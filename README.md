# Storybook Reader

동화책 사진을 찍으면 OCR로 텍스트를 추출하고 Qwen3-TTS로 읽어주는 모바일 앱

## Architecture

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│  React Native   │     │         Local GPU Server            │
│    Android App  │────▶│  ┌─────────────┐  ┌──────────────┐  │
│                 │     │  │  FastAPI    │  │  Qwen3-TTS   │  │
│  - Camera       │◀────│  │  Server     │  │  Model       │  │
│  - Audio Player │     │  └─────────────┘  └──────────────┘  │
└─────────────────┘     └─────────────────────────────────────┘
                                    │
                                    ▼
                        ┌─────────────────────┐
                        │   OpenAI API        │
                        │   (GPT-4o Vision)   │
                        └─────────────────────┘
```

## Requirements

### Backend Server
- Python 3.12+ (Qwen3-TTS 권장)
- NVIDIA GPU with 4GB+ VRAM (for 0.6B model) or 8GB+ (for 1.7B model)
- CUDA 11.8+

### Mobile App
- Node.js 18+
- Expo CLI
- Android device or emulator

## Setup

### 1. Backend Server

```bash
cd backend

# Create virtual environment
/usr/bin/python3 -m venv venv312
source venv312/bin/activate  # On Windows: venv312\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Run server
python main.py
# Or with uvicorn:
# uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Mobile App

```bash
cd mobile

# Install dependencies
npm install

# Configure API URL
# Edit src/services/api.ts and set your server IP address

# Start development server
npx expo start

# Run on Android
npx expo start --android
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/ocr` | POST | Extract text from image |
| `/api/tts` | POST | Convert text to speech |
| `/api/read` | POST | Combined OCR + TTS |

### Example: /api/read

Request:
```json
{
  "image_base64": "base64_encoded_image",
  "language": "auto",
  "voice_style": "warm",
  "speed": 1.0
}
```

Response:
```json
{
  "text": "Once upon a time...",
  "audio_base64": "base64_encoded_wav",
  "detected_language": "en",
  "duration_seconds": 5.2
}
```

## Project Structure

```
voice_test/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment variables template
│   ├── models/
│   │   └── schemas.py       # Pydantic schemas
│   ├── routers/
│   │   ├── ocr.py           # OCR endpoints
│   │   └── tts.py           # TTS endpoints
│   └── services/
│       ├── ocr_service.py   # GPT-4o Vision integration
│       └── tts_service.py   # Qwen3-TTS wrapper
│
└── mobile/
    ├── App.tsx              # App entry point
    ├── package.json         # Node dependencies
    ├── app.json             # Expo configuration
    └── src/
        ├── screens/
        │   ├── HomeScreen.tsx
        │   ├── CameraScreen.tsx
        │   └── PlayerScreen.tsx
        ├── components/
        │   ├── AudioPlayer.tsx
        │   └── LoadingOverlay.tsx
        ├── services/
        │   └── api.ts       # Backend API client
        └── utils/
            └── imageUtils.ts
```

## Features

- **OCR**: GPT-4o Vision for accurate text extraction
- **TTS**: Qwen3-TTS with multiple voice styles
- **Languages**: Korean and English support
- **Voice Styles**: Warm, Playful, Calm, Expressive
- **Speed Control**: 0.5x - 2.0x playback speed

## Performance & UX Notes

- 모바일은 **OCR과 TTS를 분리 호출**해 텍스트를 먼저 보여주고, 음성은 뒤에서 생성합니다.
- 이미지 해상도/압축률을 낮춰 OCR 처리 시간을 줄입니다.

## Configuration

### Voice Styles
- `warm`: Friendly, warm tone (default for storybooks)
- `playful`: Energetic, fun tone
- `calm`: Soothing, gentle tone
- `expressive`: Emotionally rich tone

### TTS Model Size
Set in `.env`:
- `TTS_MODEL_SIZE=0.6B`: Faster, less VRAM
- `TTS_MODEL_SIZE=1.7B`: Higher quality, more VRAM

### OCR Model (Speed/Quality)
Set in `.env`:
- `OCR_MODEL=gpt-4o-mini`: 빠른 OCR (기본)
- `OCR_FALLBACK_MODEL=gpt-4o`: 실패 시 재시도 모델
- `OCR_MAX_TOKENS=1200`: OCR 응답 최대 토큰 수

### Force TTS Language / Speaker
Set in `.env`:
- `TTS_FORCE_LANGUAGE=english` 또는 `korean`
- `TTS_EN_SPEAKER=ryan` (영어 스피커 고정 예시)

## Troubleshooting

### Server won't start
- Check OPENAI_API_KEY is set
- Verify CUDA is installed for GPU support

### App can't connect to server
- Ensure server is running
- Check firewall settings
- For Android emulator, use `10.0.2.2` as server IP
- For physical device, use your computer's local IP

### TTS model loading fails
- Check GPU memory availability
- Try smaller model size (0.6B)
- Ensure CUDA version compatibility
