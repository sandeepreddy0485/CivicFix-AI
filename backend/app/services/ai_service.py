"""
Module 3: AI-powered issue detection.

Loads a fine-tuned MobileNetV3 classifier (trained via ai-model/train.py)
if one is present at AI_MODEL_PATH. If no trained weights exist yet -- e.g.
on a fresh checkout, before you've run the training pipeline -- this falls
back to a clearly-labeled heuristic "stub" predictor so the rest of the
application (routing, severity, dashboard) is fully exercisable end to end
without requiring a trained model first.

This mirrors the project spec's point that the rule-based engines must keep
the system useful even when the AI model is unavailable or uncertain.
"""
import os
import random
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from app.core.config import settings
from app.models.complaint import IssueCategory

CLASS_NAMES = [
    IssueCategory.garbage.value,
    IssueCategory.water_leakage.value,
    IssueCategory.road_damage.value,
    IssueCategory.streetlight.value,
    IssueCategory.drainage_blockage.value,
]


@dataclass
class PredictionResult:
    category: IssueCategory
    confidence: float
    model_version: str


def _model_file_exists() -> bool:
    return os.path.isfile(settings.AI_MODEL_PATH)


@lru_cache(maxsize=1)
def _load_torch_model():
    """
    Lazily loads the trained PyTorch model. Cached so it only loads once
    per process. Returns None if torch/the weights file aren't available,
    in which case callers should use the heuristic fallback.
    """
    if not _model_file_exists():
        return None
    try:
        import torch
        from torchvision import models

        model = models.mobilenet_v3_small(weights=None)
        in_features = model.classifier[-1].in_features
        import torch.nn as nn
        model.classifier[-1] = nn.Linear(in_features, len(CLASS_NAMES))

        state_dict = torch.load(settings.AI_MODEL_PATH, map_location="cpu")
        model.load_state_dict(state_dict)
        model.eval()
        return model
    except Exception:
        # Any failure (missing torch, corrupt checkpoint, version mismatch)
        # degrades gracefully to the heuristic fallback rather than crashing
        # complaint submission.
        return None


def _predict_with_torch(model, image_path: str) -> PredictionResult:
    import torch
    from torchvision import transforms
    from PIL import Image

    preprocess = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    image = Image.open(image_path).convert("RGB")
    tensor = preprocess(image).unsqueeze(0)

    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0]
        confidence, idx = torch.max(probs, dim=0)

    category = IssueCategory(CLASS_NAMES[int(idx)])
    return PredictionResult(
        category=category,
        confidence=float(confidence),
        model_version="mobilenet_v3_small-finetuned-v1",
    )


def _predict_with_fallback(filename: str, category_hint: Optional[IssueCategory]) -> PredictionResult:
    """
    Heuristic stand-in used when no trained model is available yet.
    Looks for an obvious keyword in the filename (useful for demos/testing),
    otherwise respects a citizen-provided category hint, otherwise picks a
    low-confidence random category so the complaint is still routed and the
    UI clearly shows this came from the fallback, not a trained model.
    """
    lowered = filename.lower()
    keyword_map = {
        "garbage": IssueCategory.garbage,
        "trash": IssueCategory.garbage,
        "waste": IssueCategory.garbage,
        "water": IssueCategory.water_leakage,
        "leak": IssueCategory.water_leakage,
        "pothole": IssueCategory.road_damage,
        "road": IssueCategory.road_damage,
        "crack": IssueCategory.road_damage,
        "light": IssueCategory.streetlight,
        "lamp": IssueCategory.streetlight,
        "drain": IssueCategory.drainage_blockage,
        "sewage": IssueCategory.drainage_blockage,
    }
    for keyword, category in keyword_map.items():
        if keyword in lowered:
            return PredictionResult(category=category, confidence=0.6, model_version="rule-based-fallback-v1")

    if category_hint:
        return PredictionResult(category=category_hint, confidence=0.5, model_version="rule-based-fallback-v1")

    # Last resort: flag as unknown rather than guessing with false confidence.
    return PredictionResult(category=IssueCategory.unknown, confidence=0.3, model_version="rule-based-fallback-v1")


def predict_issue(
    image_path: str,
    category_hint: Optional[IssueCategory] = None,
    filename: Optional[str] = None,
) -> PredictionResult:
    """
    Main entry point used by the complaints API. Tries the trained model
    first; falls back to the heuristic stub if unavailable.
    """
    model = _load_torch_model()
    if model is not None:
        try:
            return _predict_with_torch(model, image_path)
        except Exception:
            pass  # fall through to heuristic fallback below

    return _predict_with_fallback(filename or os.path.basename(image_path), category_hint)
