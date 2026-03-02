import {
	AdditiveBlending,
	AmbientLight,
	BoxGeometry,
	Color,
	DirectionalLight,
	DoubleSide,
	Fog,
	Group,
	MeshBasicMaterial,
	Mesh,
	MeshStandardMaterial,
	OrthographicCamera,
	PointLight,
	RingGeometry,
	Scene,
	SphereGeometry,
	Vector2,
	Vector3,
	WebGLRenderer,
} from "three";
import type { SimulationSnapshot } from "../game/sim";
import {
	createExplosionBurst,
	normalizeExplosionPower,
	updateExplosionBurst,
	type ExplosionBurst,
} from "./effects/explosions";
import {
	bindPurplePulseRenderable,
	clearPurplePulseRenderable,
	computePurplePulseTravelDuration,
	PURPLE_PULSE_DASH_END,
	PURPLE_PULSE_DASH_START,
	PURPLE_PULSE_MAX_NEW_BINDINGS_PER_FRAME,
	PURPLE_PULSE_MAX_POOL_SIZE,
	PURPLE_PULSE_TERMINAL_ACCELERATION_POWER,
	PURPLE_PULSE_TRAVEL_DASH_RATIO,
	setDashOffset,
	setDashRatio,
	syncPurplePulsePool,
	type PurplePulseRenderable,
} from "./effects/purplePulses";
import {
	createEnemyRenderer,
	updateEnemyRenderer,
} from "./enemies/enemyRenderer";
import {
	createEnemyProjectileRenderer,
	updateEnemyProjectileRenderer,
} from "./weapons/enemyProjectiles";
import {
	createLaserBeamRenderer,
	updateLaserBeamRenderer,
} from "./weapons/laserBeams";
import {
	createPlayerProjectileRenderer,
	updatePlayerProjectileRenderer,
} from "./weapons/playerProjectiles";
import { createSceneManager, type SceneManager } from "./scenes/sceneManager";

export type RenderScene = {
	update: (snapshot: SimulationSnapshot, alpha: number) => void;
	render: () => void;
	resize: () => void;
	getSceneManager: () => SceneManager;
};

const SCENE_FOG_NEAR = 52;
const SCENE_FOG_FAR = 92;

