/** Logika permission Discord (murni, tanpa akses DOM) — mengikuti algoritma resmi di docs Discord. */

// [nama, bit, tipe channel: T=teks V=voice S=stage, "" = level server]
const RAW: [string, number, string][] = [
    ["CREATE_INSTANT_INVITE", 0, "TVS"], ["KICK_MEMBERS", 1, ""], ["BAN_MEMBERS", 2, ""], ["ADMINISTRATOR", 3, ""],
    ["MANAGE_CHANNELS", 4, "TVS"], ["MANAGE_GUILD", 5, ""], ["ADD_REACTIONS", 6, "TVS"], ["VIEW_AUDIT_LOG", 7, ""],
    ["PRIORITY_SPEAKER", 8, "V"], ["STREAM", 9, "VS"], ["VIEW_CHANNEL", 10, "TVS"], ["SEND_MESSAGES", 11, "TVS"],
    ["SEND_TTS_MESSAGES", 12, "TVS"], ["MANAGE_MESSAGES", 13, "TVS"], ["EMBED_LINKS", 14, "TVS"], ["ATTACH_FILES", 15, "TVS"],
    ["READ_MESSAGE_HISTORY", 16, "TVS"], ["MENTION_EVERYONE", 17, "TVS"], ["USE_EXTERNAL_EMOJIS", 18, "TVS"],
    ["VIEW_GUILD_INSIGHTS", 19, ""], ["CONNECT", 20, "VS"], ["SPEAK", 21, "V"], ["MUTE_MEMBERS", 22, "VS"],
    ["DEAFEN_MEMBERS", 23, "V"], ["MOVE_MEMBERS", 24, "VS"], ["USE_VAD", 25, "V"], ["CHANGE_NICKNAME", 26, ""],
    ["MANAGE_NICKNAMES", 27, ""], ["MANAGE_ROLES", 28, "TVS"], ["MANAGE_WEBHOOKS", 29, "TVS"],
    ["MANAGE_GUILD_EXPRESSIONS", 30, ""], ["USE_APPLICATION_COMMANDS", 31, "TVS"], ["REQUEST_TO_SPEAK", 32, "S"],
    ["MANAGE_EVENTS", 33, "VS"], ["MANAGE_THREADS", 34, "T"], ["CREATE_PUBLIC_THREADS", 35, "T"],
    ["CREATE_PRIVATE_THREADS", 36, "T"], ["USE_EXTERNAL_STICKERS", 37, "TVS"], ["SEND_MESSAGES_IN_THREADS", 38, "T"],
    ["USE_EMBEDDED_ACTIVITIES", 39, "TV"], ["MODERATE_MEMBERS", 40, ""], ["VIEW_CREATOR_MONETIZATION_ANALYTICS", 41, ""],
    ["USE_SOUNDBOARD", 42, "V"], ["CREATE_GUILD_EXPRESSIONS", 43, ""], ["CREATE_EVENTS", 44, "VS"],
    ["USE_EXTERNAL_SOUNDS", 45, "V"], ["SEND_VOICE_MESSAGES", 46, "TVS"], ["SET_VOICE_CHANNEL_STATUS", 48, "V"],
    ["SEND_POLLS", 49, "TVS"], ["USE_EXTERNAL_APPS", 50, "TVS"], ["PIN_MESSAGES", 51, "T"], ["BYPASS_SLOWMODE", 52, "TVS"]
];

const title = (s: string) => s.toLowerCase().split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

export interface Flag { key: string; label: string; bit: bigint; types: string; }
export const FLAGS: Flag[] = RAW.map(([key, n, types]) => ({ key, label: title(key), bit: 1n << BigInt(n), types }));
export const P = Object.fromEntries(FLAGS.map(f => [f.key, f.bit])) as Record<string, bigint>;
export const ALL = FLAGS.reduce((a, f) => a | f.bit, 0n);

/** Izin yang perlu diwaspadai (menu moderator) */
export const DANGEROUS = ["ADMINISTRATOR", "MANAGE_GUILD", "MANAGE_ROLES", "MANAGE_CHANNELS", "KICK_MEMBERS", "BAN_MEMBERS",
    "MODERATE_MEMBERS", "MANAGE_MESSAGES", "MANAGE_THREADS", "MANAGE_WEBHOOKS", "MENTION_EVERYONE", "VIEW_AUDIT_LOG",
    "MANAGE_NICKNAMES", "MANAGE_GUILD_EXPRESSIONS"];

export const big = (v: unknown): bigint => { try { return BigInt(v as any ?? 0); } catch { return 0n; } };
export const has = (perms: bigint, key: string) => (perms & P[key]) === P[key];
export const flagsOf = (perms: bigint) => FLAGS.filter(f => (perms & f.bit) === f.bit);

/** Tipe channel Discord → huruf T/V/S untuk menyaring flag yang relevan */
export function kindOf(channelType: number): "T" | "V" | "S" {
    return channelType === 2 ? "V" : channelType === 13 ? "S" : "T";
}

export interface Role { id: string; name: string; permissions: bigint; color?: number; position?: number; }
export interface Overwrite { id: string; type: number; allow: bigint; deny: bigint; }

/** type overwrite: 0/"role" = role, 1/"member" = member */
export const isRoleOw = (o: { type: any; }) => o.type === 0 || o.type === "role";

export function basePerms(o: { guildId: string; ownerId?: string; userId: string; roleIds: string[]; roles: Record<string, Role>; }): bigint {
    if (o.ownerId && o.ownerId === o.userId) return ALL;
    let p = o.roles[o.guildId]?.permissions ?? 0n; // @everyone: id role = id server
    for (const id of o.roleIds) p |= o.roles[id]?.permissions ?? 0n;
    return (p & P.ADMINISTRATOR) ? ALL : p;
}

export function channelPerms(o: {
    base: bigint; guildId: string; userId: string; roleIds: string[]; overwrites: Record<string, Overwrite> | Overwrite[] | undefined;
    timedOut?: boolean;
}): bigint {
    if (o.base === ALL || (o.base & P.ADMINISTRATOR)) return ALL;
    const list = (Array.isArray(o.overwrites) ? o.overwrites : Object.values(o.overwrites ?? {})).map(w => ({ ...w, allow: big(w.allow), deny: big(w.deny) }));
    let p = o.base;
    const ev = list.find(w => w.id === o.guildId && isRoleOw(w));
    if (ev) p = (p & ~ev.deny) | ev.allow;
    let deny = 0n, allow = 0n;
    for (const w of list) if (isRoleOw(w) && w.id !== o.guildId && o.roleIds.includes(w.id)) { deny |= w.deny; allow |= w.allow; }
    p = (p & ~deny) | allow;
    const me = list.find(w => !isRoleOw(w) && w.id === o.userId);
    if (me) p = (p & ~me.deny) | me.allow;
    if (o.timedOut) p &= P.VIEW_CHANNEL | P.READ_MESSAGE_HISTORY;
    return p;
}
