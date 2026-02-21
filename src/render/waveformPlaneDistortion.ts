export type WaveformPlaneDistortionAlgorithm = "ridge" | "ripple";

export const WAVEFORM_PLANE_DISTORTION_DEFAULT: WaveformPlaneDistortionAlgorithm = "ridge";

export const WAVEFORM_PLANE_DISTORTION_OPTIONS: Array<{
  value: WaveformPlaneDistortionAlgorithm;
  label: string;
}> = [
  { value: "ridge", label: "Ridge Flow" },
  { value: "ripple", label: "Pulse Ripple" }
];

type DistortionProfile = {
  sourceBinSkew: number;
  lowBandPortion: number;
  lowBandWeightFalloff: number;
  lowBandPow: number;
  lowBandScale: number;
  lowMidBandPortion: number;
  lowMidBandWeightFalloff: number;
  lowMidBandPow: number;
  lowMidBandScale: number;
  noiseGate: number;
};

type PopulateDistortionSpectrumParams = {
  algorithm: WaveformPlaneDistortionAlgorithm;
  sourceBins: Float32Array;
  targetBins: Float32Array;
  sampleLinear: (samples: Float32Array, index: number) => number;
};

type DistortionSpectrumMetrics = {
  amplitudeDrive: number;
  amplitudePeak: number;
  spectrumPeak: number;
};

const DISTORTION_PROFILES: Record<WaveformPlaneDistortionAlgorithm, DistortionProfile> = {
  ridge: {
    sourceBinSkew: 1.36,
    lowBandPortion: 0.12,
    lowBandWeightFalloff: 0.75,
    lowBandPow: 0.78,
    lowBandScale: 0.92,
    lowMidBandPortion: 0.3,
    lowMidBandWeightFalloff: 0.6,
    lowMidBandPow: 0.86,
    lowMidBandScale: 0.44,
    noiseGate: 0.04
  },
  ripple: {
    sourceBinSkew: 1.12,
    lowBandPortion: 0.18,
    lowBandWeightFalloff: 0.58,
    lowBandPow: 0.84,
    lowBandScale: 0.8,
    lowMidBandPortion: 0.4,
    lowMidBandWeightFalloff: 0.42,
    lowMidBandPow: 0.9,
    lowMidBandScale: 0.52,
    noiseGate: 0.03
  }
};

export function normalizeWaveformPlaneDistortionAlgorithm(
  value: string
): WaveformPlaneDistortionAlgorithm {
  switch (value) {
    case "ripple":
    case "ridge":
      return value;
    default:
      return WAVEFORM_PLANE_DISTORTION_DEFAULT;
  }
}

export function buildWaveformPlaneDisplacementHeader(
  algorithm: WaveformPlaneDistortionAlgorithm,
  spectrumStepSize: number
): string {
  const computeHeightSource =
    algorithm === "ripple" ? RIPPLE_DISTORTION_COMPUTE_HEIGHT_SOURCE : RIDGE_DISTORTION_COMPUTE_HEIGHT_SOURCE;
  return `
      uniform float uTimeSeconds;
      uniform float uHeightScale;
      uniform float uAmplitudeDrive;
      uniform sampler2D uSpectrumTex;

      float sampleSpectrum(float binNorm) {
        float u = clamp(binNorm, 0.0, 1.0);
        float stepSize = ${Math.max(spectrumStepSize, 1e-5).toFixed(6)};
        float c = texture2D(uSpectrumTex, vec2(u, 0.5)).r;
        float l = texture2D(uSpectrumTex, vec2(max(0.0, u - stepSize), 0.5)).r;
        float r = texture2D(uSpectrumTex, vec2(min(1.0, u + stepSize), 0.5)).r;
        return c * 0.52 + (l + r) * 0.24;
      }

      ${computeHeightSource}
  `;
}

export function populateWaveformPlaneSpectrumForDistortion(
  params: PopulateDistortionSpectrumParams
): DistortionSpectrumMetrics {
  const { algorithm, sourceBins, targetBins, sampleLinear } = params;
  const normalizedAlgorithm = normalizeWaveformPlaneDistortionAlgorithm(algorithm);
  const profile = DISTORTION_PROFILES[normalizedAlgorithm];
  const maxSourceIndex = Math.max(0, sourceBins.length - 1);

  let frameSpectrumPeak = 0;
  for (let i = 0; i < sourceBins.length; i += 1) {
    frameSpectrumPeak = Math.max(frameSpectrumPeak, clamp(sourceBins[i] ?? 0, 0, 1));
  }

  const lowBandDrive = computeWeightedBandAverage(
    sourceBins,
    profile.lowBandPortion,
    profile.lowBandWeightFalloff
  );
  const lowMidBandDrive = computeWeightedBandAverage(
    sourceBins,
    profile.lowMidBandPortion,
    profile.lowMidBandWeightFalloff
  );
  const rawAmplitudeTarget = clamp(
    Math.pow(lowBandDrive, profile.lowBandPow) * profile.lowBandScale +
      Math.pow(lowMidBandDrive, profile.lowMidBandPow) * profile.lowMidBandScale,
    0,
    1
  );
  const normalizedAmplitudeTarget = clamp(rawAmplitudeTarget, 0, 1);
  const amplitudeTarget =
    normalizedAmplitudeTarget <= profile.noiseGate
      ? 0
      : clamp(
          (normalizedAmplitudeTarget - profile.noiseGate) / (1 - profile.noiseGate),
          0,
          1
        );

  for (let i = 0; i < targetBins.length; i += 1) {
    const t = targetBins.length <= 1 ? 0 : i / (targetBins.length - 1);
    const sourcePos = Math.pow(t, profile.sourceBinSkew) * maxSourceIndex;
    const sampled = clamp(sampleLinear(sourceBins, sourcePos), 0, 1);
    targetBins[i] = applyDistortionSpectrumCurve(normalizedAlgorithm, sampled, t);
  }

  return {
    amplitudeDrive: amplitudeTarget,
    amplitudePeak: clamp(rawAmplitudeTarget, 0.22, 1.2),
    spectrumPeak: clamp(frameSpectrumPeak, 0.22, 1.4)
  };
}

