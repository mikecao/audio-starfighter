import type { SimulationState } from "../types";
import { clamp } from "../utils";
import {
	PLAYER_PROJECTILE_SPEED,
	queueCueShotForEnemy,
} from "./cueShots";
import type { CueShotFireParams, CueShotImmediateParams, WeaponModule } from "./types";

export const yellowLaserModule: WeaponModule = {
	id: "yellow",
	assignmentWeight: 1,
	isEnabled: (state) => state.combatConfig.shipWeapons.yellowLaser,
	planCue(state, enemy, cueTimeSeconds) {
		queueCueShotForEnemy(
			state,
			enemy,
			cueTimeSeconds,
			"yellow",
			fireImmediateYellowCueShot,
		);
	},
	getCatchupLeadSeconds: (_state, baseLeadSeconds) =>
		clamp(baseLeadSeconds, 0.18, 0.58),
	fireQueuedShot: fireQueuedYellowShot,
};

function fireImmediateYellowCueShot(
	state: SimulationState,
	params: CueShotImmediateParams,
): void {
	state.projectiles.push({
		id: state.nextProjectileId++,
		x: params.shipX,
		y: params.shipY,
		z: 0,
		vx: params.dirX * PLAYER_PROJECTILE_SPEED,
		vy: params.dirY * PLAYER_PROJECTILE_SPEED,
		ageSeconds: 0,
		maxLifetimeSeconds: 0.34,
		radius: 0.16,
		isCueShot: true,
		isFlak: false,
	});
}

function fireQueuedYellowShot(
	state: SimulationState,
	params: CueShotFireParams,
): void {
	state.projectiles.push({
		id: state.nextProjectileId++,
		x: params.shipX,
		y: params.shipY,
		z: 0,
		vx: params.dx / params.leadSeconds,
		vy: params.dy / params.leadSeconds,
		ageSeconds: 0,
		maxLifetimeSeconds: params.leadSeconds + 0.12,
		radius: 0.16,
		isCueShot: true,
		isFlak: false,
	});
}
