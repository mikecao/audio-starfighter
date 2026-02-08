import { describe, expect, it } from "vitest";
import { createSimulation } from "./sim";

describe("simulation cue scheduling", () => {
  it("resolves every scheduled cue as hit or miss", () => {
    const sim = createSimulation();
    sim.setCueTimeline([1, 2, 3, 4, 5]);

    for (let i = 0; i < 60 * 7; i += 1) {
      sim.step(1 / 60);
    }

    const snapshot = sim.getSnapshot();
    expect(snapshot.cueResolvedCount + snapshot.cueMissedCount).toBe(5);
  });

  it("resets accumulated state when starting a new synced run", () => {
    const sim = createSimulation();
    for (let i = 0; i < 60 * 2; i += 1) {
      sim.step(1 / 60);
    }

    const beforeReset = sim.getSnapshot();
    expect(beforeReset.simTick).toBeGreaterThan(0);

    sim.startTrackRun([0.5, 1, 1.5]);
    const afterReset = sim.getSnapshot();
    expect(afterReset.simTick).toBe(0);
    expect(afterReset.simTimeSeconds).toBe(0);
    expect(afterReset.enemyCount).toBe(0);
    expect(afterReset.projectileCount).toBe(0);
    expect(afterReset.score).toBe(0);
    expect(afterReset.combo).toBe(0);
  });

  it("interpolates current intensity from provided timeline samples", () => {
    const sim = createSimulation();
    sim.setIntensityTimeline([
      { timeSeconds: 0, intensity: 0 },
      { timeSeconds: 2, intensity: 1 }
    ]);

    for (let i = 0; i < 60; i += 1) {
      sim.step(1 / 60);
    }

    const snapshot = sim.getSnapshot();
    expect(snapshot.currentIntensity).toBeGreaterThan(0.45);
    expect(snapshot.currentIntensity).toBeLessThan(0.55);
  });
});
