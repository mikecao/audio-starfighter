export type AudioTrackData = {
  channelData: Float32Array;
  waveformLeft: Float32Array;
  waveformRight: Float32Array;
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

export type MoodLabel = "calm" | "driving" | "aggressive";

export type MoodAnalysis = {
  label: MoodLabel;
  confidence: number;
};

export type CuePoint = {
  timeSeconds: number;
  strength: number;
  source: "beat" | "peak";
};

export type SpectrumTimeline = {
  frameHopSeconds: number;
  frameCount: number;
  binCount: number;
  bins: Float32Array;
  beatEnvelope: Float32Array;
};

export type AudioAnalysisResult = {
  fileName: string;
  durationSeconds: number;
  sampleRate: number;
  waveformLeft: Float32Array;
  waveformRight: Float32Array;
  frames: FeatureFrame[];
  spectrum: SpectrumTimeline;
  beat: BeatAnalysis;
  mood: MoodAnalysis;
  cues: CuePoint[];
};
