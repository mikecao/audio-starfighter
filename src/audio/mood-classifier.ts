import type { BeatAnalysis, FeatureFrame, MoodAnalysis, MoodLabel } from "./types";

export function classifyMood(
  frames: FeatureFrame[],
  beat: BeatAnalysis
): MoodAnalysis {
  if (frames.length === 0) {
    return {
      label: "driving",
      confidence: 0
    };
  }

  const averageIntensity = mean(frames.map((frame) => frame.intensity));
  const averageCentroid = mean(frames.map((frame) => frame.centroid));
  const averageOnset = mean(frames.map((frame) => frame.onset));
  const bpmScore = clamp((beat.bpm - 70) / 110, 0, 1);

  const energyScore =
    averageIntensity * 0.5 +
    averageOnset * 0.2 +
    averageCentroid * 0.2 +
    bpmScore * 0.1;

  let label: MoodLabel;
  if (energyScore < 0.4) {
    label = "calm";
  } else if (energyScore > 0.68) {
    label = "aggressive";
  } else {
    label = "driving";
  }

  const center = label === "calm" ? 0.28 : label === "aggressive" ? 0.82 : 0.54;
  const confidence = clamp(1 - Math.abs(energyScore - center) / 0.42, 0, 1);

  return {
    label,
    confidence
  };
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
