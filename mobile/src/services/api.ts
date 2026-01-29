import axios, { AxiosInstance } from 'axios';

// API Configuration
// 실제 휴대폰에서 테스트할 때는 컴퓨터의 로컬 IP 사용
const API_BASE_URL = 'http://192.168.219.103:8000';

// Types
export type Language = 'ko' | 'en' | 'auto';
export type VoiceStyle = 'warm' | 'playful' | 'calm' | 'expressive';

export interface OCRRequest {
  image_base64: string;
  language?: Language;
}

export interface OCRResponse {
  text: string;
  detected_language: Language;
  confidence: number;
}

export interface TTSRequest {
  text: string;
  language?: Language;
  voice_style?: VoiceStyle;
  speed?: number;
}

export interface TTSResponse {
  audio_base64: string;
  duration_seconds: number;
}

export interface ReadRequest {
  image_base64: string;
  language?: Language;
  voice_style?: VoiceStyle;
  speed?: number;
}

export interface ReadResponse {
  text: string;
  audio_base64: string;
  detected_language: Language;
  duration_seconds: number;
}

export interface HealthResponse {
  status: string;
  tts_model_loaded: boolean;
  gpu_available: boolean;
}

// API Client
class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 120000, // 2 minutes for TTS processing
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // Server responded with error
          const message = error.response.data?.detail || 'Server error';
          throw new Error(message);
        } else if (error.request) {
          // No response received
          throw new Error('Cannot connect to server. Please check your connection.');
        } else {
          throw new Error('Request failed. Please try again.');
        }
      }
    );
  }

  /**
   * Update the base URL (useful for connecting to different servers)
   */
  setBaseUrl(url: string): void {
    this.client.defaults.baseURL = url;
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/health');
    return response.data;
  }

  /**
   * Extract text from image using OCR
   */
  async extractText(request: OCRRequest): Promise<OCRResponse> {
    const response = await this.client.post<OCRResponse>('/api/ocr', request);
    return response.data;
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(request: TTSRequest): Promise<TTSResponse> {
    const response = await this.client.post<TTSResponse>('/api/tts', request);
    return response.data;
  }

  /**
   * Combined OCR + TTS: Image to Speech
   */
  async readImage(request: ReadRequest): Promise<ReadResponse> {
    const response = await this.client.post<ReadResponse>('/api/read', request);
    return response.data;
  }
}

// Export singleton instance
export const apiService = new ApiService();
