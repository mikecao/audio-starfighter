import type { EnemyArchetypeDefinition, EnemyArchetypeId } from "../combatConfig";
import type { Enemy, EnemyPattern, SimulationState } from "../types";

/**
 * Simulation-side module for an enemy archetype.
 *
 * Each archetype provides its own spawn logic, movement patterns,
 * and archetype definition. The registry iterates over registered
 * modules when spawning and updating enemies.
 */
export type SimEnemyModule = {
	archetypeId: EnemyArchetypeId;
	definition: EnemyArchetypeDefinition;

	/** All movement patterns this archetype can use. */
	patterns: EnemyPattern[];

	/** Pick a pattern for an ambient spawn (index = spawnIndex). */
	pickAmbientPattern: (spawnIndex: number, rng: () => number) => EnemyPattern;

	/** Spawn an ambient wave of this archetype (single enemy or formation). Returns count spawned. */
	spawnAmbientWave: (state: SimulationState) => number;
};
