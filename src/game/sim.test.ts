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
});
