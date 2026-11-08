from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.department import Department
from app.models.complaint import Complaint
from app.models.assignment import Assignment
from app.schemas.department import DepartmentOut, AssignmentCreate
from app.core.deps import require_admin

router = APIRouter(tags=["departments"])


@router.get("/api/departments", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(Department).all()


@router.post("/api/assignments", status_code=201)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Allows an admin to manually (re)assign a complaint to a department."""
    complaint = db.query(Complaint).filter(Complaint.id == payload.complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    department = db.query(Department).filter(Department.id == payload.department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    assignment = Assignment(complaint_id=complaint.id, department_id=department.id)
    db.add(assignment)
    db.commit()
    return {"detail": "Assigned", "complaint_id": complaint.id, "department_id": department.id}
