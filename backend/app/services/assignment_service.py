"""
Module 5: Automatic department assignment.

A simple, deterministic category -> department mapping. This keeps the
system useful even when the AI model is unavailable or uncertain, exactly
as called out in the project spec.
"""
from sqlalchemy.orm import Session

from app.models.complaint import IssueCategory
from app.models.department import Department

CATEGORY_TO_DEPARTMENT_NAME = {
    IssueCategory.garbage: "Sanitation",
    IssueCategory.water_leakage: "Water Works",
    IssueCategory.road_damage: "Roads and Infrastructure",
    IssueCategory.streetlight: "Electrical",
    IssueCategory.drainage_blockage: "Drainage",
    IssueCategory.unknown: "Sanitation",  # default queue for manual triage
}


def get_department_for_category(db: Session, category: IssueCategory) -> Department | None:
    name = CATEGORY_TO_DEPARTMENT_NAME.get(category)
    if not name:
        return None
    return db.query(Department).filter(Department.department_name == name).first()
