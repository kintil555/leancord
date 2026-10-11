import { addCss, defineAddon, defineSettings, getRoot, OptionType, toast } from "@lean";

import { type Chan, currentChannelId, currentGuildId, effective, getChannels, getMember, getRoles, guildInfo, type Member, missingStores, myId, searchMembers } from "./data";
import { DANGEROUS, FLAGS, flagsOf, has, isRoleOw, kindOf, type Overwrite, P, type Role } from "./perms";

const CSS = `
.mv-fab{position:fixed;right:56px;bottom:14px;width:34px;height:34px;border-radius:50%;border:0;cursor:pointer;background:#23a559;color:#fff;font-size:15px;opacity:.45;z-index:2147483646}
.mv-fab:hover{opacity:1}
.mv-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,94vw);height:min(640px,88vh);display:flex;flex-direction:column;background:#2b2d31;color:#dbdee1;border-radius:12px;box-shadow:0 12px 40px #000a;font-size:14px;z-index:2147483646;overflow:hidden}
.mv-hd{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #1e1f22;font-weight:700}
.mv-hd .sp{flex:1}
.mv-x{background:none;border:0;color:#b5bac1;cursor:pointer;font-size:18px}
.mv-bar{display:flex;gap:8px;padding:10px 16px;border-bottom:1px solid #1e1f22;align-items:center;flex-wrap:wrap}
.mv-bar label{color:#949ba4;font-size:12px}
.mv-tabs{display:flex;gap:4px;padding:8px 16px 0}
.mv-tab{background:none;border:0;color:#b5bac1;padding:8px 12px;border-radius:6px 6px 0 0;cursor:pointer;font-weight:600}
.mv-tab.on{background:#313338;color:#fff}
.mv-body{flex:1;overflow:auto;padding:14px 16px;background:#313338}
select,input.mv-in{background:#1e1f22;color:#dbdee1;border:1px solid #3f4147;border-radius:6px;padding:6px 8px;font:inherit;min-width:0}
select{max-width:260px}
.mv-sec{margin:0 0 16px}
.mv-sec h4{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:#949ba4}
.mv-chips{display:flex;flex-wrap:wrap;gap:5px}
.mv-chip{padding:2px 8px;border-radius:10px;font-size:12px;background:#4e5058;white-space:nowrap}
.mv-chip.ok{background:#23a55933;color:#7ee2a0}
.mv-chip.no{background:#f23f4333;color:#ff9a9c}
.mv-chip.warn{background:#f0b23233;color:#f5c75a}
.mv-chip.role{background:#1e1f22;border:1px solid #3f4147}
.mv-card{background:#2b2d31;border-radius:8px;padding:10px 12px;margin-bottom:8px}
.mv-card .t{font-weight:600;margin-bottom:6px;display:flex;gap:8px;align-items:center}
.mv-card .s{color:#949ba4;font-size:12px}
.mv-row{cursor:pointer}.mv-row:hover{background:#35373c}
.mv-muted{color:#949ba4}
.mv-btn{background:#5865f2;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer;font-weight:600}
.mv-err{background:#f23f4322;border:1px solid #f23f4366;color:#ff9a9c;padding:12px;border-radius:8px;white-space:pre-wrap}
`;

const settings = defineSettings({
    hotkey: { type: OptionType.BOOLEAN, description: "Aktifkan hotkey Ctrl+Shift+M untuk membuka menu", default: true },
    button: { type: OptionType.BOOLEAN, description: "Tampilkan tombol hijau kecil di pojok kanan bawah", default: true }
});

// ---------- state ----------
const st = { open: false, tab: "channel" as "channel" | "user" | "hidden", channelId: null as string | null, userId: null as string | null, q: "" };
let panel: HTMLElement | null = null, fab: HTMLElement | null = null;

const colorOf = (r?: Role) => r?.color ? { color: "#" + r.color.toString(16).padStart(6, "0") } : {};
const typeName = (t: number) => ({ 0: "Teks", 2: "Voice", 4: "Kategori", 5: "Announcement", 13: "Stage", 15: "Forum", 16: "Media" } as Record<number, string>)[t] ?? `Tipe ${t}`;
const chip = (text: string, kind = "", style?: object) => <span class={"mv-chip " + kind} style={style}>{text}</span>;

function subject(gid: string, o: Overwrite, roles: Record<string, Role>) {
    if (isRoleOw(o)) {
        const r = roles[o.id];
        return chip(o.id === gid ? "@everyone" : r?.name ?? `role ${o.id}`, "role", colorOf(r));
    }
    return chip("👤 " + (getMember(gid, o.id)?.name ?? o.id), "role");
}

