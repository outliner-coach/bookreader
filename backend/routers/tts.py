from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import io
import base64

from models.schemas import TTSRequest, TTSResponse, ReadRequest, ReadResponse
from services.tts_service import get_tts_service
from services.ocr_service import extract_text_from_image

router = APIRouter(prefix="/api", tags=["TTS"])


@router.post("/tts", response_model=TTSResponse)
async def tts_endpoint(request: TTSRequest) -> TTSResponse:
    """
    Convert text to speech using Qwen3-TTS.

    - **text**: Text to convert to speech
    - **language**: Language of the text (ko, en, or auto)
    - **voice_style**: Voice style (warm, playful, calm, expressive)
    - **speed**: Speech speed (0.5-2.0, default 1.0)

    Returns base64 encoded WAV audio and duration.
    """
    try:
        tts_service = get_tts_service()

        audio_base64, duration = await tts_service.generate_speech(
            text=request.text,
            language=request.language,
            voice_style=request.voice_style,
            speed=request.speed
        )

        return TTSResponse(
            audio_base64=audio_base64,
            duration_seconds=duration
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"TTS processing failed: {str(e)}"
        )


@router.post("/tts/stream")
async def tts_stream_endpoint(request: TTSRequest):
    """
    Convert text to speech and stream the audio.

    Returns audio as a streaming WAV response.
    """
    try:
        tts_service = get_tts_service()

        audio_base64, _ = await tts_service.generate_speech(
            text=request.text,
            language=request.language,
            voice_style=request.voice_style,
            speed=request.speed
        )

        # Decode base64 to bytes
        audio_bytes = base64.b64decode(audio_base64)

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=speech.wav"
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"TTS streaming failed: {str(e)}"
        )


@router.post("/read", response_model=ReadResponse)
async def read_endpoint(request: ReadRequest) -> ReadResponse:
    """
    Combined OCR + TTS: Extract text from image and convert to speech.

    - **image_base64**: Base64 encoded image
    - **language**: Language preference (ko, en, or auto)
    - **voice_style**: Voice style for TTS
    - **speed**: Speech speed (0.5-2.0)

    Returns extracted text, audio, detected language, and duration.
    """
    try:
        # Step 1: OCR - Extract text from image
        text, detected_language, _ = await extract_text_from_image(
            image_base64=request.image_base64,
            language=request.language
        )
        print(f"OCR detected_language={detected_language} text_len={len(text)}")

        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="No text found in the image"
            )

        # Step 2: TTS - Convert text to speech
        tts_service = get_tts_service()
        audio_base64, duration = await tts_service.generate_speech(
            text=text,
            language=detected_language,
            voice_style=request.voice_style,
            speed=request.speed
        )

        return ReadResponse(
            text=text,
            audio_base64=audio_base64,
            detected_language=detected_language,
            duration_seconds=duration
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Read processing failed: {str(e)}"
        )
