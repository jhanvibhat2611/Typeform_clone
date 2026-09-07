"""Permit whole-form deletion while keeping live snapshot history immutable."""
import sqlite3
from contextlib import closing


def migrate_workspace(engine, path):
    with closing(sqlite3.connect(path)) as source:
        version = source.execute('PRAGMA user_version').fetchone()[0]
        if version == 4:
            return
        if version != 3:
            raise RuntimeError('Expected database version 3')
        backup = path.with_name(path.name + '.stage3-backup.sqlite3')
        if not backup.exists():
            with closing(sqlite3.connect(backup)) as destination:
                source.backup(destination)
    with engine.connect() as connection:
        try:
            connection.exec_driver_sql('BEGIN IMMEDIATE')
            if connection.exec_driver_sql('PRAGMA user_version').scalar_one() == 4:
                connection.commit()
                return
            connection.exec_driver_sql('DROP TRIGGER immutable_version_delete')
            connection.exec_driver_sql('''CREATE TRIGGER immutable_version_delete
                BEFORE DELETE ON form_versions
                WHEN EXISTS (SELECT 1 FROM publications WHERE form_id=OLD.form_id)
                BEGIN SELECT RAISE(ABORT, 'Remove publication before deleting form history'); END''')
            connection.exec_driver_sql('PRAGMA user_version=4')
            connection.commit()
        except Exception:
            connection.rollback()
            raise
