import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.main import create_app
from app.database import make_engine
from app.migrations import migrate_stage_two
from app.migrations_v3 import migrate_publication
from test_drafts import question, option


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/'workspace.sqlite3'
        self.app=create_app(self.path)
        self.client=TestClient(self.app).__enter__()
        self.form=self.client.post('/api/forms',json={'title':'Workspace test'}).json()
        self.url='/api/forms/'+self.form['id']
        self.body={'title':'Original','questions':[question('dropdown',options=[option('Old A'),option('Old B')]),question('number'),question('yes_no'),question('rating'),question(required=False)]}

    def tearDown(self):
        self.client.__exit__(None,None,None)
        self.temp.cleanup()

    def publish(self):
        response=self.client.post(self.url+'/publish',json=self.body)
        self.assertEqual(response.status_code,200,response.text)
        pub=response.json()['publication']
        return pub['active_version_id'], '/api/public/'+pub['public_id']

    def submit(self,version,public):
        values=[self.body['questions'][0]['options'][0]['id'],0,False,3]
        body={'submission_id':str(uuid4()),'version_id':version,'answers':[{'question_id':q['id'],'value':value} for q,value in zip(self.body['questions'],values)]}
        response=self.client.post(public+'/submissions',json=body)
        self.assertEqual(response.status_code,200,response.text)
        return response.json()['submission_id']

    def tables(self):
        with closing(sqlite3.connect(self.path)) as db:
            return {t:db.execute('SELECT * FROM '+t).fetchall() for t in ['forms','draft_questions','choice_options','form_versions','publications','submissions','answers']}

    def test_create_rename_refresh_and_nonblank_validation(self):
        self.assertEqual(self.client.patch(self.url,json={'title':'Renamed'}).status_code,200)
        self.assertEqual(self.client.patch(self.url,json={'title':' '}).status_code,422)
        with TestClient(create_app(self.path)) as restarted:
            row=next(x for x in restarted.get('/api/forms').json() if x['id']==self.form['id'])
            self.assertEqual((row['title'],row['status'],row['response_count']),('Renamed','draft',0))

    def test_duplicate_copies_draft_with_new_ids_no_history_and_is_independent(self):
        version,public=self.publish();self.submit(version,public)
        self.body['questions'][0]['prompt']='Draft only wording'
        self.client.put(self.url,json=self.body)
        duplicate=self.client.post(self.url+'/duplicate',json={}).json()
        self.assertNotEqual(duplicate['id'],self.form['id'])
        self.assertEqual(duplicate['questions'][0]['prompt'],'Draft only wording')
        for old,new in zip(self.body['questions'],duplicate['questions']):
            self.assertNotEqual(old['id'],new['id'])
            for oo,no in zip(old['options'],new['options']):
                self.assertNotEqual(oo['id'],no['id']);self.assertEqual(oo['label'],no['label'])
        du='/api/forms/'+duplicate['id']
        self.assertFalse(self.client.get(du+'/publication').json()['published'])
        self.assertEqual(self.client.get(du+'/results').json()['versions'],[])
        self.client.put(du,json={'title':'Independent','questions':[]})
        self.assertEqual(len(self.client.get(self.url).json()['questions']),5)
        self.assertEqual(self.client.get(self.url+'/results').json()['response_count'],1)

    def test_delete_only_target_including_history_and_responses(self):
        version,public=self.publish();self.submit(version,public)
        other=self.client.post(self.url+'/duplicate',json={}).json()
        other_before=self.client.get('/api/forms/'+other['id']).json()
        self.assertEqual(self.client.delete(self.url).status_code,200)
        self.assertEqual(self.client.get(self.url).status_code,404)
        self.assertEqual(self.client.get(public).status_code,404)
        self.assertEqual(self.client.get('/api/forms/'+other['id']).json(),other_before)
        rows=self.tables()
        for t in ['submissions','answers','form_versions']:self.assertEqual(rows[t],[])
        self.assertEqual(len(rows['forms']),1)
        self.assertEqual(len(rows['draft_questions']),5)
        self.assertEqual(len(rows['choice_options']),2)
        self.assertEqual(len(rows['publications']),1)
        self.assertEqual(self.client.delete(self.url).status_code,404)

    def test_delete_failure_rolls_back_every_table(self):
        version,public=self.publish();self.submit(version,public)
        before=self.tables()
        def fail(_):raise SQLAlchemyError('Injected delete failure')
        event.listen(Session,'before_commit',fail)
        try:self.assertEqual(self.client.delete(self.url).status_code,503)
        finally:event.remove(Session,'before_commit',fail)
        self.assertEqual(self.tables(),before)
        self.assertEqual(self.client.get(public).status_code,200)

    def test_results_use_two_snapshots_and_all_version_count(self):
        v1,public=self.publish();s1=self.submit(v1,public)
        old_question_id=self.body['questions'][-1]['id']
        self.body['questions'][0]['prompt']='New wording'
        self.body['questions'][0]['options'][0]['label']='New A'
        self.body['questions'].pop()
        v2,_=self.publish();self.submit(v2,public)
        self.client.patch(self.url,json={'title':'Renamed draft'})
        info=self.client.get(self.url+'/results').json()
        self.assertEqual(info['response_count'],2)
        self.assertEqual([v['response_count'] for v in info['versions']],[1,1])
        row=next(x for x in self.client.get('/api/forms').json() if x['id']==self.form['id'])
        self.assertEqual(row['response_count'],2)
        detail=self.client.get(self.url+'/submissions/'+s1).json()
        self.assertEqual(detail['snapshot']['questions'][0]['options'][0]['label'],'Old A')
        self.assertIn(old_question_id,[q['id'] for q in detail['snapshot']['questions']])
        first=self.client.get(self.url+'/versions/'+v1+'/results').json()
        second=self.client.get(self.url+'/versions/'+v2+'/results').json()
        self.assertEqual(first['summaries'][0]['distribution'][0],{'value':self.body['questions'][0]['options'][0]['id'],'label':'Old A','count':1})
        self.assertEqual(second['summaries'][0]['distribution'][0]['label'],'New A')
        self.assertEqual(second['summaries'][0]['question']['prompt'],'New wording')
        self.assertEqual(first['summaries'][1]['minimum'],0)
        self.assertEqual(first['summaries'][2]['distribution'][1]['count'],1)
        self.assertEqual([d['count'] for d in first['summaries'][3]['distribution']],[0,0,1,0,0])
        self.assertEqual(first['summaries'][4]['unanswered'],1)
        self.assertNotIn(old_question_id,detail['answers'])

    def test_empty_results_and_cross_form_access(self):
        self.assertEqual(self.client.get(self.url+'/results').json()['versions'],[])
        version,public=self.publish()
        result=self.client.get(self.url+'/versions/'+version+'/results').json()
        self.assertEqual(result['submissions'],[])
        self.assertEqual(result['summaries'][0]['answered'],0)
        submission=self.submit(version,public)
        other=self.client.post('/api/forms',json={'title':'Other'}).json()['id']
        self.assertEqual(self.client.get('/api/forms/'+other+'/versions/'+version+'/results').status_code,404)
        self.assertEqual(self.client.get('/api/forms/'+other+'/submissions/'+submission).status_code,404)

    def test_snapshot_still_immutable_when_unpublished(self):
        version,_=self.publish();self.client.post(self.url+'/unpublish')
        with closing(sqlite3.connect(self.path)) as db:
            with self.assertRaises(sqlite3.IntegrityError):db.execute('DELETE FROM form_versions WHERE id=?',(version,))


