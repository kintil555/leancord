import { IpcMainInvokeEvent } from "electron";

// Setiap fungsi export dipanggil dari index.tsx lewat defineNative(). Argumen pertama selalu event IPC.
export function getPlatform(_: IpcMainInvokeEvent) {
    return process.platform;
}
