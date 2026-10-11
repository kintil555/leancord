// CLI addon: node scripts/addon.mjs import <folder | file...> | list | remove <id>
import { spawnSync } from "child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "fs";
import { basename, dirname, extname, join, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const addonsDir = join(root, "src", "addons");
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const INDEX = /^index\.(tsx?|jsx?)$/;
const cleanId = n => n.replace(/\.(desktop|web|vesktop)$/i, "").replace(/[^\w-]/g, "_").replace(/^[_.]+/, "");

const [cmd, ...args] = process.argv.slice(2);
const noBuild = args.includes("--no-build");
const paths = args.filter(a => !a.startsWith("--")).map(p => resolve(p));
const fail = m => { console.error(m); process.exit(1); };

if (cmd === "list") {
    const ids = existsSync(addonsDir) ? readdirSync(addonsDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) : [];
    console.log(ids.length ? ids.join("\n") : "(kosong)");
    process.exit(0);
}

if (cmd === "remove") {
    const id = cleanId(args[0] ?? "");
    if (!id || !existsSync(join(addonsDir, id))) fail("Addon tidak ditemukan.");
    rmSync(join(addonsDir, id), { recursive: true, force: true });
    console.log(`Addon "${id}" dihapus.`);
} else if (cmd === "import") {
    if (!paths.length) fail("Pemakaian: addon import <folder | index.tsx [native.ts ...]> [--no-build]");
    const single = paths.length === 1 && existsSync(paths[0]) && statSync(paths[0]).isDirectory();
    const id = cleanId(basename(single ? paths[0] : dirname(paths[0])));
    if (!id) fail("Nama addon tidak valid.");
    const dest = join(addonsDir, id);

    if (single) {
        if (!readdirSync(paths[0]).some(f => INDEX.test(f))) fail("Folder harus berisi index.tsx / index.ts");
        rmSync(dest, { recursive: true, force: true });
        cpSync(paths[0], dest, { recursive: true, filter: p => !/[\\/](node_modules|\.git)([\\/]|$)/.test(p) });
    } else {
        if (paths.some(p => !existsSync(p) || !EXTS.has(extname(p)) || dirname(p) !== dirname(paths[0]))) fail("Pilih file .ts/.tsx/.js/.jsx yang ada, dari folder yang sama.");
        if (!paths.some(p => INDEX.test(basename(p)))) fail("Harus menyertakan index.tsx / index.ts");
        mkdirSync(dest, { recursive: true });
        for (const p of paths) cpSync(p, join(dest, basename(p)));
    }
    console.log(`Addon "${id}" diimpor ke ${dest}`);
} else {
    fail("Pemakaian: node scripts/addon.mjs <import|list|remove> ...");
}

if (!noBuild) {
    const r = spawnSync(process.execPath, [join(root, "scripts", "build.mjs")], { cwd: root, stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log("Build selesai. Restart Discord untuk memuat addon.");
}
