import type { BeatAnalysis, FeatureFrame } from "./types";

export function detectBeats(frames: FeatureFrame[]): BeatAnalysis {
  if (frames.length < 16) {
    return {
      bpm: 120,
      beatTimesSeconds: [],
      beatIntervalSeconds: 0.5,
      confidence: 0
    };
  }

  const hopSeconds = frames[1].timeSeconds - frames[0].timeSeconds;
  const minBpm = 70;
  const maxBpm = 180;
  const minLag = Math.max(1, Math.floor(60 / (maxBpm * hopSeconds)));
  const maxLag = Math.max(minLag + 1, Math.ceil(60 / (minBpm * hopSeconds)));

  const onset = frames.map((frame) => frame.onset);
  const centered = center(onset);

  let bestLag = minLag;
  let bestScore = Number.NEGATIVE_INFINITY;
  let totalScore = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = lag; i < centered.length; i += 1) {
      sum += centered[i] * centered[i - lag];
    }
    totalScore += Math.max(0, sum);
    if (sum > bestScore) {
      bestScore = sum;
      bestLag = lag;
    }
  }

  const beatIntervalSeconds = bestLag * hopSeconds;
  const bpm = 60 / beatIntervalSeconds;

  let bestPhase = 0;
  let bestPhaseScore = Number.NEGATIVE_INFINITY;
  for (let phase = 0; phase < bestLag; phase += 1) {
    let score = 0;
    for (let i = phase; i < onset.length; i += bestLag) {
      score += onset[i];
    }
    if (score > bestPhaseScore) {
      bestPhaseScore = score;
      bestPhase = phase;
    }
  }

  const beatTimesSeconds: number[] = [];
  for (let i = bestPhase; i < frames.length; i += bestLag) {
    beatTimesSeconds.push(frames[i].timeSeconds);
  }

  return {
    bpm,
    beatTimesSeconds,
    beatIntervalSeconds,
    confidence:
      totalScore > 0 ? clamp(bestScore / (totalScore / (maxLag - minLag + 1)), 0, 1) : 0
  };
}

function center(values: number[]): number[] {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.map((value) => value - mean);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
