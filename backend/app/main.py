"""
CivicFix AI backend entrypoint.

Run locally with:
    uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.database import Base, engine, SessionLocal, ensure_schema_compatibility
from app.models.department import Department
from app.api import auth, users, complaints, departments, admin, notifications
from app.models.complaint import Complaint, ComplaintStatus, Severity
from app.services.sla_service import calculate_due_at, as_utc
from datetime import datetime, timezone

# Single FastAPI backend per the spec's architecture decision -- no
# microservices for v1. AI inference runs as a Python module (ai_service)
# called directly from the complaints router.

Base.metadata.create_all(bind=engine)
ensure_schema_compatibility()

with SessionLocal() as migration_db:
    for existing_complaint in migration_db.query(Complaint).filter(Complaint.due_at.is_(None)).all():
        existing_complaint.due_at = calculate_due_at(
            as_utc(existing_complaint.created_at or datetime.now(timezone.utc)),
            existing_complaint.severity or Severity.medium,
        )
    migration_db.commit()

app = FastAPI(
    title="CivicFix AI API",
    description="AI-powered civic issue reporting and management system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images (dev convenience; use Cloudinary/S3-style storage in production)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(complaints.router)
app.include_router(notifications.router)
app.include_router(departments.router)
app.include_router(admin.router)


DEFAULT_DEPARTMENTS = [
    ("Sanitation", "Handles garbage accumulation and waste management complaints."),
    ("Water Works", "Handles water leakage and supply issues."),
    ("Roads and Infrastructure", "Handles potholes and road damage."),
    ("Electrical", "Handles broken or malfunctioning streetlights."),
    ("Drainage", "Handles drainage blockages and related flooding risks."),
]


@app.on_event("startup")
def seed_departments():
    """Idempotently seed the five departments from the project scope (section 4)."""
    db = SessionLocal()
    try:
        existing_names = {d.department_name for d in db.query(Department).all()}
        for name, description in DEFAULT_DEPARTMENTS:
            if name not in existing_names:
                db.add(Department(department_name=name, description=description))
        db.commit()
    finally:
        db.close()


@app.get("/")
def root():
    return {"status": "ok", "service": "CivicFix AI API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
