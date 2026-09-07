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
from app.models import Form, DraftQuestion, ChoiceOption


def question(kind="short_text", **changes):
    return {
        "id": str(uuid4()), "type": kind, "prompt": "A question",
        "description": "Some help", "required": True, "options": [], **changes,
    }


def option(label="Choice"):
    return {"id": str(uuid4()), "label": label}


class DraftTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "nested" / "drafts.sqlite3"
        self.app = create_app(self.path)
        self.client = TestClient(self.app)
        self.client.__enter__()
        self.form_id = str(uuid4())
        self.url = f"/api/forms/{self.form_id}"
        self.body = {"title": "Introductions", "questions": [question()]}

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def save(self):
        response = self.client.put(self.url, json=self.body)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def assert_unchanged(self, original):
        self.assertEqual(self.client.get(self.url).json(), original)

    def test_retry_and_all_types_survive_reload(self):
        types = ["short_text", "long_text", "multiple_choice", "dropdown", "email", "number", "yes_no", "rating"]
        self.body["questions"] = [
            question(kind, required=bool(index % 2),
                     options=[option("A"), option("B")] if kind in {"multiple_choice", "dropdown"} else [])
            for index, kind in enumerate(types)
        ]
        original = self.save()
        self.save()
        with TestClient(create_app(self.path)) as restarted:
            self.assertEqual(restarted.get(self.url).json(), original)
        with self.app.state.sessions() as session:
            self.assertEqual(session.scalar(select(func.count()).select_from(Form)), 1)
            self.assertEqual(session.scalar(select(func.count()).select_from(DraftQuestion)), 8)
            self.assertEqual(session.scalar(select(func.count()).select_from(ChoiceOption)), 4)

    def test_add_delete_and_order_are_atomic_and_persistent(self):
        first = question("multiple_choice", options=[option("A"), option("B"), option("C")])
        second = question("email")
        self.body["questions"] = [first, second]
        self.save()
        first["options"] = [first["options"][2], first["options"][0]]
        self.body["questions"] = [second, first, question("number")]
        saved = self.save()
        self.assert_unchanged(saved)
        with self.app.state.sessions() as session:
            self.assertEqual(
                [(q.id, q.position) for q in session.scalars(select(DraftQuestion).order_by(DraftQuestion.position))],
                [(q["id"], i) for i, q in enumerate(self.body["questions"])],
            )
            self.assertEqual(
                [(o.id, o.position) for o in session.scalars(select(ChoiceOption).order_by(ChoiceOption.position))],
                [(o["id"], i) for i, o in enumerate(first["options"])],
            )
        self.body["questions"] = [second]
        self.save()
        with self.app.state.sessions() as session:
            self.assertEqual(session.scalar(select(func.count()).select_from(ChoiceOption)), 0)
            self.assertEqual(session.scalar(select(func.count()).select_from(DraftQuestion)), 1)

    def test_incomplete_drafts_and_empty_form_are_valid(self):
        self.body["questions"] = [question("dropdown", prompt="", description="", options=[]), question(prompt="   ")]
        self.save()
        self.body["questions"] = []
        self.save()
        self.body["questions"] = [question("rating", prompt="")]
        self.save()

    def test_type_change_preserves_identity_and_clears_options(self):
        q = question("multiple_choice", options=[option()])
        self.body["questions"] = [q]
        self.save()
        q.update(type="long_text", options=[])
        saved = self.save()
        self.assertEqual(saved["questions"][0], q)
        with self.app.state.sessions() as session:
            self.assertEqual(session.scalar(select(func.count()).select_from(ChoiceOption)), 0)

    def test_validation_rejections_preserve_previous_draft(self):
        original = self.save()
        cases = [
            ("title", ""), ("title", "   "), ("title", "x" * 161),
            ("prompt", "x" * 1001), ("description", "x" * 2001),
            ("required", "false"), ("required", 1), ("type", "file_upload"),
            ("id", "not-a-uuid"), ("settings", {"max": 10}), ("options", [option()]),
        ]
        for field, value in cases:
            with self.subTest(field=field):
                invalid = copy.deepcopy(self.body)
                target = invalid if field == "title" else invalid["questions"][0]
                target[field] = value
                self.assertEqual(self.client.put(self.url, json=invalid).status_code, 422)
                self.assert_unchanged(original)

    def test_duplicate_question_option_and_cross_kind_ids_are_rejected(self):
        self.body["questions"] = [question("multiple_choice", options=[option(), option()]), question()]
        original = self.save()
        invalids = []
        invalid = copy.deepcopy(self.body)
        invalid["questions"][1]["id"] = invalid["questions"][0]["id"]
        invalids.append(invalid)
        invalid = copy.deepcopy(self.body)
        invalid["questions"][0]["options"][1]["id"] = invalid["questions"][0]["options"][0]["id"]
        invalids.append(invalid)
        invalid = copy.deepcopy(self.body)
        invalid["questions"][0]["options"][0]["id"] = invalid["questions"][1]["id"]
        invalids.append(invalid)
        for invalid in invalids:
            self.assertEqual(self.client.put(self.url, json=invalid).status_code, 422)
            self.assert_unchanged(original)

    def test_cross_form_question_and_option_ids_are_rejected(self):
        self.body["questions"] = [question("multiple_choice", options=[option()])]
        original = self.save()
        other_url = f"/api/forms/{uuid4()}"
        self.assertEqual(self.client.put(other_url, json=self.body).status_code, 409)
        other = {"title": "Other", "questions": [question("dropdown", options=self.body["questions"][0]["options"])]}
        self.assertEqual(self.client.put(other_url, json=other).status_code, 409)
        self.assertEqual(self.client.get(other_url).status_code, 404)
        self.assert_unchanged(original)

    def test_option_cannot_move_to_another_question_in_same_form(self):
        self.body["questions"] = [question("dropdown", options=[option()]), question("multiple_choice")]
        original = self.save()
        self.body["questions"][1]["options"] = self.body["questions"][0]["options"]
        self.body["questions"][0]["options"] = []
        self.assertEqual(self.client.put(self.url, json=self.body).status_code, 409)
        self.assert_unchanged(original)

    def test_commit_failure_rolls_back_edits_additions_deletions_and_options(self):
        self.body["questions"] = [question("dropdown", options=[option(), option()]), question()]
        original = self.save()
        self.body["title"] = "Must roll back"
        self.body["questions"] = [self.body["questions"][0], question("rating")]
        self.body["questions"][0]["options"] = [option("New")]
        self.body["questions"][0]["prompt"] = "Changed"
        def fail_commit(_):
            raise SQLAlchemyError("Simulated failure")
        event.listen(Session, "before_commit", fail_commit)
        try:
            self.assertEqual(self.client.put(self.url, json=self.body).status_code, 503)
        finally:
            event.remove(Session, "before_commit", fail_commit)
        self.assert_unchanged(original)

    def test_option_and_collection_limits(self):
        original = self.save()
        invalids = [
            {"title": "Limit", "questions": [question() for _ in range(201)]},
            {"title": "Limit", "questions": [question("dropdown", options=[option() for _ in range(101)])]},
            {"title": "Limit", "questions": [question("dropdown", options=[option("x" * 501)])]},
        ]
        for invalid in invalids:
            self.assertEqual(self.client.put(self.url, json=invalid).status_code, 422)
            self.assert_unchanged(original)

    def test_unknown_fields_and_invalid_create_write_nothing(self):
        original = self.save()
        self.assertEqual(self.client.put(self.url, json={**self.body, "answers": []}).status_code, 422)
        self.assertEqual(self.client.put(self.url, json={"title": "Missing questions"}).status_code, 422)
        self.assertEqual(self.client.get("/api/forms/not-a-uuid").status_code, 422)
        self.assertEqual(self.client.get(f"/api/forms/{uuid4()}").status_code, 404)
        other_url = f"/api/forms/{uuid4()}"
        self.assertEqual(self.client.put(other_url, json={"title": "", "questions": []}).status_code, 422)
        self.assertEqual(self.client.get(other_url).status_code, 404)
        self.assert_unchanged(original)

    def test_no_submission_schema_or_endpoint(self):
        self.save()
        with self.app.state.sessions() as session:
            self.assertEqual(set(inspect(session.bind).get_table_names()), {"forms", "draft_questions", "choice_options"})
        self.assertEqual(self.client.post("/api/submissions", json={}).status_code, 404)


if __name__ == "__main__":
    unittest.main()
