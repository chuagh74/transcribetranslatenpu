# main.py

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Import routers from the server/routers directory.
from server.routers.transcribe import router as transcribe_router
from server.routers.transcribe_ws import router as transcribe_ws_router
from server.routers.translate import router as translate_router
from server.routers.list_models import router as list_models_router
from server.routers.tts import router as tts_router

def create_app() -> FastAPI:
    app = FastAPI(
        title="Transcribe API",
        description="Production-grade API for speech-to-text and text-to-speech services.",
        version="1.0.0"
    )

    # Configure logging.
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("main")

    # Add CORS middleware.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # In production, restrict this to trusted origins.
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Mount static files for your UI/demo, if available.
    # app.mount("/ui", StaticFiles(directory="frontend", html=True), name="ui")

    # Include routers.
    app.include_router(transcribe_router)
    app.include_router(translate_router)
    app.include_router(transcribe_ws_router)
    app.include_router(tts_router)

    app.include_router(list_models_router)

    # Global exception handler.
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

    # Startup and shutdown events.
    @app.on_event("startup")
    async def startup_event():
        logger.info("Application starting up...")

    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info("Application shutting down...")

    return app

app = create_app()