class WorkspaceMigrationTest(unittest.TestCase):
    def test_v3_all_data_survives_trigger_migration(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'v3.sqlite3';engine=make_engine(path)
            migrate_stage_two(engine,path);migrate_publication(engine,path);engine.dispose()
            f,q,v,p,s=[str(uuid4()) for _ in range(5)]
            with closing(sqlite3.connect(path)) as db,db:
                db.execute('INSERT INTO forms VALUES (?,?)',(f,'Keep'))
                db.execute('INSERT INTO draft_questions VALUES (?,?,?,?,?,?,?)',(q,f,'short_text',0,'Keep prompt','Help',1))
                db.execute('INSERT INTO form_versions VALUES (?,?,?,?)',(v,f,'{}','2026-09-07'))
                db.execute('INSERT INTO publications VALUES (?,?,?)',(f,p,v))
                db.execute('INSERT INTO submissions VALUES (?,?,?,?)',(s,v,'{}','2026-09-07'))
                db.execute('INSERT INTO answers VALUES (?,?,?)',(s,q,'"Keep answer"'))
                before={t:db.execute('SELECT * FROM '+t).fetchall() for t in ['forms','draft_questions','choice_options','publications','form_versions','submissions','answers']}
            for _ in range(2):
                with TestClient(create_app(path)):pass
            with closing(sqlite3.connect(path)) as db:
                for table,rows in before.items():self.assertEqual(db.execute('SELECT * FROM '+table).fetchall(),rows)
                self.assertEqual(db.execute('PRAGMA user_version').fetchone()[0],4)
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
