import { app } from "electron";
import EventEmitter from "events";
import { cpSync, existsSync, readdirSync } from "fs";
import { basename, dirname, join } from "path";

// Discord (Windows/Squirrel) membuat folder app-x.y.z baru tiap update.
// Salin folder injector ke versi terbaru supaya LeanCord tetap aktif.

const ver = (n: string) => n.slice(4).split(".").map(Number);
function newer(a: string, b: string) {
    const x = ver(a), y = ver(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
    }
    return false;
}

function patchLatest() {
    try {
        const current = dirname(process.execPath);
        const currentName = basename(current);
        const base = join(current, "..");
        const latest = readdirSync(base).filter(n => /^app-\d/.test(n)).reduce((a, b) => newer(b, a) ? b : a, currentName);
        if (latest === currentName) return;

        const src = join(current, "resources", "app");
        const resources = join(base, latest, "resources");
        const dst = join(resources, "app");
        if (!existsSync(src) || existsSync(dst) || !existsSync(join(resources, "app.asar"))) return;

        console.info(`[LeanCord] Update Discord terdeteksi (${currentName} -> ${latest}), memasang ulang...`);
        cpSync(src, dst, { recursive: true });
    } catch (e) {
        console.error("[LeanCord] Gagal memasang ulang setelah update", e);
    }
}

if (process.platform === "win32") {
    EventEmitter.prototype.emit = new Proxy(EventEmitter.prototype.emit, {
        apply(target, thisArg, args) {
            if (args[0] === "host-updated") patchLatest();
            return Reflect.apply(target, thisArg, args as any);
        }
    });
    app.on("before-quit", patchLatest);
}
