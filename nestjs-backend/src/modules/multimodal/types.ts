export interface SpeechRecognitionResult {
  text: string;
  confidence: number;
  language: string;
}

export interface HandwritingRecognitionResult {
  text: string;
  latex: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ImageRecognitionResult {
  text: string;
  latex: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface VoiceResponse {
  text: string;
  audioUrl: string;
  duration: number;
}
