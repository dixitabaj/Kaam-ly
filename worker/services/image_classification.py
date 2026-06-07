# services/image_classification.py
# torch and the CNN model are loaded LAZILY — only on the first call to
# classify_image(). This keeps server startup fast (~2s instead of 30s+).

import os
import numpy as np
from PIL import Image, ImageStat

MODEL_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../model/ml_models/image_classification.pth")
)

CLASS_NAMES = {
    0: "Appliance Repair",
    1: "Carpentry",
    2: "Electrical",
    3: "Gardening",
    4: "Moving",
    5: "Plumbing"
}

# ── Lazy-loaded globals ───────────────────────────────────────────────────────
# None until the first request hits classify_image()
_model      = None
_preprocess = None
_torch      = None
_F          = None


def _load_model():
    """
    Load torch + CNN model on first use.
    Subsequent calls return immediately because _model is already set.
    """
    global _model, _preprocess, _torch, _F

    if _model is not None:
        return  # already loaded — do nothing

    print("⏳ Loading image classification model (first request)...")

    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torchvision import transforms

    _torch = torch
    _F     = F

    # ── Define model architecture ─────────────────────────────────────────────
    class ServiceCNN(nn.Module):
        def __init__(self, num_classes):
            super(ServiceCNN, self).__init__()
            self.features = nn.Sequential(
                nn.Conv2d(3, 32, kernel_size=3, padding=1),
                nn.BatchNorm2d(32),
                nn.ReLU(),
                nn.MaxPool2d(2),
                nn.Conv2d(32, 64, kernel_size=3, padding=1),
                nn.BatchNorm2d(64),
                nn.ReLU(),
                nn.MaxPool2d(2),
                nn.Conv2d(64, 128, kernel_size=3, padding=1),
                nn.BatchNorm2d(128),
                nn.ReLU(),
                nn.MaxPool2d(2),
                nn.Conv2d(128, 256, kernel_size=3, padding=1),
                nn.BatchNorm2d(256),
                nn.ReLU(),
                nn.MaxPool2d(2),
            )
            self.classifier = nn.Sequential(
                nn.Flatten(),
                nn.Linear(256 * 8 * 8, 512),
                nn.ReLU(),
                nn.Dropout(0.5),
                nn.Linear(512, num_classes)
            )

        def forward(self, x):
            x = self.features(x)
            return self.classifier(x)

    # ── Load weights ──────────────────────────────────────────────────────────
    state_dict  = torch.load(MODEL_PATH, map_location=torch.device("cpu"))
    num_classes = state_dict["classifier.4.bias"].shape[0]

    m = ServiceCNN(num_classes=num_classes)
    m.load_state_dict(state_dict)
    m.eval()

    _model = m

    _preprocess = transforms.Compose([
        transforms.Resize((128, 128)),
        transforms.ToTensor(),
    ])

    print("✅ Image classification model loaded")


# ── Image quality check (no torch needed — pure numpy/PIL) ───────────────────

def detect_simple_image(image):
    """Reject logos, graphics, or overly simple images before running CNN."""
    try:
        img_array = np.array(image)
        gray      = np.dot(img_array[..., :3], [0.299, 0.587, 0.114])
        variance  = np.var(gray)

        from scipy import ndimage
        edges_x      = ndimage.sobel(gray, axis=0)
        edges_y      = ndimage.sobel(gray, axis=1)
        edges        = np.hypot(edges_x, edges_y)
        edge_density = np.mean(edges > 10)

        unique_colors   = len(np.unique(img_array.reshape(-1, 3), axis=0))
        total_pixels    = img_array.shape[0] * img_array.shape[1]
        color_diversity = unique_colors / total_pixels
        contrast        = gray.max() - gray.min()

        if variance < 500:
            return True, f"Low image complexity (variance: {variance:.0f})"
        if edge_density < 0.05:
            return True, f"Too few edges detected (density: {edge_density:.3f})"
        if color_diversity < 0.01:
            return True, f"Limited color palette (diversity: {color_diversity:.3f})"
        if contrast < 50:
            return True, f"Low contrast image (contrast: {contrast:.0f})"

        return False, "Passed image validity checks"

    except Exception:
        stat      = ImageStat.Stat(image)
        variance  = sum(stat.var) / len(stat.var)
        if variance < 500:
            return True, f"Low image complexity (variance: {variance:.0f})"
        return False, "Basic checks passed"


# ── Main classify function ────────────────────────────────────────────────────

def classify_image(image_bytes):
    # Load torch + model on first call only
    _load_model()

    try:
        image = Image.open(image_bytes).convert("RGB")

        # Pre-screen for simple/logo images (no torch needed)
        is_simple, reason = detect_simple_image(image)
        if is_simple:
            return {
                "class_index":      -1,
                "class_name":       "Couldn't Classify",
                "confidence":       0.0,
                "message":          reason,
                "rejected":         True,
                "rejection_reason": "image_quality_check",
            }

        tensor = _preprocess(image).unsqueeze(0)

        with _torch.no_grad():
            TEMPERATURE  = 3.0
            outputs      = _model(tensor)
            scaled       = outputs / TEMPERATURE
            probs        = _F.softmax(scaled, dim=1)
            confidence, predicted = _torch.max(probs, 1)

            top_probs, top_indices = _torch.topk(probs, k=min(3, len(CLASS_NAMES)), dim=1)
            confidence_gap = top_probs[0][0].item() - top_probs[0][1].item()

            MIN_CONFIDENCE = 0.40
            MIN_GAP        = 0.20

            if confidence.item() < MIN_CONFIDENCE or confidence_gap < MIN_GAP:
                return {
                    "class_index":      -1,
                    "class_name":       "Couldn't Classify",
                    "confidence":       round(confidence.item(), 4),
                    "confidence_gap":   round(confidence_gap, 4),
                    "message":          "Couldn't classify this image, please use the search bar",
                    "rejected":         True,
                    "rejection_reason": "low_confidence",
                    "top_predictions":  [
                        {
                            "class_name": CLASS_NAMES.get(idx.item()),
                            "confidence": round(prob.item(), 4),
                        }
                        for prob, idx in zip(top_probs[0], top_indices[0])
                    ],
                }

        return {
            "class_index":     predicted.item(),
            "class_name":      CLASS_NAMES.get(predicted.item()),
            "confidence":      round(confidence.item(), 4),
            "confidence_gap":  round(confidence_gap, 4),
            "rejected":        False,
            "top_predictions": [
                {
                    "class_name": CLASS_NAMES.get(idx.item()),
                    "confidence": round(prob.item(), 4),
                }
                for prob, idx in zip(top_probs[0][:3], top_indices[0][:3])
            ],
        }

    except Exception as e:
        print(f"Error classifying image: {e}")
        raise