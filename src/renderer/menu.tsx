import { addCss, getRoot, setSetting, settingsRoot, toast } from "@lean";
import type { SettingDef } from "@lean";

import { addons, ids, isEnabled, setEnabled } from "./manager";

const CSS = `
.fab{position:fixed;right:14px;bottom:14px;width:34px;height:34px;border-radius:50%;border:0;cursor:pointer;
 background:#5865f2;color:#fff;font-size:16px;opacity:.45;z-index:2147483646}
.fab:hover{opacity:1}
.panel{position:fixed;right:14px;bottom:56px;width:380px;max-height:70vh;display:flex;flex-direction:column;
 background:#2b2d31;color:#dbdee1;border-radius:10px;box-shadow:0 8px 24px #0008;font-size:14px;z-index:2147483646}
.hd{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #1e1f22;font-weight:600}
.x{background:none;border:0;color:#b5bac1;cursor:pointer;font-size:16px}
.list{overflow:auto;padding:6px 0;flex:1}
.empty{padding:16px;color:#949ba4}
.row{padding:8px 14px}
.top{display:flex;align-items:center;gap:10px}
.info{flex:1;min-width:0}
.nm{font-weight:600}
.ds{color:#949ba4;font-size:12px;margin-top:2px}
.gear{background:none;border:0;color:#b5bac1;cursor:pointer;font-size:15px}
.opts{margin:8px 0 2px;padding:8px 10px;background:#1e1f22;border-radius:6px;display:flex;flex-direction:column;gap:8px}
.opt{display:flex;align-items:center;justify-content:space-between;gap:10px}
.opt .l{flex:1;font-size:13px}
.tag{color:#f0b232;font-size:11px;margin-left:6px}
input[type=text],input[type=number],select{background:#111214;color:#dbdee1;border:1px solid #3f4147;border-radius:4px;padding:4px 6px;max-width:150px}
.sw{position:relative;width:38px;height:22px;flex:none}
.sw input{opacity:0;width:100%;height:100%;margin:0;position:absolute;cursor:pointer;z-index:1}
.sw span{position:absolute;inset:0;background:#80848e;border-radius:11px}
.sw span::after{content:"";position:absolute;width:16px;height:16px;left:3px;top:3px;background:#fff;border-radius:50%}
.sw input:checked+span{background:#23a559}
.sw input:checked+span::after{left:19px}
.ft{padding:10px 14px;border-top:1px solid #1e1f22;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.btn{background:#4e5058;color:#fff;border:0;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:13px}
.btn:hover{background:#6d6f78}
.btn.pri{background:#5865f2}
.btn.pri:hover{background:#4752c4}
.st{width:100%;font-size:12px;color:#949ba4;white-space:pre-wrap;max-height:90px;overflow:auto}
`;

function Switch({ checked, onChange }: { checked: boolean; onChange(v: boolean): void; }) {
    return (
        <label class="sw">
            <input type="checkbox" checked={checked} onChange={(e: any) => onChange(e.target.checked)} />
            <span />
        </label>
    );
}

function Option({ id, k, def }: { id: string; k: string; def: SettingDef; }) {
    const store = addons[id].settings!.store as Record<string, any>;
    let control: Node;

    switch (def.type) {
        case "boolean":
            control = <Switch checked={!!store[k]} onChange={v => { store[k] = v; }} />;
            break;
        case "select":
            control = (
                <select value={String(store[k])} onChange={(e: any) => {
                    const opt = def.options.find(o => String(o.value) === e.target.value);
                    if (opt) store[k] = opt.value;
                }}>
                    {def.options.map(o => <option value={String(o.value)}>{o.label}</option>)}
                </select>
            );
            break;
        case "number":
            control = <input type="number" value={String(store[k])} onChange={(e: any) => { store[k] = Number(e.target.value); }} />;
            break;
        case "string":
            control = <input type="text" value={String(store[k])} onChange={(e: any) => { store[k] = e.target.value; }} />;
            break;
        default:
            control = def.component();
    }

    return (
        <div class="opt">
            {def.type !== "component" && (
                <div class="l">{def.description}{def.restartNeeded && <span class="tag">↻ restart</span>}</div>
            )}
            {control}
        </div>
    );
}

