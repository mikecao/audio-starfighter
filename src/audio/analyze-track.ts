import { detectBeats } from "./beat-detector";
import { generateCues } from "./cue-generator";
import { decodeAudioFile } from "./decoder";
import { extractFeatureFrames } from "./feature-extractor";
import { classifyMood } from "./mood-classifier";
import { extractSpectrumTimeline } from "./spectrum-extractor";
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
  const spectrum = extractSpectrumTimeline(track);
  emitProgress(0.58, "Detecting beats...", "beats");
  const beat = detectBeats(frames);
  populateBeatEnvelope(spectrum.beatEnvelope, spectrum.frameHopSeconds, beat.beatTimesSeconds);
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
    spectrum,
    beat,
    mood,
    cues
  };
}

function populateBeatEnvelope(
  envelope: Float32Array,
  frameHopSeconds: number,
  beatTimesSeconds: number[]
): void {
  envelope.fill(0);
  if (envelope.length === 0 || beatTimesSeconds.length === 0) {
    return;
  }

  const sortedBeats = beatTimesSeconds
    .filter((value) => Number.isFinite(value) && value >= 0)
    .slice()
    .sort((a, b) => a - b);
  if (sortedBeats.length === 0) {
    return;
  }

  const sigmaSeconds = 0.065;
  const sigmaDenominator = 2 * sigmaSeconds * sigmaSeconds;
  let beatIndex = 0;

  for (let frameIndex = 0; frameIndex < envelope.length; frameIndex += 1) {
    const timeSeconds = frameIndex * frameHopSeconds;
    while (
      beatIndex < sortedBeats.length - 1 &&
      (sortedBeats[beatIndex + 1] ?? Number.POSITIVE_INFINITY) < timeSeconds
    ) {
      beatIndex += 1;
    }

    const prevBeat = sortedBeats[beatIndex] ?? Number.POSITIVE_INFINITY;
    const nextBeat = sortedBeats[Math.min(sortedBeats.length - 1, beatIndex + 1)] ?? prevBeat;
    const deltaPrev = timeSeconds - prevBeat;
    const deltaNext = timeSeconds - nextBeat;
    const prevStrength = Math.exp(-(deltaPrev * deltaPrev) / sigmaDenominator);
    const nextStrength = Math.exp(-(deltaNext * deltaNext) / sigmaDenominator);
    envelope[frameIndex] = Math.max(0, Math.min(1, Math.max(prevStrength, nextStrength)));
  }
}
