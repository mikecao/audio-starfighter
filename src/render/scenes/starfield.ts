import { Group, type PointsMaterial } from "three";
import type { SceneInstance } from "./types";
import {
	createStarLayer,
	updateStarLayer,
	normalizeStarfieldSpeedScale,
	normalizeStarfieldShipMovementResponse,
	STARFIELD_SPEED_SCALE_DEFAULT,
	STARFIELD_SHIP_MOVEMENT_RESPONSE_DEFAULT,
} from "../stages/starfield";

export function createStarfieldScene(id: string): SceneInstance {
	const group = new Group();

	const closeStars = createStarLayer(130, 0xe0f2fe, 10.5, 0.12, 0.56);
	const nearStars = createStarLayer(220, 0x93c5fd, 6.6, 0.08, 0.34);
	const farStars = createStarLayer(150, 0x334155, 3.1, 0.05, 0.14);
	const starLayers = [farStars, nearStars, closeStars];

	for (const layer of starLayers) {
		group.add(layer.primary);
		group.add(layer.wrap);
	}

	let speedScale = STARFIELD_SPEED_SCALE_DEFAULT;
	let shipMovementResponse = STARFIELD_SHIP_MOVEMENT_RESPONSE_DEFAULT;

	return {
		id,
		kind: "starfield",
		group,
		update(simTimeSeconds, shipY) {
			for (const layer of starLayers) {
				updateStarLayer(layer, simTimeSeconds, shipY, speedScale, shipMovementResponse);
			}
		},
		set(key, value) {
			switch (key) {
				case "speedScale":
					speedScale = normalizeStarfieldSpeedScale(value as number);
					return true;
				case "shipMovementResponse":
					shipMovementResponse = normalizeStarfieldShipMovementResponse(value as number);
					return true;
				default:
					return false;
			}
		},
		getSettings() {
			return { speedScale, shipMovementResponse };
		},
		dispose() {
			for (const layer of starLayers) {
				layer.primary.geometry.dispose();
				(layer.primary.material as PointsMaterial).dispose();
				(layer.wrap.material as PointsMaterial).dispose();
			}
		},
	};
}
