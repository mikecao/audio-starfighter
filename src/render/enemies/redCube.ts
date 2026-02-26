import { BoxGeometry, Color } from "three";
import type { RenderEnemyModule } from "./types";

export const redCubeGeometry = new BoxGeometry(0.85, 0.85, 0.85);

export const redCubeRenderModule: RenderEnemyModule = {
	archetypeId: "redCube",
	geometry: redCubeGeometry,
	style: {
		baseColor: new Color("#f87171"),
		hitColor: new Color("#fef08a"),
		baseEmissive: new Color("#7f1d1d"),
		hitEmissive: new Color("#fde047"),
	},
};
