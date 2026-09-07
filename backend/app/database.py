"""SQLite configuration. Relative paths resolve from backend/, not the shell cwd."""
import os
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def database_path() -> Path:
    path = Path(os.getenv("SQLITE_PATH", "data/typeform.sqlite3")).expanduser()
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[1] / path
    return path.resolve()


def make_engine(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        "sqlite:///" + path.as_posix(),
        connect_args={"check_same_thread": False, "timeout": 10},
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    return engine


def make_session_factory(engine):
    return sessionmaker(engine, expire_on_commit=False)
