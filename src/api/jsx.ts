/** JSX → DOM Node langsung. Tanpa React/virtual DOM, jadi hemat RAM & CPU. */

function append(parent: Node, child: any) {
    if (child == null || child === false || child === true) return;
    if (Array.isArray(child)) child.forEach(c => append(parent, c));
    else parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
}

export function Fragment(props: { children?: any; }) {
    const f = document.createDocumentFragment();
    append(f, props?.children);
    return f;
}

export function h(tag: any, props: Record<string, any> | null, ...children: any[]): Node {
    if (typeof tag === "function") return tag({ ...props, children });

    const el = document.createElement(tag);
    const late: [string, any][] = [];

    for (const [k, v] of Object.entries(props ?? {})) {
        if (k === "class" || k === "className") el.className = v;
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "value" || k === "checked" || k === "disabled") late.push([k, v]);
        else if (v === true) el.setAttribute(k, "");
        else if (v != null && v !== false) el.setAttribute(k, String(v));
    }

    append(el, children);
    // value harus diset setelah <option> ada
    for (const [k, v] of late) (el as any)[k] = v;
    return el;
}
