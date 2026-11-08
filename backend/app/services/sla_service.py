from datetime import datetime, timedelta, timezone

from app.models.complaint import Severity

SLA_TARGETS = {
    Severity.critical: timedelta(hours=4),
    Severity.high: timedelta(hours=24),
    Severity.medium: timedelta(days=3),
    Severity.low: timedelta(days=7),
}


def calculate_due_at(created_at: datetime, severity: Severity) -> datetime:
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return created_at + SLA_TARGETS[severity]


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
