# CivicFix AI — System Architecture

## Overview

CivicFix AI follows a three-layer architecture, chosen deliberately for
simplicity over a microservices approach — appropriate for an MVP/portfolio
project where a single FastAPI backend keeps deployment, debugging, and
development overhead low.

```
┌─────────────────────────────────────────────┐
│              Presentation Layer              │
│   React Citizen UI    │   React Admin UI     │
└───────────────────┬───────────────────────────┘
                     │ REST (JSON + multipart)
┌────────────────────▼──────────────────────────┐
│              Application Layer                │
│  FastAPI: auth, complaints, AI inference,      │
│  severity scoring, department routing          │
└────────────────────┬──────────────────────────┘
                      │ SQLAlchemy ORM
┌─────────────────────▼─────────────────────────┐
│                 Data Layer                     │
│   PostgreSQL (or SQLite in dev)                │
│   Local disk / Cloudinary for images           │
└─────────────────────────────────────────────────┘
```

## Request flow: submitting a complaint

1. Citizen fills out the **Report Issue** form (photo + optional description
   + GPS) in the React frontend.
2. Frontend sends a single `multipart/form-data` POST to
   `/api/complaints`.
3. FastAPI validates the authenticated user and the uploaded file
   (type/size), then saves the image to disk (`UPLOAD_DIR`).
4. `ai_service.predict_issue()` runs the uploaded image through either:
   - a fine-tuned MobileNetV3 classifier, if `AI_MODEL_PATH` points to
     trained weights, or
   - a heuristic rule-based fallback, if no trained model is present yet.
5. `severity_service.assess_severity()` combines the predicted category,
   AI confidence, and keyword signals from the description into a
   severity level (critical/high/medium/low).
6. `assignment_service.get_department_for_category()` maps the category to
   one of the five departments and creates an `Assignment` row.
7. A `StatusHistory` row is written for each lifecycle transition
   (`submitted` → `ai_analyzed` → `assigned`).
8. The full complaint record (with nested images/predictions) is returned
   to the frontend and the citizen is redirected to the complaint's
   detail/tracking page.

## Why a rule-based fallback for AI?

The spec explicitly calls for the system to **remain useful even when the
AI model is unavailable or uncertain** (see Module 5 in the project spec).
`ai_service.py` implements this directly: if no trained PyTorch weights
exist at `AI_MODEL_PATH`, or if loading/inference fails for any reason, the
service transparently falls back to a heuristic predictor rather than
failing the complaint submission. The `model_version` field on every
`AIPrediction` row always records which path produced the result
(`mobilenet_v3_small-finetuned-v1` vs. `rule-based-fallback-v1`), so this is
never silently hidden from admins reviewing predictions.

## Deployment topology (suggested)

- **Frontend** → Vercel (static build of the Vite app).
- **Backend** → Render (FastAPI + Python AI inference in the same process).
- **Database** → Supabase-managed PostgreSQL.
- **Image storage** → Cloudinary in production; local disk (`uploads/`) in
  development.

These are suggestions from the spec, not hard dependencies — the backend
works against any PostgreSQL instance (or SQLite for local dev) via the
`DATABASE_URL` environment variable, and swapping in S3-compatible storage
instead of Cloudinary only requires changes inside `_save_upload()` in
`app/api/complaints.py`.

## Future architecture notes

- **PostGIS**: for proper geospatial queries (e.g., "complaints within 500m
  of X"), add the PostGIS extension to Postgres and switch `latitude`/
  `longitude` columns to a `geography(Point)` type.
- **Object detection (YOLO)**: only needed if a future version must locate
  *multiple* issues within a single photo; the current classifier assumes
  one dominant issue per image.
- **Async task queue**: if AI inference becomes slow (e.g., larger models,
  high traffic), move `ai_service.predict_issue()` off the request/response
  cycle into a background worker (e.g., Celery + Redis) and poll for the
  result instead of blocking the complaint submission request.
