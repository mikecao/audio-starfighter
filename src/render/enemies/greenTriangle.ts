import { Color, TetrahedronGeometry } from "three";
import type { RenderEnemyModule } from "./types";

export const greenTriangleGeometry = new TetrahedronGeometry(0.62, 0);

export const greenTriangleRenderModule: RenderEnemyModule = {
	archetypeId: "greenTriangle",
	geometry: greenTriangleGeometry,
	style: {
		baseColor: new Color("#4ade80"),
		hitColor: new Color("#fef08a"),
		baseEmissive: new Color("#166534"),
		hitEmissive: new Color("#bef264"),
	},
};
