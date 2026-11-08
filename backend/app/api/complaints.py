import os
import tempfile
import uuid
import math
from io import BytesIO
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.config import settings
from app.core.deps import get_current_user, require_admin
from app.models.user import User, UserRole
from app.models.complaint import Complaint, IssueCategory, Severity, ComplaintStatus
from app.models.complaint_image import ComplaintImage, ImageType
from app.models.ai_prediction import AIPrediction
from app.models.assignment import Assignment
from app.models.status_history import StatusHistory
from app.models.notification import Notification
from app.models.complaint_confirmation import ComplaintConfirmation
from app.models.complaint_flag import ComplaintFlag
from app.models.complaint_moderation_event import ComplaintModerationEvent
from app.schemas.complaint import (
    ComplaintOut,
    ComplaintDetailOut,
    ComplaintStatusUpdate,
    SeverityOverride,
    NearbyComplaintOut,
    ConfirmationSummary,
    ComplaintFlagCreate,
    ComplaintFlagReview,
    ComplaintFlagOut,
    ComplaintFlagResult,
    ComplaintModerationUpdate,
    ComplaintModerationResult,
)
from app.services import ai_service, severity_service, assignment_service
from app.services.sla_service import as_utc, calculate_due_at

router = APIRouter(prefix="/api/complaints", tags=["complaints"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
NEARBY_RADIUS_METERS = 500
SUBMISSION_LIMIT_PER_HOUR = 5
FLAG_LIMIT_PER_DAY = 10
OPEN_STATUSES = [
    ComplaintStatus.submitted,
    ComplaintStatus.ai_analyzed,
    ComplaintStatus.assigned,
    ComplaintStatus.in_progress,
]


def _save_upload(file: UploadFile, *, needs_local_file: bool = False) -> tuple[Optional[str], str]:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    contents = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image too large")

    try:
        with Image.open(BytesIO(contents)) as image:
            image_format = image.format
            image.verify()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="Invalid image file")

    format_details = {
        "JPEG": ("image/jpeg", ".jpg"),
        "PNG": ("image/png", ".png"),
        "WEBP": ("image/webp", ".webp"),
    }
    if image_format not in format_details or format_details[image_format][0] != file.content_type:
        raise HTTPException(status_code=400, detail="Image content does not match its file type")
    ext = format_details[image_format][1]
    safe_name = f"{uuid.uuid4().hex}{ext}"

    if settings.cloudinary_configured:
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        result = cloudinary.uploader.upload(
            BytesIO(contents),
            folder="civicfix",
            public_id=os.path.splitext(safe_name)[0],
            resource_type="image",
        )
        local_path = None
        if needs_local_file:
            local_path = os.path.join(tempfile.gettempdir(), safe_name)
            with open(local_path, "wb") as image_file:
                image_file.write(contents)
        return local_path, result["secure_url"]

    dest_path = os.path.join(settings.UPLOAD_DIR, safe_name)
    with open(dest_path, "wb") as image_file:
        image_file.write(contents)
    return dest_path, f"/uploads/{safe_name}"


def _record_status_change(db: Session, complaint: Complaint, new_status: ComplaintStatus):
    old = complaint.status
    if old == new_status:
        return old
    complaint.status = new_status
    db.add(StatusHistory(complaint_id=complaint.id, old_status=old.value, new_status=new_status.value))
    return old


def _notify_owner(db: Session, complaint: Complaint, old_status, new_status: ComplaintStatus):
    db.add(Notification(
        user_id=complaint.user_id,
        complaint_id=complaint.id,
        old_status=old_status.value if old_status else None,
        new_status=new_status.value,
    ))


def _confirmation_summary(db: Session, complaint_id: int, user_id: int) -> ConfirmationSummary:
    count = db.query(func.count(ComplaintConfirmation.id)).filter(
        ComplaintConfirmation.complaint_id == complaint_id
    ).scalar() or 0
    confirmed = db.query(ComplaintConfirmation.id).filter(
        ComplaintConfirmation.complaint_id == complaint_id,
        ComplaintConfirmation.user_id == user_id,
    ).first() is not None
    return ConfirmationSummary(confirmation_count=count, confirmed_by_user=confirmed)


def _distance_meters(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    earth_radius_meters = 6_371_000
    lat_a = math.radians(latitude_a)
    lat_b = math.radians(latitude_b)
    lat_delta = math.radians(latitude_b - latitude_a)
    lon_delta = math.radians(longitude_b - longitude_a)
    haversine = (
        math.sin(lat_delta / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin(lon_delta / 2) ** 2
    )
    return earth_radius_meters * 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))


@router.post("", response_model=ComplaintDetailOut, status_code=status.HTTP_201_CREATED)
def submit_complaint(
    description: Optional[str] = Form(None),
    locality: Optional[str] = Form(None, max_length=160),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    category_hint: Optional[IssueCategory] = Form(None),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Module 2 + 3 + 4 + 5 combined: a citizen submits a complaint with a photo,
    the AI model classifies it, severity is scored, and a department is
    auto-assigned -- all in one request, matching the spec's data flow.
    """
    # Basic GPS sanity validation (module 13: avoid trusting GPS blindly).
    if latitude is not None and not (-90 <= latitude <= 90):
        raise HTTPException(status_code=400, detail="Invalid latitude")
    if longitude is not None and not (-180 <= longitude <= 180):
        raise HTTPException(status_code=400, detail="Invalid longitude")

    now = datetime.now(timezone.utc)
    submission_cutoff = now - timedelta(hours=1)
    recent_count = db.query(func.count(Complaint.id)).filter(
        Complaint.user_id == current_user.id,
        Complaint.created_at >= submission_cutoff,
    ).scalar() or 0
    if recent_count >= SUBMISSION_LIMIT_PER_HOUR:
        oldest_submission = db.query(Complaint.created_at).filter(
            Complaint.user_id == current_user.id,
            Complaint.created_at >= submission_cutoff,
        ).order_by(Complaint.created_at.asc()).first()
        retry_after = 3600
        if oldest_submission:
            oldest_created_at = as_utc(oldest_submission[0])
            retry_after = max(1, int((oldest_created_at + timedelta(hours=1) - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Report limit reached. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    image_path, image_url = _save_upload(image, needs_local_file=True)
    if image_path is None:
        raise RuntimeError("Image storage did not provide a local file for classification")

    complaint = Complaint(
        user_id=current_user.id,
        description=description,
        locality=locality.strip() if locality and locality.strip() else None,
        latitude=latitude,
        longitude=longitude,
        category=IssueCategory.unknown,
        severity=Severity.medium,
        status=ComplaintStatus.submitted,
        created_at=now,
    )
    db.add(complaint)
    db.flush()  # get complaint.id without committing yet

    db.add(ComplaintImage(complaint_id=complaint.id, image_url=image_url, image_type=ImageType.before))

    # --- AI classification ---
    try:
        prediction = ai_service.predict_issue(
            image_path,
            category_hint=category_hint,
            filename=image.filename,
        )
    finally:
        if settings.cloudinary_configured and image_path and os.path.exists(image_path):
            os.remove(image_path)
    complaint.category = prediction.category
    db.add(AIPrediction(
        complaint_id=complaint.id,
        predicted_category=prediction.category.value,
        confidence=prediction.confidence,
        model_version=prediction.model_version,
    ))
    _record_status_change(db, complaint, ComplaintStatus.ai_analyzed)

    # --- Severity scoring ---
    complaint.severity = severity_service.assess_severity(
        category=complaint.category,
        description=description,
        ai_confidence=prediction.confidence,
    )
    complaint.due_at = calculate_due_at(now, complaint.severity)

    # --- Department assignment ---
    department = assignment_service.get_department_for_category(db, complaint.category)
    if department:
        db.add(Assignment(complaint_id=complaint.id, department_id=department.id))
        _record_status_change(db, complaint, ComplaintStatus.assigned)

    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("", response_model=List[ComplaintOut])
def list_complaints(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin: list all complaints (module 7 dashboard feeds off this too)."""
    return db.query(Complaint).order_by(Complaint.created_at.desc()).all()


@router.get("/my", response_model=List[ComplaintOut])
def my_complaints(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Complaint)
        .filter(Complaint.user_id == current_user.id)
        .order_by(Complaint.created_at.desc())
        .all()
    )


@router.get("/nearby", response_model=List[NearbyComplaintOut])
def find_nearby_complaints(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    category: Optional[IssueCategory] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    latitude_delta = NEARBY_RADIUS_METERS / 111_000
    longitude_delta = min(
        NEARBY_RADIUS_METERS / (111_000 * max(abs(math.cos(math.radians(latitude))), 0.01)),
        180,
    )
    query = db.query(Complaint).filter(
        Complaint.user_id != current_user.id,
        Complaint.latitude.between(latitude - latitude_delta, latitude + latitude_delta),
        Complaint.longitude.between(longitude - longitude_delta, longitude + longitude_delta),
        Complaint.status.in_(OPEN_STATUSES),
        Complaint.moderation_status != "hidden",
    )
    if category is not None:
        query = query.filter(Complaint.category == category)

    matches = []
    for complaint in query.all():
        distance = _distance_meters(latitude, longitude, complaint.latitude, complaint.longitude)
        if distance > NEARBY_RADIUS_METERS:
            continue
        summary = _confirmation_summary(db, complaint.id, current_user.id)
        matches.append(NearbyComplaintOut(
            id=complaint.id,
            category=complaint.category,
            status=complaint.status,
            locality=complaint.locality,
            distance_meters=round(distance),
            confirmation_count=summary.confirmation_count,
            confirmed_by_user=summary.confirmed_by_user,
        ))
    return sorted(matches, key=lambda match: (match.distance_meters, match.id),)[:10]


@router.post("/{complaint_id}/confirmations", response_model=ConfirmationSummary)
def confirm_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")
    if complaint.user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot confirm your own report")
    if complaint.status not in OPEN_STATUSES:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only open reports can be confirmed")

    confirmation = db.query(ComplaintConfirmation).filter(
        ComplaintConfirmation.complaint_id == complaint_id,
        ComplaintConfirmation.user_id == current_user.id,
    ).first()
    if confirmation is None:
        db.add(ComplaintConfirmation(complaint_id=complaint_id, user_id=current_user.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if not db.query(ComplaintConfirmation.id).filter(
                ComplaintConfirmation.complaint_id == complaint_id,
                ComplaintConfirmation.user_id == current_user.id,
            ).first():
                raise
    return _confirmation_summary(db, complaint_id, current_user.id)


@router.delete("/{complaint_id}/confirmations", response_model=ConfirmationSummary)
def remove_complaint_confirmation(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    confirmation = db.query(ComplaintConfirmation).filter(
        ComplaintConfirmation.complaint_id == complaint_id,
        ComplaintConfirmation.user_id == current_user.id,
    ).first()
    if confirmation is not None:
        db.delete(confirmation)
        db.commit()
    return _confirmation_summary(db, complaint_id, current_user.id)


@router.get("/flags", response_model=List[ComplaintFlagOut])
def list_open_complaint_flags(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    rows = (
        db.query(ComplaintFlag, Complaint)
        .join(Complaint, Complaint.id == ComplaintFlag.complaint_id)
        .filter(ComplaintFlag.status == "open")
        .order_by(ComplaintFlag.created_at.asc())
        .limit(200)
        .all()
    )
    counts = dict(
        db.query(ComplaintFlag.complaint_id, func.count(ComplaintFlag.id))
        .filter(ComplaintFlag.status == "open")
        .group_by(ComplaintFlag.complaint_id)
        .all()
    )
    return [
        ComplaintFlagOut(
            id=flag.id,
            complaint_id=complaint.id,
            reason=flag.reason,
            details=flag.details,
            status=flag.status,
            review_notes=flag.review_notes,
            created_at=flag.created_at,
            category=complaint.category,
            complaint_status=complaint.status,
            severity=complaint.severity,
            locality=complaint.locality,
            open_flag_count=counts.get(complaint.id, 0),
        )
        for flag, complaint in rows
    ]


@router.patch("/flags/{flag_id}", response_model=ComplaintFlagResult)
def review_complaint_flag(
    flag_id: int,
    payload: ComplaintFlagReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    flag = db.query(ComplaintFlag).filter(ComplaintFlag.id == flag_id).first()
    if flag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found")
    if flag.status != "open":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Flag has already been reviewed")

    complaint = db.query(Complaint).filter(Complaint.id == flag.complaint_id).first()
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    flag.status = "hidden" if payload.action == "hide" else "dismissed"
    flag.review_notes = payload.review_notes.strip() if payload.review_notes and payload.review_notes.strip() else None
    flag.reviewed_by_user_id = current_user.id
    flag.reviewed_at = datetime.now(timezone.utc)
    db.add(ComplaintModerationEvent(
        complaint_id=complaint.id,
        admin_user_id=current_user.id,
        action=payload.action,
        notes=flag.review_notes,
    ))

    if payload.action == "hide":
        complaint.moderation_status = "hidden"
    elif complaint.moderation_status != "hidden":
        remaining_flags = db.query(func.count(ComplaintFlag.id)).filter(
            ComplaintFlag.complaint_id == complaint.id,
            ComplaintFlag.status == "open",
            ComplaintFlag.id != flag.id,
        ).scalar() or 0
        complaint.moderation_status = "reported" if remaining_flags else "visible"

    db.commit()
    return ComplaintFlagResult(id=flag.id, status=flag.status, moderation_status=complaint.moderation_status)


@router.patch("/{complaint_id}/moderation", response_model=ComplaintModerationResult)
def restore_complaint(
    complaint_id: int,
    payload: ComplaintModerationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if complaint.moderation_status != "hidden":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Report is not hidden")

    open_flags = db.query(func.count(ComplaintFlag.id)).filter(
        ComplaintFlag.complaint_id == complaint.id,
        ComplaintFlag.status == "open",
    ).scalar() or 0
    complaint.moderation_status = "reported" if open_flags else "visible"
    db.add(ComplaintModerationEvent(
        complaint_id=complaint.id,
        admin_user_id=current_user.id,
        action="restored",
        notes=payload.review_notes.strip() if payload.review_notes and payload.review_notes.strip() else None,
    ))
    db.commit()
    return ComplaintModerationResult(
        complaint_id=complaint.id,
        moderation_status=complaint.moderation_status,
    )


@router.post("/{complaint_id}/flags", response_model=ComplaintFlagResult, status_code=status.HTTP_201_CREATED)
def flag_complaint(
    complaint_id: int,
    payload: ComplaintFlagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if complaint.user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot flag your own report")
    if complaint.moderation_status == "hidden":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This report is already hidden")

    existing_flag = db.query(ComplaintFlag.id).filter(
        ComplaintFlag.complaint_id == complaint.id,
        ComplaintFlag.reporter_user_id == current_user.id,
    ).first()
    if existing_flag:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already flagged this report")

    cutoff = datetime.now(timezone.utc) - timedelta(days=1)
    recent_flags = db.query(func.count(ComplaintFlag.id)).filter(
        ComplaintFlag.reporter_user_id == current_user.id,
        ComplaintFlag.created_at >= cutoff,
    ).scalar() or 0
    if recent_flags >= FLAG_LIMIT_PER_DAY:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Flag limit reached. Please try again tomorrow.",
        )

    flag = ComplaintFlag(
        complaint_id=complaint.id,
        reporter_user_id=current_user.id,
        reason=payload.reason,
        details=payload.details.strip() if payload.details and payload.details.strip() else None,
    )
    db.add(flag)
    complaint.moderation_status = "reported"
    db.commit()
    db.refresh(flag)
    return ComplaintFlagResult(id=flag.id, status=flag.status, moderation_status=complaint.moderation_status)


@router.get("/{complaint_id}", response_model=ComplaintDetailOut)
def get_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Module 13: prevent users from accessing other citizens' complaints.
    if current_user.role != UserRole.admin and complaint.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this complaint")

    summary = _confirmation_summary(db, complaint_id, current_user.id)
    complaint.confirmation_count = summary.confirmation_count
    complaint.confirmed_by_user = summary.confirmed_by_user
    return complaint


@router.patch("/{complaint_id}/status", response_model=ComplaintOut)
def update_status(
    complaint_id: int,
    payload: ComplaintStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = _record_status_change(db, complaint, payload.new_status)
    if old_status != payload.new_status:
        _notify_owner(db, complaint, old_status, payload.new_status)
    db.commit()
    db.refresh(complaint)
    return complaint


@router.patch("/{complaint_id}/severity", response_model=ComplaintOut)
def override_severity(
    complaint_id: int,
    payload: SeverityOverride,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Module 4: an administrator can override the predicted severity."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.severity = payload.severity
    complaint.severity_overridden = 1
    if complaint.created_at:
        complaint.due_at = calculate_due_at(as_utc(complaint.created_at), payload.severity)
    db.commit()
    db.refresh(complaint)
    return complaint


@router.post("/{complaint_id}/images", response_model=ComplaintDetailOut)
def upload_resolution_image(
    complaint_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Module 6: resolution photograph upload when marking a complaint resolved."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    _, image_url = _save_upload(image)
    db.add(ComplaintImage(complaint_id=complaint.id, image_url=image_url, image_type=ImageType.after))
    old_status = _record_status_change(db, complaint, ComplaintStatus.resolved)
    if old_status != ComplaintStatus.resolved:
        _notify_owner(db, complaint, old_status, ComplaintStatus.resolved)
    db.commit()
    db.refresh(complaint)
    return complaint
