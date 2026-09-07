import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import database_path, make_engine, make_session_factory
from .forms import router
from .migrations import migrate


def create_app(path: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        resolved_path = path or database_path()
        engine = make_engine(resolved_path)
        try:
            migrate(engine, resolved_path)
            app.state.sessions = make_session_factory(engine)
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="Typeform assignment — Stage 2", lifespan=lifespan)
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
