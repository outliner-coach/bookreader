import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models.schemas import HealthResponse
from routers import ocr_router, tts_router
from services.tts_service import get_tts_service, init_tts_service
from services.ocr_service import init_ocr_client

# Load environment variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown."""
    # Startup
    print("Starting Storybook Reader API...")

    # Initialize OCR client
    try:
        init_ocr_client()
        print("OCR client initialized")
    except ValueError as e:
        print(f"Warning: OCR client not initialized - {e}")

    # Initialize TTS service
    try:
        init_tts_service()
        print("TTS service initialized")
    except Exception as e:
        print(f"Warning: TTS service initialization failed - {e}")

    yield

    # Shutdown
    print("Shutting down Storybook Reader API...")


# Create FastAPI app
app = FastAPI(
    title="Storybook Reader API",
    description="API for reading storybooks aloud using OCR and TTS",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ocr_router)
app.include_router(tts_router)


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint."""
    return {
        "message": "Storybook Reader API",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    tts_service = get_tts_service()
    return HealthResponse(
        status="healthy",
        tts_model_loaded=tts_service.is_loaded(),
        gpu_available=tts_service.is_gpu_available()
    )


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True
    )
