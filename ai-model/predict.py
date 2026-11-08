"""
predict.py -- Quick CLI to test the trained model on a single image, without
spinning up the full backend. Useful during/after training.

Usage:
    python predict.py --image path/to/photo.jpg --weights models/civic_classifier.pt
"""
import argparse

import torch
from torchvision import transforms
from PIL import Image

from train import build_model, CLASS_NAMES


def main():
    parser = argparse.ArgumentParser(description="Run a single-image prediction")
    parser.add_argument("--image", required=True)
    parser.add_argument("--weights", default="models/civic_classifier.pt")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = build_model().to(device)
    model.load_state_dict(torch.load(args.weights, map_location=device))
    model.eval()

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    image = Image.open(args.image).convert("RGB")
    tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0]
        confidence, idx = torch.max(probs, dim=0)

    print(f"Predicted category: {CLASS_NAMES[int(idx)]}")
    print(f"Confidence: {float(confidence) * 100:.1f}%")
    print("\nAll class probabilities:")
    for name, p in zip(CLASS_NAMES, probs.tolist()):
        print(f"  {name:<20} {p * 100:.1f}%")


if __name__ == "__main__":
    main()
