import type { SimulationState } from "../types";
import type { SimulationModule } from "./types";

export type ModuleRunner = {
	modules: SimulationModule[];
	init: (state: SimulationState) => void;
	reset: (state: SimulationState) => void;
	step: (state: SimulationState, deltaSeconds: number) => void;
};

export function createModuleRunner(modules: SimulationModule[]): ModuleRunner {
	const ordered = [...modules].sort((a, b) => a.order - b.order);
	return {
		modules: ordered,
		init(state) {
			for (const module of ordered) {
				module.init?.(state);
			}
		},
		reset(state) {
			for (const module of ordered) {
				module.reset?.(state);
			}
		},
		step(state, deltaSeconds) {
			for (const module of ordered) {
				module.step(state, deltaSeconds);
			}
		},
	};
}
