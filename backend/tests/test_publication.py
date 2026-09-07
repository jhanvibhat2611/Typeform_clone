import copy
import json
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import event, select, func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.main import create_app
from app.database import make_engine
from app.migrations import migrate_stage_two
from app.models import Submission, Answer, FormVersion
from test_drafts import question, option


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'forms.sqlite3'
        self.app = create_app(self.path)
        self.client = TestClient(self.app).__enter__()
        self.url = '/api/forms/' + str(uuid4())
        self.body = {'title': 'Published form', 'questions': [question()]}

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def publish(self, url=None, body=None):
        response = self.client.post((url or self.url) + '/publish', json=body or self.body)
        self.assertEqual(response.status_code, 200, response.text)
        self.publication = response.json()['publication']
        self.public = '/api/public/' + self.publication['public_id']
        return self.publication['active_version_id']

    def payload(self, version, values=None):
        return {'submission_id': str(uuid4()), 'version_id': version,
                'answers': [{'question_id': q['id'], 'value': value} for q, value in zip(self.body['questions'], values or ['Answer'])]}

    def count(self, model):
        with self.app.state.sessions() as session:
            return session.scalar(select(func.count()).select_from(model))

    def test_incomplete_draft_saves_but_cannot_publish(self):
        for questions in [[], [question(prompt=' ')], [question('dropdown', options=[])],
                          [question('multiple_choice', options=[option('A')])],
                          [question('dropdown', options=[option('A'), option(' ')])]]:
            self.body['questions'] = questions
            self.assertEqual(self.client.put(self.url, json=self.body).status_code, 200)
            self.assertEqual(self.client.post(self.url + '/publish', json=self.body).status_code, 422)
        self.assertEqual(self.count(FormVersion), 0)

    def test_publish_exact_unsaved_draft_and_old_versions_and_unpublish(self):
        self.client.put(self.url, json=self.body)
        self.body['questions'][0]['prompt'] = 'Unsaved editor V1'
        v1 = self.publish()
        self.assertEqual(self.client.get(self.url).json()['questions'][0]['prompt'], 'Unsaved editor V1')
        snapshot = self.client.get(self.public).json()['snapshot']
        self.body['questions'][0]['prompt'] = 'V2'
        self.client.put(self.url, json=self.body)
        self.assertEqual(self.client.get(self.public).json()['snapshot'], snapshot)
        public_link = self.public
        v2 = self.publish()
        self.assertNotEqual(v1, v2)
        self.assertEqual(public_link, self.public)
        self.assertEqual(self.client.get(self.public).json()['version_id'], v2)
        old = self.payload(v1)
        self.assertEqual(self.client.post(self.public + '/submissions', json=old).status_code, 200)
        self.client.post(self.url + '/unpublish')
        self.assertEqual(self.client.get(self.public).status_code, 404)
        self.assertEqual(self.client.post(self.public + '/submissions', json=self.payload(v2)).status_code, 409)
        self.assertEqual(self.client.post(self.public + '/submissions', json=old).status_code, 200)
        self.assertEqual(self.count(Submission), 1)
        self.publish()
        self.assertEqual(public_link, self.public)

    def test_all_types_false_zero_and_optional_omission(self):
        types = ['short_text', 'long_text', 'multiple_choice', 'dropdown', 'email', 'number', 'yes_no', 'rating']
        self.body['questions'] = [question(t, options=[option('A'), option('B')] if t in {'multiple_choice', 'dropdown'} else []) for t in types]
        self.body['questions'].append(question(required=False))
        version = self.publish()
        values = ['Text', 'Multi\nline', self.body['questions'][2]['options'][0]['id'], self.body['questions'][3]['options'][1]['id'], 'person@example.com', 0, False, 5]
        response = self.client.post(self.public + '/submissions', json=self.payload(version, values))
        self.assertEqual(response.status_code, 200, response.text)
        with self.app.state.sessions() as session:
            answers = {a.question_id: json.loads(a.value_json) for a in session.scalars(select(Answer))}
            self.assertEqual(len(answers), 8)
            self.assertIs(answers[self.body['questions'][6]['id']], False)
            self.assertEqual(answers[self.body['questions'][5]['id']], 0)

    def test_invalid_values_membership_duplicates_and_versions(self):
        for kind, bad_values in {
            'short_text': [False, 4, 'x' * 1001], 'long_text': [False],
            'email': ['bad', 'a..b@example.com', 'a@-example.com', 'x' * 255],
            'number': ['4', True], 'yes_no': ['false', 0],
            'rating': [0, 6, 1.5, True, '5'], 'dropdown': ['unknown'], 'multiple_choice': ['unknown'],
        }.items():
            self.body['questions'] = [question(kind, options=[option('A'), option('B')] if kind in {'dropdown', 'multiple_choice'} else [])]
            version = self.publish()
            for value in bad_values + [None, '']:
                with self.subTest(kind=kind, value=str(value)[:20]):
                    response = self.client.post(self.public + '/submissions', json=self.payload(version, [value]))
                    self.assertEqual(response.status_code, 422, response.text)
        payload = self.payload(version, [self.body['questions'][0]['options'][0]['id']])
        invalids = [{**payload, 'answers': []}, {**payload, 'version_id': str(uuid4())},
                    {**payload, 'answers': payload['answers'] * 2},
                    {**payload, 'answers': [{'question_id': str(uuid4()), 'value': 'unknown'}]}]
        for invalid in invalids:
            self.assertEqual(self.client.post(self.public + '/submissions', json=invalid).status_code, 422)
        old_public = self.public
        unrelated = self.publish('/api/forms/' + str(uuid4()), {'title': 'Other', 'questions': [question()]})
        self.assertEqual(self.client.post(old_public + '/submissions', json={**payload, 'version_id': unrelated}).status_code, 422)
        self.assertEqual(self.count(Submission), 0)
        # Nonstandard JSON NaN is rejected, not turned into a database value or a 500.
        body = json.dumps(self.payload(unrelated, [float('nan')]))
        self.assertEqual(self.client.post(self.public + '/submissions', content=body, headers={'Content-Type':'application/json'}).status_code, 422)

    def test_retry_returns_same_ack_and_conflicting_uuid_is_rejected(self):
        version = self.publish()
        payload = self.payload(version)
        first = self.client.post(self.public + '/submissions', json=payload)
        second = self.client.post(self.public + '/submissions', json=payload)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.json(), first.json())
        payload['answers'][0]['value'] = 'Different'
        self.assertEqual(self.client.post(self.public + '/submissions', json=payload).status_code, 409)
        self.assertEqual(self.count(Submission), 1)
        self.assertEqual(self.count(Answer), 1)

    def test_concurrent_identical_retries_insert_once(self):
        payload = self.payload(self.publish())
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: self.client.post(self.public + '/submissions', json=payload), range(2)))
        self.assertEqual([r.status_code for r in responses], [200, 200])
        self.assertEqual(responses[0].json(), responses[1].json())
        self.assertEqual(self.count(Submission), 1)

    def test_publish_and_submission_commit_failure_roll_back(self):
        version = self.publish()
        original = self.client.get(self.url).json()
        live = self.client.get(self.public).json()
        self.body['title'] = 'Must not persist'
        self.body['questions'].append(question())
        def fail(_):
            raise SQLAlchemyError('Simulated storage failure')
        event.listen(Session, 'before_commit', fail)
        try:
            self.assertEqual(self.client.post(self.url + '/publish', json=self.body).status_code, 503)
            payload = self.payload(version)
            self.assertEqual(self.client.post(self.public + '/submissions', json=payload).status_code, 503)
        finally:
            event.remove(Session, 'before_commit', fail)
        self.assertEqual(self.client.get(self.url).json(), original)
        self.assertEqual(self.client.get(self.public).json(), live)
        self.assertEqual(self.count(FormVersion), 1)
        self.assertEqual(self.count(Submission), 0)
        self.assertEqual(self.count(Answer), 0)
        self.assertEqual(self.client.post(self.public + '/submissions', json=payload).status_code, 200)

    def test_deleted_draft_question_still_accepts_snapshot_answers(self):
        version = self.publish()
        payload = self.payload(version)
        self.client.put(self.url, json={'title': 'Empty draft', 'questions': []})
        self.assertEqual(self.client.post(self.public + '/submissions', json=payload).status_code, 200)

    def test_optional_null_and_blank_answers_have_no_rows(self):
        self.body['questions'] = [question(required=False), question(required=False)]
        version = self.publish()
        self.assertEqual(self.client.post(self.public + '/submissions', json=self.payload(version, [None, '  '])).status_code, 200)
        self.assertEqual(self.count(Answer), 0)

    def test_submission_waiting_for_unpublish_lock_is_rejected(self):
        payload = self.payload(self.publish())
        with self.app.state.sessions() as lock:
            lock.connection().exec_driver_sql('BEGIN IMMEDIATE')
            lock.connection().exec_driver_sql('UPDATE publications SET active_version_id=NULL')
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(self.client.post, self.public + '/submissions', json=payload)
                lock.commit()
                self.assertEqual(future.result(timeout=15).status_code, 409)
        self.assertEqual(self.count(Submission), 0)

    def test_snapshots_cannot_be_updated_or_deleted(self):
        version = self.publish()
        with self.app.state.sessions() as session:
            with self.assertRaises(SQLAlchemyError):
                session.query(FormVersion).filter_by(id=version).update({'snapshot': '{}'})
            session.rollback()
            with self.assertRaises(SQLAlchemyError):
                session.query(FormVersion).filter_by(id=version).delete()
            session.rollback()