function AddonRow({ id }: { id: string; }) {
    const addon = addons[id];
    const defs = (addon.settings?.defs ?? {}) as Record<string, SettingDef>;
    let opts: HTMLElement | null = null;

    const toggleOpts = () => {
        if (opts) { opts.remove(); opts = null; return; }
        opts = (
            <div class="opts">
                {Object.entries(defs).map(([k, def]) => <Option id={id} k={k} def={def} />)}
            </div>
        ) as HTMLElement;
        row.append(opts);
    };

    const row = (
        <div class="row">
            <div class="top">
                <div class="info">
                    <div class="nm">{addon.name}{addon.version && <span class="ds"> v{addon.version}</span>}</div>
                    <div class="ds">{addon.description}</div>
                </div>
                {Object.keys(defs).length > 0 && <button class="gear" title="Pengaturan" onClick={toggleOpts}>⚙</button>}
                <Switch checked={isEnabled(id)} onChange={v => setEnabled(id, v)} />
            </div>
        </div>
    ) as HTMLElement;

    return row;
}

let hideFab: () => void = () => {};

export function initMenu() {
    const root = getRoot();
    addCss(CSS);

    let panel: HTMLElement | null = null;
    let status: HTMLElement;
    let rebuildBtn: HTMLElement;

    const say = (msg: string) => { if (status) status.textContent = msg; };

    const doImport = async (mode: "folder" | "files") => {
        const r = await LeanNative.importAddon(mode);
        if (r.canceled) return;
        if (!r.ok) return say(`Gagal import: ${r.error}`);
        say(`Addon "${r.id}" ditambahkan. Klik "Rebuild & restart" untuk memuatnya.`);
        rebuildBtn.classList.add("pri");
    };

    const doRebuild = async () => {
        say("Building...");
        const r = await LeanNative.rebuild(true);
        if (!r.ok) say(`Build gagal:\n${r.error}`);
        else say("Build berhasil, restart...");
    };

    const build = () => {
        const list = ids.length
            ? ids.map(id => <AddonRow id={id} />)
            : <div class="empty">Belum ada addon. Import folder atau file index.tsx / native.ts.</div>;

        rebuildBtn = <button class="btn" onClick={doRebuild}>Rebuild & restart</button> as HTMLElement;
        status = <div class="st" /> as HTMLElement;

        return (
            <div class="panel">
                <div class="hd">
                    <span>LeanCord · Addons</span>
                    <button class="x" onClick={toggle}>✕</button>
                </div>
                <div class="list">{list}</div>
                <div class="ft">
                    <button class="btn" onClick={() => doImport("folder")}>Import folder</button>
                    <button class="btn" onClick={() => doImport("files")}>Import file</button>
                    {rebuildBtn}
                    <button class="btn" onClick={() => LeanNative.restart()}>Restart</button>
                    <button class="btn" title="Buka lagi dengan Ctrl+Shift+L" onClick={hideFab}>Sembunyikan tombol</button>
                    {status}
                </div>
            </div>
        ) as HTMLElement;
    };

    const toggle = () => {
        if (panel) { panel.remove(); panel = null; return; }
        panel = build();
        root.append(panel);
    };

    const fab = <button class="fab" title="LeanCord Addons (Ctrl+Shift+L)" onClick={toggle}>L</button> as HTMLElement;
    const applyFab = () => { fab.style.display = settingsRoot.core!.showButton === false ? "none" : ""; };
    applyFab();
    root.append(fab);

    hideFab = () => {
        setSetting("core.showButton", false);
        applyFab();
        toast("Tombol disembunyikan. Buka menu dengan Ctrl+Shift+L");
    };

    window.addEventListener("keydown", e => {
        if (e.ctrlKey && e.shiftKey && e.code === "KeyL") {
            e.preventDefault();
            toggle();
        }
    });

}
