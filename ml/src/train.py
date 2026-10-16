import os
import sys
import time
import json
import argparse
from pathlib import Path
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, f1_score

from model import WasteClassifier
from dataset import prepare_dataloaders

def select_device():
    if torch.backends.mps.is_available():
        device = torch.device("mps")
        print("Using Apple Silicon Metal Performance Shaders (MPS) GPU acceleration.")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
        print("Using NVIDIA CUDA GPU acceleration.")
    else:
        device = torch.device("cpu")
        print("Using multi-threaded CPU.")
    return device

def train_epoch(model, loader, criterion, optimizer, device):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for i, (images, labels) in enumerate(loader):
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = outputs.max(1)
        correct += preds.eq(labels).sum().item()
        total += labels.size(0)

        if (i + 1) % 25 == 0 or (i + 1) == len(loader):
            print(f"  Step [{i+1}/{len(loader)}] Loss: {loss.item():.4f} Acc: {correct/total*100:.2f}%")

    epoch_loss = running_loss / total
    epoch_acc = correct / total
    return epoch_loss, epoch_acc

def evaluate(model, loader, criterion, device):
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)

            running_loss += loss.item() * images.size(0)
            _, preds = outputs.max(1)
            correct += preds.eq(labels).sum().item()
            total += labels.size(0)

            all_preds.extend(preds.cpu().numpy())
            all_targets.extend(labels.cpu().numpy())

    val_loss = running_loss / total
    val_acc = correct / total
    return val_loss, val_acc, np.array(all_preds), np.array(all_targets)

def train(
    data_dir="Merged Waste Classification Dataset (MWCD)/final_merged_dataset",
    output_dir="ml/models",
    epochs=5,
    batch_size=32,
    max_samples_per_class=600,
    learning_rate=1e-3,
    val_split=0.15,
    seed=42
):
    start_time = time.time()
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    device = select_device()

    print(f"\n--- Loading Dataset from: {data_dir} ---")
    train_loader, val_loader, classes, class_to_idx, class_weights = prepare_dataloaders(
        data_dir=data_dir,
        batch_size=batch_size,
        val_split=val_split,
        max_samples_per_class=max_samples_per_class,
        num_workers=0, # macOS fork safety
        seed=seed
    )

    print(f"Classes ({len(classes)}): {classes}")
    print(f"Training samples: {len(train_loader.dataset)}, Validation samples: {len(val_loader.dataset)}")
    print(f"Batch size: {batch_size}, Device: {device}")

    # Model definition
    model = WasteClassifier(num_classes=len(classes), pretrained=True)
    model.to(device)

    # Loss with class weights
    criterion = nn.CrossEntropyLoss(weight=class_weights.to(device))

    # Differential learning rate: lower for pretrained backbone, higher for custom head
    backbone_params = [p for n, p in model.named_parameters() if 'classifier' not in n]
    classifier_params = [p for n, p in model.named_parameters() if 'classifier' in n]

    optimizer = optim.AdamW([
        {'params': backbone_params, 'lr': learning_rate * 0.1},
        {'params': classifier_params, 'lr': learning_rate}
    ], weight_decay=1e-4)

    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    best_val_acc = 0.0
    best_f1 = 0.0
    history = {
        "train_loss": [],
        "train_acc": [],
        "val_loss": [],
        "val_acc": [],
        "val_f1": []
    }

    print("\n--- Commencing Model Training ---")
    for epoch in range(1, epochs + 1):
        epoch_start = time.time()
        print(f"\nEpoch [{epoch}/{epochs}]")
        
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, preds, targets = evaluate(model, val_loader, criterion, device)
        scheduler.step()

        macro_f1 = f1_score(targets, preds, average='macro', zero_division=0)
        weighted_f1 = f1_score(targets, preds, average='weighted', zero_division=0)

        history["train_loss"].append(train_loss)
        history["train_acc"].append(train_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)
        history["val_f1"].append(macro_f1)

        epoch_duration = time.time() - epoch_start
        print(f"Epoch {epoch} Result ({epoch_duration:.1f}s) - "
              f"Train Loss: {train_loss:.4f}, Train Acc: {train_acc*100:.2f}% | "
              f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc*100:.2f}%, Val F1: {macro_f1:.4f}")

        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_f1 = macro_f1
            best_path = out_dir / "best_waste_classifier.pth"
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_acc': val_acc,
                'val_f1': macro_f1,
                'classes': classes,
                'class_to_idx': class_to_idx
            }, best_path)
            print(f"  >>> Best model checkpoint saved to: {best_path} (Acc: {val_acc*100:.2f}%)")

    total_time = time.time() - start_time
    print(f"\n--- Training Completed in {total_time/60:.2f} minutes ---")
    print(f"Best Validation Accuracy: {best_val_acc*100:.2f}%, Best F1: {best_f1:.4f}")

    # Final detailed evaluation with the best weights
    best_checkpoint = torch.load(out_dir / "best_waste_classifier.pth", map_location=device, weights_only=False)
    model.load_state_dict(best_checkpoint['model_state_dict'])
    _, final_acc, final_preds, final_targets = evaluate(model, val_loader, criterion, device)

    report_str = classification_report(final_targets, final_preds, target_names=classes, digits=4, zero_division=0)
    report_dict = classification_report(final_targets, final_preds, target_names=classes, output_dict=True, zero_division=0)
    conf_mat = confusion_matrix(final_targets, final_preds).tolist()

    print("\nClassification Report:")
    print(report_str)

    # Save classes.json
    with open(out_dir / "classes.json", "w") as f:
        json.dump(classes, f, indent=2)

    # Save metadata & metrics
    config = {
        "model_name": "MobileNetV3-WasteClassifier-MWCD",
        "dataset_name": "Merged Waste Classification Dataset (MWCD)",
        "num_classes": len(classes),
        "classes": classes,
        "input_resolution": [224, 224],
        "normalization": {
            "mean": [0.485, 0.456, 0.406],
            "std": [0.229, 0.224, 0.225]
        },
        "training_epochs": epochs,
        "training_duration_seconds": round(total_time, 2),
        "best_val_accuracy": round(best_val_acc, 4),
        "best_val_f1": round(best_f1, 4),
        "device_used": str(device),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

    with open(out_dir / "model_config.json", "w") as f:
        json.dump(config, f, indent=2)

    metrics = {
        "history": history,
        "classification_report": report_dict,
        "confusion_matrix": conf_mat,
        "classes": classes
    }

    with open(out_dir / "training_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nAll artifacts successfully saved to: {out_dir}")
    return config, metrics

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train custom waste classification vision model on MWCD")
    parser.add_argument("--epochs", type=int, default=5, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--samples-per-class", type=int, default=500, help="Max samples per class (None for full)")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    args = parser.parse_args()

    train(
        epochs=args.epochs,
        batch_size=args.batch_size,
        max_samples_per_class=args.samples_per_class if args.samples_per_class > 0 else None,
        learning_rate=args.lr
    )
