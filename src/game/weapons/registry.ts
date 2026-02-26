import type { CueWeaponId, SimulationState } from "../types";
import { blueLaserModule } from "./blueLaser";
import { greenLaserModule } from "./greenLaser";
import { orangeFlakModule } from "./orangeFlak";
import { purpleMissileModule } from "./purpleMissile";
import type { WeaponModule } from "./types";
import { yellowLaserModule } from "./yellowLaser";

const weaponModules = new Map<CueWeaponId, WeaponModule>([
	["blue", blueLaserModule],
	["yellow", yellowLaserModule],
	["green", greenLaserModule],
	["purple", purpleMissileModule],
	["orange", orangeFlakModule],
]);

export function getWeaponModule(id: CueWeaponId): WeaponModule | undefined {
	return weaponModules.get(id);
}

export function getWeaponModules(): WeaponModule[] {
	return Array.from(weaponModules.values());
}

export function getEnabledWeaponModules(
	state: SimulationState,
): WeaponModule[] {
	return getWeaponModules().filter(
		(module) => module.isEnabled(state) && module.assignmentWeight > 0,
	);
}

export function isWeaponEnabled(
	state: SimulationState,
	weaponId: CueWeaponId,
): boolean {
	const module = weaponModules.get(weaponId);
	return module ? module.isEnabled(state) : false;
}

export function selectCueWeaponForAssignment(
	state: SimulationState,
): WeaponModule | null {
	const pool: WeaponModule[] = [];
	for (const module of weaponModules.values()) {
		if (!module.isEnabled(state)) {
			continue;
		}
		const weight = Math.max(0, Math.floor(module.assignmentWeight));
		for (let i = 0; i < weight; i += 1) {
			pool.push(module);
		}
	}
	if (pool.length === 0) {
		return null;
	}
	const selected = pool[state.cueWeaponCursor % pool.length];
	state.cueWeaponCursor = (state.cueWeaponCursor + 1) % Math.max(1, pool.length);
	return selected ?? null;
}