// ---------- tabs ----------
function ChannelTab(gid: string, chans: Chan[], me: Member) {
    const ch = chans.find(c => c.id === st.channelId) ?? chans[0];
    if (!ch) return <div class="mv-muted">Tidak ada channel.</div>;
    const roles = getRoles(gid);
    const { perms } = effective(gid, me, ch);
    const kind = kindOf(ch.type);
    const rel = FLAGS.filter(f => f.types.includes(kind));
    const ows = Object.values(ch.overwrites);
    return <div>
        <div class="mv-sec">
            <h4>Izin efektif {me.name} di #{ch.name} ({typeName(ch.type)})</h4>
            <div class="mv-chips">{rel.map(f => chip(f.label, has(perms, f.key) ? "ok" : "no"))}</div>
            {ch.topic ? <div class="mv-muted" style={{ marginTop: "8px" }}>Topik: {ch.topic}</div> : null}
        </div>
        <div class="mv-sec">
            <h4>Permission overwrite ({ows.length})</h4>
            {ows.length ? ows.map(o => <div class="mv-card">
                <div class="t">{subject(gid, o, roles)} <span class="s">{isRoleOw(o) ? "role" : "member"}</span></div>
                {flagsOf(o.allow).length ? <div class="mv-chips" style={{ marginBottom: "4px" }}>{flagsOf(o.allow).map(f => chip("✔ " + f.label, "ok"))}</div> : null}
                {flagsOf(o.deny).length ? <div class="mv-chips">{flagsOf(o.deny).map(f => chip("✘ " + f.label, "no"))}</div> : null}
            </div>) : <div class="mv-muted">Tidak ada overwrite (mengikuti izin role / kategori).</div>}
        </div>
    </div>;
}

function UserTab(gid: string, me: Member, body: HTMLElement) {
    const user = (st.userId && getMember(gid, st.userId)) || me;
    const roles = getRoles(gid);
    const { base } = effective(gid, user, null);
    const res = <div /> as HTMLElement;
    const doSearch = (q: string) => {
        res.replaceChildren(...searchMembers(gid, q).map(m =>
            <div class="mv-card mv-row" onClick={() => { st.userId = m.id; render(); }}>{m.name}</div>));
        if (!res.childNodes.length) res.append(<div class="mv-muted">Tidak ada hasil (hanya member yang sudah dimuat Discord yang bisa dicari).</div>);
    };
    const input = <input class="mv-in" placeholder="Cari member (nama/nick)…" value={st.q} onInput={(e: any) => { st.q = e.target.value; doSearch(st.q); }} style={{ width: "100%", marginBottom: "8px" }} /> as HTMLElement;
    const list = flagsOf(base);
    return <div>
        <div class="mv-sec">{input}<div style={{ maxHeight: "150px", overflow: "auto" }}>{res}</div></div>
        <div class="mv-sec">
            <h4>{user.name}{user.id === me.id ? " (saya)" : ""}</h4>
            {user.timedOut ? <div style={{ marginBottom: "8px" }}>{chip("⏳ Sedang di-timeout", "warn")}</div> : null}
            <div class="mv-chips">{user.roleIds.map(id => chip(roles[id]?.name ?? id, "role", colorOf(roles[id])))}
                {user.roleIds.length ? null : <span class="mv-muted">Hanya @everyone</span>}</div>
        </div>
        <div class="mv-sec">
            <h4>Izin level server (gabungan role)</h4>
            {has(base, "ADMINISTRATOR") ? <div style={{ marginBottom: "8px" }}>{chip("Administrator / Owner — semua izin", "warn")}</div> : null}
            <div class="mv-chips">{DANGEROUS.map(k => chip(FLAGS.find(f => f.key === k)!.label, has(base, k) ? "warn" : "no"))}</div>
        </div>
        <div class="mv-sec">
            <h4>Semua izin ({list.length})</h4>
            <div class="mv-chips">{list.map(f => chip(f.label, "ok"))}</div>
        </div>
    </div>;
}

function HiddenTab(gid: string, chans: Chan[], me: Member) {
    const roles = getRoles(gid);
    const name = (id?: string) => chans.find(c => c.id === id)?.name;
    const rows = chans.filter(c => c.type !== 4).map(c => ({ c, p: effective(gid, me, c).perms }));
    const hidden = rows.filter(r => !has(r.p, "VIEW_CHANNEL"));
    const ro = rows.filter(r => has(r.p, "VIEW_CHANNEL") && [0, 5, 15, 16].includes(r.c.type) && !has(r.p, "SEND_MESSAGES"));
    const who = (c: Chan) => {
        const allowed = Object.values(c.overwrites).filter(o => (o.allow & P.VIEW_CHANNEL) !== 0n);
        return allowed.length ? <div class="mv-chips" style={{ marginTop: "6px" }}><span class="s">Boleh lihat:</span>{allowed.map(o => subject(gid, o, roles))}</div> : null;
    };
    const card = (c: Chan) => <div class="mv-card mv-row" onClick={() => { st.channelId = c.id; st.tab = "channel"; render(); }}>
        <div class="t">{c.type === 2 || c.type === 13 ? "🔊" : "#"} {c.name} <span class="s">{typeName(c.type)}{name(c.parentId) ? " · " + name(c.parentId) : ""}</span></div>
        {who(c)}
    </div>;
    return <div>
        <div class="mv-sec"><h4>Tersembunyi — tidak bisa dilihat {me.name} ({hidden.length})</h4>
            {hidden.length ? hidden.map(r => card(r.c)) : <div class="mv-muted">Tidak ada.</div>}</div>
        <div class="mv-sec"><h4>Bisa dilihat tapi tidak bisa chat ({ro.length})</h4>
            {ro.length ? ro.map(r => card(r.c)) : <div class="mv-muted">Tidak ada.</div>}</div>
        <div class="mv-muted" style={{ fontSize: "12px" }}>Isi channel tersembunyi tetap tidak bisa dibaca (server Discord yang menolak); menu ini hanya menampilkan daftar & izinnya. Klik channel untuk detail overwrite.</div>
    </div>;
}

