import { describe, expect, it } from "vitest";
import { classifyMood } from "./mood-classifier";
import type { BeatAnalysis, FeatureFrame } from "./types";

function buildFrames(
  count: number,
  values: Pick<FeatureFrame, "rms" | "flux" | "centroid" | "onset" | "intensity">
): FeatureFrame[] {
  const frames: FeatureFrame[] = [];
  for (let i = 0; i < count; i += 1) {
    frames.push({
      timeSeconds: i * 0.01,
      ...values
    });
  }
  return frames;
}

const beatTemplate: BeatAnalysis = {
  bpm: 120,
  beatTimesSeconds: [],
  beatIntervalSeconds: 0.5,
  confidence: 1
};

describe("classifyMood", () => {
  it("classifies low-energy frames as calm", () => {
    const mood = classifyMood(
      buildFrames(200, {
        rms: 0.2,
        flux: 0.1,
        centroid: 0.2,
        onset: 0.1,
        intensity: 0.2
      }),
      { ...beatTemplate, bpm: 80 }
    );
    expect(mood.label).toBe("calm");
  });

  it("classifies high-energy frames as aggressive", () => {
    const mood = classifyMood(
      buildFrames(200, {
        rms: 0.9,
        flux: 0.85,
        centroid: 0.85,
        onset: 0.8,
        intensity: 0.9
      }),
      { ...beatTemplate, bpm: 170 }
    );
    expect(mood.label).toBe("aggressive");
  });
});
