"""Forward-only transactional SQLite migrations. Stage 1 was unversioned (0)."""
import sqlite3
from contextlib import closing
from pathlib import Path

from sqlalchemy.engine import Engine

QUESTION_TABLE = """
CREATE TABLE draft_questions_v2 (
    id VARCHAR(36) PRIMARY KEY NOT NULL,
    form_id VARCHAR(36) NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN (
        'short_text', 'long_text', 'multiple_choice', 'dropdown',
        'email', 'number', 'yes_no', 'rating'
    )),
    position INTEGER NOT NULL CHECK (position >= 0),
    prompt TEXT NOT NULL,
    description TEXT NOT NULL,
    required BOOLEAN NOT NULL
)
"""


def migrate_stage_two(engine: Engine, path: Path) -> None:
    # SQLite's backup API includes committed journal/WAL data. Never overwrite a backup.
    with closing(sqlite3.connect(path)) as source:
        version = source.execute("PRAGMA user_version").fetchone()[0]
        tables = {row[0] for row in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if version == 0 and tables == {"forms", "draft_questions"}:
            backup = path.with_name(path.name + ".stage1-backup.sqlite3")
            if not backup.exists():
                with closing(sqlite3.connect(backup)) as destination:
                    source.backup(destination)

    with engine.connect() as connection:
        try:
            # Explicit BEGIN makes DDL transactional under Python's SQLite driver.
            connection.exec_driver_sql("BEGIN IMMEDIATE")
            version = connection.exec_driver_sql("PRAGMA user_version").scalar_one()
            if version == 2:
                connection.commit()
                return
            if version != 0:
                raise RuntimeError(f"Unsupported database version {version}; no changes made")
            tables = set(connection.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).scalars())
            if tables and tables != {"forms", "draft_questions"}:
                raise RuntimeError("Unrecognized unversioned database; migration stopped")
            if not tables:
                connection.exec_driver_sql(
                    "CREATE TABLE forms (id VARCHAR(36) PRIMARY KEY NOT NULL, title VARCHAR(160) NOT NULL)"
                )
            connection.exec_driver_sql(QUESTION_TABLE)
            if tables:
                connection.exec_driver_sql("""
                    INSERT INTO draft_questions_v2
                    (id, form_id, type, position, prompt, description, required)
                    SELECT id, form_id, type, position, prompt, description, required
                    FROM draft_questions
                """)
                connection.exec_driver_sql("DROP TABLE draft_questions")
            connection.exec_driver_sql("ALTER TABLE draft_questions_v2 RENAME TO draft_questions")
            connection.exec_driver_sql("""
                CREATE TABLE choice_options (
                    id VARCHAR(36) PRIMARY KEY NOT NULL,
                    question_id VARCHAR(36) NOT NULL REFERENCES draft_questions(id) ON DELETE CASCADE,
                    label TEXT NOT NULL,
                    position INTEGER NOT NULL CHECK (position >= 0)
                )
            """)
            connection.exec_driver_sql("CREATE INDEX ix_questions_form ON draft_questions(form_id, position)")
            connection.exec_driver_sql("CREATE INDEX ix_options_question ON choice_options(question_id, position)")
            if connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall():
                raise RuntimeError("Foreign key check failed; migration rolled back")
            connection.exec_driver_sql("PRAGMA user_version=2")
            connection.commit()
        except Exception:
            connection.rollback()
            raise


def migrate(engine: Engine, path: Path) -> None:
    from .migrations_v3 import migrate_publication
    with closing(sqlite3.connect(path)) as connection:
        version = connection.execute("PRAGMA user_version").fetchone()[0]
    if version == 3:
        return
    # Keep the original 0 -> 2 migration intact, then apply the additive migration.
    migrate_stage_two(engine, path)
    migrate_publication(engine, path)
