import { detectBeats } from "./beat-detector";
import { generateCues } from "./cue-generator";
import { decodeAudioFile } from "./decoder";
import { extractFeatureFrames } from "./feature-extractor";
import { classifyMood } from "./mood-classifier";
import type { AudioAnalysisResult } from "./types";

type AnalyzeAudioTrackOptions = {
  onProgress?: (progress: number, message: string, stage: AnalyzeProgressStage) => void;
};

type AnalyzeProgressStage = "decode" | "features" | "beats" | "mood" | "cues" | "finalize";

export async function analyzeAudioTrack(
  file: File,
  options: AnalyzeAudioTrackOptions = {}
): Promise<AudioAnalysisResult> {
  const emitProgress = (
    progress: number,
    message: string,
    stage: AnalyzeProgressStage
  ): void => {
    options.onProgress?.(Math.max(0, Math.min(1, progress)), message, stage);
  };

  emitProgress(0.05, "Decoding audio...", "decode");
  const track = await decodeAudioFile(file);
  emitProgress(0.35, "Extracting features...", "features");
  const frames = extractFeatureFrames(track);
  emitProgress(0.58, "Detecting beats...", "beats");
  const beat = detectBeats(frames);
  emitProgress(0.74, "Classifying mood...", "mood");
  const mood = classifyMood(frames, beat);
  emitProgress(0.88, "Generating cue timeline...", "cues");
  const cues = generateCues(frames, beat);
  emitProgress(1, "Analysis complete", "finalize");

  return {
    fileName: file.name,
    durationSeconds: track.durationSeconds,
    sampleRate: track.sampleRate,
    waveformLeft: track.waveformLeft,
    waveformRight: track.waveformRight,
    frames,
    beat,
    mood,
    cues
  };
}
