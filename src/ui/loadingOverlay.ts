export type LoadingOverlay = {
  show: (
    title: string,
    message: string,
    progress?: number,
    phaseLabel?: string,
    phaseTone?: LoadingPhaseTone
  ) => void;
  setProgress: (
    progress: number,
    message?: string,
    phaseLabel?: string,
    phaseTone?: LoadingPhaseTone
  ) => void;
  hide: () => void;
};

export type LoadingPhaseTone =
  | "decode"
  | "features"
  | "beats"
  | "mood"
  | "cues"
  | "precompute"
  | "finalize";

type LoadingPhase = {
  tone: LoadingPhaseTone;
  label: string;
};

const LOADING_PHASES: LoadingPhase[] = [
  { tone: "decode", label: "Decode" },
  { tone: "features", label: "Features" },
  { tone: "beats", label: "Beat Detect" },
  { tone: "mood", label: "Mood" },
  { tone: "cues", label: "Cue Build" },
  { tone: "precompute", label: "Precompute" },
  { tone: "finalize", label: "Finalize" }
];

export function createLoadingOverlay(container: HTMLElement): LoadingOverlay {
  const overlay = document.createElement("section");
  overlay.className = "loading-overlay loading-overlay--hidden";

  const card = document.createElement("div");
  card.className = "loading-overlay__card";

  const titleEl = document.createElement("h2");
  titleEl.className = "loading-overlay__title";
  titleEl.textContent = "Preparing";

  const phaseCurrentEl = document.createElement("p");
  phaseCurrentEl.className = "loading-overlay__phase-current";
  phaseCurrentEl.textContent = "Current: Decode";

  const phaseList = document.createElement("ul");
  phaseList.className = "loading-overlay__phase-list";
  const phaseNodeByTone = new Map<LoadingPhaseTone, HTMLLIElement>();
  for (const phase of LOADING_PHASES) {
    const item = document.createElement("li");
    item.className = `loading-overlay__phase-chip loading-overlay__phase-chip--${phase.tone}`;
    item.textContent = phase.label;
    item.setAttribute("data-phase", phase.tone);
    phaseList.appendChild(item);
    phaseNodeByTone.set(phase.tone, item);
  }

  const messageEl = document.createElement("p");
  messageEl.className = "loading-overlay__message";
  messageEl.textContent = "Please wait...";

  const track = document.createElement("div");
  track.className = "loading-overlay__track";

  const bar = document.createElement("div");
  bar.className = "loading-overlay__bar";
  track.appendChild(bar);

  const percentEl = document.createElement("p");
  percentEl.className = "loading-overlay__percent";
  percentEl.textContent = "0%";

  card.append(titleEl, phaseCurrentEl, phaseList, messageEl, track, percentEl);
  overlay.appendChild(card);
  container.appendChild(overlay);

  let currentProgress = 0;

  const setPhase = (phaseLabel?: string, phaseTone?: LoadingPhaseTone): void => {
    let resolvedLabel = phaseLabel ?? "";
    if (!resolvedLabel && phaseTone) {
      const phase = LOADING_PHASES.find((entry) => entry.tone === phaseTone);
      resolvedLabel = phase?.label ?? "";
    }

    if (resolvedLabel) {
      phaseCurrentEl.textContent = `Current: ${resolvedLabel}`;
    }

    for (const phase of LOADING_PHASES) {
      phaseNodeByTone.get(phase.tone)?.classList.remove("loading-overlay__phase-chip--active");
    }
    if (phaseTone) {
      phaseNodeByTone.get(phaseTone)?.classList.add("loading-overlay__phase-chip--active");
    }
  };

  const setBar = (progress: number): void => {
    currentProgress = Math.max(0, Math.min(1, progress));
    bar.style.width = `${(currentProgress * 100).toFixed(1)}%`;
    percentEl.textContent = `${Math.round(currentProgress * 100)}%`;
    overlay.setAttribute("aria-valuenow", String(Math.round(currentProgress * 100)));
  };

  overlay.setAttribute("role", "progressbar");
  overlay.setAttribute("aria-valuemin", "0");
  overlay.setAttribute("aria-valuemax", "100");
  setPhase("Decode", "decode");
  setBar(0);

  return {
    show(title, message, progress = 0, phaseLabel, phaseTone) {
      titleEl.textContent = title;
      messageEl.textContent = message;
      setPhase(phaseLabel, phaseTone);
      setBar(progress);
      overlay.classList.remove("loading-overlay--hidden");
    },
    setProgress(progress, message, phaseLabel, phaseTone) {
      if (message) {
        messageEl.textContent = message;
      }
      setPhase(phaseLabel, phaseTone);
      setBar(progress);
    },
    hide() {
      overlay.classList.add("loading-overlay--hidden");
      setPhase("Decode", "decode");
      setBar(0);
    }
  };
}
