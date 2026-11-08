from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import require_admin
from app.models.complaint import Complaint, ComplaintStatus, Severity
from app.models.assignment import Assignment
from app.models.department import Department

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), current_user=Depends(require_admin)):
    """
    Module 7: Admin dashboard. Returns the aggregate stats called for in the
    spec -- totals by status/severity, category distribution, department
    performance, and location distribution for map/heatmap rendering.
    """
    total = db.query(func.count(Complaint.id)).scalar() or 0

    def count_status(s: ComplaintStatus) -> int:
        return db.query(func.count(Complaint.id)).filter(Complaint.status == s).scalar() or 0

    pending = count_status(ComplaintStatus.submitted) + count_status(ComplaintStatus.ai_analyzed) + count_status(ComplaintStatus.assigned)
    in_progress = count_status(ComplaintStatus.in_progress)
    resolved = count_status(ComplaintStatus.resolved) + count_status(ComplaintStatus.closed)
    critical = db.query(func.count(Complaint.id)).filter(Complaint.severity == Severity.critical).scalar() or 0
    overdue = db.query(func.count(Complaint.id)).filter(
        Complaint.due_at <= datetime.now(timezone.utc),
        Complaint.status.notin_([ComplaintStatus.resolved, ComplaintStatus.closed]),
        Complaint.moderation_status != "hidden",
    ).scalar() or 0

    category_rows = db.query(Complaint.category, func.count(Complaint.id)).group_by(Complaint.category).all()
    category_distribution = {cat.value: cnt for cat, cnt in category_rows}

    dept_rows = (
        db.query(Department.department_name, func.count(Assignment.id))
        .join(Assignment, Assignment.department_id == Department.id)
        .group_by(Department.department_name)
        .all()
    )
    department_performance = {name: cnt for name, cnt in dept_rows}

    location_rows = (
        db.query(Complaint.latitude, Complaint.longitude, Complaint.category, Complaint.severity, Complaint.status)
        .filter(Complaint.latitude.isnot(None), Complaint.longitude.isnot(None))
        .all()
    )
    locations = [
        {
            "latitude": lat,
            "longitude": lng,
            "category": cat.value,
            "severity": sev.value,
            "status": st.value,
        }
        for lat, lng, cat, sev, st in location_rows
    ]

    return {
        "total_complaints": total,
        "pending_complaints": pending,
        "in_progress_complaints": in_progress,
        "resolved_complaints": resolved,
        "critical_complaints": critical,
        "overdue_complaints": overdue,
        "category_distribution": category_distribution,
        "department_performance": department_performance,
        "location_distribution": locations,
    }
