import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "fs";
import { basename, dirname, extname, join } from "path";

const EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const INDEX = /^index\.(tsx?|jsx?)$/;

const cleanId = (name: string) =>
    name.replace(/\.(desktop|web|vesktop)$/i, "").replace(/[^\w-]/g, "_").replace(/^[_.]+/, "");

export type ImportResult = { ok: true; id: string; } | { ok: false; error: string; };

/** Import folder addon, atau file index.tsx/native.ts (dan file pendukung) ke src/addons/<id>/ */
export function importAddon(paths: string[], addonsDir: string): ImportResult {
    try {
        if (!paths.length) return { ok: false, error: "Tidak ada yang dipilih" };

        const single = paths.length === 1 && statSync(paths[0]).isDirectory();
        const id = cleanId(basename(single ? paths[0] : dirname(paths[0])));
        if (!id) return { ok: false, error: "Nama addon tidak valid (ubah nama foldernya)" };

        const dest = join(addonsDir, id);

        if (single) {
            if (!readdirSync(paths[0]).some(f => INDEX.test(f)))
                return { ok: false, error: "Folder harus berisi index.tsx / index.ts" };
            rmSync(dest, { recursive: true, force: true });
            cpSync(paths[0], dest, { recursive: true, filter: p => !/[\\/](node_modules|\.git)([\\/]|$)/.test(p) });
        } else {
            const bad = paths.find(p => !EXTS.has(extname(p)) || dirname(p) !== dirname(paths[0]));
            if (bad) return { ok: false, error: "Pilih file .ts/.tsx/.js/.jsx dari folder yang sama" };
            if (!paths.some(p => INDEX.test(basename(p))))
                return { ok: false, error: "Harus menyertakan index.tsx / index.ts" };
            mkdirSync(dest, { recursive: true });
            for (const p of paths) cpSync(p, join(dest, basename(p)));
        }

        return { ok: true, id };
    } catch (e: any) {
        return { ok: false, error: String(e?.message ?? e) };
    }
}

export const addonDirExists = (addonsDir: string, id: string) => existsSync(join(addonsDir, id));
