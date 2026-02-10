type TimelineCue = {
  timeSeconds: number;
  source?: "beat" | "peak";
};

type EventTimelineMetrics = {
  simTimeSeconds: number;
  audioTimeSeconds: number | null;
  cueResolvedCount: number;
  cueMissedCount: number;
  cues: TimelineCue[] | null;
  usingBeatFallback: boolean;
};

export type EventTimeline = {
  update: (metrics: EventTimelineMetrics) => void;
};

const WINDOW_PAST_SECONDS = 0.35;
const WINDOW_FUTURE_SECONDS = 2.6;
const AUDIO_DRIFT_SHOW_THRESHOLD_SECONDS = 0.04;
const TIMELINE_DRAW_INTERVAL_SECONDS = 1 / 30;

export function createEventTimeline(container: HTMLElement): EventTimeline {
  const rail = document.createElement("section");
  rail.className = "event-timeline";

  const header = document.createElement("div");
  header.className = "event-timeline__header";

  const title = document.createElement("p");
  title.className = "event-timeline__title";
  title.textContent = "Cue Rail";

  const stats = document.createElement("p");
  stats.className = "event-timeline__stats";
  stats.textContent = "No run loaded";

  header.append(title, stats);
  rail.appendChild(header);

  const canvas = document.createElement("canvas");
  canvas.className = "event-timeline__canvas";
  rail.appendChild(canvas);

  const legend = document.createElement("p");
  legend.className = "event-timeline__legend";
  legend.textContent = "Beat cue | Peak cue | Audio clock | SIM NOW";
  rail.appendChild(legend);

  container.appendChild(rail);

  let lastMetrics: EventTimelineMetrics | null = null;
  let previousSimTimeSeconds: number | null = null;
  let flashStrength = 0;
  let lastFlashUpdateMs = performance.now();
  let lastDrawSimTimeSeconds = Number.NEGATIVE_INFINITY;

  const draw = (): void => {
    if (!lastMetrics) {
      return;
    }
    drawTimeline(canvas, lastMetrics, stats, flashStrength);
  };

  const resizeObserver = new ResizeObserver(() => {
    if (!lastMetrics) {
      return;
    }
    draw();
  });
  resizeObserver.observe(rail);

  return {
    update(metrics) {
      const nowMs = performance.now();
      const elapsedSeconds = Math.max(0, (nowMs - lastFlashUpdateMs) / 1000);
      lastFlashUpdateMs = nowMs;
      flashStrength = Math.max(0, flashStrength - elapsedSeconds * 2.4);

      if (metrics.cues && previousSimTimeSeconds !== null) {
        const movedForward = metrics.simTimeSeconds >= previousSimTimeSeconds;
        if (movedForward) {
          let crossings = 0;
          for (const cue of metrics.cues) {
            if (
              cue.timeSeconds > previousSimTimeSeconds &&
              cue.timeSeconds <= metrics.simTimeSeconds
            ) {
              crossings += 1;
            }
          }
          if (crossings > 0) {
            flashStrength = Math.min(1, flashStrength + 0.42 + crossings * 0.2);
          }
        } else {
          flashStrength = 0;
        }
      }

      lastMetrics = metrics;
      previousSimTimeSeconds = metrics.simTimeSeconds;

      const shouldDraw =
        Math.abs(metrics.simTimeSeconds - lastDrawSimTimeSeconds) >=
          TIMELINE_DRAW_INTERVAL_SECONDS ||
        flashStrength > 0.01;
      if (shouldDraw) {
        draw();
        lastDrawSimTimeSeconds = metrics.simTimeSeconds;
      }
    }
  };
}

