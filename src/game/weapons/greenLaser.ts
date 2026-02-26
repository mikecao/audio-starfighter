import type { WeaponModule } from "./types";

export const greenLaserModule: WeaponModule = {
	id: "green",
	assignmentWeight: 1,
	isEnabled: (state) => state.combatConfig.shipWeapons.greenLaser,
	planCue: () => {
		// Cleanup laser resolves at cue time.
	},
	getCatchupLeadSeconds: (_state, baseLeadSeconds) =>
		Math.min(0.34, Math.max(0.14, baseLeadSeconds * 0.6)),
};
