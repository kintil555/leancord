import type { NativeFns } from "./types";

/** Proxy ke fungsi di native.ts addon (jalan di main process). id diikat otomatis oleh manager. */
export function defineNative<T>(): NativeFns<T> {
    let id = "";
    return new Proxy({}, {
        get: (_, fn: string) => fn === "_bind"
            ? (i: string) => { id = i; }
            : (...args: unknown[]) => LeanNative.call(id, fn, args)
    }) as NativeFns<T>;
}
