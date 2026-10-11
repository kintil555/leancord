import { createStyle, defineAddon, defineNative, defineSettings, OptionType, toast } from "@lean";

const native = defineNative<typeof import("./native")>();
const style = createStyle("LeanDiscord");

// Selector memakai substring class ([class*=]) karena class Discord ber-hash.
// Kalau Discord mengubahnya, cukup matikan opsi terkait.
const CSS = {
    noAnimations: `
*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
}`,
    noEffects: `
*, *::before, *::after {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    will-change: auto !important;
}`,
    hideActiveNow: `[class*="nowPlayingColumn"] { display: none !important; }`,
    simpleUI: `
a[href="/shop"], a[href="/quests"], a[href="/store"],
[data-list-item-id$="___shop"], [data-list-item-id$="___quests"],
[class*="giftButton"], [class*="premiumPromo"], [class*="upsell"],
[class*="nitroUpsell"], [class*="avatarDecoration"], [class*="profileEffects"],
[class*="bannerPremium"] { display: none !important; }`
};

function apply() {
    const { store } = settings;
    style.set(
        (store.noAnimations ? CSS.noAnimations : "") +
        (store.noEffects ? CSS.noEffects : "") +
        (store.hideActiveNow ? CSS.hideActiveNow : "") +
        (store.simpleUI ? CSS.simpleUI : "")
    );
}

const bool = (description: string, def = true) =>
    ({ type: OptionType.BOOLEAN, description, default: def, onChange: apply }) as const;

function UsagePanel() {
    const info = <span /> as HTMLElement;
    return (
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            <button class="btn" onClick={async () => {
                const u = await native.getUsage();
                info.textContent = `RAM ${u.ramMB} MB • CPU ${u.cpu}% • ${u.processes} proses`;
            }}>Cek RAM/CPU</button>
            <button class="btn" onClick={async () => {
                await native.clearCache();
                toast("Cache dibersihkan");
            }}>Bersihkan cache</button>
            {info}
        </div>
    );
}

const settings = defineSettings({
    noAnimations: bool("Matikan animasi & transisi (hemat CPU/GPU)"),
    noEffects: bool("Matikan blur & bayangan (hemat GPU)"),
    simpleUI: bool("UI simpel: sembunyikan Shop, Quests, upsell Nitro, dekorasi avatar"),
    hideActiveNow: bool("Sembunyikan kolom Active Now", false),
    disableSmoothScrolling: {
        type: OptionType.BOOLEAN,
        description: "Matikan smooth scrolling",
        default: true,
        restartNeeded: true
    },
    heapLimit: {
        type: OptionType.SELECT,
        description: "Batas heap JS per proses (terlalu kecil bisa crash)",
        restartNeeded: true,
        options: [
            { label: "Default", value: 0, default: true },
            { label: "1024 MB", value: 1024 },
            { label: "768 MB", value: 768 },
            { label: "512 MB", value: 512 }
        ]
    },
    usage: { type: OptionType.COMPONENT, description: "", component: UsagePanel }
});

export default defineAddon({
    name: "LeanDiscord",
    description: "Kurangi animasi/efek, bersihkan UI, flag Electron hemat RAM/CPU",
    version: "1.0.0",
    authors: ["kintil555"],
    enabledByDefault: true,
    settings,
    native,

    start: apply,
    stop: () => style.remove()
});