function computeWeightedBandAverage(
  sourceBins: Float32Array,
  portion: number,
  weightFalloff: number
): number {
  if (sourceBins.length <= 0) {
    return 0;
  }
  const count = Math.max(1, Math.min(sourceBins.length, Math.floor(sourceBins.length * portion)));
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < count; i += 1) {
    const normalized = count <= 1 ? 0 : i / (count - 1);
    const weight = 1 - normalized * clamp(weightFalloff, 0, 1);
    weightedSum += clamp(sourceBins[i] ?? 0, 0, 1) * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

function applyDistortionSpectrumCurve(
  algorithm: WaveformPlaneDistortionAlgorithm,
  sampled: number,
  t: number
): number {
  if (algorithm === "ripple") {
    const lowBoost = 1 - t * 0.28;
    const centerBoost = 0.9 + (1 - Math.abs(t * 2 - 1)) * 0.18;
    return clamp(Math.pow(sampled, 0.9) * lowBoost * centerBoost, 0, 1);
  }
  return sampled;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const RIDGE_DISTORTION_COMPUTE_HEIGHT_SOURCE = `
      float computeHeight(vec2 uvPoint) {
        vec2 p = uvPoint * vec2(5.8, 8.9);
        p.x += uTimeSeconds * 1.84;
        float baseA = sin(p.x * 1.33 + p.y * 0.29) * 0.58;
        float baseB = sin(p.x * 0.79 - p.y * 1.14 + 1.12) * 0.37;
        float baseC = sin((p.x + p.y) * 1.47 - 0.46) * 0.25;
        float raw = abs(baseA + baseB + baseC);
        float ridgeSource = (raw * 1.24) / (1.0 + raw * 0.34);
        float ridge = pow(ridgeSource, 1.04);
        float depthScale = pow(max(0.0, 1.0 - uvPoint.y), 0.54);
        float lateral = 1.0 - smoothstep(0.18, 0.86, abs(uvPoint.x - 0.5));
        float depthSpectrumBin = pow(clamp(1.0 - uvPoint.y, 0.0, 1.0), 1.55);
        float sweepSpectrumBin = 0.5 + 0.5 * sin(
          uvPoint.x * 12.6 +
          uvPoint.y * 5.2 +
          uTimeSeconds * 1.28
        );
        float spectrum = mix(
          sampleSpectrum(depthSpectrumBin),
          sampleSpectrum(sweepSpectrumBin),
          0.42
        );
        float spectrumAccent = pow(max(0.0, spectrum), 1.08);
        float spectralShape = 0.56 + spectrum * 1.74 + spectrumAccent * 1.12;
        float amplitudeBoost = 0.76 + uAmplitudeDrive * 1.52;
        float nearEdgeFade = smoothstep(0.12, 0.42, uvPoint.y);
        float nearSafetyScale = 0.08 + nearEdgeFade * 0.92;
        float nearAmplitudeScale = 0.28 + nearEdgeFade * 0.72;
        return ridge * uHeightScale * (0.1 + depthScale * 0.88) * (0.74 + lateral * 0.46) * spectralShape * amplitudeBoost * nearSafetyScale * nearAmplitudeScale;
      }
`;

const RIPPLE_DISTORTION_COMPUTE_HEIGHT_SOURCE = `
      float computeHeight(vec2 uvPoint) {
        vec2 p = uvPoint * vec2(4.7, 7.6);
        p.x += uTimeSeconds * 1.22;
        p.y += sin(uTimeSeconds * 0.32 + uvPoint.x * 3.2) * 0.28;
        float waveA = sin((p.x + p.y * 0.64) * 1.18);
        float waveB = sin((p.x * 0.62 - p.y * 1.42) + 1.24);
        float waveC = sin((p.x * 0.42 + p.y * 0.84) * 2.1 - 0.34) * 0.42;
        float ripple = abs(waveA * 0.52 + waveB * 0.46 + waveC * 0.32);
        float depthScale = pow(max(0.0, 1.0 - uvPoint.y), 0.5);
        float lateral = 1.0 - smoothstep(0.14, 0.9, abs(uvPoint.x - 0.5));
        float depthSpectrumBin = pow(clamp(1.0 - uvPoint.y, 0.0, 1.0), 1.34);
        float sweepSpectrumBin = 0.5 + 0.5 * sin(
          uvPoint.x * 10.4 +
          uvPoint.y * 6.1 +
          uTimeSeconds * 1.62
        );
        float spectrum = mix(
          sampleSpectrum(depthSpectrumBin),
          sampleSpectrum(sweepSpectrumBin),
          0.58
        );
        float spectrumAccent = pow(max(0.0, spectrum), 1.24);
        float spectralShape = 0.42 + spectrum * 1.48 + spectrumAccent * 1.4;
        float amplitudeBoost = 0.72 + uAmplitudeDrive * 1.74;
        float nearEdgeFade = smoothstep(0.08, 0.38, uvPoint.y);
        float nearSafetyScale = 0.1 + nearEdgeFade * 0.9;
        float nearAmplitudeScale = 0.24 + nearEdgeFade * 0.76;
        return ripple * uHeightScale * (0.12 + depthScale * 0.82) * (0.7 + lateral * 0.52) * spectralShape * amplitudeBoost * nearSafetyScale * nearAmplitudeScale;
      }
`;
