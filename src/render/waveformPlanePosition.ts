export type WaveformPlanePositionMode = "bottom" | "top" | "both";

export const WAVEFORM_PLANE_POSITION_DEFAULT: WaveformPlanePositionMode =
  "bottom";

export const WAVEFORM_PLANE_POSITION_OPTIONS: Array<{
  value: WaveformPlanePositionMode;
  label: string;
}> = [
  { value: "bottom", label: "Bottom" },
  { value: "top", label: "Top" },
  { value: "both", label: "Both" }
];

export function normalizeWaveformPlanePositionMode(
  value: string
): WaveformPlanePositionMode {
  switch (value) {
    case "top":
    case "both":
    case "bottom":
      return value;
    default:
      return WAVEFORM_PLANE_POSITION_DEFAULT;
  }
}
