import { describe, expect, it } from "vitest";
import { detectBeats } from "./beat-detector";
import type { FeatureFrame } from "./types";

describe("detectBeats", () => {
  it("estimates BPM close to 120 on synthetic pulses", () => {
    const hopSeconds = 0.01;
    const frames: FeatureFrame[] = [];

    for (let i = 0; i < 2500; i += 1) {
      const isPulse = i % 50 === 0;
      frames.push({
        timeSeconds: i * hopSeconds,
        rms: isPulse ? 0.8 : 0.2,
        flux: isPulse ? 1 : 0.1,
        centroid: 0.4,
        onset: isPulse ? 1 : 0,
        intensity: isPulse ? 1 : 0.2
      });
    }

    const beat = detectBeats(frames);
    expect(beat.bpm).toBeGreaterThan(116);
    expect(beat.bpm).toBeLessThan(124);
    expect(beat.beatTimesSeconds.length).toBeGreaterThan(30);
  });
});
