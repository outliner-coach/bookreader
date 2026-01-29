#!/usr/bin/env python3
"""
OpenAI Whisper 음성 텍스트 변환기
M2 Mac에서 최적화되어 실행됩니다.
"""

import argparse
import os
import sys
import whisper
import torch


def get_device():
    """사용 가능한 최적의 디바이스 반환"""
    # MPS는 Whisper의 일부 연산과 호환되지 않아 CPU 사용
    # Apple Silicon에서 CPU도 충분히 빠름
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def transcribe_audio(audio_path: str, model_name: str = "base", language: str = None) -> dict:
    """
    오디오 파일을 텍스트로 변환합니다.

    Args:
        audio_path: 오디오 파일 경로
        model_name: Whisper 모델 (tiny, base, small, medium, large)
        language: 언어 코드 (예: 'ko', 'en'). None이면 자동 감지

    Returns:
        변환 결과 딕셔너리
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {audio_path}")

    device = get_device()
    print(f"디바이스: {device}")
    print(f"모델 로딩 중: {model_name}...")

    model = whisper.load_model(model_name, device=device)

    print(f"변환 중: {audio_path}")

    options = {}
    if language:
        options["language"] = language

    result = model.transcribe(audio_path, **options)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="OpenAI Whisper 음성 텍스트 변환기",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python transcriber.py audio.mp3
  python transcriber.py audio.wav --model medium
  python transcriber.py audio.m4a --language ko
  python transcriber.py audio.mp3 --model large --output result.txt
        """
    )

    parser.add_argument("audio", help="변환할 오디오 파일 경로")
    parser.add_argument(
        "--model", "-m",
        default="base",
        choices=["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"],
        help="Whisper 모델 선택 (기본: base). 큰 모델일수록 정확하지만 느림"
    )
    parser.add_argument(
        "--language", "-l",
        default=None,
        help="언어 코드 (예: ko, en, ja). 미지정시 자동 감지"
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="결과를 저장할 파일 경로 (미지정시 터미널에 출력)"
    )
    parser.add_argument(
        "--timestamps", "-t",
        action="store_true",
        help="타임스탬프와 함께 출력"
    )

    args = parser.parse_args()

    try:
        result = transcribe_audio(args.audio, args.model, args.language)

        if args.timestamps:
            output_lines = []
            for segment in result["segments"]:
                start = segment["start"]
                end = segment["end"]
                text = segment["text"].strip()
                line = f"[{start:.2f} - {end:.2f}] {text}"
                output_lines.append(line)
            output_text = "\n".join(output_lines)
        else:
            output_text = result["text"].strip()

        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(output_text)
            print(f"\n결과가 저장되었습니다: {args.output}")
        else:
            print("\n" + "=" * 50)
            print("변환 결과:")
            print("=" * 50)
            print(output_text)
            print("=" * 50)

        # 감지된 언어 표시
        if "language" in result:
            print(f"\n감지된 언어: {result['language']}")

    except FileNotFoundError as e:
        print(f"오류: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"오류 발생: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
