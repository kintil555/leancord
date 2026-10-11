const CSS = `
:host{all:initial}
*{box-sizing:border-box;font-family:"gg sans","Noto Sans",system-ui,sans-serif}
.toast{position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:#1e1f22;color:#dbdee1;
 padding:10px 16px;border-radius:8px;font-size:14px;box-shadow:0 4px 12px #0006;z-index:2147483647;pointer-events:none}
`;

let root: ShadowRoot | null = null;

/** Shadow root bersama untuk semua UI LeanCord (terisolasi dari CSS Discord) */
export function getRoot(): ShadowRoot {
    if (root) return root;
    const host = document.createElement("leancord-root");
    root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = CSS;
    root.append(style);
    document.documentElement.append(host);
    return root;
}

export function addCss(css: string) {
    const s = document.createElement("style");
    s.textContent = css;
    getRoot().append(s);
}

export function toast(message: string, ms = 2500) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    getRoot().append(el);
    setTimeout(() => el.remove(), ms);
}
