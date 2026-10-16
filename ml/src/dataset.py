import os
import torch
from torch.utils.data import Dataset, DataLoader, random_split, Subset
from torchvision import datasets, transforms
from pathlib import Path
import numpy as np

def get_data_transforms():
    train_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    val_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    return train_transforms, val_transforms

class TransformedSubset(Dataset):
    def __init__(self, subset, transform=None):
        self.subset = subset
        self.transform = transform

    def __getitem__(self, idx):
        x, y = self.subset[idx]
        if self.transform:
            x = self.transform(x)
        return x, y

    def __len__(self):
        return len(self.subset)

def prepare_dataloaders(
    data_dir="Merged Waste Classification Dataset (MWCD)/final_merged_dataset",
    batch_size=32,
    val_split=0.15,
    max_samples_per_class=None,
    num_workers=2,
    seed=42
):
    torch.manual_seed(seed)
    np.random.seed(seed)

    train_tf, val_tf = get_data_transforms()
    
    # Base dataset without transforms to PIL images
    base_dataset = datasets.ImageFolder(root=data_dir)
    classes = base_dataset.classes
    class_to_idx = base_dataset.class_to_idx
    
    # Calculate class weights for imbalanced datasets
    targets = np.array(base_dataset.targets)
    class_counts = np.bincount(targets, minlength=len(classes))
    total_samples = len(targets)
    
    # Balanced sampling or balanced weighting
    indices = []
    if max_samples_per_class:
        for cls_idx in range(len(classes)):
            cls_indices = np.where(targets == cls_idx)[0]
            selected = np.random.choice(cls_indices, min(len(cls_indices), max_samples_per_class), replace=False)
            indices.extend(selected)
        indices = np.array(indices)
    else:
        indices = np.arange(total_samples)

    np.random.shuffle(indices)
    
    val_size = int(len(indices) * val_split)
    train_indices = indices[val_size:]
    val_indices = indices[:val_size]

    train_subset = Subset(base_dataset, train_indices)
    val_subset = Subset(base_dataset, val_indices)

    train_dataset = TransformedSubset(train_subset, transform=train_tf)
    val_dataset = TransformedSubset(val_subset, transform=val_tf)

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=False
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=False
    )

    # Class weights for loss
    class_weights = total_samples / (len(classes) * np.maximum(class_counts, 1).astype(float))
    weights_tensor = torch.tensor(class_weights, dtype=torch.float32)

    return train_loader, val_loader, classes, class_to_idx, weights_tensor