function drawTimeline(
  canvas: HTMLCanvasElement,
  metrics: EventTimelineMetrics,
  statsNode: HTMLElement,
  flashStrength = 0
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(220, Math.floor(canvas.clientWidth));
  const cssHeight = Math.max(70, Math.floor(canvas.clientHeight));
  const targetWidth = Math.floor(cssWidth * dpr);
  const targetHeight = Math.floor(cssHeight * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(dpr, dpr);

  context.clearRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = "#050d1d";
  context.fillRect(0, 0, cssWidth, cssHeight);

  const nowX = Math.round(cssWidth * 0.24) + 0.5;
  const top = 8;
  const bottom = cssHeight - 14;
  const laneY = Math.round((top + bottom) * 0.5) + 0.5;
  const secondsSpan = WINDOW_PAST_SECONDS + WINDOW_FUTURE_SECONDS;
  const pixelsPerSecond = cssWidth / Math.max(0.001, secondsSpan);

  drawGrid(
    context,
    cssWidth,
    top,
    laneY,
    nowX,
    pixelsPerSecond,
    metrics.simTimeSeconds
  );

  context.strokeStyle = "rgba(134, 170, 221, 0.55)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, laneY);
  context.lineTo(cssWidth, laneY);
  context.stroke();

  let visibleCueCount = 0;

  if (metrics.cues) {
    for (const cue of metrics.cues) {
      const delta = cue.timeSeconds - metrics.simTimeSeconds;
      if (delta < -WINDOW_PAST_SECONDS || delta > WINDOW_FUTURE_SECONDS) {
        continue;
      }
      visibleCueCount += 1;
      const x = nowX + delta * pixelsPerSecond;
      const trailLength = cue.source === "peak" ? 22 : 16;
      const trailGradient = context.createLinearGradient(x, laneY, x + trailLength, laneY);
      if (cue.source === "peak") {
        trailGradient.addColorStop(0, "rgba(244, 114, 182, 0.04)");
        trailGradient.addColorStop(1, "rgba(244, 114, 182, 0.72)");
        context.fillStyle = "rgba(244, 114, 182, 0.96)";
      } else {
        trailGradient.addColorStop(0, "rgba(103, 232, 249, 0.04)");
        trailGradient.addColorStop(1, "rgba(103, 232, 249, 0.72)");
        context.fillStyle = "rgba(103, 232, 249, 0.96)";
      }

      context.strokeStyle = trailGradient;
      context.lineWidth = cue.source === "peak" ? 2.8 : 2.4;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(x, laneY);
      context.lineTo(Math.min(cssWidth, x + trailLength), laneY);
      context.stroke();

      context.beginPath();
      context.arc(x, laneY, 3.2, 0, Math.PI * 2);
      context.fill();
    }
  }

  if (metrics.audioTimeSeconds !== null && Number.isFinite(metrics.audioTimeSeconds)) {
    const audioDelta = metrics.audioTimeSeconds - metrics.simTimeSeconds;
    if (Math.abs(audioDelta) >= AUDIO_DRIFT_SHOW_THRESHOLD_SECONDS) {
      const audioX = nowX + audioDelta * pixelsPerSecond;
      if (audioX >= 0 && audioX <= cssWidth) {
        context.strokeStyle = "rgba(192, 242, 255, 0.35)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(audioX, top - 1);
        context.lineTo(audioX, bottom + 1);
        context.stroke();
      }
    }
  }

  context.strokeStyle = "rgba(251, 191, 36, 0.98)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(nowX, top - 1);
  context.lineTo(nowX, bottom + 1);
  context.stroke();

  if (flashStrength > 0.01) {
    const glowWidth = 9 + flashStrength * 24;
    const gradient = context.createLinearGradient(nowX - glowWidth, 0, nowX + glowWidth, 0);
    gradient.addColorStop(0, "rgba(251, 191, 36, 0)");
    gradient.addColorStop(0.5, `rgba(251, 191, 36, ${0.16 + flashStrength * 0.3})`);
    gradient.addColorStop(1, "rgba(251, 191, 36, 0)");
    context.fillStyle = gradient;
    context.fillRect(nowX - glowWidth, top - 2, glowWidth * 2, bottom - top + 4);
  }

  context.fillStyle = "rgba(251, 191, 36, 0.95)";
  context.font = "11px Consolas, 'Courier New', monospace";
  context.fillText("NOW", nowX + 6, 12);

  const cueCount = metrics.cues?.length ?? 0;
  const resolved = metrics.cueResolvedCount + metrics.cueMissedCount;
  const sourceLabel = metrics.usingBeatFallback ? "Cue fallback" : "Beat events";
  statsNode.textContent =
    `SIM ${metrics.simTimeSeconds.toFixed(2)}s | Visible ${visibleCueCount} | ` +
    `${sourceLabel} ${resolved}/${cueCount}`;
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  top: number,
  laneY: number,
  nowX: number,
  pixelsPerSecond: number,
  simTimeSeconds: number
): void {
  context.strokeStyle = "rgba(95, 132, 196, 0.3)";
  context.lineWidth = 1;
  const spacingSeconds = 0.5;

  const leftTime = simTimeSeconds - WINDOW_PAST_SECONDS;
  const rightTime = simTimeSeconds + WINDOW_FUTURE_SECONDS;
  const firstTickTime = Math.ceil(leftTime / spacingSeconds) * spacingSeconds;

  for (let t = firstTickTime; t <= rightTime; t += spacingSeconds) {
    const x = nowX + (t - simTimeSeconds) * pixelsPerSecond;
    const gx = Math.round(x) + 0.5;
    if (gx < 0 || gx > width) {
      continue;
    }
    context.beginPath();
    context.moveTo(gx, laneY - 9);
    context.lineTo(gx, laneY + 9);
    context.stroke();

    const secondsAhead = t - simTimeSeconds;
    if (secondsAhead > 0.001) {
      context.fillStyle = "rgba(141, 172, 219, 0.72)";
      context.font = "10px Consolas, 'Courier New', monospace";
      context.fillText(`+${secondsAhead.toFixed(1)}s`, gx - 12, top + 8);
    }
  }

  context.fillStyle = "rgba(141, 172, 219, 0.68)";
  context.font = "10px Consolas, 'Courier New', monospace";
  context.fillText("past", 6, top + 8);
  context.fillText("upcoming", nowX + 34, top + 8);
}
