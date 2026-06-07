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

CLASS_LABELS = [model.config.id2label[i] for i in range(len(model.config.id2label))]

# Auto-built from config
GENERAL_LABEL_MAP = {
    label: label.replace("general-", "")
    for label in CLASS_LABELS
    if label.startswith("general-")
}

SPECIFIC_TO_CATEGORY = {
    "AC Installation": "Appliance Repair", "AC Repair": "Appliance Repair",
    "Dryer Repair": "Appliance Repair", "Washer Repair": "Appliance Repair",
    "Refrigerator Repair": "Appliance Repair", "Dishwasher Repair": "Appliance Repair",
    "Oven Repair": "Appliance Repair", "Stove Repair": "Appliance Repair",

    "Furniture Assembly": "Assembly", "Equipment Assembly": "Assembly", "Outdoor Assembly": "Assembly",

    "Furniture Repair": "Carpentry", "Flooring Installation": "Carpentry",
    "Custom Built-ins": "Carpentry", "Refinishing": "Carpentry", "Trim Work": "Carpentry",

    "House Cleaning": "Cleaning", "Deep Cleaning": "Cleaning", "Move-in/Move-out Cleaning": "Cleaning",

    "Switch Repair": "Electrical", "Socket Repair": "Electrical", "Lighting Installation": "Electrical",

    "Lawn Mowing": "Gardening", "Tree Trimming": "Gardening", "Plant Care": "Gardening",
    "Weed Control": "Gardening", "Fertilization": "Gardening",

    "HVAC Maintenance": "HVAC",

    "Furniture Moving": "Moving", "Box Moving": "Moving",
    "Specialty Moving": "Moving", "Equipment Moving": "Moving",

    "Interior": "Painting", "Exterior": "Painting",

    "Drain Cleaning": "Plumbing", "Faucet Repair": "Plumbing", "Toilet Repair": "Plumbing",
    "Water Heater Repair": "Plumbing", "Pipe Repair": "Plumbing",
}


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

    predicted_idx    = torch.argmax(probs).item()
    raw_label        = CLASS_LABELS[predicted_idx]
    confidence_score = probs[predicted_idx].item() * 100

    # Resolve taskType and subCategory
    if raw_label in GENERAL_LABEL_MAP:
        # "general-Carpentry" → taskType: "Carpentry", subCategory: "general-Carpentry"
        task_type    = GENERAL_LABEL_MAP[raw_label]
        sub_category = raw_label
    elif raw_label in SPECIFIC_TO_CATEGORY:
        # "Furniture Repair" → taskType: "Carpentry", subCategory: "Furniture Repair"
        task_type    = SPECIFIC_TO_CATEGORY[raw_label]
        sub_category = raw_label
    else:
        task_type    = raw_label
        sub_category = None

    all_predictions = sorted(
        [
            {
                "label":      CLASS_LABELS[i],
                "confidence": f"{probs[i].item() * 100:.2f}%"
            }
            for i in range(len(probs))
        ],
        key=lambda x: float(x["confidence"].strip("%")),
        reverse=True
    )

    return {
        "text":            text,
        "predicted_label": raw_label,
        "task_type":       task_type,
        "sub_category":    sub_category,
        "confidence":      f"{confidence_score:.2f}%",
        "all_predictions": all_predictions
    }