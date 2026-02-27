import {
	DoubleSide,
	Group,
	Mesh,
	PlaneGeometry,
	ShaderMaterial,
} from "three";

export type OceanTimeOfDay = "sunrise" | "day" | "sunset" | "night";

export const OCEAN_TIME_OF_DAY_OPTIONS: Array<{ value: OceanTimeOfDay; label: string }> = [
	{ value: "sunrise", label: "Sunrise" },
	{ value: "day", label: "Day" },
	{ value: "sunset", label: "Sunset" },
	{ value: "night", label: "Night" },
];
export const OCEAN_TIME_OF_DAY_DEFAULT: OceanTimeOfDay = "day";

function oceanTimeOfDayToInt(tod: OceanTimeOfDay): number {
	switch (tod) {
		case "sunrise": return 0;
		case "day": return 1;
		case "sunset": return 2;
		case "night": return 3;
	}
}

export type OceanStage = {
	group: Group;
	update: (simTimeSeconds: number, shipY: number) => void;
	setSize: (size: number) => void;
	setDistortionScale: (scale: number) => void;
	setAmplitude: (amplitude: number) => void;
	setSpeed: (speed: number) => void;
	setTimeOfDay: (tod: OceanTimeOfDay) => void;
};

export const OCEAN_SIZE_DEFAULT = 0.7;
export const OCEAN_SIZE_MIN = 0.1;
export const OCEAN_SIZE_MAX = 3;
export const OCEAN_DISTORTION_DEFAULT = 3.1;
export const OCEAN_DISTORTION_MIN = 0;
export const OCEAN_DISTORTION_MAX = 8;
export const OCEAN_AMPLITUDE_DEFAULT = 0.25;
export const OCEAN_AMPLITUDE_MIN = 0;
export const OCEAN_AMPLITUDE_MAX = 2;
export const OCEAN_SPEED_DEFAULT = 4;
export const OCEAN_SPEED_MIN = 0;
export const OCEAN_SPEED_MAX = 10;

const QUAD_WIDTH = 44;
const QUAD_HEIGHT = 24;
const QUAD_Z = -10;
const SEGMENTS_X = 64;
const SEGMENTS_Y = 48;

