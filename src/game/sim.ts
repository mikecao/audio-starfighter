export type SimulationSnapshot = {
  simTimeSeconds: number;
  simTick: number;
  ship: {
    x: number;
    y: number;
    z: number;
  };
  enemyCount: number;
  projectileCount: number;
};

type SimulationState = {
  simTimeSeconds: number;
  simTick: number;
  shipX: number;
  shipY: number;
};

export type Simulation = {
  step: (deltaSeconds: number) => void;
  getSnapshot: () => SimulationSnapshot;
};

export function createSimulation(): Simulation {
  const state: SimulationState = {
    simTimeSeconds: 0,
    simTick: 0,
    shipX: -6,
    shipY: 0
  };

  return {
    step(deltaSeconds: number) {
      state.simTimeSeconds += deltaSeconds;
      state.simTick += 1;

      state.shipY = Math.sin(state.simTimeSeconds * 1.4) * 1.8;
      state.shipX = -6 + Math.sin(state.simTimeSeconds * 0.35) * 0.75;
    },
    getSnapshot() {
      return {
        simTimeSeconds: state.simTimeSeconds,
        simTick: state.simTick,
        ship: {
          x: state.shipX,
          y: state.shipY,
          z: 0
        },
        enemyCount: 0,
        projectileCount: 0
      };
    }
  };
}
