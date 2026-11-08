"""
SQLAlchemy engine, session factory, and declarative base.
"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_schema_compatibility():
    """Add fields needed by newer app versions to existing databases."""
    inspector = inspect(engine)
    if "complaints" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("complaints")}
    statements = []
    due_at_type = "TIMESTAMP WITH TIME ZONE" if engine.dialect.name == "postgresql" else "TIMESTAMP"
    if "locality" not in column_names:
        statements.append("ALTER TABLE complaints ADD COLUMN locality VARCHAR(160)")
    if "due_at" not in column_names:
        statements.append(f"ALTER TABLE complaints ADD COLUMN due_at {due_at_type}")
    if "moderation_status" not in column_names:
        statements.append(
            "ALTER TABLE complaints ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT 'visible'"
        )
    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))


def get_db():
    """FastAPI dependency that yields a DB session and closes it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
