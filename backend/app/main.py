import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, database_path, make_engine, make_session_factory
from .forms import router


def create_app(path: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = make_engine(path or database_path())
        # Initial schema only. Introduce migrations before changing this schema.
        Base.metadata.create_all(engine)
        app.state.sessions = make_session_factory(engine)
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="Typeform assignment — Stage 1", lifespan=lifespan)
    origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
        allow_methods=["GET", "PUT"],
        allow_headers=["Content-Type"],
    )
    app.include_router(router)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
