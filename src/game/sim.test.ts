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
    expect(snapshot.cueResolvedCount).toBeLessThanOrEqual(5);
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
    expect(afterReset.pendingCueCount).toBe(3);
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

  it("produces deterministic outcomes for the same seed and inputs", () => {
    const simA = createSimulation();
    const simB = createSimulation();

    const intensityTimeline = [
      { timeSeconds: 0, intensity: 0.3 },
      { timeSeconds: 1.5, intensity: 0.9 },
      { timeSeconds: 3, intensity: 0.2 }
    ];
    const cueTimeline = [0.8, 1.6, 2.4, 3.2];

    simA.setRandomSeed(42);
    simB.setRandomSeed(42);
    simA.setIntensityTimeline(intensityTimeline);
    simB.setIntensityTimeline(intensityTimeline);
    simA.startTrackRun(cueTimeline);
    simB.startTrackRun(cueTimeline);

    for (let i = 0; i < 60 * 5; i += 1) {
      simA.step(1 / 60);
      simB.step(1 / 60);
    }

    const a = simA.getSnapshot();
    const b = simB.getSnapshot();
    expect(a.enemyCount).toBe(b.enemyCount);
    expect(a.projectileCount).toBe(b.projectileCount);
    expect(a.cueResolvedCount).toBe(b.cueResolvedCount);
    expect(a.cueMissedCount).toBe(b.cueMissedCount);
    expect(a.score).toBe(b.score);
    expect(a.combo).toBe(b.combo);
  });

  it("keeps cue pending before its time and resolves it afterward", () => {
    const sim = createSimulation();
    sim.setRandomSeed(7);
    sim.startTrackRun([1.0]);

    for (let i = 0; i < 60 * 0.75; i += 1) {
      sim.step(1 / 60);
    }

    const beforeCue = sim.getSnapshot();
    expect(beforeCue.pendingCueCount).toBeGreaterThan(0);
    expect(beforeCue.cueResolvedCount + beforeCue.cueMissedCount).toBe(0);

    for (let i = 0; i < 60 * 0.6; i += 1) {
      sim.step(1 / 60);
    }

    const afterCue = sim.getSnapshot();
    expect(afterCue.cueResolvedCount + afterCue.cueMissedCount).toBe(1);
  });

  it("resets cue progress when applying a new cue timeline", () => {
    const sim = createSimulation();
    sim.startTrackRun([0.5, 1.0]);

    for (let i = 0; i < 60 * 1.2; i += 1) {
      sim.step(1 / 60);
    }
    const beforeReset = sim.getSnapshot();
    expect(beforeReset.cueResolvedCount + beforeReset.cueMissedCount).toBeGreaterThan(0);

    sim.setCueTimeline([2.0, 2.5]);
    const afterReset = sim.getSnapshot();
    expect(afterReset.cueResolvedCount).toBe(0);
    expect(afterReset.cueMissedCount).toBe(0);
    expect(afterReset.pendingCueCount).toBe(2);
    expect(afterReset.plannedCueCount).toBe(0);
  });

  it("exposes configured mood profile in snapshot", () => {
    const sim = createSimulation();
    sim.setMoodProfile("aggressive");
    const snapshot = sim.getSnapshot();
    expect(snapshot.moodProfile).toBe("aggressive");
  });

  it("increases combat pressure in aggressive mood versus calm", () => {
    const calm = createSimulation();
    const aggressive = createSimulation();
    calm.setRandomSeed(99);
    aggressive.setRandomSeed(99);
    calm.setMoodProfile("calm");
    aggressive.setMoodProfile("aggressive");

    for (let i = 0; i < 60 * 6; i += 1) {
      calm.step(1 / 60);
      aggressive.step(1 / 60);
    }

    const calmSnapshot = calm.getSnapshot();
    const aggressiveSnapshot = aggressive.getSnapshot();
    expect(aggressiveSnapshot.projectileCount).toBeGreaterThanOrEqual(calmSnapshot.projectileCount);
    expect(aggressiveSnapshot.enemyCount).toBeGreaterThanOrEqual(calmSnapshot.enemyCount);
  });

  it("decouples enemy bullet volume from enemy population using bullet ratio", () => {
    const noBullets = createSimulation();
    noBullets.setRandomSeed(77);
    noBullets.setMoodProfile("aggressive");
    noBullets.setEnemyBulletRatio(0);

    for (let i = 0; i < 60 * 6; i += 1) {
      noBullets.step(1 / 60);
    }

    const noBulletsSnapshot = noBullets.getSnapshot();
    expect(noBulletsSnapshot.enemyCount).toBeGreaterThan(0);
    expect(noBulletsSnapshot.enemyProjectiles.length).toBe(0);

    const boostedBullets = createSimulation();
    boostedBullets.setRandomSeed(77);
    boostedBullets.setMoodProfile("aggressive");
    boostedBullets.setEnemyBulletRatio(1.6);

    for (let i = 0; i < 60 * 6; i += 1) {
      boostedBullets.step(1 / 60);
    }

    const boostedSnapshot = boostedBullets.getSnapshot();
    expect(boostedSnapshot.enemyCount).toBeGreaterThan(0);
    expect(boostedSnapshot.enemyProjectiles.length).toBeGreaterThan(0);
  });

  it("lets primary projectile weapon be toggled independently", () => {
    const withPrimary = createSimulation();
    const withoutPrimary = createSimulation();
    withPrimary.setEnemyBulletRatio(0);
    withoutPrimary.setEnemyBulletRatio(0);
    withoutPrimary.setShipWeapons({ primaryProjectiles: false });

    let maxPlayerProjectilesWithPrimary = 0;
    let maxPlayerProjectilesWithoutPrimary = 0;

    for (let i = 0; i < 60 * 4; i += 1) {
      withPrimary.step(1 / 60);
      withoutPrimary.step(1 / 60);
      maxPlayerProjectilesWithPrimary = Math.max(
        maxPlayerProjectilesWithPrimary,
        withPrimary.getSnapshot().projectiles.length
      );
      maxPlayerProjectilesWithoutPrimary = Math.max(
        maxPlayerProjectilesWithoutPrimary,
        withoutPrimary.getSnapshot().projectiles.length
      );
    }

    expect(maxPlayerProjectilesWithPrimary).toBeGreaterThan(0);
    expect(maxPlayerProjectilesWithoutPrimary).toBe(0);
  });

  it("keeps simulation stable when cleanup laser weapon is disabled", () => {
    const sim = createSimulation();
    sim.setShipWeapons({ cleanupLaser: false });
    sim.setIntensityTimeline([
      { timeSeconds: 0, intensity: 0.95 },
      { timeSeconds: 4, intensity: 0.95 }
    ]);

    let maxLaserBeams = 0;
    let maxEnemyCount = 0;
    for (let i = 0; i < 60 * 8; i += 1) {
      sim.step(1 / 60);
      const snapshot = sim.getSnapshot();
      maxLaserBeams = Math.max(maxLaserBeams, snapshot.laserBeams.length);
      maxEnemyCount = Math.max(maxEnemyCount, snapshot.enemyCount);
    }

    const finalSnapshot = sim.getSnapshot();
    expect(finalSnapshot.enemyCount).toBeGreaterThan(0);
    expect(maxLaserBeams).toBe(0);
    expect(maxEnemyCount).toBeLessThan(120);
  });

  it("surfaces enemy archetype in snapshots for roster-driven rendering", () => {
    const sim = createSimulation();
    sim.setEnemyRoster({
      enabledArchetypes: ["redCube"],
      spawnScale: 1.1,
      fireScale: 0.95
    });

    for (let i = 0; i < 60 * 2; i += 1) {
      sim.step(1 / 60);
    }

    const snapshot = sim.getSnapshot();
    expect(snapshot.enemyCount).toBeGreaterThan(0);
    expect(snapshot.enemies.every((enemy) => enemy.archetype === "redCube")).toBe(true);
  });

  it("emits cue-tagged projectiles when queued cue shots are enabled", () => {
    const sim = createSimulation();
    sim.setRandomSeed(17);
    sim.startTrackRun([0.8, 1.2, 1.6, 2.0, 2.4, 2.8]);

    let cueProjectileSeen = false;
    for (let i = 0; i < 60 * 5; i += 1) {
      sim.step(1 / 60);
      const snapshot = sim.getSnapshot();
      if (snapshot.projectiles.some((projectile) => projectile.isCueShot)) {
        cueProjectileSeen = true;
        break;
      }
    }

    expect(cueProjectileSeen).toBe(true);
  });
});
