from datetime import datetime, timezone
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.complaint import IssueCategory, Severity, ComplaintStatus
from app.models.complaint_image import ImageType


class ComplaintCreate(BaseModel):
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # category/severity are normally derived by AI + rules, but a citizen may
    # optionally hint at a category if AI is unavailable or uncertain.
    category_hint: Optional[IssueCategory] = None


class ComplaintImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    image_url: str
    image_type: ImageType
    uploaded_at: datetime


class AIPredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    predicted_category: str
    confidence: float
    model_version: str
    created_at: datetime


class StatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    old_status: Optional[str]
    new_status: str
    updated_at: datetime


class ComplaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    category: IssueCategory
    description: Optional[str]
    locality: Optional[str] = None
    latitude: Optional[float]
    longitude: Optional[float]
    severity: Severity
    status: ComplaintStatus
    created_at: datetime
    due_at: Optional[datetime] = None
    moderation_status: str = "visible"
    updated_at: datetime
    images: List[ComplaintImageOut] = []
    predictions: List[AIPredictionOut] = []

    @field_serializer("due_at")
    def serialize_due_at(self, due_at: Optional[datetime]) -> Optional[datetime]:
        if due_at is not None and due_at.tzinfo is None:
            return due_at.replace(tzinfo=timezone.utc)
        return due_at


class ComplaintDetailOut(ComplaintOut):
    history: List[StatusHistoryOut] = []
    confirmation_count: int = 0
    confirmed_by_user: bool = False


class NearbyComplaintOut(BaseModel):
    id: int
    category: IssueCategory
    status: ComplaintStatus
    locality: Optional[str]
    distance_meters: int
    confirmation_count: int
    confirmed_by_user: bool


class ConfirmationSummary(BaseModel):
    confirmation_count: int
    confirmed_by_user: bool


class NotificationOut(BaseModel):
    id: int
    complaint_id: int
    old_status: Optional[str]
    new_status: str
    created_at: datetime
    read_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class ComplaintStatusUpdate(BaseModel):
    new_status: ComplaintStatus


class SeverityOverride(BaseModel):
    severity: Severity


class ComplaintFlagCreate(BaseModel):
    reason: Literal["spam", "inappropriate", "false_information", "duplicate", "other"]
    details: Optional[str] = Field(default=None, max_length=500)


class ComplaintFlagReview(BaseModel):
    action: Literal["dismiss", "hide"]
    review_notes: Optional[str] = Field(default=None, max_length=500)


class ComplaintModerationUpdate(BaseModel):
    review_notes: Optional[str] = Field(default=None, max_length=500)


class ComplaintFlagOut(BaseModel):
    id: int
    complaint_id: int
    reason: str
    details: Optional[str]
    status: str
    review_notes: Optional[str]
    created_at: datetime
    category: IssueCategory
    complaint_status: ComplaintStatus
    severity: Severity
    locality: Optional[str]
    open_flag_count: int


class ComplaintFlagResult(BaseModel):
    id: int
    status: str
    moderation_status: str


class ComplaintModerationResult(BaseModel):
    complaint_id: int
    moderation_status: str
