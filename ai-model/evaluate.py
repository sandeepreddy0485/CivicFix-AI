"""
evaluate.py -- Evaluate the trained classifier on a held-out test set.

Reports accuracy, precision, recall, F1-score (per-class and macro-averaged)
and a confusion matrix, per section 8 of the project spec. Do not quote an
accuracy figure publicly until you've actually run this against real data.

Expected layout:
    dataset/test/<class_name>/*.jpg   (same five classes as train.py)

Usage:
    python evaluate.py --data-dir dataset --weights models/civic_classifier.pt
"""
import argparse

import torch
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from sklearn.metrics import classification_report, confusion_matrix

from train import build_model, CLASS_NAMES


def main():
    parser = argparse.ArgumentParser(description="Evaluate the CivicFix AI issue classifier")
    parser.add_argument("--data-dir", default="dataset")
    parser.add_argument("--weights", default="models/civic_classifier.pt")
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    test_dir = f"{args.data_dir}/test"
    test_dataset = datasets.ImageFolder(test_dir, transform=transform)
    if test_dataset.classes != CLASS_NAMES:
        raise ValueError(f"Test set classes {test_dataset.classes} do not match expected {CLASS_NAMES}")

    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)

    model = build_model().to(device)
    model.load_state_dict(torch.load(args.weights, map_location=device))
    model.eval()

    all_preds, all_labels = [], []
    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            _, preds = torch.max(outputs, 1)
            all_preds.extend(preds.cpu().tolist())
            all_labels.extend(labels.tolist())

    print("Classification report (precision / recall / F1 per class + macro avg):\n")
    print(classification_report(all_labels, all_preds, target_names=CLASS_NAMES, digits=4))

    print("Confusion matrix (rows = actual, columns = predicted):")
    cm = confusion_matrix(all_labels, all_preds)
    header = "          " + " ".join(f"{c[:8]:>8}" for c in CLASS_NAMES)
    print(header)
    for class_name, row in zip(CLASS_NAMES, cm):
        print(f"{class_name[:10]:<10}" + " ".join(f"{v:>8}" for v in row))


if __name__ == "__main__":
    main()
