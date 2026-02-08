import type { AudioAnalysisResult } from "../audio/types";

type AudioPanelHandlers = {
  onAnalyze: (file: File) => Promise<AudioAnalysisResult>;
};

export type AudioPanel = {
  getLatestAnalysis: () => AudioAnalysisResult | null;
};

export function createAudioPanel(
  container: HTMLElement,
  handlers: AudioPanelHandlers
): AudioPanel {
  const panel = document.createElement("section");
  panel.className = "audio-panel";

  const title = document.createElement("h2");
  title.className = "audio-panel__title";
  title.textContent = "Audio Analysis";
  panel.appendChild(title);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "audio/*";
  fileInput.className = "audio-panel__file";
  panel.appendChild(fileInput);

  const status = document.createElement("p");
  status.className = "audio-panel__status";
  status.textContent = "Load a track to generate BPM and cue timeline.";
  panel.appendChild(status);

  const stats = document.createElement("p");
  stats.className = "audio-panel__stats";
  stats.textContent = "No analysis yet.";
  panel.appendChild(stats);

  const canvas = document.createElement("canvas");
  canvas.className = "audio-panel__timeline";
  canvas.width = 360;
  canvas.height = 130;
  panel.appendChild(canvas);

  container.appendChild(panel);

  let latestAnalysis: AudioAnalysisResult | null = null;
  let requestId = 0;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    const currentRequestId = ++requestId;
    status.textContent = `Analyzing ${file.name}...`;
    stats.textContent = "Processing waveform...";
    drawPlaceholder(canvas, "Analyzing...");

    try {
      const analysis = await handlers.onAnalyze(file);
      if (currentRequestId !== requestId) {
        return;
      }

      latestAnalysis = analysis;
      status.textContent = `Analyzed ${analysis.fileName}`;
      stats.textContent = [
        `BPM ${analysis.beat.bpm.toFixed(1)}`,
        `Cues ${analysis.cues.length}`,
        `Duration ${analysis.durationSeconds.toFixed(1)}s`,
        `Confidence ${(analysis.beat.confidence * 100).toFixed(0)}%`
      ].join(" | ");

      drawTimeline(canvas, analysis);
    } catch (error) {
      if (currentRequestId !== requestId) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = "Analysis failed";
      stats.textContent = message;
      drawPlaceholder(canvas, "Analysis failed");
    }
  });

  drawPlaceholder(canvas, "No data");

  return {
    getLatestAnalysis() {
      return latestAnalysis;
    }
  };
}

function drawTimeline(canvas: HTMLCanvasElement, analysis: AudioAnalysisResult): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);

  context.fillStyle = "#050d1d";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(95, 132, 196, 0.4)";
  context.lineWidth = 1;
  for (let y = 0; y <= 4; y += 1) {
    const gy = Math.round((y / 4) * (height - 1)) + 0.5;
    context.beginPath();
    context.moveTo(0, gy);
    context.lineTo(width, gy);
    context.stroke();
  }

  const frames = analysis.frames;
  if (frames.length > 1) {
    context.strokeStyle = "#67e8f9";
    context.lineWidth = 1.4;
    context.beginPath();
    for (let i = 0; i < frames.length; i += 1) {
      const x = (frames[i].timeSeconds / analysis.durationSeconds) * width;
      const y = height - frames[i].intensity * (height - 8) - 4;
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();
  }

  context.strokeStyle = "rgba(244, 114, 182, 0.9)";
  context.lineWidth = 1;
  for (const cue of analysis.cues) {
    const x = (cue.timeSeconds / analysis.durationSeconds) * width;
    context.beginPath();
    context.moveTo(x, height);
    context.lineTo(x, 0);
    context.stroke();
  }
}

function drawPlaceholder(canvas: HTMLCanvasElement, text: string): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#050d1d";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#9eb4d3";
  context.font = "12px Consolas, 'Courier New', monospace";
  context.fillText(text, 12, canvas.height / 2);
}
