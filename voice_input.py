#!/usr/bin/env python3
"""
음성 입력 도구
마이크로 녹음 → Whisper 변환 → 클립보드 복사
엔터를 누르면 녹음 시작/종료
"""

import sys
import tempfile
import numpy as np
import sounddevice as sd
import whisper
import pyperclip
from scipy.io import wavfile


# 설정
SAMPLE_RATE = 16000  # Whisper 권장 샘플레이트
MODEL_NAME = "medium"  # tiny, base, small, medium, large


def record_audio():
    """엔터로 녹음 시작/종료"""
    print("\n🎤 엔터를 누르면 녹음 시작...")
    input()

    print("🔴 녹음 중... (엔터를 누르면 종료)")

    # 녹음 데이터 저장용
    frames = []

    def callback(indata, frame_count, time_info, status):
        frames.append(indata.copy())

    # 녹음 시작
    stream = sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype=np.float32,
        callback=callback
    )

    with stream:
        input()  # 엔터 대기

    print("⏹️  녹음 종료")

    # 녹음 데이터 합치기
    if not frames:
        return None

    audio_data = np.concatenate(frames, axis=0)
    return audio_data


def transcribe(audio_data, model):
    """오디오 데이터를 텍스트로 변환"""
    # 임시 파일로 저장
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        # float32를 int16으로 변환
        audio_int16 = (audio_data * 32767).astype(np.int16)
        wavfile.write(f.name, SAMPLE_RATE, audio_int16)
        temp_path = f.name

    # 변환
    result = model.transcribe(temp_path, language="ko")

    # 임시 파일 삭제
    import os
    os.unlink(temp_path)

    return result["text"].strip()


def main():
    print("=" * 50)
    print("🎙️  음성 입력 도구")
    print("=" * 50)
    print(f"모델: {MODEL_NAME}")
    print("Ctrl+C로 종료")
    print("=" * 50)

    print("\n모델 로딩 중...")
    model = whisper.load_model(MODEL_NAME, device="cpu")
    print("모델 로딩 완료!")

    try:
        while True:
            # 녹음
            audio_data = record_audio()

            if audio_data is None or len(audio_data) < SAMPLE_RATE * 0.5:
                print("⚠️  녹음이 너무 짧습니다.")
                continue

            # 변환
            print("🔄 변환 중...")
            text = transcribe(audio_data, model)

            if text:
                # 클립보드에 복사
                pyperclip.copy(text)
                print(f"\n✅ 변환 완료 (클립보드에 복사됨):")
                print(f"   \"{text}\"")
                print("\n   Cmd+V로 붙여넣기 하세요!")
            else:
                print("⚠️  인식된 텍스트가 없습니다.")

    except KeyboardInterrupt:
        print("\n\n👋 종료합니다.")
        sys.exit(0)


if __name__ == "__main__":
    main()
