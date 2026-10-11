import electron, { app, BrowserWindowConstructorOptions } from "electron";
import { join } from "path";

import "./ipc";
import "./persist";
import { settings } from "./settings";

console.log("[LeanCord] Starting up...");

// Electron menetapkan app path ke folder injector kita: <resources>/app
// app.asar asli milik Discord ada satu level di atasnya
const asarPath = join(app.getAppPath(), "..", "app.asar");
const discordPkg = require(join(asarPath, "package.json"));
const discordMain = join(asarPath, discordPkg.main);
require.main!.filename = discordMain;
(app as any).setAppPath(asarPath);

class BrowserWindow extends electron.BrowserWindow {
    constructor(options: BrowserWindowConstructorOptions) {
        // Hanya jendela utama Discord (punya preload & title)
        if (!options?.webPreferences?.preload || !options.title) {
            super(options);
            return;
        }

        process.env.DISCORD_PRELOAD = options.webPreferences.preload;
        options.webPreferences.preload = join(__dirname, "preload.js");
        options.webPreferences.sandbox = false;

        super(options);
    }
}
Object.assign(BrowserWindow, electron.BrowserWindow);
// esbuild bisa mengganti nama class, sementara getFocusedWindow() mengandalkan nama ini
Object.defineProperty(BrowserWindow, "name", { value: "BrowserWindow", configurable: true });

const electronPath = require.resolve("electron");
delete require.cache[electronPath]!.exports;
require.cache[electronPath]!.exports = { ...electron, BrowserWindow };

// Aktifkan DevTools (Ctrl+Shift+I) untuk development addon
if (settings.core.devtools ?? true) {
    const g = global as any;
    const enable = (s: any) => s.set("DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING", true);
    if (g.appSettings) enable(g.appSettings);
    else Object.defineProperty(g, "appSettings", {
        configurable: true,
        get: () => undefined,
        set(v) { delete g.appSettings; g.appSettings = v; enable(v); }
    });
}

console.log("[LeanCord] Loading original Discord app.asar");
require(discordMain);
