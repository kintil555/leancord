// Bangun installer mandiri (Node SEA): node scripts/sea.mjs [--out dist-installer/leancord-installer]
import { build } from "esbuild";
import { execFileSync } from "child_process";
import { copyFileSync, chmodSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-installer");
const win = process.platform === "win32";
const exe = join(out, win ? "leancord-installer.exe" : "leancord-installer");
mkdirSync(out, { recursive: true });

for (const f of ["main.js", "preload.js", "renderer.js"])
    if (!existsSync(join(root, "dist", f))) throw new Error(`dist/${f} belum ada, jalankan npm run build`);

await build({
    entryPoints: [join(root, "scripts/installer.mjs")], outfile: join(out, "installer.cjs"),
    bundle: true, platform: "node", format: "cjs", target: "node22", logLevel: "warning",
    define: { "import.meta.url": "undefined" }
});

const cfg = join(out, "sea-config.json");
writeFileSync(cfg, JSON.stringify({
    main: join(out, "installer.cjs"), output: join(out, "sea.blob"), disableExperimentalSEAWarning: true,
    assets: Object.fromEntries(["main.js", "preload.js", "renderer.js"].map(f => [f, join(root, "dist", f)]))
}));
execFileSync(process.execPath, ["--experimental-sea-config", cfg], { stdio: "inherit" });

copyFileSync(process.execPath, exe);
if (!win) chmodSync(exe, 0o755);
if (process.platform === "darwin") execFileSync("codesign", ["--remove-signature", exe]);

const args = [join(root, "node_modules/postject/dist/cli.js"), exe, "NODE_SEA_BLOB", join(out, "sea.blob"),
    "--sentinel-fuse", "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"];
if (process.platform === "darwin") args.push("--macho-segment-name", "NODE_SEA");
execFileSync(process.execPath, args, { stdio: "inherit" });
if (process.platform === "darwin") execFileSync("codesign", ["--sign", "-", exe]);
console.log("Installer:", exe);
