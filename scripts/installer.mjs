// Installer LeanCord: menulis resources/app/{package.json,index.js} di folder Discord.
// Electron memuat folder "app" lebih dulu daripada app.asar; patcher kita lalu memuat app.asar asli.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import * as sea from "node:sea";

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

const isOurs = appDir => {
    try { return JSON.parse(readFileSync(join(appDir, "package.json"), "utf8")).leancord === true; } catch { return false; }
};

function inject({ branch, resources }, force) {
    const appDir = join(resources, "app");
    if (existsSync(join(resources, "_app.asar")))
        throw new Error("Terdeteksi mod lain (_app.asar, mis. Vencord). Uninstall dulu agar tidak bentrok.");
    if (existsSync(appDir) && !isOurs(appDir) && !force)
        throw new Error(`${appDir} sudah ada dan bukan milik LeanCord (pakai --force untuk menimpa).`);

    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "package.json"), JSON.stringify({
        name: BRANCHES[branch].pkg, // harus sama dengan nama asli supaya folder data user Discord tidak berubah
        main: "index.js",
        leancord: true
    }, null, 2));
    writeFileSync(join(appDir, "index.js"), `require(${JSON.stringify(mainJs)});\n`);
}

function uninject({ resources }) {
    const appDir = join(resources, "app");
    if (!existsSync(appDir)) return false;
    if (!isOurs(appDir)) throw new Error(`${appDir} bukan milik LeanCord, tidak dihapus.`);
    rmSync(appDir, { recursive: true, force: true });
    return true;
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
        else console.log(`${isOurs(join(t.resources, "app")) ? "[ON] " : "[OFF]"} ${t.branch}: ${t.resources}`);
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
