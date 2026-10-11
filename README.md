# LeanCord

Injector Discord desktop yang ringan, tanpa Vencord. Pola injeksinya sama dengan Vencord
(patch `BrowserWindow` di main process + preload), tapi tanpa webpack patching dan tanpa React:
renderer-nya ~16 KB. Fiturnya ditambah lewat **Addons**.

## Pasang (installer siap pakai)
Unduh `LeanCordInstaller-win.exe` / `-linux` / `-macos` dari [Releases › devbuild](../../releases/tag/devbuild),
jalankan (di Linux/macOS: `chmod +x` dulu; Windows: klik dua kali). Terbuka jendela GUI: pilih instalasi Discord → Pasang / Lepas. Butuh Edge/Chrome (bawaan Windows). Dengan argumen (`inject`, `uninject`, `status`) berjalan sebagai CLI.
Lepas: `LeanCordInstaller-xxx uninject`. Installer mandiri hanya membawa addon bawaan; untuk import addon
& Rebuild, pakai cara dari source di bawah.

## Pasang (dari source)

```
npm install          # (opsional) ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install, tidak perlu binary Electron
npm run build
npm run inject       # otomatis cari Discord; atau: npm run inject -- --path "<folder Discord>"
```
Tutup Discord total (termasuk tray), buka lagi. Lepas dengan `npm run uninject`.
Opsi: `--branch stable|ptb|canary`, `--force`. Cek status: `npm run status`.

> Folder proyek ini harus tetap di tempatnya (injector memuat `dist/main.js` dari sini).
> Jangan jalankan bersamaan dengan Vencord. Installer menolak jika `_app.asar` milik mod lain terdeteksi.

## Menu Addons
Tombol **L** di pojok kanan bawah, atau **Ctrl+Shift+L**. Isinya: daftar addon, toggle on/off,
pengaturan (⚙), **Import folder / Import file**, **Rebuild & restart**.

## Cara pasang addon
Addon = folder berisi `index.tsx` (renderer) dan opsional `native.ts` (main process).

1. **Lewat menu**: Import folder (atau Import file: pilih `index.tsx` + `native.ts`) → Rebuild & restart.
2. **Lewat CLI**: `npm run addon -- import <folder>` atau `npm run addon -- import index.tsx native.ts`
   (otomatis build), lalu restart Discord.
3. **Manual**: taruh folder di `src/addons/<nama>/`, jalankan `npm run build`.

Hapus: `npm run addon -- remove <nama>`. Daftar: `npm run addon -- list`.
Contoh template: `examples/HelloAddon/`. Addon bawaan: `src/addons/LeanDiscord/`.

Tombol Rebuild butuh `node` di PATH.

## API addon (`import ... from "@lean"`)
`defineAddon`, `defineSettings` + `OptionType` (BOOLEAN/STRING/NUMBER/SELECT/COMPONENT),
`defineNative<typeof import("./native")>()`, `createStyle(id)`, `toast()`, `addCss()`, JSX → DOM langsung.
Di `native.ts`: `import { getAddonSettings } from "@main/settings"` untuk membaca setting saat startup
(mis. flag Chromium yang harus dipasang sebelum app ready). Fungsi yang di-export otomatis bisa dipanggil
dari renderer; argumen pertamanya selalu event IPC.

## Struktur
```
scripts/installer.mjs   inject / uninject / status (metode Vencord: app.asar -> _app.asar + app.asar kecil)
scripts/asar.mjs        penulis app.asar minimal
scripts/build.mjs       esbuild: dist/main.js, preload.js, renderer.js (+ glob src/addons/*)
src/main/               patcher, IPC, settings, import addon, persist setelah update Discord
src/preload.ts          bridge `LeanNative`
src/renderer/           manager addon + menu
src/api/                API untuk addon
```
Settings disimpan di `<appData>/LeanCord/settings.json`.

## Catatan
- Memodifikasi klien Discord melanggar ToS Discord (sama seperti Vencord/BetterDiscord). Risiko ditanggung sendiri.
- Windows: setelah Discord update (folder `app-x.y.z` baru), injector disalin otomatis. Kalau gagal, jalankan `npm run inject` lagi.
- Linux Flatpak/Snap belum didukung; pakai `--path`.
