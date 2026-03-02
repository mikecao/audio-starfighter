import type { SceneInstance } from "./types";
import {
	createSkyStage,
	SKY_TURBIDITY_DEFAULT,
	SKY_RAYLEIGH_DEFAULT,
	SKY_MIE_COEFFICIENT_DEFAULT,
	SKY_MIE_DIRECTIONAL_G_DEFAULT,
	SKY_ELEVATION_DEFAULT,
	SKY_AZIMUTH_DEFAULT,
	SKY_EXPOSURE_DEFAULT,
	SKY_HORIZON_DEFAULT,
	SKY_CLOUD_COVERAGE_DEFAULT,
	SKY_CLOUD_DENSITY_DEFAULT,
	SKY_CLOUD_ELEVATION_DEFAULT,
} from "../stages/sky";

export function createSkyScene(id: string): SceneInstance {
	const stage = createSkyStage();

	let turbidity = SKY_TURBIDITY_DEFAULT;
	let rayleighVal = SKY_RAYLEIGH_DEFAULT;
	let mieCoefficient = SKY_MIE_COEFFICIENT_DEFAULT;
	let mieDirectionalG = SKY_MIE_DIRECTIONAL_G_DEFAULT;
	let elevation = SKY_ELEVATION_DEFAULT;
	let azimuth = SKY_AZIMUTH_DEFAULT;
	let exposure = SKY_EXPOSURE_DEFAULT;
	let horizon = SKY_HORIZON_DEFAULT;
	let cloudCoverage = SKY_CLOUD_COVERAGE_DEFAULT;
	let cloudDensity = SKY_CLOUD_DENSITY_DEFAULT;
	let cloudElevation = SKY_CLOUD_ELEVATION_DEFAULT;

	return {
		id,
		kind: "sky",
		group: stage.group,
		update(simTimeSeconds, shipY) {
			stage.update(simTimeSeconds, shipY);
		},
		set(key, value) {
			const v = value as number;
			switch (key) {
				case "turbidity":
					turbidity = v;
					stage.setTurbidity(v);
					return true;
				case "rayleigh":
					rayleighVal = v;
					stage.setRayleigh(v);
					return true;
				case "mieCoefficient":
					mieCoefficient = v;
					stage.setMieCoefficient(v);
					return true;
				case "mieDirectionalG":
					mieDirectionalG = v;
					stage.setMieDirectionalG(v);
					return true;
				case "elevation":
					elevation = v;
					stage.setElevation(v);
					return true;
				case "azimuth":
					azimuth = v;
					stage.setAzimuth(v);
					return true;
				case "exposure":
					exposure = v;
					stage.setExposure(v);
					return true;
				case "horizon":
					horizon = v;
					stage.setHorizon(v);
					return true;
				case "cloudCoverage":
					cloudCoverage = v;
					stage.setCloudCoverage(v);
					return true;
				case "cloudDensity":
					cloudDensity = v;
					stage.setCloudDensity(v);
					return true;
				case "cloudElevation":
					cloudElevation = v;
					stage.setCloudElevation(v);
					return true;
				default:
					return false;
			}
		},
		getSettings() {
			return {
				turbidity,
				rayleigh: rayleighVal,
				mieCoefficient,
				mieDirectionalG,
				elevation,
				azimuth,
				exposure,
				horizon,
				cloudCoverage,
				cloudDensity,
				cloudElevation,
			};
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
