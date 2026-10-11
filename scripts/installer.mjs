// Installer LeanCord (metode Vencord): app.asar asli -> _app.asar, lalu app.asar kecil yang me-require dist/main.js.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import * as sea from "node:sea";
import { MARKER, writeAppAsar } from "./asar.mjs";

const IS_SEA = sea.isSea(); // true bila dijalankan sebagai installer .exe/binary mandiri
const here = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
const root = resolve(dirname(here), "..");

const dataDir = process.platform === "win32" ? join(process.env.APPDATA ?? homedir(), "LeanCord")
    : process.platform === "darwin" ? join(homedir(), "Library", "Application Support", "LeanCord")
    : join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "LeanCord");

// Mode installer mandiri: tulis bundle ke <dataDir>/dist, lalu inject ke sana.
const distDir = IS_SEA ? join(dataDir, "dist") : join(root, "dist");
const mainJs = join(distDir, "main.js");

function extractBundle() {
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, "package.json"), '{ "type": "commonjs" }\n');
    for (const f of ["main.js", "preload.js", "renderer.js"])
        writeFileSync(join(distDir, f), Buffer.from(sea.getRawAsset(f)));
}

const BRANCHES = {
    stable: { win: "Discord", mac: "Discord", pkg: "discord", linux: ["discord"] },
    ptb: { win: "DiscordPTB", mac: "Discord PTB", pkg: "discordptb", linux: ["discord-ptb", "discordptb"] },
    canary: { win: "DiscordCanary", mac: "Discord Canary", pkg: "discordcanary", linux: ["discord-canary", "discordcanary"] }
};

const verParts = n => n.slice(4).split(".").map(Number);
function cmpVer(a, b) {
    const x = verParts(a), y = verParts(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
    return 0;
}

const hasAsar = res => existsSync(join(res, "app.asar"));

function latestWinResources(dir) {
    const v = readdirSync(dir).filter(n => /^app-\d/.test(n)).sort(cmpVer).at(-1);
    return v ? join(dir, v, "resources") : null;
}

function discover() {
    const out = [];
    const add = (branch, resources) => { if (resources && hasAsar(resources)) out.push({ branch, resources }); };

    for (const [branch, b] of Object.entries(BRANCHES)) {
        if (process.platform === "win32") {
            const base = join(process.env.LOCALAPPDATA ?? "", b.win);
            if (existsSync(base)) add(branch, latestWinResources(base));
        } else if (process.platform === "darwin") {
            add(branch, join("/Applications", `${b.mac}.app`, "Contents", "Resources"));
        } else {
            for (const name of b.linux)
                for (const base of ["/opt", "/usr/share", "/usr/lib", join(homedir(), ".local/share")])
                    add(branch, join(base, name, "resources"));
        }
    }
    return out;
}

/** --path boleh berupa folder resources, atau folder instalasi Discord */
function fromPath(p) {
    p = resolve(p);
    if (hasAsar(p)) return [{ branch: guessBranch(p), resources: p }];
    if (hasAsar(join(p, "resources"))) return [{ branch: guessBranch(p), resources: join(p, "resources") }];
    if (existsSync(p)) {
        const r = latestWinResources(p);
        if (r && hasAsar(r)) return [{ branch: guessBranch(p), resources: r }];
    }
    return [];
}

const guessBranch = p => /canary/i.test(p) ? "canary" : /ptb/i.test(p) ? "ptb" : "stable";

const asarOf = r => join(r, "app.asar"), origOf = r => join(r, "_app.asar");

/** app.asar milik kita = file kecil yang memuat marker (Vencord & lainnya tidak punya) */
const isOurs = r => {
    try { const f = asarOf(r); return statSync(f).size < 4096 && readFileSync(f, "latin1").includes(MARKER); } catch { return false; }
};

/** Sisa instalasi versi lama (folder resources/app) — dihapus agar tidak bentrok */
function cleanLegacy(r) {
    const d = join(r, "app");
    try { if (JSON.parse(readFileSync(join(d, "package.json"), "utf8")).leancord === true) rmSync(d, { recursive: true, force: true }); } catch { /* bukan milik kita */ }
}

const busy = e => e.code === "EBUSY" || e.code === "EPERM" || e.code === "EACCES"
    ? Object.assign(e, { message: `${e.message} (tutup Discord sepenuhnya termasuk tray; atau jalankan sebagai Administrator/sudo)` }) : e;

function unpatch(r) {
    if (!existsSync(origOf(r))) return false;
    if (!isOurs(r)) throw new Error(`${asarOf(r)} bukan milik LeanCord (mod lain, mis. Vencord?). Uninstall dulu.`);
    try {
        rmSync(asarOf(r), { force: true });
        renameSync(origOf(r), asarOf(r));
    } catch (e) { throw busy(e); }
    return true;
}

function inject({ resources }, force) {
    cleanLegacy(resources);
    if (existsSync(origOf(resources))) {
        if (!isOurs(resources) && !force)
            throw new Error("Terdeteksi mod lain (_app.asar, mis. Vencord). Uninstall dulu, atau pakai --force.");
        if (isOurs(resources)) unpatch(resources); // pasang ulang dari kondisi bersih
        else rmSync(asarOf(resources), { force: true }), renameSync(origOf(resources), asarOf(resources));
    }
    try {
        renameSync(asarOf(resources), origOf(resources));
        writeAppAsar(asarOf(resources), mainJs);
    } catch (e) {
        if (!existsSync(asarOf(resources)) && existsSync(origOf(resources))) renameSync(origOf(resources), asarOf(resources));
        throw busy(e);
    }
}

function uninject({ resources }) {
    cleanLegacy(resources);
    return unpatch(resources);
}

// ---- CLI ----
const args = process.argv.slice(2);
if (IS_SEA && !args.length) args.push("inject"); // klik dua kali = pasang
const [cmd, ...rest] = args;
const flag = n => rest.includes(`--${n}`);
const opt = n => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };

