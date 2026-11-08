from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from app.database import Base


class ComplaintFlag(Base):
    __tablename__ = "complaint_flags"
    __table_args__ = (
        UniqueConstraint("complaint_id", "reporter_user_id", name="uq_complaint_flag_reporter"),
    )

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    reporter_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reason = Column(String(40), nullable=False)
    details = Column(Text, nullable=True)
    status = Column(String(20), default="open", nullable=False, index=True)
    review_notes = Column(Text, nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
