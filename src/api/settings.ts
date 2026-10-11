import type { SettingDef, SettingsApi, SettingsDefs, Store } from "./types";

type Root = { core?: Record<string, any>; addons?: Record<string, Record<string, any>>; };

// Objek dari contextBridge read-only, jadi salin ke objek biasa
export const root: Root = typeof LeanNative !== "undefined" ? JSON.parse(JSON.stringify(LeanNative.settings)) : {};
root.core ??= {};
root.addons ??= {};

/** Update state lokal + simpan ke disk lewat main process. Path: "core.x" atau "addons.<id>.<key>" */
export function setSetting(path: string, value: unknown) {
    const parts = path.split(".");
    let o: any = root;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] ??= {};
    o[parts[parts.length - 1]] = value;
    void LeanNative.setSetting(path, value);
}

function defaultOf(def: SettingDef) {
    switch (def.type) {
        case "boolean": return def.default ?? false;
        case "string": return def.default ?? "";
        case "number": return def.default ?? 0;
        case "select": return (def.options.find(o => o.default) ?? def.options[0])?.value;
        default: return undefined;
    }
}

export function defineSettings<const D extends SettingsDefs>(defs: D): SettingsApi<D> {
    let id = "";
    const store = new Proxy({} as Store<D>, {
        get(_, key: string) {
            const def = defs[key];
            if (!def) return undefined;
            const v = root.addons![id]?.[key];
            return v !== undefined ? v : defaultOf(def);
        },
        set(_, key: string, value) {
            if (!id || !defs[key]) return true;
            setSetting(`addons.${id}.${key}`, value);
            defs[key].onChange?.(value);
            return true;
        }
    });
    return { defs, store, _bind(i: string) { id = i; } };
}
