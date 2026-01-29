import os
import base64
import asyncio
from typing import Optional, Tuple
from openai import OpenAI
from models.schemas import Language

client: Optional[OpenAI] = None


def init_ocr_client():
    """Initialize OpenAI client."""
    global client
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    client = OpenAI(api_key=api_key)


def detect_language(text: str) -> Language:
    """Detect language from text (simple heuristic)."""
    korean_chars = sum(1 for c in text if '\uac00' <= c <= '\ud7af' or '\u1100' <= c <= '\u11ff')
    total_chars = len(text.replace(" ", "").replace("\n", ""))

    if total_chars == 0:
        return Language.KOREAN

    korean_ratio = korean_chars / total_chars
    if korean_ratio > 0.3:
        return Language.KOREAN
    return Language.ENGLISH


async def extract_text_from_image(
    image_base64: str,
    language: Language = Language.AUTO
) -> Tuple[str, Language, float]:
    """
    Extract text from image using GPT-4o Vision.

    Args:
        image_base64: Base64 encoded image
        language: Target language (AUTO for auto-detection)

    Returns:
        Tuple of (extracted_text, detected_language, confidence)
    """
    global client
    if client is None:
        init_ocr_client()

    # Build language instruction
    lang_instruction = ""
    if language == Language.KOREAN:
        lang_instruction = "텍스트는 한국어입니다."
    elif language == Language.ENGLISH:
        lang_instruction = "The text is in English."
    else:
        lang_instruction = "텍스트는 한국어 또는 영어일 수 있습니다."

    prompt = f"""이 동화책 페이지의 텍스트를 정확하게 추출해주세요.

규칙:
- 본문 텍스트만 추출하세요 (페이지 번호, 출판사 정보, 저작권 표시 제외)
- 줄바꿈과 문단 구분을 유지하세요
- 대화문의 따옴표는 그대로 유지하세요
- 이미지에 텍스트가 없으면 빈 문자열을 반환하세요
- 텍스트만 반환하고, 다른 설명이나 코멘트는 추가하지 마세요

{lang_instruction}"""

    # Ensure proper base64 format
    if not image_base64.startswith("data:"):
        # Add data URL prefix if missing
        image_base64 = f"data:image/jpeg;base64,{image_base64}"

    primary_model = os.getenv("OCR_MODEL", "gpt-4o-mini")
    fallback_model = os.getenv("OCR_FALLBACK_MODEL", "gpt-4o")
    try:
        max_tokens = int(os.getenv("OCR_MAX_TOKENS", "1200"))
    except ValueError:
        max_tokens = 1200

    def is_refusal(text: str) -> bool:
        if not text:
            return True
        lowered = text.strip().lower()
        return any(
            phrase in lowered
            for phrase in [
                "can't assist",
                "cannot assist",
                "can't help with that image",
                "cannot help with that image",
                "can't process",
                "cannot process",
                "처리할 수 없습니다",
                "도와드릴 수 없습니다",
                "죄송하지만",
            ]
        )

    async def call_ocr(model_name: str) -> str:
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": image_base64}
                        }
                    ]
                }
            ],
            max_tokens=max_tokens,
            temperature=0.1  # Low temperature for accurate OCR
        )
        content = response.choices[0].message.content or ""
        return content.strip()

    extracted_text = await call_ocr(primary_model)
    if is_refusal(extracted_text):
        print(f"OCR refusal or empty response from {primary_model}. Retrying with {fallback_model}...")
        extracted_text = await call_ocr(fallback_model)

    if is_refusal(extracted_text):
        raise ValueError("이미지에서 텍스트를 추출할 수 없습니다. 밝은 환경에서 다시 촬영해 주세요.")

    # Detect language if AUTO
    detected_lang = language if language != Language.AUTO else detect_language(extracted_text)

    # Confidence is estimated (GPT-4o doesn't provide confidence scores)
    confidence = 0.95 if extracted_text else 0.0

    return extracted_text, detected_lang, confidence
