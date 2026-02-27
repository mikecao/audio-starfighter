import {
	DoubleSide,
	Group,
	Mesh,
	MathUtils,
	PlaneGeometry,
	ShaderMaterial,
	Vector3,
} from "three";

// ── Exported types & constants ──

export type SkyStage = {
	group: Group;
	update: (simTimeSeconds: number, shipY: number) => void;
	setTurbidity: (v: number) => void;
	setRayleigh: (v: number) => void;
	setMieCoefficient: (v: number) => void;
	setMieDirectionalG: (v: number) => void;
	setElevation: (v: number) => void;
	setAzimuth: (v: number) => void;
	setExposure: (v: number) => void;
};

export const SKY_TURBIDITY_DEFAULT = 10;
export const SKY_TURBIDITY_MIN = 0;
export const SKY_TURBIDITY_MAX = 20;
export const SKY_RAYLEIGH_DEFAULT = 3;
export const SKY_RAYLEIGH_MIN = 0;
export const SKY_RAYLEIGH_MAX = 4;
export const SKY_MIE_COEFFICIENT_DEFAULT = 0.005;
export const SKY_MIE_COEFFICIENT_MIN = 0;
export const SKY_MIE_COEFFICIENT_MAX = 0.1;
export const SKY_MIE_DIRECTIONAL_G_DEFAULT = 0.7;
export const SKY_MIE_DIRECTIONAL_G_MIN = 0;
export const SKY_MIE_DIRECTIONAL_G_MAX = 1;
export const SKY_ELEVATION_DEFAULT = 2;
export const SKY_ELEVATION_MIN = 0;
export const SKY_ELEVATION_MAX = 90;
export const SKY_AZIMUTH_DEFAULT = 180;
export const SKY_AZIMUTH_MIN = -180;
export const SKY_AZIMUTH_MAX = 180;
export const SKY_EXPOSURE_DEFAULT = 0.5;
export const SKY_EXPOSURE_MIN = 0;
export const SKY_EXPOSURE_MAX = 1;

// ── Geometry constants ──

const QUAD_WIDTH = 44;
const QUAD_HEIGHT = 24;
const QUAD_Z = -10;

// ── Helpers ──

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}

function computeSunPosition(elevation: number, azimuth: number): Vector3 {
	const phi = MathUtils.degToRad(90 - elevation);
	const theta = MathUtils.degToRad(azimuth);
	return new Vector3().setFromSphericalCoords(1, phi, theta);
}

// ── Shaders ──

/*
 * Preetham sky model ported from Three.js Sky.js addon.
 * Adapted for a full-screen quad with an orthographic camera:
 * instead of using vWorldPosition to derive a view direction,
 * we map the quad's UV coordinates to a hemisphere of directions.
 *
 * The scattering coefficients (betaR, betaM, sunE, sunfade) depend
 * only on sun position and material params, so we compute them
 * once in the fragment shader rather than per-vertex.
 */

const VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform float turbidity;
uniform float rayleigh;
uniform float mieCoefficient;
uniform float mieDirectionalG;
uniform vec3 sunPosition;
uniform float exposure;

varying vec2 vUv;

// ── Constants ──
const float E = 2.71828182845904523536;
const float PI = 3.141592653589793238;
const vec3 UP = vec3(0.0, 1.0, 0.0);

// Precomputed Rayleigh total scattering
const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);

// Mie constants
const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);

// Earth shadow hack
const float cutoffAngle = 1.6110731556870734; // pi / 1.95
const float steepness = 1.5;
const float EE = 1000.0;

// Optical lengths at zenith
const float rayleighZenithLength = 8.4E3;
const float mieZenithLength = 1.25E3;

// Sun angular diameter
const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
const float ONE_OVER_FOURPI = 0.07957747154594767;

// ── Functions ──

float sunIntensityFn(float zenithAngleCos) {
	zenithAngleCos = clamp(zenithAngleCos, -1.0, 1.0);
	return EE * max(0.0, 1.0 - pow(E, -((cutoffAngle - acos(zenithAngleCos)) / steepness)));
}

vec3 totalMie(float T) {
	float c = (0.2 * T) * 10E-18;
	return 0.434 * c * MieConst;
}

float rayleighPhase(float cosTheta) {
	return THREE_OVER_SIXTEENPI * (1.0 + pow(cosTheta, 2.0));
}

float hgPhase(float cosTheta, float g) {
	float g2 = pow(g, 2.0);
	float inv = 1.0 / pow(1.0 - 2.0 * g * cosTheta + g2, 1.5);
	return ONE_OVER_FOURPI * ((1.0 - g2) * inv);
}

