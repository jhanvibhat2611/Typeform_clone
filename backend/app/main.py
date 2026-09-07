import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .database import database_path, make_engine, make_session_factory
from .forms import router
from .migrations import migrate
from .publication import router as publication_router
from .workspace import router as workspace_router
from .results import router as results_router


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

    app = FastAPI(title="Typeform Builder API", lifespan=lifespan)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request, exc):
        # Never echo raw answers (including non-JSON NaN) into the error response.
        return JSONResponse(status_code=422, content={"detail": [
            {"loc": error["loc"], "msg": error["msg"], "type": error["type"]}
            for error in exc.errors()
        ]})
    origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
        allow_methods=["GET", "PUT", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )
    app.include_router(workspace_router)
    app.include_router(results_router)
    app.include_router(router)
    app.include_router(publication_router)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
