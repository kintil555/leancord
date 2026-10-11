/** <style> terkelola untuk CSS yang disuntik ke halaman Discord */
export function createStyle(id: string) {
    let el: HTMLStyleElement | null = null;
    return {
        set(css: string) {
            if (!el) {
                el = document.createElement("style");
                el.dataset.leancord = id;
                document.head.append(el);
            }
            el.textContent = css;
        },
        remove() {
            el?.remove();
            el = null;
        }
    };
}
