import type { AudioTrackData, FeatureFrame } from "./types";

type ExtractionOptions = {
  windowSize?: number;
  hopSize?: number;
};

export function extractFeatureFrames(
  track: AudioTrackData,
  options: ExtractionOptions = {}
): FeatureFrame[] {
  const windowSize = options.windowSize ?? 1024;
  const hopSize = options.hopSize ?? 512;

  const frames: FeatureFrame[] = [];
  const source = track.channelData;
  const scratch = new Float32Array(windowSize);
  const prevAbs = new Float32Array(windowSize);

  let previousFlux = 0;
  let frameIndex = 0;

  for (let start = 0; start + windowSize <= source.length; start += hopSize) {
    let rmsAcc = 0;
    let highAcc = 0;
    let fluxAcc = 0;

    for (let i = 0; i < windowSize; i += 1) {
      const sample = source[start + i] ?? 0;
      const windowed = sample * hann(i, windowSize);
      scratch[i] = windowed;
      rmsAcc += windowed * windowed;

      if (i > 0) {
        const diff = windowed - scratch[i - 1];
        highAcc += diff * diff;
      }

      const absSample = Math.abs(windowed);
      const delta = absSample - prevAbs[i];
      if (delta > 0) {
        fluxAcc += delta;
      }
      prevAbs[i] = absSample;
    }

    const rms = Math.sqrt(rmsAcc / windowSize);
    const centroid = highAcc / (rmsAcc + 1e-9);
    const flux = fluxAcc / windowSize;
    const onset = Math.max(0, flux - previousFlux * 0.35);
    previousFlux = flux;

    frames.push({
      timeSeconds: (frameIndex * hopSize) / track.sampleRate,
      rms,
      flux,
      centroid,
      onset,
      intensity: 0
    });

    frameIndex += 1;
  }

  normalizeInPlace(frames, "rms");
  normalizeInPlace(frames, "flux");
  normalizeInPlace(frames, "centroid");
  normalizeInPlace(frames, "onset");

  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    frame.intensity =
      frame.rms * 0.45 + frame.flux * 0.35 + frame.centroid * 0.2;
  }

  smoothInPlace(frames, "intensity", 0.22);
  smoothInPlace(frames, "onset", 0.15);

  return frames;
}

function hann(index: number, size: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1));
}

function normalizeInPlace(
  frames: FeatureFrame[],
  key: "rms" | "flux" | "centroid" | "onset"
): void {
  if (frames.length === 0) {
    return;
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const frame of frames) {
    const value = frame[key];
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  const span = Math.max(max - min, 1e-9);
  for (const frame of frames) {
    frame[key] = (frame[key] - min) / span;
  }
}

function smoothInPlace(
  frames: FeatureFrame[],
  key: "intensity" | "onset",
  alpha: number
): void {
  if (frames.length === 0) {
    return;
  }

  let smoothed = frames[0][key];
  for (const frame of frames) {
    smoothed = alpha * frame[key] + (1 - alpha) * smoothed;
    frame[key] = smoothed;
  }
}
