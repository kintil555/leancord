/** Akses modul internal Discord (webpack) tanpa patching: dipakai addon untuk membaca Flux store. */

let req: any = null;

export function getWebpackRequire(): any | null {
    if (req) return req;
    const chunk = (window as any).webpackChunkdiscord_app;
    if (!Array.isArray(chunk)) return null;
    try {
        chunk.push([[Symbol("leancord")], {}, (r: any) => { req = r; }]);
        chunk.pop();
    } catch { /* belum siap */ }
    return req?.c ? req : (req = null);
}

const stores = new Map<string, any>();
let scanned = 0;

function scan(wanted: string) {
    const r = getWebpackRequire();
    if (!r) return;
    const mods = Object.values<any>(r.c);
    if (scanned === mods.length) return; // tidak ada modul baru sejak scan terakhir
    scanned = mods.length;
    for (const m of mods) {
        const e = m?.exports;
        if (!e || e === window || typeof e !== "object" && typeof e !== "function") continue;
        let cands: any[];
        try { cands = [e, e.default, ...Object.values(e)]; } catch { continue; }
        for (const c of cands) {
            if (!c || typeof c !== "object" || typeof c.getName !== "function") continue;
            try {
                const n = c.getName();
                if (typeof n === "string" && !stores.has(n)) stores.set(n, c);
            } catch { /* abaikan */ }
        }
    }
}

/** Cari Flux store berdasarkan nama (mis. "ChannelStore"). null bila belum tersedia. */
export function findStore<T = any>(name: string): T | null {
    if (!stores.has(name)) scan(name);
    return stores.get(name) ?? null;
}
