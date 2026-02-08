type HudMetrics = {
  fps: number;
  simTimeSeconds: number;
  simTick: number;
  enemyCount: number;
  projectileCount: number;
};

export type DebugHud = {
  update: (metrics: HudMetrics) => void;
};

export function createDebugHud(container: HTMLElement): DebugHud {
  const hud = document.createElement("aside");
  hud.className = "debug-hud";

  const title = document.createElement("h1");
  title.className = "debug-hud__title";
  title.textContent = "Audio Starfighter";
  hud.appendChild(title);

  const list = document.createElement("dl");
  list.className = "debug-hud__list";
  hud.appendChild(list);

  const metricFields = [
    { key: "fps", label: "FPS" },
    { key: "simTimeSeconds", label: "Sim Time" },
    { key: "simTick", label: "Ticks" },
    { key: "enemyCount", label: "Enemies" },
    { key: "projectileCount", label: "Projectiles" }
  ] as const;

  const valueNodes = new Map<string, HTMLElement>();

  for (const field of metricFields) {
    const row = document.createElement("div");
    row.className = "debug-hud__row";

    const dt = document.createElement("dt");
    dt.textContent = field.label;

    const dd = document.createElement("dd");
    dd.textContent = "-";

    row.append(dt, dd);
    list.appendChild(row);
    valueNodes.set(field.key, dd);
  }

  container.appendChild(hud);

  return {
    update(metrics) {
      valueNodes.get("fps")!.textContent = metrics.fps.toFixed(1);
      valueNodes.get("simTimeSeconds")!.textContent = `${metrics.simTimeSeconds.toFixed(2)}s`;
      valueNodes.get("simTick")!.textContent = String(metrics.simTick);
      valueNodes.get("enemyCount")!.textContent = String(metrics.enemyCount);
      valueNodes.get("projectileCount")!.textContent = String(metrics.projectileCount);
    }
  };
}
