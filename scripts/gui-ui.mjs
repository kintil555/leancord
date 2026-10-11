// Halaman UI installer (HTML tunggal, tanpa dependensi).
export const page = token => `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>LeanCord Installer</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#1e1f22;--card:#2b2d31;--card2:#313338;--line:#3f4147;--tx:#f2f3f5;--mut:#a3a6aa;--brand:#5865f2;--brand2:#4752c4;--ok:#23a559;--err:#f23f43;--warn:#f0b232}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--tx);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;align-items:center;padding:28px 20px;overflow-y:auto}
main{width:100%;max-width:640px}
header{text-align:center;margin-bottom:22px}
.logo{width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,var(--brand),#8b5cf6);display:grid;place-items:center;font-weight:800;font-size:26px;margin:0 auto 12px;box-shadow:0 8px 24px #5865f255}
h1{margin:0;font-size:24px;letter-spacing:-.3px}
header p{margin:4px 0 0;color:var(--mut);font-size:14px}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:var(--mut);margin:22px 0 8px}
.item{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px;margin-bottom:10px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--mut);flex:none}
.item.on .dot{background:var(--ok);box-shadow:0 0 0 4px #23a55933}
.info{flex:1;min-width:0}
.name{font-weight:600}
.path{color:var(--mut);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:rtl;text-align:left}
.badge{font-size:12px;color:var(--mut)}
.item.on .badge{color:var(--ok)}
.btns{display:flex;gap:8px;flex:none}
button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:8px 16px;cursor:pointer;color:#fff;background:var(--brand);transition:.15s}
button:hover{background:var(--brand2)}
button.sec{background:#4e5058}button.sec:hover{background:#6d6f78}
button.danger{background:var(--err)}button.danger:hover{background:#c93438}
button:disabled{opacity:.5;cursor:default}
.empty{background:var(--card);border:1px dashed var(--line);border-radius:12px;padding:20px;text-align:center;color:var(--mut)}
.row{display:flex;gap:8px}
input{flex:1;background:var(--card2);border:1px solid var(--line);border-radius:8px;color:var(--tx);padding:9px 12px;font:inherit;min-width:0}
input:focus{outline:2px solid var(--brand);outline-offset:-1px}
#msg{margin-top:16px;min-height:44px;border-radius:10px;padding:11px 14px;font-size:14px;display:none;white-space:pre-wrap}
#msg.ok{display:block;background:#23a55922;border:1px solid #23a55966;color:#7ee2a0}
#msg.err{display:block;background:#f23f4322;border:1px solid #f23f4366;color:#ff9a9c}
#msg.info{display:block;background:var(--card);border:1px solid var(--line);color:var(--mut)}
footer{margin-top:auto;padding-top:24px;display:flex;gap:16px;align-items:center;color:var(--mut);font-size:12px}
footer a{color:var(--mut);cursor:pointer;text-decoration:underline}
</style></head><body>
<main>
<header><div class="logo">L</div><h1>LeanCord Installer</h1><p>Injector Discord ringan dengan sistem Addons</p></header>
<h2>Instalasi Discord</h2>
<div id="list"><div class="empty">Mencari Discord…</div></div>
<h2>Folder lain (opsional)</h2>
<div class="row"><input id="path" placeholder="Folder instalasi Discord atau folder resources"><button class="sec" id="add">Tambah</button></div>
<div id="msg"></div>
</main>
<footer><span>Tutup Discord sepenuhnya (termasuk tray) sebelum memasang.</span><a id="close">Keluar</a></footer>
<script>
const T=${JSON.stringify(token)};
const $=s=>document.querySelector(s);
const api=(p,o={})=>fetch(p,{...o,headers:{"x-token":T,"content-type":"application/json"}}).then(r=>r.json());
const msg=(t,k)=>{const m=$("#msg");m.className=k;m.textContent=t};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let extra="";
function render(items){
  const l=$("#list");
  if(!items.length){l.innerHTML='<div class="empty">Discord tidak ditemukan.<br>Masukkan folder instalasinya di bawah.</div>';return}
  l.innerHTML=items.map((d,i)=>'<div class="item'+(d.installed?" on":"")+'"><span class="dot"></span><div class="info"><div class="name">'+esc(d.name)+' <span class="badge">· '+(d.installed?"Terpasang":"Belum terpasang")+'</span></div><div class="path" title="'+esc(d.resources)+'"><bdi>'+esc(d.resources)+'</bdi></div></div><div class="btns">'
   +'<button data-i="'+i+'" data-a="install">'+(d.installed?"Pasang ulang":"Pasang")+'</button>'
   +(d.installed?'<button class="danger" data-i="'+i+'" data-a="uninstall">Lepas</button>':"")+'</div></div>').join("");
  l.querySelectorAll("button").forEach(b=>b.onclick=()=>act(items[b.dataset.i],b.dataset.a));
}
async function load(){render(await api("/api/installs"+(extra?"?path="+encodeURIComponent(extra):"")))}
async function act(d,action,force){
  document.querySelectorAll("button").forEach(b=>b.disabled=true);
  msg("Memproses…","info");
  const r=await api("/api/action",{method:"POST",body:JSON.stringify({action,resources:d.resources,force})});
  document.querySelectorAll("button").forEach(b=>b.disabled=false);
  if(r.ok){msg(action==="install"?"Berhasil dipasang. Tutup Discord sepenuhnya (termasuk tray) lalu buka lagi.":"Berhasil dilepas.","ok");render(r.installs)}
  else{msg(r.error,"err");load()}
}
$("#add").onclick=async()=>{extra=$("#path").value.trim();if(!extra)return;const r=await api("/api/installs?path="+encodeURIComponent(extra));render(r);const hit=r.some(x=>x.resources.toLowerCase().includes(extra.toLowerCase().replace(/[\\/]+$/,"")));hit?msg("Folder ditambahkan.","ok"):msg("Tidak ada app.asar Discord di folder itu.","err")};
$("#close").onclick=async()=>{await api("/api/close");document.body.innerHTML='<p style="margin:auto;color:#a3a6aa">Sudah selesai. Jendela ini boleh ditutup.</p>';setTimeout(()=>window.close(),300)};
setInterval(()=>api("/api/ping").catch(()=>{}),2000);api("/api/ping");load();
</script></body></html>`;
