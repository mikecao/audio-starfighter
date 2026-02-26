import type { SimulationState } from "../types";

export type SimulationModule = {
	id: string;
	order: number;
	init?: (state: SimulationState) => void;
	reset?: (state: SimulationState) => void;
	step: (state: SimulationState, deltaSeconds: number) => void;
};
