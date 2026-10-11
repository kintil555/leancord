import { defineAddon, defineNative, defineSettings, OptionType, toast } from "@lean";

const native = defineNative<typeof import("./native")>();

const settings = defineSettings({
    greeting: {
        type: OptionType.STRING,
        description: "Teks sapaan",
        default: "Halo dari HelloAddon!"
    }
});

export default defineAddon({
    name: "HelloAddon",
    description: "Contoh addon: settings + native (main process)",
    version: "1.0.0",
    settings,
    native,

    async start() {
        const platform = await native.getPlatform();
        toast(`${settings.store.greeting} (${platform})`);
    },

    stop() {
        // bersihkan listener / style / timer di sini
    }
});
