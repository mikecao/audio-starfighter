import type { AudioTrackData } from "./types";

const WAVEFORM_PREVIEW_SAMPLES = 2048;

export async function decodeAudioFile(file: File): Promise<AudioTrackData> {
  const bytes = await file.arrayBuffer();
  const context = new AudioContext();

  try {
    const decoded = await context.decodeAudioData(bytes);
    const mono = mixDownToMono(decoded);
    const left = decoded.getChannelData(0);
    const right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : left;

    return {
      channelData: mono,
      waveformLeft: buildWaveformEnvelope(left, WAVEFORM_PREVIEW_SAMPLES),
      waveformRight: buildWaveformEnvelope(right, WAVEFORM_PREVIEW_SAMPLES),
      sampleRate: decoded.sampleRate,
      durationSeconds: decoded.duration
    };
  } finally {
    await context.close();
  }
}

function mixDownToMono(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const mixed = new Float32Array(length);

  for (let c = 0; c < channels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) {
      mixed[i] += data[i];
    }
  }

  const scale = channels > 0 ? 1 / channels : 1;
  for (let i = 0; i < length; i += 1) {
    mixed[i] *= scale;
  }

  return mixed;
}

function buildWaveformEnvelope(channel: Float32Array, points: number): Float32Array {
  if (channel.length === 0 || points <= 0) {
    return new Float32Array();
  }

  const envelope = new Float32Array(points);
  const bucketSize = channel.length / points;

  for (let i = 0; i < points; i += 1) {
    const start = Math.floor(i * bucketSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucketSize));
    let peak = 0;
    for (let j = start; j < end && j < channel.length; j += 1) {
      const abs = Math.abs(channel[j] ?? 0);
      if (abs > peak) {
        peak = abs;
      }
    }
    envelope[i] = Math.max(0, Math.min(1, peak));
  }

  return envelope;
}
