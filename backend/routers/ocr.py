from fastapi import APIRouter, HTTPException

from models.schemas import OCRRequest, OCRResponse
from services.ocr_service import extract_text_from_image

router = APIRouter(prefix="/api/ocr", tags=["OCR"])


@router.post("", response_model=OCRResponse)
async def ocr_endpoint(request: OCRRequest) -> OCRResponse:
    """
    Extract text from an image using GPT-4o Vision.

    - **image_base64**: Base64 encoded image (JPEG, PNG, etc.)
    - **language**: Target language (ko, en, or auto for auto-detection)

    Returns extracted text, detected language, and confidence score.
    """
    try:
        text, detected_language, confidence = await extract_text_from_image(
            image_base64=request.image_base64,
            language=request.language
        )

        return OCRResponse(
            text=text,
            detected_language=detected_language,
            confidence=confidence
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}"
        )
