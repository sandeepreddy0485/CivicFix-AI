# Dataset

This folder is intentionally empty in the repo (no image data is included).
Populate it yourself before running `train.py`, using the layout below.

## Required structure

```
dataset/
├── train/
│   ├── garbage/
│   ├── water_leakage/
│   ├── road_damage/
│   ├── streetlight/
│   └── drainage_blockage/
├── val/
│   ├── garbage/
│   ├── water_leakage/
│   ├── road_damage/
│   ├── streetlight/
│   └── drainage_blockage/
└── test/
    ├── garbage/
    ├── water_leakage/
    ├── road_damage/
    ├── streetlight/
    └── drainage_blockage/
```

Folder names must match exactly (they become the class labels). A rough split
of 70% train / 15% val / 15% test per class is a reasonable starting point.

## Suggested sources (per project spec section 8)

- **Garbage**: Kaggle civic waste / garbage classification datasets.
- **Road damage**: RDD2022 (Road Damage Dataset 2022).
- **Streetlights / water leakage / drainage**: harder to find ready-made,
  self-collected photos are suggested; Roboflow Universe is worth searching
  too.

Before using any dataset, check:
1. Its license permits your intended use (including commercial/portfolio use).
2. Image quality is reasonable (the model is as good as its training data).
3. Class balance — wildly uneven class counts will bias predictions. If one
   class has far fewer images, consider augmentation (already partially
   applied in `train.py`) or sourcing more examples.

## Verifying your dataset before training

```bash
find dataset/train -type f | wc -l   # total training images
for d in dataset/train/*/; do echo "$d: $(ls "$d" | wc -l)"; done
```
