from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    department_name = Column(String(120), unique=True, nullable=False)
    description = Column(Text, nullable=True)

    assignments = relationship("Assignment", back_populates="department")