// Vertex displacement uses the same noise as the fragment shader.
// Only vertices below the horizon line (uv.y < 0.45) are displaced.
const VERTEX = /* glsl */ `
uniform float uTime;
uniform float uAmplitude;
uniform float uSpeed;
varying vec2 vUv;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  vec2 ga = hash2(i + vec2(0.0, 0.0));
  vec2 gb = hash2(i + vec2(1.0, 0.0));
  vec2 gc = hash2(i + vec2(0.0, 1.0));
  vec2 gd = hash2(i + vec2(1.0, 1.0));

  float va = dot(ga, f - vec2(0.0, 0.0));
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));

  return va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * (va - vb - vc + vd);
}

void main() {
  vUv = uv;
  vec3 pos = position;

  float horizonY = 0.45;
  if (uv.y < horizonY) {
    float t = uTime;
    // How far below the horizon this vertex is (0 at horizon, 1 at bottom)
    float belowHorizon = 1.0 - uv.y / horizonY;
    // Scroll to match forward speed
    float scrollX = uv.x * 6.0 + t * uSpeed * 0.5;
    float scrollY = uv.y * 4.0 + t * 0.3;
    // Two octaves of noise
    float wave = noise(vec2(scrollX, scrollY)) * 0.6
               + noise(vec2(scrollX * 2.1 + 3.7, scrollY * 2.3 - 1.2)) * 0.4;
    // Fade displacement near horizon to keep skyline clean
    float horizonFade = smoothstep(0.0, 0.15, belowHorizon);
    pos.y += wave * uAmplitude * horizonFade;
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

// Ocean shader for orthographic side-view.
//
// Mental model: we're looking at the ocean surface at a grazing angle.
// Screen X = world X along the surface. Screen Y (below horizon) maps to
// distance from the viewer across the surface plane — horizon is infinitely
// far, bottom of screen is nearest.
//
// We sample 2D noise on this virtual surface plane to get wave normals,
// then compute reflections/specular as if looking at the plane from a
// low angle.  This produces the characteristic "stretched reflections"
// that make water look like water.

const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uDistortion;
uniform float uSpeed;
uniform int uTimeOfDay;
varying vec2 vUv;

// ── Gradient noise with analytical derivatives ────────────────────
// Returns vec3(value, dfdx, dfdy) — derivatives give us accurate normals.

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

vec3 noiseD(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);

  vec2 ga = hash2(i + vec2(0.0, 0.0));
  vec2 gb = hash2(i + vec2(1.0, 0.0));
  vec2 gc = hash2(i + vec2(0.0, 1.0));
  vec2 gd = hash2(i + vec2(1.0, 1.0));

  float va = dot(ga, f - vec2(0.0, 0.0));
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));

  float value = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * (va - vb - vc + vd);
  vec2 deriv = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd)
    + du * (u.yx * (va - vb - vc + vd) + vec2(vb, vc) - va);

  return vec3(value, deriv);
}

void main() {
  vec2 uv = vUv;
  float t = uTime;
  float horizonY = 0.45;

  // ── Time-of-day color presets ──
  vec3 horizonCol, midCol, zenithCol, horizonGlowBand;
  vec3 sunDir, sunColor;
  float sunColumnCenter;
  vec3 skyReflectHorizon, skyReflectZenith;
  vec3 deepColor, shallowColor, glowCol;
  vec3 crestLightCol, waveHeightCol;

  if (uTimeOfDay == 0) {
    // ── Sunrise ──
    horizonCol      = vec3(0.80, 0.42, 0.28);
    midCol          = vec3(0.38, 0.52, 0.72);
    zenithCol       = vec3(0.18, 0.30, 0.55);
    horizonGlowBand = vec3(0.55, 0.28, 0.10);
    sunDir          = normalize(vec3(-0.65, 0.18, 1.0));
    sunColor        = vec3(1.0, 0.75, 0.45);
    sunColumnCenter = 0.28;
    skyReflectHorizon = vec3(0.45, 0.30, 0.18);
    skyReflectZenith  = vec3(0.12, 0.16, 0.30);
    deepColor       = vec3(0.02, 0.06, 0.14);
    shallowColor    = vec3(0.04, 0.10, 0.20);
    glowCol         = vec3(0.50, 0.30, 0.15);
    crestLightCol   = vec3(0.10, 0.07, 0.04);
    waveHeightCol   = vec3(0.02, 0.04, 0.06);
  } else if (uTimeOfDay == 1) {
    // ── Day ──
    horizonCol      = vec3(0.72, 0.84, 0.96);
    midCol          = vec3(0.38, 0.62, 0.90);
    zenithCol       = vec3(0.12, 0.36, 0.72);
    horizonGlowBand = vec3(0.88, 0.92, 0.96);
    sunDir          = normalize(vec3(0.0, 0.85, 1.0));
    sunColor        = vec3(1.0, 0.98, 0.90);
    sunColumnCenter = 0.50;
    skyReflectHorizon = vec3(0.50, 0.60, 0.72);
    skyReflectZenith  = vec3(0.14, 0.26, 0.48);
    deepColor       = vec3(0.0, 0.08, 0.20);
    shallowColor    = vec3(0.02, 0.14, 0.28);
    glowCol         = vec3(0.60, 0.70, 0.80);
    crestLightCol   = vec3(0.08, 0.08, 0.06);
    waveHeightCol   = vec3(0.0, 0.03, 0.05);
  } else if (uTimeOfDay == 2) {
    // ── Sunset (default — matches original hardcoded values) ──
    horizonCol      = vec3(0.35, 0.25, 0.18);
    midCol          = vec3(0.12, 0.10, 0.18);
    zenithCol       = vec3(0.02, 0.02, 0.06);
    horizonGlowBand = vec3(0.15, 0.08, 0.03);
    sunDir          = normalize(vec3(-0.1, 0.15, 1.0));
    sunColor        = vec3(1.0, 0.80, 0.50);
    sunColumnCenter = 0.45;
    skyReflectHorizon = vec3(0.25, 0.18, 0.12);
    skyReflectZenith  = vec3(0.06, 0.06, 0.12);
    deepColor       = vec3(0.0, 0.04, 0.08);
    shallowColor    = vec3(0.0, 0.06, 0.12);
    glowCol         = vec3(0.30, 0.20, 0.12);
    crestLightCol   = vec3(0.06, 0.05, 0.04);
    waveHeightCol   = vec3(0.0, 0.02, 0.03);
  } else {
    // ── Night ──
    horizonCol      = vec3(0.06, 0.07, 0.14);
    midCol          = vec3(0.02, 0.03, 0.08);
    zenithCol       = vec3(0.0, 0.0, 0.03);
    horizonGlowBand = vec3(0.04, 0.06, 0.12);
    sunDir          = normalize(vec3(0.3, 0.22, 1.0));
    sunColor        = vec3(0.82, 0.88, 1.0);
    sunColumnCenter = 0.62;
    skyReflectHorizon = vec3(0.06, 0.07, 0.12);
    skyReflectZenith  = vec3(0.02, 0.02, 0.06);
    deepColor       = vec3(0.0, 0.01, 0.04);
    shallowColor    = vec3(0.0, 0.02, 0.06);
    glowCol         = vec3(0.05, 0.06, 0.10);
    crestLightCol   = vec3(0.03, 0.03, 0.04);
    waveHeightCol   = vec3(0.0, 0.01, 0.02);
  }

  // ════════════════════════════════════════════════════════════════════
  //  SKY
  // ════════════════════════════════════════════════════════════════════
  if (uv.y > horizonY) {
    float skyT = (uv.y - horizonY) / (1.0 - horizonY);

    vec3 sky = mix(horizonCol, midCol, smoothstep(0.0, 0.25, skyT));
    sky = mix(sky, zenithCol, smoothstep(0.25, 1.0, skyT));

    // Glow band right at horizon
    sky += horizonGlowBand * smoothstep(0.08, 0.0, skyT);

    gl_FragColor = vec4(sky, 1.0);
    return;
  }

  // ════════════════════════════════════════════════════════════════════
  //  OCEAN SURFACE — grazing angle view
  // ════════════════════════════════════════════════════════════════════

  // dist: 0 at screen bottom (nearest), 1 at horizon (farthest)
  float dist = 1.0 - (horizonY - uv.y) / horizonY;

  // Map screen coordinates to a virtual surface plane.
  float surfaceZ = (0.5 + 30.0 * dist * dist * dist) * uSize;
  float surfaceX = (uv.x - 0.5) * surfaceZ * 2.0;

  // Scroll the surface plane to convey forward speed (ship travels left to right).
  float forwardScroll = t * uSpeed;
  vec2 sp = vec2(surfaceX + forwardScroll, surfaceZ);

  // ── Three scrolling noise layers on the surface plane ──
  vec2 scroll1 = sp * 0.8 + vec2(t * 0.6, t * 0.08);
  vec2 scroll2 = sp * 1.6 + vec2(-t * 0.4, t * 0.12);
  vec2 scroll3 = sp * 3.2 + vec2(t * 0.8, -t * 0.05);

  vec3 n1 = noiseD(scroll1);
  vec3 n2 = noiseD(scroll2);
  vec3 n3 = noiseD(scroll3);

  // Combined wave height and derivatives
  float waveH = n1.x * 0.5 + n2.x * 0.35 + n3.x * 0.15;
  vec2 waveDeriv = n1.yz * 0.5 + n2.yz * 0.35 + n3.yz * 0.15;

  // Scale derivatives — stronger near viewer, subtle at distance
  float derivScale = mix(2.5, 0.3, dist * dist) * uDistortion;
  waveDeriv *= derivScale;

  // Surface normal from derivatives
  vec3 N = normalize(vec3(-waveDeriv.x, 1.0, -waveDeriv.y));

  // ── View direction (grazing angle — nearly horizontal at horizon) ──
  float viewAngle = mix(0.35, 0.02, dist * dist);
  vec3 viewDir = normalize(vec3(0.0, viewAngle, 1.0));

  // ── Fresnel ──
  float NdotV = max(0.0, dot(N, viewDir));
  float fresnel = 0.04 + 0.96 * pow(1.0 - NdotV, 5.0);
  fresnel = mix(fresnel, 0.95, smoothstep(0.3, 0.95, dist));

  // ── Specular — sun/moon reflection path on water ──
  vec3 R = reflect(-viewDir, N);
  float sunSpec = pow(max(0.0, dot(R, sunDir)), 256.0);
  float sunSpecBroad = pow(max(0.0, dot(R, sunDir)), 16.0);

  // Reflection column — horizontal band around light source
  float sunColumnX = smoothstep(0.3, 0.0, abs(uv.x - sunColumnCenter));
  sunSpec *= sunColumnX;
  sunSpecBroad *= sunColumnX * 0.6 + 0.4;

  // ── Sky reflection color (what the water reflects) ──
  float reflectUp = max(0.0, R.y);
  vec3 skyReflect = mix(
    skyReflectHorizon,
    skyReflectZenith,
    smoothstep(0.0, 0.5, reflectUp)
  );

  // ── Deep water color (what we see through the surface) ──
  vec3 waterColor = mix(shallowColor, deepColor, dist);

  // ── Combine reflection and refraction via Fresnel ──
  vec3 col = mix(waterColor, skyReflect, fresnel);

  // Add specular highlights
  col += sunColor * sunSpec * 3.0;
  col += sunColor * sunSpecBroad * 0.08;

  // ── Stretched reflection on water (the bright path) ──
  float reflPathX = smoothstep(0.25, 0.0, abs(uv.x - sunColumnCenter));
  float reflPathDist = smoothstep(1.0, 0.3, dist);
  float reflPath = reflPathX * reflPathDist * (0.3 + waveH * 0.4 + 0.3);
  col += sunColor * reflPath * 0.12;

  // ── Horizon glow — light where sky meets water ──
  float horizonGlowFactor = smoothstep(0.3, 1.0, dist);
  col = mix(col, glowCol, horizonGlowFactor * 0.35);

  // ── Wave-driven brightness variation ──
  float crestLight = waveH * 0.15 * (1.0 - dist * 0.5);
  col += crestLightCol * crestLight;

  // ── Subtle color variation from wave height ──
  col += waveHeightCol * max(0.0, waveH) * (1.0 - dist);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function createOceanStage(): OceanStage {
	const group = new Group();

	const geometry = new PlaneGeometry(QUAD_WIDTH, QUAD_HEIGHT, SEGMENTS_X, SEGMENTS_Y);
	const uniforms = {
		uTime: { value: 0 },
		uSize: { value: OCEAN_SIZE_DEFAULT },
		uDistortion: { value: OCEAN_DISTORTION_DEFAULT },
		uAmplitude: { value: OCEAN_AMPLITUDE_DEFAULT },
		uSpeed: { value: OCEAN_SPEED_DEFAULT },
		uTimeOfDay: { value: oceanTimeOfDayToInt(OCEAN_TIME_OF_DAY_DEFAULT) },
	};
	const material = new ShaderMaterial({
		vertexShader: VERTEX,
		fragmentShader: FRAGMENT,
		uniforms,
		side: DoubleSide,
		transparent: false,
		depthWrite: true,
	});
	const mesh = new Mesh(geometry, material);
	mesh.position.set(0, 0, QUAD_Z);
	mesh.renderOrder = -10;
	group.add(mesh);

	return {
		group,
		update(simTimeSeconds) {
			uniforms.uTime.value = simTimeSeconds;
		},
		setSize(size) {
			uniforms.uSize.value = Math.max(OCEAN_SIZE_MIN, Math.min(OCEAN_SIZE_MAX, size));
		},
		setDistortionScale(scale) {
			uniforms.uDistortion.value = Math.max(OCEAN_DISTORTION_MIN, Math.min(OCEAN_DISTORTION_MAX, scale));
		},
		setAmplitude(value) {
			uniforms.uAmplitude.value = Math.max(OCEAN_AMPLITUDE_MIN, Math.min(OCEAN_AMPLITUDE_MAX, value));
		},
		setSpeed(speed) {
			uniforms.uSpeed.value = Math.max(OCEAN_SPEED_MIN, Math.min(OCEAN_SPEED_MAX, speed));
		},
		setTimeOfDay(tod) {
			uniforms.uTimeOfDay.value = oceanTimeOfDayToInt(tod);
		},
	};
}
