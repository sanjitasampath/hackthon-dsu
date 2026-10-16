import sys
import os
import json
import time
import base64
import io
import argparse
from pathlib import Path
from PIL import Image
import torch
from torchvision import transforms

from model import WasteClassifier

# Campus disposal rules per class
CAMPUS_DISPOSAL_RULES = {
    "battery": {
        "campus_category": "other_uncertain",
        "bin_color": "Red / Hazardous",
        "guideline": "E-Waste / Battery Drop-Off Station: Hazardous chemical hazard. Never discard in standard general or recycling bins.",
        "description": "Spent battery cell or electronic accumulator requiring specialized hazardous material disposal."
    },
    "cardboard": {
        "campus_category": "paper_cardboard",
        "bin_color": "Blue Bin",
        "guideline": "Blue Bin: Clean Paper & Cardboard. Flatten boxes and remove packaging tapes before disposal.",
        "description": "Corrugated cardboard packaging or cardboard material suitable for recycling."
    },
    "glass": {
        "campus_category": "glass",
        "bin_color": "Teal Bin",
        "guideline": "Teal Bin: Glass Recyclables. Empty liquids and rinse containers. Do not place ceramics or pyrex.",
        "description": "Glass bottle, jar, or container."
    },
    "metal": {
        "campus_category": "metal",
        "bin_color": "Grey Bin",
        "guideline": "Grey Bin: Metal & Aluminium. Rinse drink cans and food tins clean before depositing.",
        "description": "Aluminium beverage can, steel tin, or metallic item."
    },
    "organic": {
        "campus_category": "organic",
        "bin_color": "Green Bin",
        "guideline": "Green Bin: Compostable Organic Waste. Food scraps, fruit peels, and biodegradable kitchen waste only.",
        "description": "Compostable organic matter or food scrap."
    },
    "paper": {
        "campus_category": "paper_cardboard",
        "bin_color": "Blue Bin",
        "guideline": "Blue Bin: Dry Paper. Clean office paper, newspapers, notebooks, and brochures. Keep dry.",
        "description": "Office paper, printed document, or notebook sheet."
    },
    "plastic": {
        "campus_category": "plastic",
        "bin_color": "Yellow Bin",
        "guideline": "Yellow Bin: Plastics. Empty and rinse PET/HDPE bottles and rigid plastics. Compress bottles to save space.",
        "description": "Plastic bottle, container, or polymer packaging."
    },
    "textile": {
        "campus_category": "other_uncertain",
        "bin_color": "Purple / Donation Bin",
        "guideline": "Campus Textile Donation Bank: Clean clothes, fabrics, and dry garments should be deposited in textile bank.",
        "description": "Fabric, garment, or cloth textile item."
    },
    "trash": {
        "campus_category": "other_uncertain",
        "bin_color": "Black Bin",
        "guideline": "Black Bin: General Landfill. Non-recyclable mixed solid waste, soiled food wrappers, and contaminated items.",
        "description": "Non-recyclable general solid landfill waste."
    }
}

def load_inference_model(model_dir="ml/models"):
    model_dir = Path(model_dir)
    checkpoint_path = model_dir / "best_waste_classifier.pth"
    classes_path = model_dir / "classes.json"

    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Trained model checkpoint not found at {checkpoint_path}")

    with open(classes_path, "r") as f:
        classes = json.load(f)

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    model = WasteClassifier(num_classes=len(classes), pretrained=False)
    
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    state_dict = checkpoint.get('model_state_dict', checkpoint)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    return model, classes, transform, device

def predict_image(image_input, model, classes, transform, device):
    """
    image_input: PIL Image, filepath string, or base64 data string
    """
    start_time = time.time()
    
    if isinstance(image_input, Image.Image):
        img = image_input.convert("RGB")
    elif isinstance(image_input, str):
        if image_input.startswith("data:image") or len(image_input) > 500:
            clean_b64 = image_input.split(",")[-1]
            img_bytes = base64.b64decode(clean_b64)
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        elif os.path.exists(image_input):
            img = Image.open(image_input).convert("RGB")
        else:
            clean_b64 = image_input.strip()
            img_bytes = base64.b64decode(clean_b64)
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    else:
        raise ValueError("Unsupported image input type")

    tensor = transform(img).unsqueeze(0).to(device)
    
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()

    top_idx = int(probs.argmax())
    predicted_class = classes[top_idx]
    confidence = float(probs[top_idx])
    inference_time_ms = round((time.time() - start_time) * 1000, 2)

    class_probs = {cls: round(float(prob), 4) for cls, prob in zip(classes, probs)}
    
    disposal_info = CAMPUS_DISPOSAL_RULES.get(predicted_class, {
        "campus_category": "other_uncertain",
        "bin_color": "Landfill / Review",
        "guideline": "Inspect item visually. Place in appropriate recycling stream or general waste.",
        "description": f"{predicted_class.capitalize()} waste item"
    })

    return {
        "success": True,
        "predicted_class": predicted_class,
        "campus_category": disposal_info["campus_category"],
        "bin_color": disposal_info["bin_color"],
        "confidence": round(confidence, 4),
        "review_required": bool(confidence < 0.65),
        "disposal_guideline": disposal_info["guideline"],
        "item_description": disposal_info["description"],
        "class_probabilities": class_probs,
        "inference_time_ms": inference_time_ms,
        "model_name": "MobileNetV3-WasteClassifier-MWCD",
        "dataset_name": "Merged Waste Classification Dataset (MWCD)"
    }

def main():
    parser = argparse.ArgumentParser(description="Predict waste class from image")
    parser.add_argument("--image-path", type=str, help="Path to waste image")
    parser.add_argument("--base64", type=str, help="Base64 encoded image string")
    parser.add_argument("--stdin", action="store_true", help="Read base64 or path from stdin")
    parser.add_argument("--model-dir", type=str, default="ml/models", help="Directory containing model checkpoint")
    args = parser.parse_args()

    image_source = None
    if args.stdin:
        image_source = sys.stdin.read().strip()
    elif args.base64:
        image_source = args.base64
    elif args.image_path:
        image_source = args.image_path

    if not image_source:
        print(json.dumps({"success": False, "error": "No image input provided"}))
        sys.exit(1)

    try:
        model, classes, transform, device = load_inference_model(args.model_dir)
        result = predict_image(image_source, model, classes, transform, device)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
