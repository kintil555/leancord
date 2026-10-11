// CLI + GUI installer LeanCord. Tanpa argumen pada binary mandiri (klik dua kali) -> membuka GUI.
import { existsSync } from "fs";

import { extractBundle, fromPath, discover, inject, uninject, isInstalled, IS_SEA, mainJs } from "./installer-core.mjs";
import { runGui } from "./gui.mjs";

// ---- CLI ----
const args = process.argv.slice(2);
const useGui = !args.length && (IS_SEA || process.env.LEANCORD_GUI); // klik dua kali = GUI
const [cmd, ...rest] = args;
const flag = n => rest.includes(`--${n}`);
const opt = n => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };

function main() {
    if (!["inject", "uninject", "status"].includes(cmd)) {
        console.log("Pemakaian: <inject|uninject|status> [--branch stable|ptb|canary] [--path <folder Discord>] [--force]");
        return 1;
    }

    let targets = opt("path") ? fromPath(opt("path")) : discover();
    if (opt("branch")) targets = targets.filter(t => t.branch === opt("branch"));

    if (!targets.length) {
        console.error("Discord tidak ditemukan. Gunakan --path <folder instalasi Discord atau folder resources>.");
        return 1;
    }

    if (cmd === "inject" && IS_SEA) extractBundle();

    if (cmd === "inject" && !existsSync(mainJs)) {
        console.error("dist/main.js belum ada. Jalankan: npm run build");
        return 1;
    }

    let failed = false;
    for (const t of targets) {
        try {
            if (cmd === "inject") { inject(t, flag("force")); console.log(`[OK] Terpasang di ${t.resources}`); }
            else if (cmd === "uninject") console.log(uninject(t) ? `[OK] Dihapus dari ${t.resources}` : `[--] Tidak terpasang: ${t.resources}`);
            else console.log(`${isInstalled(t.resources) ? "[ON] " : "[OFF]"} ${t.branch}: ${t.resources}`);
        } catch (e) {
            failed = true;
            const hint = e.code === "EACCES" || e.code === "EPERM" ? " (butuh izin: coba jalankan dengan sudo/Administrator)" : "";
            console.error(`[ERR] ${t.resources}: ${e.message}${hint}`);
        }
    }
    if (cmd === "inject" && !failed) console.log("Tutup Discord sepenuhnya (termasuk tray) lalu buka lagi.");
    return failed ? 1 : 0;
}

if (useGui) runGui().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
else {
    let code = 1;
    try { code = main(); } catch (e) { console.error("[ERR]", e?.stack ?? e); }
    process.exit(code);
}
