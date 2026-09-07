import copy
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import event, inspect, select, func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.main import create_app
from app.models import Form, DraftQuestion


class DraftTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "nested" / "drafts.sqlite3"
        self.app = create_app(self.path)
        self.client = TestClient(self.app)
        self.client.__enter__()
        self.form_id = str(uuid4())
        self.url = f"/api/forms/{self.form_id}"
        self.body = {
            "title": "Student introductions",
            "question": {
                "id": str(uuid4()), "type": "short_text",
                "prompt": "What is your name?", "description": "Your preferred name is fine.",
                "required": True,
            },
        }

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def create(self):
        response = self.client.put(self.url, json=self.body)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_create_retry_and_update_keep_ids(self):
        self.create()
        self.create()
        changed = copy.deepcopy(self.body)
        changed["title"] = "Renamed draft"
        changed["question"].update(prompt="How should we address you?", description="", required=False)
        self.assertEqual(self.client.put(self.url, json=changed).status_code, 200)
        self.assertEqual(self.client.get(self.url).json(), {"id": self.form_id, **changed})
        with self.app.state.sessions() as session:
            self.assertEqual(session.scalar(select(func.count()).select_from(Form)), 1)
            self.assertEqual(session.scalar(select(func.count()).select_from(DraftQuestion)), 1)

    def test_validation_rejections_preserve_previous_draft(self):
        original = self.create()
        changes = [
            ("title", ""), ("title", "   "), ("title", "x" * 161),
            ("prompt", "\n  "), ("prompt", "x" * 1001),
            ("description", "x" * 2001), ("required", "false"),
            ("required", 1), ("type", "email"), ("id", "not-a-uuid"),
        ]
        for field, value in changes:
            with self.subTest(field=field, value=str(value)[:20]):
                invalid = copy.deepcopy(self.body)
                target = invalid if field == "title" else invalid["question"]
                target[field] = value
                self.assertEqual(self.client.put(self.url, json=invalid).status_code, 422)
                self.assertEqual(self.client.get(self.url).json(), original)

    def test_invalid_create_writes_nothing(self):
        self.body["title"] = ""
        self.assertEqual(self.client.put(self.url, json=self.body).status_code, 422)
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_cannot_replace_question_id(self):
        original = self.create()
        self.body["question"]["id"] = str(uuid4())
        self.body["title"] = "Must not be saved"
        self.assertEqual(self.client.put(self.url, json=self.body).status_code, 409)
        self.assertEqual(self.client.get(self.url).json(), original)

    def test_foreign_question_conflict_rolls_back_new_form(self):
        original = self.create()
        other_url = f"/api/forms/{uuid4()}"
        self.assertEqual(self.client.put(other_url, json=self.body).status_code, 409)
        self.assertEqual(self.client.get(other_url).status_code, 404)
        self.assertEqual(self.client.get(self.url).json(), original)

    def test_commit_failure_rolls_back_both_rows(self):
        original = self.create()

        def fail_commit(_):
            raise SQLAlchemyError("Simulated disk failure")

        self.body["title"] = "Must roll back"
        self.body["question"]["prompt"] = "This must roll back too"
        event.listen(Session, "before_commit", fail_commit)
        try:
            self.assertEqual(self.client.put(self.url, json=self.body).status_code, 503)
        finally:
            event.remove(Session, "before_commit", fail_commit)
        self.assertEqual(self.client.get(self.url).json(), original)

    def test_fresh_app_and_engine_read_persistent_database(self):
        original = self.create()
        with TestClient(create_app(self.path)) as restarted:
            self.assertEqual(restarted.get(self.url).json(), original)

    def test_no_submission_schema_or_endpoint(self):
        self.create()
        with self.app.state.sessions() as session:
            self.assertEqual(set(inspect(session.bind).get_table_names()), {"forms", "draft_questions"})
        self.assertEqual(self.client.post("/api/submissions", json={}).status_code, 404)

    def test_rejects_unknown_fields_missing_fields_and_bad_routes(self):
        original = self.create()
        self.assertEqual(self.client.put(self.url, json={**self.body, "answers": []}).status_code, 422)
        self.assertEqual(self.client.put(self.url, json={"title": "Missing question"}).status_code, 422)
        self.assertEqual(self.client.get("/api/forms/not-a-uuid").status_code, 422)
        self.assertEqual(self.client.get(f"/api/forms/{uuid4()}").status_code, 404)
        self.assertEqual(self.client.get(self.url).json(), original)


if __name__ == "__main__":
    unittest.main()