class StageTwoMigrationTest(unittest.TestCase):
    def test_existing_v2_rows_unchanged_and_repeatable(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'stage2.sqlite3'
            engine = make_engine(path)
            migrate_stage_two(engine, path)
            engine.dispose()
            fid, qid, oid = [str(uuid4()) for _ in range(3)]
            with closing(sqlite3.connect(path)) as db, db:
                db.execute('INSERT INTO forms VALUES (?,?)', (fid, 'Preserved'))
                db.execute('INSERT INTO draft_questions VALUES (?,?,?,?,?,?,?)', (qid,fid,'dropdown',0,'Prompt','Help',1))
                db.execute('INSERT INTO choice_options VALUES (?,?,?,?)',(oid,qid,'Label',0))
                before = {table: db.execute('SELECT * FROM '+table).fetchall() for table in ['forms','draft_questions','choice_options']}
            for _ in range(2):
                with TestClient(create_app(path)) as client:
                    self.assertEqual(client.get('/api/forms/'+fid).status_code,200)
            with closing(sqlite3.connect(path)) as db:
                for table, rows in before.items():
                    self.assertEqual(db.execute('SELECT * FROM '+table).fetchall(),rows)
                self.assertEqual(db.execute('PRAGMA user_version').fetchone()[0],3)
            self.assertTrue(path.with_name(path.name+'.stage2-backup.sqlite3').exists())
