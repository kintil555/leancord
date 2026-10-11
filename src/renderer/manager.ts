import addons from "~addons";

import { setSetting, settingsRoot } from "@lean";

const running = new Set<string>();

export const ids = Object.keys(addons).sort((a, b) =>
    addons[a].name.localeCompare(addons[b].name));

export const isEnabled = (id: string) =>
    settingsRoot.addons![id]?.enabled ?? addons[id].enabledByDefault ?? false;

export const isRunning = (id: string) => running.has(id);

export function startAddon(id: string) {
    if (running.has(id)) return;
    try {
        addons[id].start?.();
        running.add(id);
    } catch (e) {
        console.error(`[LeanCord] Gagal menjalankan addon ${id}`, e);
    }
}

export function stopAddon(id: string) {
    if (!running.has(id)) return;
    try { addons[id].stop?.(); } catch (e) { console.error(`[LeanCord] Gagal menghentikan addon ${id}`, e); }
    running.delete(id);
}

export function setEnabled(id: string, enabled: boolean) {
    setSetting(`addons.${id}.enabled`, enabled);
    if (enabled) startAddon(id);
    else stopAddon(id);
}

export function startAll() {
    for (const id of ids) {
        addons[id].settings?._bind(id);
        addons[id].native?._bind(id);
    }
    for (const id of ids) if (isEnabled(id)) startAddon(id);
}

export { addons };
