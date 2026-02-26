import type { SpectrumTimeline } from "../../audio/types";

export function fillWaveformTextureDataWithSilence(data: Uint8Array): void {
	for (let i = 0; i < data.length; i += 4) {
		data[i] = 0;
		data[i + 1] = 0;
		data[i + 2] = 0;
		data[i + 3] = 255;
	}
}

export function populateSpectrumTimelineTexture(
	data: Uint8Array,
	timeline: SpectrumTimeline,
	textureTimeSamples: number,
	textureBinSamples: number,
): void {
	fillWaveformTextureDataWithSilence(data);
	if (
		textureTimeSamples <= 0 ||
		textureBinSamples <= 0 ||
		timeline.frameCount <= 0
	) {
		return;
	}

	const frameCount = timeline.frameCount;
	const binCount = timeline.binCount;
	const frameMax = Math.max(1, frameCount - 1);
	const binMax = Math.max(1, binCount - 1);
	for (let y = 0; y < textureBinSamples; y += 1) {
		const textureBinT =
			textureBinSamples <= 1 ? 0 : y / (textureBinSamples - 1);
		const remappedBin = Math.pow(textureBinT, 1.3) * binMax;
		const binLo = Math.floor(remappedBin);
		const binHi = Math.min(binCount - 1, binLo + 1);
		const binMix = remappedBin - binLo;

		for (let x = 0; x < textureTimeSamples; x += 1) {
			const timeT =
				textureTimeSamples <= 1 ? 0 : x / (textureTimeSamples - 1);
			const remappedFrame = timeT * frameMax;
			const frameLo = Math.floor(remappedFrame);
			const frameHi = Math.min(frameCount - 1, frameLo + 1);
			const frameMix = remappedFrame - frameLo;

			const loLo = timeline.bins[frameLo * binCount + binLo] ?? 0;
			const loHi = timeline.bins[frameLo * binCount + binHi] ?? loLo;
			const hiLo = timeline.bins[frameHi * binCount + binLo] ?? loLo;
			const hiHi = timeline.bins[frameHi * binCount + binHi] ?? hiLo;
			const frameLoMix = loLo + (loHi - loLo) * binMix;
			const frameHiMix = hiLo + (hiHi - hiLo) * binMix;
			const value = clamp(
				frameLoMix + (frameHiMix - frameLoMix) * frameMix,
				0,
				1,
			);

			const beatLo = timeline.beatEnvelope[frameLo] ?? 0;
			const beatHi = timeline.beatEnvelope[frameHi] ?? beatLo;
			const beat = clamp(beatLo + (beatHi - beatLo) * frameMix, 0, 1);

			const encodedValue = Math.round(Math.pow(value, 1.04) * 255);
			const encodedBeat = Math.round(beat * 255);
			const offset = (y * textureTimeSamples + x) * 4;
			data[offset] = encodedValue;
			data[offset + 1] = encodedBeat;
			data[offset + 2] = encodedValue;
			data[offset + 3] = 255;
		}
	}
}

export function populateSpectrumTimelineTextureFromWaveform(
	data: Uint8Array,
	waveformLeft: Float32Array,
	waveformRight: Float32Array,
	textureTimeSamples: number,
	textureBinSamples: number,
): void {
	fillWaveformTextureDataWithSilence(data);
	const maxLength = Math.max(waveformLeft.length, waveformRight.length);
	if (maxLength <= 0 || textureTimeSamples <= 0 || textureBinSamples <= 0) {
		return;
	}

	for (let y = 0; y < textureBinSamples; y += 1) {
		const binT = textureBinSamples <= 1 ? 0 : y / (textureBinSamples - 1);
		const skew = Math.pow(binT, 1.72);
		const lowBoost = 1 - binT * 0.82;

		for (let x = 0; x < textureTimeSamples; x += 1) {
			const timeT =
				textureTimeSamples <= 1 ? 0 : x / (textureTimeSamples - 1);
			const sourcePos = timeT * (maxLength - 1);
			const left = sampleWaveformLinear(waveformLeft, sourcePos);
			const right =
				waveformRight.length > 0
					? sampleWaveformLinear(waveformRight, sourcePos)
					: left;
			const mono = clamp((left + right) * 0.5, 0, 1);
			const ridge = Math.max(
				0,
				Math.sin((timeT * (3.8 + skew * 13.2) + skew * 0.21) * Math.PI * 2),
			);
			const value = clamp(
				Math.pow(mono, 1.06) * (0.5 + lowBoost * 0.44) + ridge * 0.16,
				0,
				1,
			);
			const beat = clamp(ridge * (0.4 + lowBoost * 0.42), 0, 1);
			const encodedValue = Math.round(value * 255);
			const encodedBeat = Math.round(beat * 255);
			const offset = (y * textureTimeSamples + x) * 4;
			data[offset] = encodedValue;
			data[offset + 1] = encodedBeat;
			data[offset + 2] = encodedValue;
			data[offset + 3] = 255;
		}
	}
}

export function sampleWaveformLinear(
	samples: Float32Array,
	index: number,
): number {
	if (samples.length === 0) {
		return 0;
	}
	const clampedIndex = clamp(index, 0, samples.length - 1);
	const lo = Math.floor(clampedIndex);
	const hi = Math.min(samples.length - 1, lo + 1);
	const t = clampedIndex - lo;
	const loValue = samples[lo] ?? 0;
	const hiValue = samples[hi] ?? loValue;
	return loValue + (hiValue - loValue) * t;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
