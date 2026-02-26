import type { EnemyArchetypeId } from "../combatConfig";
import type { SimulationState } from "../types";
import { greenTriangleModule } from "./greenTriangle";
import { redCubeModule } from "./redCube";
import type { SimEnemyModule } from "./types";

const enemyModules = new Map<EnemyArchetypeId, SimEnemyModule>([
	["redCube", redCubeModule],
	["greenTriangle", greenTriangleModule],
]);

export function getEnemyModule(
	archetypeId: EnemyArchetypeId,
): SimEnemyModule | undefined {
	return enemyModules.get(archetypeId);
}

export function registerEnemyModule(module: SimEnemyModule): void {
	enemyModules.set(module.archetypeId, module);
}

/**
 * Spawn an ambient wave for the given archetype.
 * Falls back to redCube if the module isn't found.
 */
export function spawnAmbientEnemyWave(
	state: SimulationState,
	archetype: EnemyArchetypeId,
): number {
	const module = enemyModules.get(archetype);
	if (module) {
		return module.spawnAmbientWave(state);
	}
	// Fallback: use redCube module
	return redCubeModule.spawnAmbientWave(state);
}