export function setupScene(container: HTMLElement): RenderScene {
	const FIXED_RENDER_WIDTH = 1920;
	const FIXED_RENDER_HEIGHT = 1080;
	const ORTHO_HALF_HEIGHT = 11.5;

	const scene = new Scene();
	const lowEnergyBg = new Color("#070707");
	const highEnergyBg = new Color("#141414");
	const currentBg = lowEnergyBg.clone();
	scene.background = currentBg;
	const sceneFog = new Fog(
		currentBg.clone(),
		SCENE_FOG_NEAR,
		SCENE_FOG_FAR,
	);
	scene.fog = sceneFog;

	const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
	camera.position.set(0, 0, 20);
	camera.lookAt(new Vector3(0, 0, 0));

	const renderer = new WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(1);
	renderer.setSize(FIXED_RENDER_WIDTH, FIXED_RENDER_HEIGHT, false);
	renderer.domElement.classList.add("main-scene-canvas");
	container.appendChild(renderer.domElement);
	const meshLineResolution = new Vector2(
		FIXED_RENDER_WIDTH,
		FIXED_RENDER_HEIGHT,
	);

	const ambientLight = new AmbientLight("#c7ced9", 0.4);
	scene.add(ambientLight);

	const directionalLight = new DirectionalLight("#fef2c2", 1.1);
	directionalLight.position.set(2, 4, 8);
	scene.add(directionalLight);
	const waveformTopLight = new PointLight("#b7ffd9", 2.2, 90, 2);
	waveformTopLight.position.set(0, 10, -14);
	scene.add(waveformTopLight);

	const shipGeometry = new BoxGeometry(1.2, 0.6, 0.9);
	const shipMaterial = new MeshStandardMaterial({
		color: "#67e8f9",
		roughness: 0.25,
		metalness: 0.5,
		transparent: true,
		opacity: 0.62,
		side: DoubleSide,
		depthWrite: false,
	});
	const shipMesh = new Mesh(shipGeometry, shipMaterial);
	scene.add(shipMesh);
	const shieldMaterial = new MeshStandardMaterial({
		color: "#7dd3fc",
		transparent: true,
		opacity: 0,
		emissive: "#38bdf8",
		emissiveIntensity: 0.5,
		roughness: 0.2,
		metalness: 0,
	});
	const shieldMesh = new Mesh(new SphereGeometry(0.8, 16, 12), shieldMaterial);
	scene.add(shieldMesh);

	const enemyRenderer = createEnemyRenderer();
	scene.add(enemyRenderer.group);

	const playerProjectileRenderer = createPlayerProjectileRenderer();
	scene.add(playerProjectileRenderer.group);
	const purplePulseGroup = new Group();
	scene.add(purplePulseGroup);
	const purplePulses: PurplePulseRenderable[] = [];
	const purplePulseIndexByMissileId = new Map<number, number>();
	syncPurplePulsePool(
		purplePulses,
		PURPLE_PULSE_MAX_POOL_SIZE,
		purplePulseGroup,
		meshLineResolution,
	);
	const enemyProjectileRenderer = createEnemyProjectileRenderer();
	scene.add(enemyProjectileRenderer.ballGroup);
	scene.add(enemyProjectileRenderer.laserGroup);

	const laserBeamRenderer = createLaserBeamRenderer();
	scene.add(laserBeamRenderer.group);

	let previousShipY = 0;
	let previousShipTimeSeconds = 0;
	let hasPreviousShipY = false;
	let shipPitch = 0;
	let lastMissileTrailSnapshotTime = -1;

	const explosionGeometry = new SphereGeometry(0.4, 10, 8);
	const explosionMaterial = new MeshBasicMaterial({
		color: "#fde047",
		transparent: true,
		opacity: 1,
		blending: AdditiveBlending,
	});
	const explosionRingGeometry = new RingGeometry(0.595, 0.62, 40);
	const explosionRingMaterial = new MeshBasicMaterial({
		color: "#fb923c",
		transparent: true,
		opacity: 1,
		side: 2,
		blending: AdditiveBlending,
	});
	const explosionGroup = new Group();
	scene.add(explosionGroup);
	const explosionMeshes: Mesh[] = [];
	const explosionRingMeshes: Mesh[] = [];
	const explosionParticleBursts: ExplosionBurst[] = [];
	const coreColor = new Color();
	const ringColor = new Color();
	const sparkColor = new Color();

	// ── Scene Manager ──
	const sceneManager = createSceneManager(scene);

	function resize(): void {
		const width = container.clientWidth;
		const height = container.clientHeight;
		if (width === 0 || height === 0) {
			return;
		}

		const targetAspect = FIXED_RENDER_WIDTH / FIXED_RENDER_HEIGHT;
		let displayWidth = Math.min(width, FIXED_RENDER_WIDTH);
		let displayHeight = displayWidth / targetAspect;

		if (displayHeight > height) {
			displayHeight = Math.min(height, FIXED_RENDER_HEIGHT);
			displayWidth = displayHeight * targetAspect;
		}

		displayWidth = Math.max(1, displayWidth);
		displayHeight = Math.max(1, displayHeight);

		renderer.domElement.style.width = `${displayWidth}px`;
		renderer.domElement.style.height = `${displayHeight}px`;
		renderer.domElement.style.left = `${(width - displayWidth) * 0.5}px`;
		renderer.domElement.style.top = `${(height - displayHeight) * 0.5}px`;

		meshLineResolution.set(displayWidth, displayHeight);
		for (const pulse of purplePulses) {
			pulse.material.resolution = meshLineResolution;
		}

		const halfWidth = ORTHO_HALF_HEIGHT * targetAspect;
		camera.left = -halfWidth;
		camera.right = halfWidth;
		camera.top = ORTHO_HALF_HEIGHT;
		camera.bottom = -ORTHO_HALF_HEIGHT;
		camera.updateProjectionMatrix();
	}

	resize();

	return {
		update(snapshot) {
			const simTimeSeconds = snapshot.simTimeSeconds;
			shipMesh.position.set(snapshot.ship.x, snapshot.ship.y, snapshot.ship.z);
			const deltaY = hasPreviousShipY ? snapshot.ship.y - previousShipY : 0;
			const deltaTime = hasPreviousShipY
				? Math.max(1e-3, snapshot.simTimeSeconds - previousShipTimeSeconds)
				: 1 / 60;
			const verticalVelocity = deltaY / deltaTime;
			hasPreviousShipY = true;
			previousShipY = snapshot.ship.y;
			previousShipTimeSeconds = snapshot.simTimeSeconds;
			const targetPitch = clamp01Signed(-verticalVelocity * 0.085, 0.58);
			shipPitch += (targetPitch - shipPitch) * 0.3;
			shipMesh.rotation.x = shipPitch;
			shipMesh.rotation.y = 0;
			shipMesh.rotation.z = 0;
			shieldMesh.position.copy(shipMesh.position);
			shieldMaterial.opacity = snapshot.shieldAlpha * 0.45;
			shieldMesh.scale.setScalar(1 + snapshot.shieldAlpha * 0.5);

			const intensity = snapshot.currentIntensity;
			currentBg.copy(lowEnergyBg).lerp(highEnergyBg, intensity);
			sceneFog.color.copy(currentBg);
			shipMaterial.emissive.set("#0e7490");
			shipMaterial.emissiveIntensity = 0.08 + intensity * 0.3;

			// ── Update all active scenes ──
			sceneManager.updateAll(simTimeSeconds, snapshot.ship.y);

			updateEnemyRenderer(enemyRenderer, snapshot.enemies, intensity);
			updatePlayerProjectileRenderer(
				playerProjectileRenderer,
				snapshot.projectiles,
			);
			updateEnemyProjectileRenderer(
				enemyProjectileRenderer,
				snapshot.enemyProjectiles,
				snapshot.enemyProjectileStyle,
			);

			if (snapshot.simTimeSeconds < lastMissileTrailSnapshotTime - 1e-6) {
				for (const pulse of purplePulses) {
					clearPurplePulseRenderable(pulse);
				}
				purplePulseIndexByMissileId.clear();
			}
			lastMissileTrailSnapshotTime = snapshot.simTimeSeconds;

			if (snapshot.purpleMissileEnabled) {
				const missileById = new Map<
					number,
					SimulationSnapshot["missiles"][number]
				>();
				for (const missile of snapshot.missiles) {
					missileById.set(missile.id, missile);
				}

				let bindingsThisFrame = 0;
				for (const missile of snapshot.missiles) {
					if (purplePulseIndexByMissileId.has(missile.id)) {
						continue;
					}
					const travelDurationSeconds = computePurplePulseTravelDuration(
						snapshot.simTimeSeconds,
						missile,
					);
					if (missile.ageSeconds >= travelDurationSeconds - 1e-4) {
						continue;
					}
					if (bindingsThisFrame >= PURPLE_PULSE_MAX_NEW_BINDINGS_PER_FRAME) {
						break;
					}

					const freeIndex = purplePulses.findIndex(
						(pulse) => pulse.missileId === null,
					);
					if (freeIndex < 0) {
						break;
					}

					const pulse = purplePulses[freeIndex];
					bindPurplePulseRenderable(pulse, missile);
					purplePulseIndexByMissileId.set(missile.id, freeIndex);
					bindingsThisFrame += 1;
				}

				for (let i = 0; i < purplePulses.length; i += 1) {
					const pulse = purplePulses[i];
					if (pulse.missileId === null) {
						continue;
					}

					const missile = missileById.get(pulse.missileId);
					if (missile) {
						pulse.animationDurationSeconds = computePurplePulseTravelDuration(
							snapshot.simTimeSeconds,
							missile,
						);
						pulse.animationStartTimeSeconds =
							snapshot.simTimeSeconds - missile.ageSeconds;
					}

					pulse.mesh.visible = true;
					const elapsed =
						snapshot.simTimeSeconds - pulse.animationStartTimeSeconds;
					const progress = clamp01(
						elapsed / Math.max(1e-4, pulse.animationDurationSeconds),
					);
					const shapedProgress = Math.pow(
						progress,
						PURPLE_PULSE_TERMINAL_ACCELERATION_POWER,
					);
					setDashOffset(
						pulse.material,
						-lerp(
							PURPLE_PULSE_DASH_START,
							PURPLE_PULSE_DASH_END,
							shapedProgress,
						),
					);
					setDashRatio(pulse.material, PURPLE_PULSE_TRAVEL_DASH_RATIO);
					pulse.material.opacity = 0.92 * (1 - progress * 0.1);

					if (progress >= 1) {
						if (pulse.missileId !== null) {
							purplePulseIndexByMissileId.delete(pulse.missileId);
						}
						clearPurplePulseRenderable(pulse);
					}
				}
			} else {
				for (const pulse of purplePulses) {
					clearPurplePulseRenderable(pulse);
				}
				purplePulseIndexByMissileId.clear();
			}

			updateLaserBeamRenderer(laserBeamRenderer, snapshot.laserBeams);

			syncMeshPool(
				explosionMeshes,
				snapshot.explosions.length,
				explosionGroup,
				() => {
					const mesh = new Mesh(explosionGeometry, explosionMaterial.clone());
					mesh.visible = false;
					return mesh;
				},
			);
			syncMeshPool(
				explosionRingMeshes,
				snapshot.explosions.length,
				explosionGroup,
				() => {
					const mesh = new Mesh(
						explosionRingGeometry,
						explosionRingMaterial.clone(),
					);
					mesh.visible = false;
					return mesh;
				},
			);
			while (explosionParticleBursts.length < snapshot.explosions.length) {
				const burst = createExplosionBurst(explosionParticleBursts.length);
				burst.points.visible = false;
				explosionParticleBursts.push(burst);
				explosionGroup.add(burst.points);
			}
			for (let i = 0; i < explosionMeshes.length; i += 1) {
				const mesh = explosionMeshes[i];
				const ringMesh = explosionRingMeshes[i];
				const burst = explosionParticleBursts[i];
				const explosion = snapshot.explosions[i];
				if (!explosion) {
					mesh.visible = false;
					ringMesh.visible = false;
					burst.points.visible = false;
					continue;
				}

				const normalizedAge = clamp01(1 - explosion.alpha);
				const peakScale = explosion.power;
				const peakNormalized = normalizeExplosionPower(explosion.power);
				const intensityScale = 0.22 + peakScale * 0.88;
				const intensityGlow = 0.62 + peakNormalized * 1.05;
				const palette =
					EXPLOSION_PALETTES[explosion.variant % EXPLOSION_PALETTES.length];

				mesh.visible = true;
				mesh.position.set(explosion.x, explosion.y, explosion.z);
				mesh.scale.setScalar(
					explosion.scale * ARCADE_CORE_SCALE_MULTIPLIER * intensityScale,
				);
				const material = mesh.material as MeshBasicMaterial;
				if (normalizedAge < 0.4) {
					coreColor.lerpColors(
						palette.coreStart,
						palette.coreMid,
						normalizedAge / 0.4,
					);
				} else {
					coreColor.lerpColors(
						palette.coreMid,
						palette.coreEnd,
						(normalizedAge - 0.4) / 0.6,
					);
				}
				material.color.copy(coreColor);
				material.opacity = Math.max(
					0,
					Math.pow(explosion.alpha, 0.55) * intensityGlow,
				);

				ringMesh.visible = true;
				ringMesh.position.set(explosion.x, explosion.y, explosion.z + 0.01);
				ringMesh.scale.setScalar(
					0.5 +
						normalizedAge *
							ARCADE_RING_MAX_SCALE *
							(0.42 + peakNormalized * 0.78),
				);
				const ringMaterial = ringMesh.material as MeshBasicMaterial;
				ringColor.lerpColors(palette.ringStart, palette.ringEnd, normalizedAge);
				ringMaterial.color.copy(ringColor);
				ringMaterial.opacity = Math.max(
					0,
					Math.pow(1 - normalizedAge, 0.8) * (0.6 + peakNormalized * 0.9),
				);

				sparkColor.lerpColors(coreColor, ringColor, 0.4 + normalizedAge * 0.35);

				burst.points.visible = true;
				burst.points.position.set(explosion.x, explosion.y, explosion.z + 0.08);
				updateExplosionBurst(
					burst,
					normalizedAge,
					explosion.alpha,
					peakScale,
					sparkColor,
				);
			}
		},
		render() {
			renderer.render(scene, camera);
		},
		resize,
		getSceneManager() {
			return sceneManager;
		},
	};
}