// ACES Filmic tone mapping
vec3 ACESFilmic(vec3 x) {
	float a = 2.51;
	float b = 0.03;
	float c = 2.43;
	float d = 0.59;
	float e = 0.14;
	return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
	// ── Map UV to view direction on a hemisphere ──
	// x: full 360° azimuth, y: 0 = horizon, 1 = zenith
	float azimuthAngle = (vUv.x - 0.5) * 2.0 * PI;
	float elevAngle = vUv.y * PI * 0.5;
	vec3 direction = normalize(vec3(
		cos(elevAngle) * sin(azimuthAngle),
		sin(elevAngle),
		cos(elevAngle) * cos(azimuthAngle)
	));

	// ── Scattering coefficients (per-fragment, uniform across quad) ──
	vec3 sunDir = normalize(sunPosition);
	float sunE = sunIntensityFn(dot(sunDir, UP));
	float sunfade = 1.0 - clamp(1.0 - exp(sunPosition.y / 450000.0), 0.0, 1.0);
	float rayleighCoefficient = rayleigh - (1.0 * (1.0 - sunfade));
	vec3 betaR = totalRayleigh * rayleighCoefficient;
	vec3 betaM = totalMie(turbidity) * mieCoefficient;

	// ── Optical length ──
	float zenithAngle = acos(max(0.0, dot(UP, direction)));
	float inv = 1.0 / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / PI), -1.253));
	float sR = rayleighZenithLength * inv;
	float sM = mieZenithLength * inv;

	// ── Extinction ──
	vec3 Fex = exp(-(betaR * sR + betaM * sM));

	// ── In-scattering ──
	float cosTheta = dot(direction, sunDir);
	float rPhase = rayleighPhase(cosTheta * 0.5 + 0.5);
	vec3 betaRTheta = betaR * rPhase;
	float mPhase = hgPhase(cosTheta, mieDirectionalG);
	vec3 betaMTheta = betaM * mPhase;

	vec3 Lin = pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * (1.0 - Fex), vec3(1.5));
	Lin *= mix(
		vec3(1.0),
		pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * Fex, vec3(0.5)),
		clamp(pow(1.0 - dot(UP, sunDir), 5.0), 0.0, 1.0)
	);

	// ── Night sky ──
	vec3 L0 = vec3(0.1) * Fex;

	// ── Solar disc ──
	float sundisk = smoothstep(sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta);
	L0 += (sunE * 19000.0 * Fex) * sundisk;

	// ── Composition ──
	vec3 texColor = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);
	vec3 retColor = pow(texColor, vec3(1.0 / (1.2 + (1.2 * sunfade))));

	// ── Tone mapping + exposure ──
	retColor *= exposure;
	retColor = ACESFilmic(retColor);

	// ── sRGB conversion ──
	retColor = pow(retColor, vec3(1.0 / 2.2));

	gl_FragColor = vec4(retColor, 1.0);
}
`;

// ── Factory ──

export function createSkyStage(): SkyStage {
	const group = new Group();

	let elevation = SKY_ELEVATION_DEFAULT;
	let azimuth = SKY_AZIMUTH_DEFAULT;

	const uniforms = {
		turbidity: { value: SKY_TURBIDITY_DEFAULT },
		rayleigh: { value: SKY_RAYLEIGH_DEFAULT },
		mieCoefficient: { value: SKY_MIE_COEFFICIENT_DEFAULT },
		mieDirectionalG: { value: SKY_MIE_DIRECTIONAL_G_DEFAULT },
		sunPosition: { value: computeSunPosition(elevation, azimuth) },
		exposure: { value: SKY_EXPOSURE_DEFAULT },
	};

	const geometry = new PlaneGeometry(QUAD_WIDTH, QUAD_HEIGHT);
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

	function updateSunPosition(): void {
		uniforms.sunPosition.value.copy(computeSunPosition(elevation, azimuth));
	}

	return {
		group,
		update(_simTimeSeconds, _shipY) {
			// Sky is static — no per-frame animation needed
		},
		setTurbidity(v) {
			uniforms.turbidity.value = clamp(v, SKY_TURBIDITY_MIN, SKY_TURBIDITY_MAX);
		},
		setRayleigh(v) {
			uniforms.rayleigh.value = clamp(v, SKY_RAYLEIGH_MIN, SKY_RAYLEIGH_MAX);
		},
		setMieCoefficient(v) {
			uniforms.mieCoefficient.value = clamp(v, SKY_MIE_COEFFICIENT_MIN, SKY_MIE_COEFFICIENT_MAX);
		},
		setMieDirectionalG(v) {
			uniforms.mieDirectionalG.value = clamp(v, SKY_MIE_DIRECTIONAL_G_MIN, SKY_MIE_DIRECTIONAL_G_MAX);
		},
		setElevation(v) {
			elevation = clamp(v, SKY_ELEVATION_MIN, SKY_ELEVATION_MAX);
			updateSunPosition();
		},
		setAzimuth(v) {
			azimuth = clamp(v, SKY_AZIMUTH_MIN, SKY_AZIMUTH_MAX);
			updateSunPosition();
		},
		setExposure(v) {
			uniforms.exposure.value = clamp(v, SKY_EXPOSURE_MIN, SKY_EXPOSURE_MAX);
		},
	};
}
