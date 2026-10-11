// Penulis app.asar minimal (port dari Vencord Installer, app_asar.go): berisi index.js + package.json saja.
// index.js hanya me-require patcher LeanCord; app.asar asli Discord dipindah ke _app.asar.
import { writeFileSync } from "fs";

export const MARKER = "leancord"; // dipakai untuk mengenali app.asar milik kita

export function writeAppAsar(outFile, patcherPath) {
    const indexJs = `/*${MARKER}*/require(${JSON.stringify(patcherPath)})`;
    const pkg = '{"name":"discord","main":"index.js"}';
    const idx = Buffer.from(indexJs), pk = Buffer.from(pkg);

    const header = Buffer.from(JSON.stringify({
        files: {
            "index.js": { size: idx.length, offset: "0" },
            "package.json": { size: pk.length, offset: String(idx.length) }
        }
    }));
    const aligned = (header.length + 3) & ~3;
    const hdr = Buffer.alloc(16);
    hdr.writeUInt32LE(4, 0);
    hdr.writeUInt32LE(aligned + 8, 4);
    hdr.writeUInt32LE(aligned + 4, 8);
    hdr.writeUInt32LE(header.length, 12);
    const pad = Buffer.alloc(aligned - header.length, "0");
    writeFileSync(outFile, Buffer.concat([hdr, header, pad, idx, pk]));
}
