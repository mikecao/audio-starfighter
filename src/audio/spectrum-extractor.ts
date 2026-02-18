import type { AudioTrackData, SpectrumTimeline } from "./types";

type SpectrumExtractOptions = {
  windowSize?: number;
  hopSize?: number;
  binCount?: number;
  minFrequencyHz?: number;
  maxFrequencyHz?: number;
};

const DEFAULT_WINDOW_SIZE = 1024;
const DEFAULT_HOP_SIZE = 768;
const DEFAULT_BIN_COUNT = 28;
const DEFAULT_MIN_FREQUENCY_HZ = 50;
const DEFAULT_MAX_FREQUENCY_HZ = 7600;

export function extractSpectrumTimeline(
  track: AudioTrackData,
  options: SpectrumExtractOptions = {}
): SpectrumTimeline {
  const windowSize = Math.max(128, options.windowSize ?? DEFAULT_WINDOW_SIZE);
  const hopSize = Math.max(64, options.hopSize ?? DEFAULT_HOP_SIZE);
  const binCount = Math.max(8, options.binCount ?? DEFAULT_BIN_COUNT);
  const minFrequencyHz = Math.max(20, options.minFrequencyHz ?? DEFAULT_MIN_FREQUENCY_HZ);
  const maxFrequencyHz = Math.max(
    minFrequencyHz + 40,
    Math.min(track.sampleRate * 0.47, options.maxFrequencyHz ?? DEFAULT_MAX_FREQUENCY_HZ)
  );

  const source = track.channelData;
  const frameCount =
    source.length === 0 ? 1 : Math.max(1, Math.floor((source.length - 1) / hopSize) + 1);

  const bins = new Float32Array(frameCount * binCount);
  const beatEnvelope = new Float32Array(frameCount);
  const window = buildHannWindow(windowSize);
  const frequencies = buildLogFrequencies(binCount, minFrequencyHz, maxFrequencyHz);
  const coefficients = frequencies.map((frequencyHz) =>
    computeGoertzelCoefficient(windowSize, frequencyHz, track.sampleRate)
  );
  const maxByBin = new Float32Array(binCount);
  const maxTimeSeconds = Math.max(0, track.durationSeconds);
  const frameHopSeconds = hopSize / track.sampleRate;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * hopSize;
    const timeSeconds = Math.min(maxTimeSeconds, frameIndex * frameHopSeconds);

    for (let binIndex = 0; binIndex < binCount; binIndex += 1) {
      const coefficient = coefficients[binIndex] ?? 0;
      let q0 = 0;
      let q1 = 0;
      let q2 = 0;

      for (let i = 0; i < windowSize; i += 1) {
        const sample = source[start + i] ?? 0;
        const windowed = sample * (window[i] ?? 0);
        q0 = windowed + coefficient * q1 - q2;
        q2 = q1;
        q1 = q0;
      }

      const power = q1 * q1 + q2 * q2 - coefficient * q1 * q2;
      const normalizedPower = Math.max(0, power / Math.max(1e-6, windowSize * windowSize));
      const offset = frameIndex * binCount + binIndex;
      bins[offset] = normalizedPower;
      if (normalizedPower > (maxByBin[binIndex] ?? 0)) {
        maxByBin[binIndex] = normalizedPower;
      }
    }

    beatEnvelope[frameIndex] = 0;
    if (timeSeconds >= maxTimeSeconds && frameIndex > 0) {
      break;
    }
  }

  normalizeAndShapeBinsInPlace(bins, maxByBin, frameCount, binCount);
  smoothBinsInPlace(bins, frameCount, binCount);

  return {
    frameHopSeconds,
    frameCount,
    binCount,
    bins,
    beatEnvelope
  };
}

function buildHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  const denom = Math.max(1, size - 1);
  for (let i = 0; i < size; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / denom);
  }
  return window;
}

function buildLogFrequencies(binCount: number, minHz: number, maxHz: number): number[] {
  const frequencies: number[] = [];
  const minLog = Math.log(minHz);
  const maxLog = Math.log(maxHz);
  const span = Math.max(1e-6, maxLog - minLog);
  for (let i = 0; i < binCount; i += 1) {
    const t = binCount <= 1 ? 0 : i / (binCount - 1);
    frequencies.push(Math.exp(minLog + span * t));
  }
  return frequencies;
}

function computeGoertzelCoefficient(
  windowSize: number,
  frequencyHz: number,
  sampleRate: number
): number {
  const rawBin = (windowSize * frequencyHz) / sampleRate;
  const roundedBin = Math.max(1, Math.round(rawBin));
  const omega = (2 * Math.PI * roundedBin) / windowSize;
  return 2 * Math.cos(omega);
}

function normalizeAndShapeBinsInPlace(
  bins: Float32Array,
  maxByBin: Float32Array,
  frameCount: number,
  binCount: number
): void {
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    for (let binIndex = 0; binIndex < binCount; binIndex += 1) {
      const offset = frameIndex * binCount + binIndex;
      const maxValue = Math.max(1e-6, maxByBin[binIndex] ?? 1e-6);
      const raw = clamp01((bins[offset] ?? 0) / maxValue);
      const binT = binCount <= 1 ? 0 : binIndex / (binCount - 1);
      const lowBoost = 1 - binT * 0.72;
      const shaped = Math.pow(raw, 1.12) * (0.82 + lowBoost * 0.34);
      bins[offset] = clamp01(shaped);
    }
  }
}

function smoothBinsInPlace(
  bins: Float32Array,
  frameCount: number,
  binCount: number
): void {
  const scratch = new Float32Array(binCount);
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameOffset = frameIndex * binCount;
    for (let binIndex = 0; binIndex < binCount; binIndex += 1) {
      const left = bins[frameOffset + Math.max(0, binIndex - 1)] ?? 0;
      const center = bins[frameOffset + binIndex] ?? 0;
      const right = bins[frameOffset + Math.min(binCount - 1, binIndex + 1)] ?? 0;
      scratch[binIndex] = left * 0.2 + center * 0.6 + right * 0.2;
    }
    for (let binIndex = 0; binIndex < binCount; binIndex += 1) {
      bins[frameOffset + binIndex] = clamp01(scratch[binIndex] ?? 0);
    }
  }

  for (let binIndex = 0; binIndex < binCount; binIndex += 1) {
    let previous = bins[binIndex] ?? 0;
    for (let frameIndex = 1; frameIndex < frameCount; frameIndex += 1) {
      const offset = frameIndex * binCount + binIndex;
      const current = bins[offset] ?? 0;
      const smoothed = previous * 0.58 + current * 0.42;
      bins[offset] = smoothed;
      previous = smoothed;
    }
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
