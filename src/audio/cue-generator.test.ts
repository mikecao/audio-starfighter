import { describe, expect, it } from "vitest";
import { generateCues } from "./cue-generator";
import type { BeatAnalysis, FeatureFrame } from "./types";

describe("generateCues", () => {
  it("creates merged cues from beats and intensity peaks", () => {
    const frames: FeatureFrame[] = [];
    for (let i = 0; i < 200; i += 1) {
      const timeSeconds = i * 0.05;
      const peak = i === 80 || i === 120;
      frames.push({
        timeSeconds,
        rms: peak ? 0.9 : 0.3,
        flux: peak ? 0.85 : 0.2,
        centroid: 0.4,
        onset: peak ? 0.8 : 0.1,
        intensity: peak ? 0.92 : 0.3
      });
    }

    const beat: BeatAnalysis = {
      bpm: 120,
      beatIntervalSeconds: 0.5,
      confidence: 0.9,
      beatTimesSeconds: [2, 4, 6, 8]
    };

    const cues = generateCues(frames, beat);
    expect(cues.length).toBeGreaterThanOrEqual(2);
    expect(cues.some((cue) => cue.source === "peak")).toBe(true);
    expect(cues[0].timeSeconds).toBeGreaterThanOrEqual(0);
  });
});
