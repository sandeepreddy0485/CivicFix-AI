# CivicFix AI — Database Design

PostgreSQL in production (SQLite fallback for local development — see
`backend/app/core/config.py`). Schema is defined via SQLAlchemy models in
`backend/app/models/`.

## Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | int, PK | |
| name | string | |
| email | string, unique | login identifier |
| password_hash | string | bcrypt hash, never plaintext |
| role | enum(`citizen`, `admin`) | default `citizen` |
| created_at | datetime | |

### `departments`
| Column | Type | Notes |
|---|---|---|
| id | int, PK | |
| department_name | string, unique | e.g. "Sanitation" |
| description | text, nullable | |

Seeded automatically on backend startup with the five departments from the
project scope (Sanitation, Water Works, Roads and Infrastructure,
Electrical, Drainage).

### `complaints`
| Column | Type | Notes |
|---|---|---|
| id | int, PK | |
| user_id | int, FK → users.id | |
| category | enum | garbage / water_leakage / road_damage / streetlight / drainage_blockage / unknown |
| description | text, nullable | citizen-provided |
| locality | string, nullable | ward, neighbourhood, or landmark supplied by the resident |
| latitude / longitude | float, nullable | GPS coordinates |
| severity | enum | critical / high / medium / low |
| severity_overridden | int (0/1) | set to 1 if an admin manually changed it |
| status | enum | submitted / ai_analyzed / assigned / in_progress / resolved / closed |
| due_at | datetime, nullable | SLA deadline derived from severity (Critical 4h, High 24h, Medium 3d, Low 7d) |
| moderation_status | string | visible / reported / hidden; reports remain available to admins while hidden |
| created_at / updated_at | datetime | |

### `complaint_images`
| Column | Type | Notes |
|---|---|---|
| id | int, PK | |
| complaint_id | int, FK → complaints.id | |
| image_url | string | browser-served path such as `/uploads/<filename>` (not a local filesystem path) |
| image_type | enum(`before`, `after`) | `before` = reported photo, `after` = resolution photo |
| uploaded_at | datetime | |

### `ai_predictions`
| Column | Type | Notes |
|---|---|---|
| id | int, PK | |
| complaint_id | int, FK → complaints.id | |
| predicted_category | string | |
| confidence | float | 0.0–1.0 |
| model_version | string | e.g. `mobilenet_v3_small-finetuned-v1` or `rule-based-fallback-v1` |
| created_at | datetime | |

### `assignments`
| Column | Type | Notes |
|---|---|---|
| id | int, PK | |
| complaint_id | int, FK → complaints.id | |
| department_id | int, FK → departments.id | |
| assigned_at | datetime | |

### `status_history`
| Column | Type | Notes |
|---|---|---|
| id | int, PK | |
| complaint_id | int, FK → complaints.id | |
| old_status | string, nullable | null for the first entry |
| new_status | string | |
| updated_at | datetime | |

Every status transition (including the automated ones during AI analysis
and assignment) is logged here, giving a full audit trail per complaint —
this satisfies the spec's requirement to "keep an audit history of
complaint status changes."

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | int, PK | |
| user_id | int, FK → users.id | recipient; list/read operations are scoped to this user |
| complaint_id | int, FK → complaints.id | |
| old_status / new_status | string | status transition that generated the notification |
| created_at | datetime | |
| read_at | datetime, nullable | null while unread |

Notifications are created when an administrator changes a report's status,
including resolving a report with a resolution photo. Initial automated
classification and assignment transitions are retained in `status_history`
but do not generate notifications.

### `complaint_confirmations`
| Column | Type | Notes |
|---|---|---|
| id | int, PK | |
| complaint_id | int, FK → complaints.id | |
| user_id | int, FK → users.id | one confirmation per resident per report |
| created_at | datetime | |

Nearby matching is limited to open reports within 500 metres. The search
returns a distance and safe report summary, not the reporter's identity or
description. Only another resident can confirm a report; confirmation
creation is idempotent.

## Relationships

```
users (1) ───< (many) complaints
users (1) ───< (many) notifications
users (1) ───< (many) complaint_confirmations
complaints (1) ───< (many) complaint_images
complaints (1) ───< (many) ai_predictions
complaints (1) ───< (many) assignments >─── (1) departments
complaints (1) ───< (many) status_history
complaints (1) ───< (many) notifications
complaints (1) ───< (many) complaint_confirmations
complaints (1) ───< (many) complaint_flags
complaints (1) ───< (many) complaint_moderation_events
```

### `complaint_flags`
| Column | Type | Notes |
|---|---|---|
| id | int, PK | |
| complaint_id | int, FK → complaints.id | report under review |
| reporter_user_id | int, FK → users.id | identity is not included in the admin queue response |
| reason / details | string / text | reason is required; details are optional and limited to 500 characters |
| status | string | open / dismissed / hidden |
| review_notes | text, nullable | administrator's review note |
| reviewed_by_user_id / reviewed_at | FK / datetime, nullable | audit information for the moderation decision |
| created_at | datetime | |

A resident may flag a report once. Flags are rate-limited per resident and
never automatically hide a report; an administrator explicitly dismisses a
flag or hides its report. Report creation is limited to five per authenticated
resident in a rolling hour, and flagging is limited to ten reports per resident
per rolling day. Active reports past `due_at` are counted as overdue for the
municipal dashboard; resolved, closed, and hidden reports are excluded.

The `complaint_moderation_events` table records each administrator moderation
action (dismiss, hide, or restore), including the responsible administrator and
optional review notes. Restoring a report preserves any still-open flags for
follow-up review.

## Migrations

The project ships with Alembic installed (`backend/requirements.txt`) but
no migration scripts are pre-generated, since the schema may still evolve
during development. To set up migrations once the schema stabilizes:

```bash
cd backend
alembic init alembic
# edit alembic.ini's sqlalchemy.url and alembic/env.py to import app.database.Base
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Until then, `Base.metadata.create_all(bind=engine)` in `app/main.py`
creates tables automatically on first run — fine for development, but you
should switch to Alembic-managed migrations before a production launch.
The current startup compatibility check adds the newer `locality`, `due_at`,
and `moderation_status` columns to an existing `complaints` table without
dropping report data and backfills missing SLA deadlines.

## Future: PostGIS

For hotspot analysis and proximity queries (future enhancement #5 in the
spec), add the PostGIS extension and convert `latitude`/`longitude` into a
single `geography(Point, 4326)` column, which enables queries like
"complaints within 500 meters of this point" far more efficiently than
computing distances in application code.
