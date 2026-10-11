import { getAddonSettings } from "@main/settings";
import { app, IpcMainInvokeEvent, session } from "electron";

// Flag Chromium harus dipasang sebelum app "ready", jadi dibaca saat modul dimuat.
// Perubahan baru berlaku setelah restart penuh Discord.
const s = getAddonSettings("LeanDiscord");

if (s.enabled ?? true) {
    if (s.disableSmoothScrolling ?? true) app.commandLine.appendSwitch("disable-smooth-scrolling");

    const heap = Number(s.heapLimit ?? 0);
    if (heap > 0) app.commandLine.appendSwitch("js-flags", `--max-old-space-size=${heap}`);
}

export async function clearCache(_: IpcMainInvokeEvent) {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearCodeCaches({});
}

export function getUsage(_: IpcMainInvokeEvent) {
    const m = app.getAppMetrics();
    return {
        processes: m.length,
        ramMB: Math.round(m.reduce((a, p) => a + p.memory.workingSetSize, 0) / 1024), // KB -> MB
        cpu: Math.round(m.reduce((a, p) => a + p.cpu.percentCPUUsage, 0) * 10) / 10
    };
}
