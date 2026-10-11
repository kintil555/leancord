// GUI installer: server HTTP lokal (127.0.0.1, token acak) + jendela browser mode "app" (tanpa address bar).
import { spawn } from "child_process";
import { randomBytes } from "crypto";
import { existsSync, mkdtempSync } from "fs";
import { createServer } from "http";
import { tmpdir } from "os";
import { join } from "path";

import { discover, extractBundle, fromPath, inject, isInstalled, IS_SEA, mainJs, uninject } from "./installer-core.mjs";
import { page } from "./gui-ui.mjs";

const label = { stable: "Discord Stable", ptb: "Discord PTB", canary: "Discord Canary" };

function listInstalls(extra) {
    const seen = new Map();
    for (const t of [...discover(), ...(extra ? fromPath(extra) : [])])
        seen.set(t.resources, { branch: t.branch, name: label[t.branch], resources: t.resources, installed: isInstalled(t.resources) });
    return [...seen.values()];
}

function findBrowser() {
    const env = process.env, c = [];
    if (process.platform === "win32") {
        for (const base of [env["ProgramFiles(x86)"], env.ProgramFiles, env.LOCALAPPDATA].filter(Boolean)) {
            c.push(join(base, "Microsoft/Edge/Application/msedge.exe"), join(base, "Google/Chrome/Application/chrome.exe"));
        }
    } else if (process.platform === "darwin") {
        c.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser");
    } else {
        for (const d of (env.PATH ?? "").split(":"))
            for (const n of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"]) c.push(join(d, n));
    }
    return c.find(existsSync);
}

function openWindow(url) {
    const browser = findBrowser();
    if (browser) {
        const profile = mkdtempSync(join(tmpdir(), "leancord-ui-"));
        spawn(browser, [`--app=${url}`, `--user-data-dir=${profile}`, "--window-size=760,600", "--no-first-run", "--disable-extensions"],
            { detached: true, stdio: "ignore" }).unref();
        return;
    }
    const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
        : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => { }).unref();
    console.log("Buka di browser:", url);
}

export function runGui() {
    return new Promise(resolve => {
        const token = randomBytes(16).toString("hex");
        let lastPing = Date.now(), pinged = false;

        const send = (res, code, body, type = "application/json") => {
            res.writeHead(code, { "content-type": type + "; charset=utf-8", "cache-control": "no-store" });
            res.end(typeof body === "string" ? body : JSON.stringify(body));
        };
        const readBody = req => new Promise(r => { let d = ""; req.on("data", c => d += c); req.on("end", () => { try { r(JSON.parse(d || "{}")); } catch { r({}); } }); });

        const server = createServer(async (req, res) => {
            const url = new URL(req.url, "http://x");
            if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? "")) return send(res, 403, { error: "host" });
            if (req.method === "GET" && url.pathname === "/") {
                if (url.searchParams.get("t") !== token) return send(res, 403, "Forbidden", "text/plain");
                return send(res, 200, page(token), "text/html");
            }
            if (req.headers["x-token"] !== token) return send(res, 403, { error: "token" });

            try {
                if (url.pathname === "/api/ping") { pinged = true; lastPing = Date.now(); return send(res, 200, { ok: true }); }
                if (url.pathname === "/api/installs") return send(res, 200, listInstalls(url.searchParams.get("path")));
                if (url.pathname === "/api/close") { send(res, 200, { ok: true }); return server.close(), resolve(); }
                if (url.pathname === "/api/action" && req.method === "POST") {
                    const { action, resources, force } = await readBody(req);
                    const t = discover().concat(fromPath(resources ?? "")).find(x => x.resources === resources);
                    if (!t) return send(res, 404, { error: "Instalasi Discord tidak ditemukan" });
                    try {
                        if (action === "install") { if (IS_SEA) extractBundle(); if (!existsSync(mainJs)) throw new Error("dist/main.js belum ada"); inject(t, !!force); }
                        else if (action === "uninstall") uninject(t);
                        else throw new Error("aksi tidak dikenal");
                        return send(res, 200, { ok: true, installs: listInstalls(resources) });
                    } catch (e) {
                        const hint = e.code === "EACCES" || e.code === "EPERM" || e.code === "EBUSY" ? " Tutup Discord sepenuhnya (termasuk tray) lalu coba lagi." : "";
                        return send(res, 200, { ok: false, error: e.message + hint });
                    }
                }
                send(res, 404, { error: "not found" });
            } catch (e) { send(res, 500, { error: String(e?.message ?? e) }); }
        });

        server.listen(0, "127.0.0.1", () => {
            const url = `http://127.0.0.1:${server.address().port}/?t=${token}`;
            openWindow(url);
            // Tutup otomatis bila jendela ditutup (heartbeat berhenti)
            const timer = setInterval(() => {
                if (Date.now() - lastPing > (pinged ? 8000 : 30000)) { clearInterval(timer); server.close(); resolve(); }
            }, 1000);
        });
    });
}
