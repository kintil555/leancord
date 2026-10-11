export const OptionType = {
    BOOLEAN: "boolean",
    STRING: "string",
    NUMBER: "number",
    SELECT: "select",
    COMPONENT: "component"
} as const;

interface Base {
    description: string;
    /** Tampilkan label "restart" di menu; perubahan baru berlaku setelah Discord di-restart */
    restartNeeded?: boolean;
    onChange?(value: any): void;
}

export interface BooleanDef extends Base { type: "boolean"; default?: boolean; }
export interface StringDef extends Base { type: "string"; default?: string; }
export interface NumberDef extends Base { type: "number"; default?: number; }
export interface SelectDef extends Base {
    type: "select";
    options: readonly { label: string; value: string | number; default?: boolean; }[];
}
export interface ComponentDef extends Base { type: "component"; component: () => Node; }

export type SettingDef = BooleanDef | StringDef | NumberDef | SelectDef | ComponentDef;
export type SettingsDefs = Record<string, SettingDef>;

type ValueOf<D> =
    D extends { type: "boolean"; } ? boolean :
    D extends { type: "string"; } ? string :
    D extends { type: "number"; } ? number :
    D extends { type: "select"; } ? string | number : never;

export type Store<D extends SettingsDefs> = {
    [K in keyof D as D[K] extends { type: "component"; } ? never : K]: ValueOf<D[K]>;
};

export interface SettingsApi<D extends SettingsDefs = SettingsDefs> {
    defs: D;
    store: Store<D>;
    _bind(id: string): void;
}

export type NativeFns<T> = {
    [K in keyof T as T[K] extends (...a: any) => any ? K : never]:
    T[K] extends (e: any, ...a: infer A) => infer R ? (...a: A) => Promise<Awaited<R>> : never;
} & { _bind(id: string): void; };

export interface Addon {
    name: string;
    description: string;
    version?: string;
    authors?: string[];
    /** Aktif otomatis saat pertama kali terdeteksi (default: false) */
    enabledByDefault?: boolean;
    settings?: SettingsApi<any>;
    /** Hasil defineNative<typeof import("./native")>() */
    native?: { _bind(id: string): void; };
    start?(): void | Promise<void>;
    stop?(): void;
}

export const defineAddon = <T extends Addon>(addon: T) => addon;
