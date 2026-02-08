export type AudioTrackData = {
  channelData: Float32Array;
  sampleRate: number;
  durationSeconds: number;
};

export type FeatureFrame = {
  timeSeconds: number;
  rms: number;
  flux: number;
  centroid: number;
  onset: number;
  intensity: number;
};

export type BeatAnalysis = {
  bpm: number;
  beatTimesSeconds: number[];
  beatIntervalSeconds: number;
  confidence: number;
};

export type CuePoint = {
  timeSeconds: number;
  strength: number;
  source: "beat" | "peak";
};

export type AudioAnalysisResult = {
  fileName: string;
  durationSeconds: number;
  sampleRate: number;
  frames: FeatureFrame[];
  beat: BeatAnalysis;
  cues: CuePoint[];
};
