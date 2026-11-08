"""
Module 4: Severity assessment.

For the MVP this is a transparent, rule-based engine rather than a second
ML model: it combines the detected category, AI confidence, and simple
keyword signals from the citizen's description. An administrator can
always override the result (see PATCH /api/complaints/{id} severity override).
"""
from app.models.complaint import IssueCategory, Severity

# Baseline severity per category, reflecting typical public-safety impact.
CATEGORY_BASE_SEVERITY = {
    IssueCategory.garbage: Severity.low,
    IssueCategory.water_leakage: Severity.medium,
    IssueCategory.road_damage: Severity.high,
    IssueCategory.streetlight: Severity.medium,
    IssueCategory.drainage_blockage: Severity.medium,
    IssueCategory.unknown: Severity.medium,
}

# Keywords in the citizen's free-text description that should escalate severity.
# Kept intentionally simple/transparent for an MVP; a smarter NLP pass is a
# good future enhancement.
CRITICAL_KEYWORDS = [
    "exposed wire", "live wire", "electrocut", "sparking", "fire",
    "collapsed", "gas leak", "sewage overflow", "flooding", "accident",
    "child", "injury", "injured",
]
HIGH_KEYWORDS = ["large pothole", "major leak", "blocked road", "overflow", "no water supply"]

SEVERITY_ORDER = [Severity.low, Severity.medium, Severity.high, Severity.critical]


def _escalate(current: Severity, target: Severity) -> Severity:
    """Return whichever severity is higher (never downgrade automatically)."""
    if SEVERITY_ORDER.index(target) > SEVERITY_ORDER.index(current):
        return target
    return current


def assess_severity(
    category: IssueCategory,
    description: str | None,
    ai_confidence: float | None = None,
) -> Severity:
    severity = CATEGORY_BASE_SEVERITY.get(category, Severity.medium)

    text = (description or "").lower()
    if any(kw in text for kw in CRITICAL_KEYWORDS):
        severity = _escalate(severity, Severity.critical)
    elif any(kw in text for kw in HIGH_KEYWORDS):
        severity = _escalate(severity, Severity.high)

    # Low-confidence AI predictions should not drive a critical rating on
    # their own; flag for manual review by capping escalation from AI alone.
    if ai_confidence is not None and ai_confidence < 0.4 and severity == Severity.critical:
        severity = Severity.high

    return severity
