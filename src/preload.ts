import { contextBridge, ipcRenderer, webFrame } from "electron/renderer";

import { IPC } from "./shared/ipc";

const settings = ipcRenderer.sendSync(IPC.GET_SETTINGS);
const addonMap: Record<string, Record<string, string>> = ipcRenderer.sendSync(IPC.GET_ADDON_MAP);

contextBridge.exposeInMainWorld("LeanNative", {
    settings,
    setSetting: (path: string, value: unknown) => ipcRenderer.invoke(IPC.SET_SETTING, path, value),
    call: (id: string, fn: string, args: unknown[]) => {
        const channel = addonMap[id]?.[fn];
        if (!channel) return Promise.reject(new Error(`Native ${id}.${fn} tidak ada`));
        return ipcRenderer.invoke(channel, ...args);
    },
    importAddon: (mode: string) => ipcRenderer.invoke(IPC.IMPORT_ADDON, mode),
    rebuild: (relaunch: boolean) => ipcRenderer.invoke(IPC.REBUILD, relaunch),
    restart: () => ipcRenderer.invoke(IPC.RESTART)
});

const js: string = ipcRenderer.sendSync(IPC.GET_RENDERER_JS);
if (js) webFrame.executeJavaScript(js);

// Preload asli Discord (DiscordNative, dll)
require(process.env.DISCORD_PRELOAD!);
