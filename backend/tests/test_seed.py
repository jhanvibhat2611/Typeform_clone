import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
from unittest.mock import patch
from uuid import uuid4
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import create_app
from app.seed import fixtures, seed_demo, seed_id


class SeedTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'demo.sqlite3'
        self.client = TestClient(create_app(self.path))
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def rows(self):
        with closing(sqlite3.connect(self.path)) as db:
            return {t: sorted(db.execute('SELECT * FROM ' + t).fetchall(), key=repr) for t in
                    ['forms', 'draft_questions', 'choice_options', 'publications', 'form_versions', 'submissions', 'answers']}

    def unrelated(self):
        form = self.client.post('/api/forms', json={'title': 'Event Registration'}).json()
        q = {'id': str(uuid4()), 'type': 'short_text', 'prompt': 'Keep my answer', 'description': '', 'required': True, 'options': []}
        pub = self.client.post('/api/forms/' + form['id'] + '/publish', json={'title': form['title'], 'questions': [q]}).json()['publication']
        result = self.client.post('/api/public/' + pub['public_id'] + '/submissions', json={
            'submission_id': str(uuid4()), 'version_id': pub['active_version_id'], 'answers': [{'question_id': q['id'], 'value': 'Keep this'}]})
        self.assertEqual(result.status_code, 200)

    def test_records_summaries_idempotency_and_unrelated_data(self):
        self.unrelated()  # Same title must not be confused with seed identities.
        before = self.rows()
        self.assertEqual([r['status'] for r in seed_demo(self.path)], ['created', 'created'])
        after = self.rows()
        for table, rows in before.items():
            self.assertTrue(all(row in after[table] for row in rows), table)
        listing = self.client.get('/api/forms').json()
        kinds = set()
        for fixture in fixtures():
            key = fixture['key']; form_id = seed_id(key + '/form')
            row = next(row for row in listing if row['id'] == form_id)
            self.assertEqual((row['title'], row['status'], row['response_count']), (fixture['title'], 'published', 5))
            public = self.client.get('/api/public/' + seed_id(key + '/public'))
            self.assertEqual(public.status_code, 200)
            snapshot = public.json()['snapshot']; kinds.update(q['type'] for q in snapshot['questions'])
            self.assertEqual([q['position'] for q in snapshot['questions']], list(range(6)))
            result = self.client.get(f'/api/forms/{form_id}/versions/{seed_id(key + "/version/1")}/results').json()
            self.assertEqual(len(result['submissions']), 5)
            s = result['summaries']
            if key == 'event-registration':
                self.assertEqual([d['count'] for d in s[2]['distribution']], [2, 2, 1])
                self.assertEqual((s[3]['minimum'], s[3]['maximum']), (0, 2))
                self.assertEqual([d['count'] for d in s[4]['distribution']], [3, 2])
                self.assertEqual(s[5]['unanswered'], 2)
            else:
                self.assertEqual([d['count'] for d in s[0]['distribution']], [0, 1, 1, 2, 1])
                self.assertEqual([d['count'] for d in s[1]['distribution']], [2, 1, 2])
                self.assertEqual((s[4]['unanswered'], s[5]['unanswered']), (1, 2))
        self.assertEqual(kinds, {'short_text', 'long_text', 'email', 'number', 'yes_no', 'rating', 'dropdown', 'multiple_choice'})
        self.assertEqual([r['status'] for r in seed_demo(self.path)], ['skipped-existing', 'skipped-existing'])
        self.assertEqual(self.rows(), after)

    def test_seed_edits_and_unpublication_are_preserved(self):
        seed_demo(self.path); form_id = seed_id('event-registration/form')
        self.assertEqual(self.client.put('/api/forms/' + form_id, json={'title': 'My edited event', 'questions': []}).status_code, 200)
        self.assertEqual(self.client.post('/api/forms/' + form_id + '/unpublish').status_code, 200)
        before = self.rows(); seed_demo(self.path); self.assertEqual(self.rows(), before)

    def test_invalid_fixture_rolls_back_both_forms(self):
        self.unrelated(); before = self.rows(); data = fixtures(); data[1]['rows'][0][-1] = 'not-an-email'
        with patch('app.seed.fixtures', return_value=data), self.assertRaises(HTTPException):
            seed_demo(self.path)
        self.assertEqual(self.rows(), before)

    def test_command_fresh_database_and_repeat(self):
        path = Path(self.temp.name) / 'command.sqlite3'; env = {**os.environ, 'SQLITE_PATH': str(path)}
        def run():
            return json.loads(subprocess.run([sys.executable, '-m', 'app.seed'], cwd=Path(__file__).parents[1],
                env=env, text=True, capture_output=True, check=True).stdout)
        self.assertEqual([r['status'] for r in run()['forms']], ['created', 'created'])
        with closing(sqlite3.connect(path)) as db:
            before = db.execute('SELECT * FROM submissions ORDER BY id').fetchall()
            self.assertEqual(len(before), 10)
            self.assertEqual(db.execute('SELECT count(*) FROM answers').fetchone()[0], 55)
        self.assertEqual([r['status'] for r in run()['forms']], ['skipped-existing', 'skipped-existing'])
        with closing(sqlite3.connect(path)) as db:
            self.assertEqual(db.execute('SELECT * FROM submissions ORDER BY id').fetchall(), before)
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
