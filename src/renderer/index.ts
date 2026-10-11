import { startAll } from "./manager";
import { initMenu } from "./menu";

function boot() {
    try {
        startAll();
        initMenu();
    } catch (e) {
        console.error("[LeanCord] Boot gagal", e);
    }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
