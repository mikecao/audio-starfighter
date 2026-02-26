import type { CueWeaponId, Enemy, SimulationState } from "../types";

export type CueShotFireParams = {
	shipX: number;
	shipY: number;
	dx: number;
	dy: number;
	leadSeconds: number;
};

export type CueShotImmediateParams = {
	shipX: number;
	shipY: number;
	dirX: number;
	dirY: number;
};

export type WeaponModule = {
	id: CueWeaponId;
	assignmentWeight: number;
	isEnabled: (state: SimulationState) => boolean;
	planCue: (state: SimulationState, enemy: Enemy, cueTimeSeconds: number) => void;
	getCatchupLeadSeconds?: (
		state: SimulationState,
		baseLeadSeconds: number,
	) => number;
	fireQueuedShot?: (state: SimulationState, params: CueShotFireParams) => void;
	fireQueued?: (state: SimulationState) => void;
	step?: (state: SimulationState, deltaSeconds: number) => void;
};
