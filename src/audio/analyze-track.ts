import { detectBeats } from "./beat-detector";
import { generateCues } from "./cue-generator";
import { decodeAudioFile } from "./decoder";
import { extractFeatureFrames } from "./feature-extractor";
import type { AudioAnalysisResult } from "./types";

export async function analyzeAudioTrack(file: File): Promise<AudioAnalysisResult> {
  const track = await decodeAudioFile(file);
  const frames = extractFeatureFrames(track);
  const beat = detectBeats(frames);
  const cues = generateCues(frames, beat);

  return {
    fileName: file.name,
    durationSeconds: track.durationSeconds,
    sampleRate: track.sampleRate,
    frames,
    beat,
    cues
  };
}
