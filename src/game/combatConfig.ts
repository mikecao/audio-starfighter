export type EnemyArchetypeId = "redCube";

export type ShipWeaponsConfig = {
  blueLaser: boolean;
  yellowLaser: boolean;
  greenLaser: boolean;
  purpleMissile: boolean;
};

export type EnemyProjectileStyle = "balls" | "lasers";

export type EnemyRosterConfig = {
  enabledArchetypes: EnemyArchetypeId[];
  spawnScale: number;
  fireScale: number;
  enemyProjectileStyle: EnemyProjectileStyle;
};

export type CombatConfig = {
  shipWeapons: ShipWeaponsConfig;
  enemyRoster: EnemyRosterConfig;
};

export type CombatConfigPatch = {
  shipWeapons?: Partial<ShipWeaponsConfig>;
  enemyRoster?: Partial<EnemyRosterConfig>;
};

export type EnemyArchetypeDefinition = {
  id: EnemyArchetypeId;
  spawnWeight: number;
  speedScale: number;
  fireCooldownScale: number;
  radiusScale: number;
};

export const ENEMY_ARCHETYPE_DEFINITIONS: Record<EnemyArchetypeId, EnemyArchetypeDefinition> = {
  redCube: {
    id: "redCube",
    spawnWeight: 1,
    speedScale: 1,
    fireCooldownScale: 1,
    radiusScale: 1
  }
};

export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  shipWeapons: {
    blueLaser: true,
    yellowLaser: true,
    greenLaser: true,
    purpleMissile: false
  },
  enemyRoster: {
    enabledArchetypes: ["redCube"],
    spawnScale: 1,
    fireScale: 1,
    enemyProjectileStyle: "balls"
  }
};

export function normalizeCombatConfig(
  patch: CombatConfigPatch | undefined,
  base: CombatConfig = DEFAULT_COMBAT_CONFIG
): CombatConfig {
  const shipWeapons: ShipWeaponsConfig = {
    blueLaser: patch?.shipWeapons?.blueLaser ?? base.shipWeapons.blueLaser,
    yellowLaser: patch?.shipWeapons?.yellowLaser ?? base.shipWeapons.yellowLaser,
    greenLaser: patch?.shipWeapons?.greenLaser ?? base.shipWeapons.greenLaser,
    purpleMissile: patch?.shipWeapons?.purpleMissile ?? base.shipWeapons.purpleMissile
  };

  const rosterEnabled =
    patch?.enemyRoster?.enabledArchetypes ?? base.enemyRoster.enabledArchetypes;

  const normalizedArchetypes = sanitizeEnabledArchetypes(rosterEnabled);

  const spawnScale = clamp(patch?.enemyRoster?.spawnScale ?? base.enemyRoster.spawnScale, 0.45, 2.4);
  const fireScale = clamp(patch?.enemyRoster?.fireScale ?? base.enemyRoster.fireScale, 0.45, 2.4);
  const enemyProjectileStyle = normalizeEnemyProjectileStyle(
    patch?.enemyRoster?.enemyProjectileStyle ?? base.enemyRoster.enemyProjectileStyle
  );

  return {
    shipWeapons,
    enemyRoster: {
      enabledArchetypes: normalizedArchetypes,
      spawnScale,
      fireScale,
      enemyProjectileStyle
    }
  };
}

export function sanitizeEnabledArchetypes(input: readonly EnemyArchetypeId[]): EnemyArchetypeId[] {
  const deduped: EnemyArchetypeId[] = [];
  for (const archetypeId of input) {
    if (!ENEMY_ARCHETYPE_DEFINITIONS[archetypeId]) {
      continue;
    }
    if (!deduped.includes(archetypeId)) {
      deduped.push(archetypeId);
    }
  }

  if (deduped.length === 0) {
    return ["redCube"];
  }

  return deduped;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeEnemyProjectileStyle(style: EnemyProjectileStyle): EnemyProjectileStyle {
  if (style === "lasers") {
    return "lasers";
  }
  return "balls";
}
