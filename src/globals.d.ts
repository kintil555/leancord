declare module "~addons" {
    import type { Addon } from "@lean";
    const addons: Record<string, Addon>;
    export default addons;
}

declare module "~addonNatives" {
    const natives: Record<string, Record<string, unknown>>;
    export default natives;
}

declare const LeanNative: {
    settings: { core?: Record<string, any>; addons?: Record<string, Record<string, any>>; };
    setSetting(path: string, value: unknown): Promise<void>;
    call(id: string, fn: string, args: unknown[]): Promise<any>;
    importAddon(mode: "folder" | "files"): Promise<{ ok: boolean; canceled?: boolean; id?: string; error?: string; }>;
    rebuild(relaunch: boolean): Promise<{ ok: boolean; error?: string; }>;
    restart(): Promise<void>;
};

// JSX tanpa React: <div/> menghasilkan DOM Node langsung (lihat src/api/jsx.ts)
declare function h(tag: any, props: any, ...children: any[]): Node;
declare function Fragment(props: { children?: any; }): Node;
declare namespace JSX {
    type Element = Node;
    interface IntrinsicElements { [tag: string]: any; }
    interface ElementChildrenAttribute { children: {}; }
}