function syncMeshPool(
	meshes: Mesh[],
	requiredCount: number,
	parent: Group,
	createMesh: () => Mesh,
): void {
	while (meshes.length < requiredCount) {
		const mesh = createMesh();
		meshes.push(mesh);
		parent.add(mesh);
	}
}

function lerp(start: number, end: number, t: number): number {
	return start + (end - start) * t;
}

type ExplosionPalette = {
	coreStart: Color;
	coreMid: Color;
	coreEnd: Color;
	ringStart: Color;
	ringEnd: Color;
};

const ARCADE_CORE_SCALE_MULTIPLIER = 2.35;
const ARCADE_RING_MAX_SCALE = 7.2;
const EXPLOSION_PALETTES: ExplosionPalette[] = [
	{
		coreStart: new Color("#f472b6"),
		coreMid: new Color("#60a5fa"),
		coreEnd: new Color("#38bdf8"),
		ringStart: new Color("#f0abfc"),
		ringEnd: new Color("#a78bfa"),
	},
	{
		coreStart: new Color("#ef4444"),
		coreMid: new Color("#f97316"),
		coreEnd: new Color("#facc15"),
		ringStart: new Color("#fb7185"),
		ringEnd: new Color("#fb923c"),
	},
	{
		coreStart: new Color("#22d3ee"),
		coreMid: new Color("#38bdf8"),
		coreEnd: new Color("#a3e635"),
		ringStart: new Color("#67e8f9"),
		ringEnd: new Color("#84cc16"),
	},
	{
		coreStart: new Color("#fca5a5"),
		coreMid: new Color("#f9a8d4"),
		coreEnd: new Color("#c084fc"),
		ringStart: new Color("#fda4af"),
		ringEnd: new Color("#e879f9"),
	},
	{
		coreStart: new Color("#4ade80"),
		coreMid: new Color("#22d3ee"),
		coreEnd: new Color("#60a5fa"),
		ringStart: new Color("#86efac"),
		ringEnd: new Color("#06b6d4"),
	},
	{
		coreStart: new Color("#fde047"),
		coreMid: new Color("#fb923c"),
		coreEnd: new Color("#f43f5e"),
		ringStart: new Color("#fef08a"),
		ringEnd: new Color("#f97316"),
	},
];

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function clamp01Signed(value: number, maxAbs: number): number {
	return Math.max(-maxAbs, Math.min(maxAbs, value));
}
