import { spawn } from "child_process";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { readFileSync } from "fs";
import { join } from "path";
import natives from "~addonNatives";

import { IPC } from "../shared/ipc";
import { importAddon } from "./addons";
import { settings, setSettingByPath } from "./settings";

const REPO = join(__dirname, "..");
const ADDONS_DIR = join(REPO, "src", "addons");

type Evt = { senderFrame?: { url: string; } | null; };

/** Hanya halaman Discord yang boleh memakai bridge ini */
function trusted(e: Evt) {
    try {
        const host = new URL(e.senderFrame!.url).hostname;
        return /(^|\.)(discord\.com|discordapp\.com)$/.test(host);
    } catch {
        return false;
    }
}

function guard(e: Evt) {
    if (!trusted(e)) throw new Error("Untrusted sender");
}

ipcMain.on(IPC.GET_RENDERER_JS, e => {
    try { e.returnValue = trusted(e) ? readFileSync(join(__dirname, "renderer.js"), "utf8") : ""; }
    catch (err) { console.error("[LeanCord] renderer.js tidak ditemukan, jalankan build", err); e.returnValue = ""; }
});

ipcMain.on(IPC.GET_SETTINGS, e => { e.returnValue = trusted(e) ? settings : {}; });

ipcMain.handle(IPC.SET_SETTING, (e, path: string, value: unknown) => {
    guard(e);
    setSettingByPath(path, value);
});

// Daftarkan fungsi dari native.ts tiap addon sebagai IPC handler
const addonMap: Record<string, Record<string, string>> = {};
for (const [id, mod] of Object.entries(natives)) {
    for (const [fn, impl] of Object.entries(mod)) {
        if (typeof impl !== "function") continue;
        const key = `LeanCord:native:${id}:${fn}`;
        ipcMain.handle(key, (e, ...args) => { guard(e); return (impl as Function)(e, ...args); });
        (addonMap[id] ??= {})[fn] = key;
    }
}
ipcMain.on(IPC.GET_ADDON_MAP, e => { e.returnValue = trusted(e) ? addonMap : {}; });

ipcMain.handle(IPC.IMPORT_ADDON, async (e, mode: "folder" | "files") => {
    guard(e);
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
    const opts = {
        title: mode === "folder" ? "Pilih folder addon" : "Pilih index.tsx / native.ts",
        properties: mode === "folder" ? ["openDirectory" as const] : ["openFile" as const, "multiSelections" as const],
        filters: mode === "folder" ? [] : [{ name: "Addon files", extensions: ["ts", "tsx", "js", "jsx"] }]
    };
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (r.canceled) return { ok: false, canceled: true };
    return importAddon(r.filePaths, ADDONS_DIR);
});

ipcMain.handle(IPC.REBUILD, (e, relaunch: boolean) => {
    guard(e);
    return new Promise(resolve => {
        const p = spawn("node", [join(REPO, "scripts", "build.mjs")], { cwd: REPO, windowsHide: true });
        let out = "";
        const collect = (d: Buffer) => { out = (out + d).slice(-2000); };
        p.stdout.on("data", collect);
        p.stderr.on("data", collect);
        p.on("error", err => resolve({ ok: false, error: `Gagal menjalankan node: ${err.message}` }));
        p.on("close", code => {
            if (code !== 0) return resolve({ ok: false, error: out || `build exit ${code}` });
            resolve({ ok: true });
            if (relaunch) setTimeout(() => { app.relaunch(); app.exit(0); }, 300);
        });
    });
});

ipcMain.handle(IPC.RESTART, e => {
    guard(e);
    setTimeout(() => { app.relaunch(); app.exit(0); }, 100);
});
