import type { SimulationModule } from "./types";

export type DefaultModuleHandlers = {
	shipMotion: SimulationModule["step"];
	enemySpawns: SimulationModule["step"];
	cuePlanning: SimulationModule["step"];
	weaponFire: SimulationModule["step"];
	enemyUpdates: SimulationModule["step"];
	projectileUpdates: SimulationModule["step"];
	collisionResolution: SimulationModule["step"];
	cleanup: SimulationModule["step"];
};

export function createDefaultModules(
	handlers: DefaultModuleHandlers,
): SimulationModule[] {
	return [
		{
			id: "ship-motion",
			order: 10,
			step: handlers.shipMotion,
		},
		{
			id: "enemy-spawn",
			order: 20,
			step: handlers.enemySpawns,
		},
		{
			id: "cue-planning",
			order: 30,
			step: handlers.cuePlanning,
		},
		{
			id: "weapon-fire",
			order: 40,
			step: handlers.weaponFire,
		},
		{
			id: "enemy-updates",
			order: 50,
			step: handlers.enemyUpdates,
		},
		{
			id: "projectile-updates",
			order: 60,
			step: handlers.projectileUpdates,
		},
		{
			id: "collision-resolution",
			order: 70,
			step: handlers.collisionResolution,
		},
		{
			id: "cleanup",
			order: 80,
			step: handlers.cleanup,
		},
	];
}
