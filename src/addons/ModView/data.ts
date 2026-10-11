import { findStore } from "@lean";

import { basePerms, big, channelPerms, type Overwrite, type Role } from "./perms";

/** Pembungkus akses store Discord. Setiap method dicoba beberapa nama agar tahan perubahan versi. */
const call = (s: any, names: string[], ...args: any[]) => {
    for (const n of names) if (typeof s?.[n] === "function") { try { const r = s[n](...args); if (r != null) return r; } catch { /* coba berikutnya */ } }
    return undefined;
};

export const NEEDED = ["ChannelStore", "GuildStore", "GuildRoleStore", "GuildMemberStore", "UserStore", "SelectedChannelStore", "SelectedGuildStore"];
export const missingStores = () => NEEDED.filter(n => !findStore(n));

export interface Chan { id: string; name: string; type: number; parentId?: string; topic?: string; overwrites: Record<string, Overwrite>; position: number; }
export interface Member { id: string; name: string; roleIds: string[]; timedOut: boolean; }

export const currentGuildId = (): string | null => call(findStore("SelectedGuildStore"), ["getGuildId"]) ?? null;
export const currentChannelId = (): string | null => call(findStore("SelectedChannelStore"), ["getChannelId"]) ?? null;
export const myId = (): string => call(findStore("UserStore"), ["getCurrentUser"])?.id;

export function guildInfo(gid: string): { id: string; name: string; ownerId?: string; } | null {
    const g = call(findStore("GuildStore"), ["getGuild"], gid);
    return g ? { id: g.id, name: g.name, ownerId: g.ownerId ?? g.owner_id } : null;
}

export function getRoles(gid: string): Record<string, Role> {
    const raw = call(findStore("GuildRoleStore"), ["getRolesSnapshot", "getRoles"], gid) ?? call(findStore("GuildStore"), ["getRoles"], gid) ?? {};
    const out: Record<string, Role> = {};
    for (const r of Object.values<any>(raw)) out[r.id] = { id: r.id, name: r.name, permissions: big(r.permissions), color: r.color, position: r.position };
    return out;
}

const normOw = (c: any): Record<string, Overwrite> => {
    const out: Record<string, Overwrite> = {};
    for (const w of Object.values<any>(c.permissionOverwrites ?? c.permission_overwrites ?? {})) out[w.id] = { id: w.id, type: w.type, allow: big(w.allow), deny: big(w.deny) };
    return out;
}

export function getChannels(gid: string): Chan[] {
    const store = findStore("ChannelStore");
    let raw: any = call(store, ["getMutableGuildChannelsForGuild", "getGuildChannels"], gid);
    let list: any[] = raw ? (Array.isArray(raw) ? raw : Object.values(raw)) : [];
    if (!list.length) { // fallback: GuildChannelStore
        const gcs: any = call(findStore("GuildChannelStore"), ["getChannels"], gid);
        if (gcs) for (const v of Object.values<any>(gcs)) if (Array.isArray(v)) for (const x of v) list.push(x?.channel ?? x);
    }
    return list.filter(c => c && c.id && ![10, 11, 12].includes(c.type)).map(c => ({
        id: c.id, name: c.name ?? c.id, type: c.type, parentId: c.parent_id ?? c.parentId, topic: c.topic,
        position: c.position ?? 0, overwrites: normOw(c)
    }));
}

export function getMember(gid: string, uid: string): Member | null {
    const m = call(findStore("GuildMemberStore"), ["getMember"], gid, uid);
    const u = call(findStore("UserStore"), ["getUser"], uid);
    if (!m && !u) return null;
    const until = m?.communicationDisabledUntil;
    return {
        id: uid, name: m?.nick ?? u?.globalName ?? u?.username ?? uid, roleIds: m?.roles ?? [],
        timedOut: !!until && new Date(until as any).getTime() > Date.now()
    };
}

export function searchMembers(gid: string, q: string): Member[] {
    const list: any[] = call(findStore("GuildMemberStore"), ["getMembers"], gid) ?? [];
    const users = findStore("UserStore");
    const ql = q.toLowerCase();
    const out: Member[] = [];
    for (const m of list) {
        const u = call(users, ["getUser"], m.userId);
        const hay = `${m.nick ?? ""} ${u?.globalName ?? ""} ${u?.username ?? ""}`.toLowerCase();
        if (!ql || hay.includes(ql)) out.push({ id: m.userId, name: m.nick ?? u?.globalName ?? u?.username ?? m.userId, roleIds: m.roles ?? [], timedOut: false });
        if (out.length >= 30) break;
    }
    return out;
}

/** Izin efektif `member` di `channel` (atau izin server bila channel = null) */
export function effective(gid: string, member: Member, channel: Chan | null) {
    const g = guildInfo(gid);
    const roles = getRoles(gid);
    const base = basePerms({ guildId: gid, ownerId: g?.ownerId, userId: member.id, roleIds: member.roleIds, roles });
    if (!channel) return { base, perms: base, roles };
    const perms = channelPerms({ base, guildId: gid, userId: member.id, roleIds: member.roleIds, overwrites: channel.overwrites, timedOut: member.timedOut });
    return { base, perms, roles };
}
