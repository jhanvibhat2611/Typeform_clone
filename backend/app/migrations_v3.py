"""Add publication/submission storage without altering any draft rows."""
import sqlite3
from contextlib import closing
from pathlib import Path
from uuid import uuid4

from sqlalchemy.engine import Engine


def migrate_publication(engine: Engine, path: Path) -> None:
    with closing(sqlite3.connect(path)) as source:
        version = source.execute('PRAGMA user_version').fetchone()[0]
        if version == 3:
            return
        if version != 2:
            raise RuntimeError(f'Expected database version 2, found {version}')
        backup = path.with_name(path.name + '.stage2-backup.sqlite3')
        if not backup.exists():
            with closing(sqlite3.connect(backup)) as destination:
                source.backup(destination)
    with engine.connect() as connection:
        try:
            connection.exec_driver_sql('BEGIN IMMEDIATE')
            if connection.exec_driver_sql('PRAGMA user_version').scalar_one() == 3:
                connection.commit()
                return
            for statement in [
                '''CREATE TABLE form_versions (
                    id TEXT PRIMARY KEY NOT NULL,
                    form_id TEXT NOT NULL REFERENCES forms(id),
                    snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
                    created_at TEXT NOT NULL,
                    UNIQUE(form_id, id)
                )''',
                '''CREATE TABLE publications (
                    form_id TEXT PRIMARY KEY NOT NULL REFERENCES forms(id),
                    public_id TEXT NOT NULL UNIQUE,
                    active_version_id TEXT,
                    FOREIGN KEY(form_id, active_version_id) REFERENCES form_versions(form_id, id)
                )''',
                '''CREATE TABLE submissions (
                    id TEXT PRIMARY KEY NOT NULL,
                    version_id TEXT NOT NULL REFERENCES form_versions(id),
                    request_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )''',
                '''CREATE TABLE answers (
                    submission_id TEXT NOT NULL REFERENCES submissions(id),
                    question_id TEXT NOT NULL,
                    value_json TEXT NOT NULL CHECK(json_valid(value_json)),
                    PRIMARY KEY(submission_id, question_id)
                )''',
                'CREATE INDEX ix_submissions_version ON submissions(version_id)',
                '''CREATE TRIGGER immutable_version_update BEFORE UPDATE ON form_versions
                   BEGIN SELECT RAISE(ABORT, 'Published snapshots are immutable'); END''',
                '''CREATE TRIGGER immutable_version_delete BEFORE DELETE ON form_versions
                   BEGIN SELECT RAISE(ABORT, 'Published snapshots are immutable'); END''',
            ]:
                connection.exec_driver_sql(statement)
            for form_id in connection.exec_driver_sql('SELECT id FROM forms').scalars().all():
                connection.exec_driver_sql(
                    'INSERT INTO publications(form_id, public_id) VALUES (?, ?)', (form_id, str(uuid4())))
            if connection.exec_driver_sql('PRAGMA foreign_key_check').fetchall():
                raise RuntimeError('Foreign key check failed')
            connection.exec_driver_sql('PRAGMA user_version=3')
            connection.commit()
        except Exception:
            connection.rollback()
            raise
