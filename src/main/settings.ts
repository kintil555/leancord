import { app } from "electron";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";

export interface Settings {
    core: Record<string, any>;
    addons: Record<string, Record<string, any>>;
}

const dir = join(app.getPath("appData"), "LeanCord");
const file = join(dir, "settings.json");

function load(): Settings {
    try {
        const j = JSON.parse(readFileSync(file, "utf8"));
        return { core: j.core ?? {}, addons: j.addons ?? {} };
    } catch {
        return { core: {}, addons: {} };
    }
}

export const settings = load();

let timer: NodeJS.Timeout | undefined;

function flush() {
    if (!timer) return;
    clearTimeout(timer);
    timer = undefined;
    try {
        mkdirSync(dir, { recursive: true });
        const tmp = file + ".tmp";
        writeFileSync(tmp, JSON.stringify(settings, null, 2));
        renameSync(tmp, file);
    } catch (e) {
        console.error("[LeanCord] Gagal menyimpan settings", e);
    }
}

app.on("will-quit", flush);

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

/** Path: "core.<key>" atau "addons.<id>.<key>" */
export function setSettingByPath(path: string, value: unknown) {
    const parts = path.split(".");
    const okRoot = parts[0] === "core" ? parts.length === 2 : parts[0] === "addons" && parts.length === 3;
    if (!okRoot || parts.some(p => !p || FORBIDDEN.has(p))) throw new Error("Invalid settings path");
    if (JSON.stringify(value ?? null).length > 50_000) throw new Error("Value too large");

    let o: any = settings;
    for (let i = 0; i < parts.length - 1; i++) {
        o = Object.prototype.hasOwnProperty.call(o, parts[i]) ? o[parts[i]] : (o[parts[i]] = {});
    }
    o[parts[parts.length - 1]] = value;

    clearTimeout(timer);
    timer = setTimeout(flush, 300);
}

/** Dipakai native.ts addon untuk membaca setting-nya saat startup */
export const getAddonSettings = (id: string): Record<string, any> => settings.addons[id] ?? {};
