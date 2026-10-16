import os
import sys
import json
from pathlib import Path
from PIL import Image

def inspect_dataset(dataset_dir="Merged Waste Classification Dataset (MWCD)/final_merged_dataset", output_json="ml/dataset_summary.json"):
    root_path = Path(dataset_dir).resolve()
    if not root_path.exists():
        print(f"Error: Dataset directory not found at {root_path}")
        sys.exit(1)

    print(f"Inspecting dataset at: {root_path}")
    
    classes = sorted([d.name for d in root_path.iterdir() if d.is_dir() and not d.name.startswith('.')])
    summary = {
        "dataset_name": "Merged Waste Classification Dataset (MWCD)",
        "dataset_path": str(root_path),
        "total_classes": len(classes),
        "classes": classes,
        "class_counts": {},
        "valid_images": 0,
        "corrupted_images": 0,
        "sample_images": {}
    }

    supported_exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    total_images = 0

    for cls in classes:
        cls_dir = root_path / cls
        files = [f for f in cls_dir.iterdir() if f.is_file() and f.suffix.lower() in supported_exts]
        count = len(files)
        summary["class_counts"][cls] = count
        total_images += count
        
        # Pick 3 representative sample files
        samples = [str(f.relative_to(Path.cwd())) for f in files[:3]]
        summary["sample_images"][cls] = samples
        print(f"  - Class '{cls}': {count} images")

    summary["total_images"] = total_images
    print(f"\nTotal classes: {len(classes)}, Total images: {total_images}")

    # Save summary
    out_path = Path(output_json)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"Dataset manifest successfully saved to {out_path}")
    return summary

if __name__ == "__main__":
    inspect_dataset()
