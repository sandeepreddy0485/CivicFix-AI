from typing import Optional
from pydantic import BaseModel, ConfigDict


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    department_name: str
    description: Optional[str] = None


class AssignmentCreate(BaseModel):
    complaint_id: int
    department_id: int
