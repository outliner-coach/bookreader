from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class Language(str, Enum):
    KOREAN = "ko"
    ENGLISH = "en"
    AUTO = "auto"


class VoiceStyle(str, Enum):
    WARM = "warm"  # 따뜻한 톤 (동화책 기본)
    PLAYFUL = "playful"  # 발랄한 톤
    CALM = "calm"  # 차분한 톤
    EXPRESSIVE = "expressive"  # 감정 표현이 풍부한 톤


# OCR Request/Response
class OCRRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    language: Language = Field(default=Language.AUTO, description="Target language for OCR")


class OCRResponse(BaseModel):
    text: str = Field(..., description="Extracted text from image")
    detected_language: Language = Field(..., description="Detected language")
    confidence: float = Field(default=1.0, description="OCR confidence score")


# TTS Request/Response
class TTSRequest(BaseModel):
    text: str = Field(..., description="Text to convert to speech")
    language: Language = Field(default=Language.AUTO, description="Language of the text")
    voice_style: VoiceStyle = Field(default=VoiceStyle.WARM, description="Voice style for TTS")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="Speech speed (0.5-2.0)")


class TTSResponse(BaseModel):
    audio_base64: str = Field(..., description="Base64 encoded audio (WAV format)")
    duration_seconds: float = Field(..., description="Audio duration in seconds")


# Combined Read Request/Response (Image -> Audio)
class ReadRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    language: Language = Field(default=Language.AUTO, description="Language preference")
    voice_style: VoiceStyle = Field(default=VoiceStyle.WARM, description="Voice style for TTS")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="Speech speed")


class ReadResponse(BaseModel):
    text: str = Field(..., description="Extracted text from image")
    audio_base64: str = Field(..., description="Base64 encoded audio")
    detected_language: Language = Field(..., description="Detected language")
    duration_seconds: float = Field(..., description="Audio duration in seconds")


# Health Check
class HealthResponse(BaseModel):
    status: str = Field(default="healthy")
    tts_model_loaded: bool = Field(..., description="Whether TTS model is loaded")
    gpu_available: bool = Field(..., description="Whether GPU is available")
