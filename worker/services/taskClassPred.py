import torch
from pathlib import Path
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODEL_PATH = BASE_DIR / "worker" / "model" / "task_classification"

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_PATH)
model = DistilBertForSequenceClassification.from_pretrained(MODEL_PATH)
model.to(device)
model.eval()

CLASS_LABELS = [
    "AC Installation", "AC Repair", "Box Moving", "Custom Built-ins",
    "Deep Cleaning", "Dishwasher Repair", "Drain Cleaning", "Dryer Repair",
    "Equipment Assembly", "Equipment Moving", "Exterior", "Faucet Repair",
    "Fertilization", "Flooring Installation", "Furniture Assembly", "Furniture Moving",
    "Furniture Repair", "HVAC Maintenance", "House Cleaning", "Interior",
    "Lawn Mowing", "Lighting Installation", "Move-in/Move-out Cleaning",
    "Outdoor Assembly", "Oven Repair", "Pipe Repair", "Plant Care", "Refinishing",
    "Refrigerator Repair", "Socket Repair", "Specialty Moving", "Stove Repair",
    "Switch Repair", "Toilet Repair", "Tree Trimming", "Trim Work",
    "Washer Repair", "Water Heater Repair", "Weed Control", "Plumbing"
]

def run_prediction(text: str) -> dict:
    tokens = tokenizer(
        text,
        max_length=128,
        padding="max_length",
        truncation=True,
        return_tensors="pt"
    )
    tokens = {k: v.to(device) for k, v in tokens.items()}

    with torch.no_grad():
        outputs = model(**tokens)
        probs = torch.softmax(outputs.logits, dim=-1)[0]

    predicted_idx = torch.argmax(probs).item()
    predicted_label = CLASS_LABELS[predicted_idx]
    confidence_score = probs[predicted_idx].item() * 100

    all_predictions = sorted(
        [
            {
                "label": CLASS_LABELS[i],
                "confidence": f"{probs[i].item() * 100:.2f}%"
            }
            for i in range(len(probs))
        ],
        key=lambda x: float(x["confidence"].strip("%")),
        reverse=True
    )

    return {
        "text": text,
        "predicted_label": predicted_label,
        "confidence": f"{confidence_score:.2f}%",
        "all_predictions": all_predictions
    }