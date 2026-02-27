import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { SettingsPanel } from "./SettingsPanel";
import type { SettingsBridge } from "./settingsBridge";

export function mountSettingsPanel(bridge: SettingsBridge): void {
	const container = document.createElement("div");
	container.id = "leva-settings-root";
	document.body.appendChild(container);
	const root = createRoot(container);
	root.render(createElement(SettingsPanel, { bridge }));
}
