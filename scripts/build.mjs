import { build, context } from "esbuild";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const addonsDir = join(root, "src", "addons");
const watch = process.argv.includes("--watch");
const minify = process.argv.includes("--minify");

const findFile = (dir, names) => names.map(n => join(dir, n)).find(existsSync);

/** Semua folder di src/addons/ (kecuali yang diawali _ atau .) */
function listAddons() {
    if (!existsSync(addonsDir)) return [];
    return readdirSync(addonsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^[A-Za-z0-9][\w-]*$/.test(d.name))
        .map(d => d.name);
}

const rel = p => "./" + p.slice(join(root, "src").length + 1).replaceAll("\\", "/");

const virtual = (name, generate) => ({
    name: "virtual:" + name,
    setup(b) {
        const ns = "virtual-" + name;
        b.onResolve({ filter: new RegExp(`^${name}$`) }, () => ({ path: name, namespace: ns }));
        b.onLoad({ filter: /.*/, namespace: ns }, () => ({
            contents: generate(), resolveDir: join(root, "src"), loader: "js"
        }));
    }
});

function importAll(fileNames, kind) {
    let imports = "", entries = "", i = 0;
    for (const id of listAddons()) {
        const file = findFile(join(addonsDir, id), fileNames);
        if (!file) continue;
        imports += kind === "default"
            ? `import a${i} from ${JSON.stringify(rel(file))};\n`
            : `import * as a${i} from ${JSON.stringify(rel(file))};\n`;
        entries += `${JSON.stringify(id)}: a${i},\n`;
        i++;
    }
    return `${imports}export default {\n${entries}};`;
}

const addonsPlugin = virtual("~addons", () => importAll(["index.tsx", "index.ts", "index.jsx", "index.js"], "default"));
const nativesPlugin = virtual("~addonNatives", () => importAll(["native.ts", "native.js"], "star"));

const alias = {
    "@lean": join(root, "src", "api", "index.ts"),
    "@main": join(root, "src", "main")
};

const common = { bundle: true, logLevel: "info", legalComments: "none", minify, sourcemap: false };

// Proyek ini "type": "module", tapi hasil build main/preload adalah CommonJS
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "package.json"), '{ "type": "commonjs" }\n');

const targets = [
    {
        ...common, entryPoints: [join(root, "src/main/index.ts")], outfile: join(root, "dist/main.js"),
        platform: "node", format: "cjs", target: "node18", external: ["electron", "original-fs"],
        plugins: [nativesPlugin], alias
    },
    {
        ...common, entryPoints: [join(root, "src/preload.ts")], outfile: join(root, "dist/preload.js"),
        platform: "node", format: "cjs", target: "node18", external: ["electron"]
    },
    {
        ...common, entryPoints: [join(root, "src/renderer/index.ts")], outfile: join(root, "dist/renderer.js"),
        platform: "browser", format: "iife", target: "es2022",
        jsx: "transform", jsxFactory: "h", jsxFragment: "Fragment",
        inject: [join(root, "src/api/jsx.ts")],
        plugins: [addonsPlugin], alias
    }
];

if (watch) {
    for (const t of targets) await (await context(t)).watch();
    console.log("Watching... (Ctrl+C untuk berhenti)");
} else {
    await Promise.all(targets.map(t => build(t)));
}
