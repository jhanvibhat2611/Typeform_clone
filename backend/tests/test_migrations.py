import sqlite3
from contextlib import closing
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from app.main import create_app

STAGE_ONE_SCHEMA = """
CREATE TABLE forms (id VARCHAR(36) PRIMARY KEY NOT NULL, title VARCHAR(160) NOT NULL);
CREATE TABLE draft_questions (
    id VARCHAR(36) PRIMARY KEY NOT NULL,
    form_id VARCHAR(36) NOT NULL UNIQUE REFERENCES forms(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type = 'short_text'),
    position INTEGER NOT NULL CHECK (position = 0),
    prompt TEXT NOT NULL, description TEXT NOT NULL, required BOOLEAN NOT NULL
);
"""


class MigrationTests(unittest.TestCase):
    def test_stage_one_values_and_ids_survive_and_migration_is_repeatable(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "legacy.sqlite3"
            form_id, question_id = str(uuid4()), str(uuid4())
            row = (question_id, form_id, "short_text", 0, "Your name? 🌱", "Keep whitespace.  ", 1)
            with closing(sqlite3.connect(path)) as connection, connection:
                connection.executescript(STAGE_ONE_SCHEMA)
                connection.execute("INSERT INTO forms VALUES (?, ?)", (form_id, "Original title"))
                connection.execute("INSERT INTO draft_questions VALUES (?, ?, ?, ?, ?, ?, ?)", row)
            for _ in range(2):
                with TestClient(create_app(path)) as client:
                    saved = client.get(f"/api/forms/{form_id}").json()
                    self.assertEqual(saved, {
                        "id": form_id, "title": "Original title",
                        "questions": [{"id": question_id, "type": "short_text", "prompt": row[4],
                                       "description": row[5], "required": True, "options": []}],
                    })
            with closing(sqlite3.connect(path)) as connection, connection:
                self.assertEqual(connection.execute("SELECT * FROM draft_questions").fetchone(), row)
                self.assertEqual(connection.execute("PRAGMA user_version").fetchone()[0], 4)
                self.assertEqual(connection.execute("PRAGMA foreign_key_check").fetchall(), [])
            self.assertTrue(path.with_name(path.name + ".stage1-backup.sqlite3").is_file())

    def test_migration_failure_rolls_back_ddl_and_preserves_legacy_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "invalid.sqlite3"
            # An orphan demonstrates fail-closed migration and transactional DDL rollback.
            with closing(sqlite3.connect(path)) as connection, connection:
                connection.executescript(STAGE_ONE_SCHEMA)
                connection.execute("INSERT INTO draft_questions VALUES (?, ?, ?, ?, ?, ?, ?)",
                                   (str(uuid4()), str(uuid4()), "short_text", 0, "Orphan", "", 0))
                old_sql = connection.execute("SELECT sql FROM sqlite_master WHERE name='draft_questions'").fetchone()[0]
            with self.assertRaises(Exception):
                with TestClient(create_app(path)):
                    pass
            with closing(sqlite3.connect(path)) as connection, connection:
                self.assertEqual(connection.execute("PRAGMA user_version").fetchone()[0], 0)
                self.assertEqual(connection.execute("SELECT sql FROM sqlite_master WHERE name='draft_questions'").fetchone()[0], old_sql)
                self.assertEqual(connection.execute("SELECT COUNT(*) FROM draft_questions").fetchone()[0], 1)
                self.assertEqual(connection.execute("SELECT name FROM sqlite_master WHERE name='draft_questions_v2'").fetchall(), [])

    def test_unknown_version_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "future.sqlite3"
            with closing(sqlite3.connect(path)) as connection, connection:
                connection.execute("PRAGMA user_version=99")
            with self.assertRaises(RuntimeError):
                with TestClient(create_app(path)):
                    pass
            with closing(sqlite3.connect(path)) as connection, connection:
                self.assertEqual(connection.execute("PRAGMA user_version").fetchone()[0], 99)
