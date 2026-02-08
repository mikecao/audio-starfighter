import type { BeatAnalysis, CuePoint, FeatureFrame } from "./types";

export function generateCues(
  frames: FeatureFrame[],
  beat: BeatAnalysis
): CuePoint[] {
  if (frames.length === 0) {
    return [];
  }

  const cues: CuePoint[] = [];
  const minSpacingSeconds = 0.12;

  for (const beatTime of beat.beatTimesSeconds) {
    const index = findNearestFrameIndex(frames, beatTime);
    const frame = frames[index];
    const strength = frame.onset * 0.65 + frame.intensity * 0.35;
    if (strength >= 0.45) {
      cues.push({
        timeSeconds: beatTime,
        strength,
        source: "beat"
      });
    }
  }

  for (let i = 2; i < frames.length - 2; i += 1) {
    const frame = frames[i];
    const localMax =
      frame.intensity >= frames[i - 1].intensity &&
      frame.intensity >= frames[i + 1].intensity &&
      frame.intensity > 0.78 &&
      frame.onset > 0.35;

    if (localMax) {
      cues.push({
        timeSeconds: frame.timeSeconds,
        strength: frame.intensity,
        source: "peak"
      });
    }
  }

  cues.sort((a, b) => a.timeSeconds - b.timeSeconds);

  const merged: CuePoint[] = [];
  for (const cue of cues) {
    const last = merged[merged.length - 1];
    if (!last || cue.timeSeconds - last.timeSeconds >= minSpacingSeconds) {
      merged.push(cue);
      continue;
    }

    if (cue.strength > last.strength) {
      merged[merged.length - 1] = cue;
    }
  }

  return merged;
}

function findNearestFrameIndex(frames: FeatureFrame[], timeSeconds: number): number {
  let low = 0;
  let high = frames.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].timeSeconds < timeSeconds) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  if (low === 0) {
    return 0;
  }

  const prev = frames[low - 1];
  const next = frames[low];
  return Math.abs(prev.timeSeconds - timeSeconds) <=
    Math.abs(next.timeSeconds - timeSeconds)
    ? low - 1
    : low;
}
