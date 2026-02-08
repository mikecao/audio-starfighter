import type { AudioTrackData } from "./types";

export async function decodeAudioFile(file: File): Promise<AudioTrackData> {
  const bytes = await file.arrayBuffer();
  const context = new AudioContext();

  try {
    const decoded = await context.decodeAudioData(bytes);
    const mono = mixDownToMono(decoded);

    return {
      channelData: mono,
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
