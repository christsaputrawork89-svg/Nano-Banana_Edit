
export interface Scene {
  id: number;
  imageUrl: string | null;
  prompt: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface ImageState {
  file: File | null;
  previewUrl: string | null;
  mimeType: string;
}

export type MarkerColor = 'red' | 'blue' | 'green' | 'yellow' | null;

export interface MarkingAction {
  color: MarkerColor;
  points: { x: number; y: number }[];
}