if (!["inject", "uninject", "status"].includes(cmd)) {
    console.log("Pemakaian: node scripts/installer.mjs <inject|uninject|status> [--branch stable|ptb|canary] [--path <folder Discord>] [--force]");
    process.exit(1);
}

let targets = opt("path") ? fromPath(opt("path")) : discover();
if (opt("branch")) targets = targets.filter(t => t.branch === opt("branch"));

if (!targets.length) {
    console.error("Discord tidak ditemukan. Gunakan --path <folder instalasi Discord atau folder resources>.");
    process.exit(1);
}

if (cmd === "inject" && IS_SEA) extractBundle();

if (cmd === "inject" && !existsSync(mainJs)) {
    console.error("dist/main.js belum ada. Jalankan: npm run build");
    process.exit(1);
}

let failed = false;
for (const t of targets) {
    try {
        if (cmd === "inject") { inject(t, flag("force")); console.log(`[OK] Terpasang di ${t.resources}`); }
        else if (cmd === "uninject") console.log(uninject(t) ? `[OK] Dihapus dari ${t.resources}` : `[--] Tidak terpasang: ${t.resources}`);
        else console.log(`${isOurs(t.resources) && existsSync(origOf(t.resources)) ? "[ON] " : "[OFF]"} ${t.branch}: ${t.resources}`);
    } catch (e) {
        failed = true;
        const hint = e.code === "EACCES" || e.code === "EPERM" ? " (butuh izin: coba jalankan dengan sudo/Administrator)" : "";
        console.error(`[ERR] ${t.resources}: ${e.message}${hint}`);
    }
}
if (cmd === "inject" && !failed) console.log("Tutup Discord sepenuhnya (termasuk tray) lalu buka lagi.");
// Windows: jendela tertutup otomatis saat double-click, jadi tahan sebentar
if (IS_SEA && process.platform === "win32" && !process.argv[2]) {
    console.log("\nTekan Enter untuk menutup...");
    process.stdin.once("data", () => process.exit(failed ? 1 : 0));
} else process.exit(failed ? 1 : 0);
