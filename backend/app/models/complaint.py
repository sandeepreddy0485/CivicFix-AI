import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class IssueCategory(str, enum.Enum):
    garbage = "garbage"
    water_leakage = "water_leakage"
    road_damage = "road_damage"
    streetlight = "streetlight"
    drainage_blockage = "drainage_blockage"
    unknown = "unknown"


class Severity(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class ComplaintStatus(str, enum.Enum):
    submitted = "submitted"
    ai_analyzed = "ai_analyzed"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(Enum(IssueCategory), default=IssueCategory.unknown, nullable=False)
    description = Column(Text, nullable=True)
    locality = Column(String(160), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    severity = Column(Enum(Severity), default=Severity.medium, nullable=False)
    severity_overridden = Column(Integer, default=0)  # 0/1 boolean flag (sqlite-friendly)
    status = Column(Enum(ComplaintStatus), default=ComplaintStatus.submitted, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    due_at = Column(DateTime(timezone=True), nullable=True, index=True)
    moderation_status = Column(String(20), default="visible", nullable=False, index=True)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="complaints")
    images = relationship("ComplaintImage", back_populates="complaint", cascade="all, delete-orphan")
    predictions = relationship("AIPrediction", back_populates="complaint", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="complaint", cascade="all, delete-orphan")
    history = relationship("StatusHistory", back_populates="complaint", cascade="all, delete-orphan")
