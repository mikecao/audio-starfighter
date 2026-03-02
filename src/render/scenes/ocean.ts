import type { SceneInstance } from "./types";
import {
	createOceanStage,
	OCEAN_SIZE_DEFAULT,
	OCEAN_DISTORTION_DEFAULT,
	OCEAN_AMPLITUDE_DEFAULT,
	OCEAN_SPEED_DEFAULT,
	OCEAN_TIME_OF_DAY_DEFAULT,
	type OceanTimeOfDay,
} from "../stages/ocean";

const VALID_TIME_OF_DAY = new Set<string>(["sunrise", "day", "sunset", "night"]);

export function createOceanScene(id: string): SceneInstance {
	const stage = createOceanStage();

	let size = OCEAN_SIZE_DEFAULT;
	let distortionScale = OCEAN_DISTORTION_DEFAULT;
	let amplitude = OCEAN_AMPLITUDE_DEFAULT;
	let speed = OCEAN_SPEED_DEFAULT;
	let timeOfDay: OceanTimeOfDay = OCEAN_TIME_OF_DAY_DEFAULT;

	return {
		id,
		kind: "ocean",
		group: stage.group,
		update(simTimeSeconds, shipY) {
			stage.update(simTimeSeconds, shipY);
		},
		set(key, value) {
			switch (key) {
				case "size":
					size = value as number;
					stage.setSize(size);
					return true;
				case "distortionScale":
					distortionScale = value as number;
					stage.setDistortionScale(distortionScale);
					return true;
				case "amplitude":
					amplitude = value as number;
					stage.setAmplitude(amplitude);
					return true;
				case "speed":
					speed = value as number;
					stage.setSpeed(speed);
					return true;
				case "timeOfDay":
					if (VALID_TIME_OF_DAY.has(value as string)) {
						timeOfDay = value as OceanTimeOfDay;
						stage.setTimeOfDay(timeOfDay);
					}
					return true;
				default:
					return false;
			}
		},
		getSettings() {
			return { size, distortionScale, amplitude, speed, timeOfDay };
		},
		dispose() {
			const mesh = stage.group.children[0];
			if (mesh && "geometry" in mesh) {
				(mesh as { geometry: { dispose(): void } }).geometry.dispose();
			}
			if (mesh && "material" in mesh) {
				(mesh as { material: { dispose(): void } }).material.dispose();
			}
		},
	};
}
