import os
import io
import base64
from typing import Tuple, Optional

import soundfile as sf
import numpy as np

from models.schemas import Language, VoiceStyle

# Qwen3-TTS import
try:
    import torch
    from qwen_tts import Qwen3TTSModel
    QWEN_TTS_AVAILABLE = True
except ImportError:
    QWEN_TTS_AVAILABLE = False
    torch = None
    Qwen3TTSModel = None


class TTSService:
    """Qwen3-TTS Service for text-to-speech conversion."""

    def __init__(self):
        self.model: Optional[Qwen3TTSModel] = None
        self.device = None
        self.model_loaded = False
        self.sample_rate = 24000  # Qwen3-TTS sample rate
        self.speaker_overrides = {
            Language.KOREAN: None,
            Language.ENGLISH: None,
            Language.AUTO: None,
        }
        self.force_language = (os.getenv("TTS_FORCE_LANGUAGE") or "").strip().lower()

        # Voice style mappings for Qwen3-TTS CustomVoice
        # Available speakers (per model): aiden, dylan, eric, ono_anna, ryan, serena, sohee, uncle_fu, vivian
        self.voice_styles = {
            VoiceStyle.WARM: "sohee",
            VoiceStyle.PLAYFUL: "ryan",
            VoiceStyle.CALM: "ono_anna",
            VoiceStyle.EXPRESSIVE: "vivian",
        }

        # Language mapping for Qwen3-TTS (lowercase matches model config)
        self.language_map = {
            Language.KOREAN: "korean",
            Language.ENGLISH: "english",
            Language.AUTO: "auto",
        }

    def load_model(self, model_size: str = "0.6B"):
        """
        Load Qwen3-TTS model.

        Args:
            model_size: Model size ("0.6B" or "1.7B")
        """
        if self.model_loaded:
            return

        if not QWEN_TTS_AVAILABLE:
            print("qwen-tts package not available. Using mock TTS mode.")
            return

        self.speaker_overrides[Language.KOREAN] = os.getenv("TTS_KO_SPEAKER") or None
        self.speaker_overrides[Language.ENGLISH] = os.getenv("TTS_EN_SPEAKER") or None
        self.force_language = (os.getenv("TTS_FORCE_LANGUAGE") or "").strip().lower()

        # Determine device
        if torch.cuda.is_available():
            self.device = "cuda:0"
            dtype = torch.bfloat16
        elif torch.backends.mps.is_available():
            self.device = "mps"
            dtype = torch.float32  # MPS doesn't support bfloat16
        else:
            self.device = "cpu"
            dtype = torch.float32

        print(f"Loading Qwen3-TTS model ({model_size}) on {self.device}...")

        # Model name based on size
        if model_size == "1.7B":
            model_name = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
        else:
            model_name = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"

        try:
            self.model = Qwen3TTSModel.from_pretrained(
                model_name,
                device_map=self.device,
                dtype=dtype,
            )
            self.model_loaded = True
            print(f"Qwen3-TTS model loaded successfully on {self.device}")

        except Exception as e:
            print(f"Error loading Qwen3-TTS model: {e}")
            print("Falling back to mock TTS mode for development...")
            self.model_loaded = False

    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self.model_loaded

    def is_gpu_available(self) -> bool:
        """Check if GPU is available."""
        if not QWEN_TTS_AVAILABLE or torch is None:
            return False
        return torch.cuda.is_available() or torch.backends.mps.is_available()

    def _get_speaker(self, voice_style: VoiceStyle, language: Language) -> str:
        """Get speaker name for voice style."""
        override = self.speaker_overrides.get(language)
        if override:
            return override
        return self.voice_styles.get(voice_style, "sohee")

    def _get_language(self, language: Language) -> str:
        """Get language string for Qwen3-TTS."""
        return self.language_map.get(language, "korean")

    def _infer_language_from_text(self, text: str) -> Language:
        """Infer language from text with a simple Hangul check."""
        for c in text:
            if '\uac00' <= c <= '\ud7af' or '\u1100' <= c <= '\u11ff':
                return Language.KOREAN
        return Language.ENGLISH

    async def generate_speech(
        self,
        text: str,
        language: Language = Language.AUTO,
        voice_style: VoiceStyle = VoiceStyle.WARM,
        speed: float = 1.0
    ) -> Tuple[str, float]:
        """
        Generate speech from text using Qwen3-TTS.

        Args:
            text: Text to convert to speech
            language: Language of the text
            voice_style: Voice style to use
            speed: Speech speed (0.5-2.0)

        Returns:
            Tuple of (audio_base64, duration_seconds)
        """
        if not text.strip():
            return "", 0.0

        if self.force_language in ("en", "english"):
            language = Language.ENGLISH
        elif self.force_language in ("ko", "korean"):
            language = Language.KOREAN

        if language == Language.AUTO:
            language = self._infer_language_from_text(text)
        elif language == Language.ENGLISH and self._infer_language_from_text(text) == Language.KOREAN:
            language = Language.KOREAN

        if self.model_loaded and self.model is not None:
            return await self._generate_with_model(text, language, voice_style, speed)
        else:
            return self._generate_mock_audio(text, speed)

    async def _generate_with_model(
        self,
        text: str,
        language: Language,
        voice_style: VoiceStyle,
        speed: float
    ) -> Tuple[str, float]:
        """Generate speech using the actual Qwen3-TTS model."""
        try:
            speaker = self._get_speaker(voice_style, language)
            lang = self._get_language(language)
            print(f"TTS generate: language={lang} speaker={speaker} text_sample={text[:24].replace(chr(10),' ')}")

            # Generate audio using Qwen3-TTS
            wavs, sr = self.model.generate_custom_voice(
                text=text,
                language=lang,
                speaker=speaker,
            )

            # Get the first audio output
            audio_array = wavs[0]

            # Apply speed adjustment if needed
            if speed != 1.0:
                audio_array = self._adjust_speed(audio_array, sr, speed)

            # Convert to base64
            audio_base64, duration = self._audio_to_base64(audio_array, sr)

            return audio_base64, duration

        except Exception as e:
            print(f"Error generating speech: {e}")
            return self._generate_mock_audio(text, speed)

    def _adjust_speed(self, audio: np.ndarray, sr: int, speed: float) -> np.ndarray:
        """Adjust audio playback speed using resampling."""
        try:
            import librosa
            # Time stretch without pitch change
            return librosa.effects.time_stretch(audio, rate=speed)
        except ImportError:
            # Simple resampling as fallback
            new_length = int(len(audio) / speed)
            indices = np.linspace(0, len(audio) - 1, new_length).astype(int)
            return audio[indices]

    def _generate_mock_audio(self, text: str, speed: float) -> Tuple[str, float]:
        """Generate mock audio for development/testing."""
        word_count = len(text.split())
        duration = (word_count / 150) * 60 / speed
        duration = max(1.0, min(duration, 300.0))

        sample_rate = 24000
        samples = int(duration * sample_rate)

        # Generate a simple tone for testing
        t = np.linspace(0, duration, samples, dtype=np.float32)
        audio_array = 0.01 * np.sin(2 * np.pi * 440 * t).astype(np.float32)

        audio_base64, actual_duration = self._audio_to_base64(audio_array, sample_rate)
        return audio_base64, actual_duration

    def _audio_to_base64(
        self,
        audio_array: np.ndarray,
        sample_rate: int
    ) -> Tuple[str, float]:
        """Convert audio array to base64 encoded WAV."""
        buffer = io.BytesIO()
        sf.write(buffer, audio_array, sample_rate, format="WAV")
        buffer.seek(0)

        audio_base64 = base64.b64encode(buffer.read()).decode("utf-8")
        duration = len(audio_array) / sample_rate

        return audio_base64, duration


# Global TTS service instance
tts_service = TTSService()


def get_tts_service() -> TTSService:
    """Get the global TTS service instance."""
    return tts_service


def init_tts_service():
    """Initialize the TTS service with model loading."""
    model_size = os.getenv("TTS_MODEL_SIZE", "0.6B")
    tts_service.load_model(model_size)
