"""
train.py -- Fine-tune a pretrained MobileNetV3-Small on civic issue images.

Section 8 of the project spec: transfer learning rather than training from
scratch, five-class classifier (garbage, water_leakage, road_damage,
streetlight, drainage_blockage).

Expected dataset layout (standard torchvision ImageFolder format):

    dataset/
        train/
            garbage/*.jpg
            water_leakage/*.jpg
            road_damage/*.jpg
            streetlight/*.jpg
            drainage_blockage/*.jpg
        val/
            garbage/*.jpg
            ... (same five class folders)

Usage:
    python train.py --data-dir dataset --epochs 15 --batch-size 32

Output:
    models/civic_classifier.pt  (state_dict, loadable by backend/app/services/ai_service.py)
    models/training_log.json
"""
import argparse
import json
import os
import time

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

CLASS_NAMES = ["garbage", "water_leakage", "road_damage", "streetlight", "drainage_blockage"]


def build_model(num_classes: int = len(CLASS_NAMES)) -> nn.Module:
    """Load a pretrained MobileNetV3-Small and replace its final layer."""
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.IMAGENET1K_V1)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_classes)
    return model


def get_dataloaders(data_dir: str, batch_size: int):
    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    train_dir = os.path.join(data_dir, "train")
    val_dir = os.path.join(data_dir, "val")
    if not os.path.isdir(train_dir) or not os.path.isdir(val_dir):
        raise FileNotFoundError(
            f"Expected '{train_dir}' and '{val_dir}' to exist with one subfolder per class "
            f"({CLASS_NAMES}). See the module docstring for the expected layout."
        )

    train_dataset = datasets.ImageFolder(train_dir, transform=train_transform)
    val_dataset = datasets.ImageFolder(val_dir, transform=val_transform)

    # Sanity-check that class folders match what the backend expects, so the
    # saved model's output indices line up with CLASS_NAMES in ai_service.py.
    if train_dataset.classes != CLASS_NAMES:
        raise ValueError(
            f"Dataset classes {train_dataset.classes} do not match expected "
            f"{CLASS_NAMES}. Rename folders or update CLASS_NAMES in both "
            f"train.py and backend/app/services/ai_service.py together."
        )

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=2)
    return train_loader, val_loader


def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    running_loss, correct, total = 0.0, 0, 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    return running_loss / total, correct / total


def validate(model, loader, criterion, device):
    model.eval()
    running_loss, correct, total = 0.0, 0, 0
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

    return running_loss / total, correct / total


def main():
    parser = argparse.ArgumentParser(description="Train the CivicFix AI issue classifier")
    parser.add_argument("--data-dir", default="dataset", help="Path to dataset/ with train/ and val/ subfolders")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--output", default="models/civic_classifier.pt")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    train_loader, val_loader = get_dataloaders(args.data_dir, args.batch_size)

    model = build_model().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    history = []
    best_val_acc = 0.0

    for epoch in range(1, args.epochs + 1):
        start = time.time()
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = validate(model, val_loader, criterion, device)
        elapsed = time.time() - start

        print(
            f"Epoch {epoch}/{args.epochs} - "
            f"train_loss={train_loss:.4f} train_acc={train_acc:.4f} "
            f"val_loss={val_loss:.4f} val_acc={val_acc:.4f} ({elapsed:.1f}s)"
        )
        history.append({
            "epoch": epoch, "train_loss": train_loss, "train_acc": train_acc,
            "val_loss": val_loss, "val_acc": val_acc,
        })

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), args.output)
            print(f"  -> New best model saved to {args.output} (val_acc={val_acc:.4f})")

    with open("models/training_log.json", "w") as f:
        json.dump({"history": history, "best_val_acc": best_val_acc, "classes": CLASS_NAMES}, f, indent=2)

    print(f"\nTraining complete. Best val accuracy: {best_val_acc:.4f}")
    print("Run evaluate.py for a full precision/recall/F1/confusion-matrix report on a held-out test set.")


if __name__ == "__main__":
    main()