// ---------- panel ----------
function render() {
    if (!panel) return;
    const body = panel.querySelector(".mv-body") as HTMLElement, bar = panel.querySelector(".mv-bar") as HTMLElement;
    const missing = missingStores();
    const gid = currentGuildId();
    if (missing.length) return void (bar.replaceChildren(), body.replaceChildren(<div class="mv-err">Store Discord belum ditemukan: {missing.join(", ")}.{"\n"}Tunggu Discord selesai memuat lalu buka lagi, atau Discord mungkin sudah mengubah struktur internalnya.</div>));
    if (!gid) return void (bar.replaceChildren(), body.replaceChildren(<div class="mv-muted">Buka sebuah server (bukan DM) dulu.</div>));

    const chans = getChannels(gid).sort((a, b) => a.position - b.position);
    if (!st.channelId || !chans.some(c => c.id === st.channelId)) st.channelId = currentChannelId() ?? chans[0]?.id ?? null;
    const me = getMember(gid, myId());
    if (!me) return void body.replaceChildren(<div class="mv-err">Data member Anda belum dimuat.</div>);
    const target = (st.userId && getMember(gid, st.userId)) || me;

    bar.replaceChildren(
        <label>Server</label>, <b>{guildInfo(gid)?.name}</b>,
        <label>Channel</label>,
        <select value={st.channelId ?? ""} onChange={(e: any) => { st.channelId = e.target.value; render(); }}>
            {chans.map(c => <option value={c.id}>{c.type === 4 ? "▾ " : c.type === 2 || c.type === 13 ? "🔊 " : "# "}{c.name}</option>)}
        </select>,
        <label>User</label>,
        <span>{target.name}{target.id === me.id ? " (saya)" : ""} {target.id !== me.id ? <button class="mv-btn" style={{ padding: "2px 8px", marginLeft: "4px" }} onClick={() => { st.userId = null; render(); }}>reset</button> : null}</span>
    );
    panel.querySelectorAll(".mv-tab").forEach(t => t.classList.toggle("on", (t as HTMLElement).dataset.t === st.tab));

    body.replaceChildren(
        st.tab === "channel" ? ChannelTab(gid, chans, target)
            : st.tab === "user" ? UserTab(gid, me, body)
                : HiddenTab(gid, chans, target)
    );
}

function open() {
    if (panel) return render();
    st.open = true;
    const tab = (t: typeof st.tab, label: string) => <button class="mv-tab" data-t={t} onClick={() => { st.tab = t; render(); }}>{label}</button>;
    panel = <div class="mv-panel">
        <div class="mv-hd">🛡 ModView <span class="mv-muted" style={{ fontWeight: 400 }}>permission channel & user</span><span class="sp" />
            <button class="mv-x" onClick={close}>✕</button></div>
        <div class="mv-bar" />
        <div class="mv-tabs">{tab("channel", "Channel")}{tab("user", "User")}{tab("hidden", "Tersembunyi / Read-only")}</div>
        <div class="mv-body" />
    </div> as HTMLElement;
    getRoot().append(panel);
    render();
}

function close() { panel?.remove(); panel = null; st.open = false; }

const onKey = (e: KeyboardEvent) => {
    if (settings.store.hotkey && e.ctrlKey && e.shiftKey && e.code === "KeyM") { e.preventDefault(); st.open ? close() : open(); }
    else if (e.key === "Escape" && st.open) close();
};

let style: HTMLStyleElement | null = null;

export default defineAddon({
    name: "ModView",
    description: "Menu moderator: lihat permission overwrite channel & izin user, plus daftar channel tersembunyi / read-only",
    version: "1.0.0",
    authors: ["kintil555"],
    enabledByDefault: true,
    settings,

    start() {
        addCss(CSS);
        style = getRoot().lastElementChild as HTMLStyleElement;
        fab = <button class="mv-fab" title="ModView (Ctrl+Shift+M)" onClick={() => st.open ? close() : open()}>🛡</button> as HTMLElement;
        if (settings.store.button) getRoot().append(fab);
        document.addEventListener("keydown", onKey, true);
    },

    stop() {
        document.removeEventListener("keydown", onKey, true);
        close(); fab?.remove(); style?.remove(); fab = style = null;
    }
});
