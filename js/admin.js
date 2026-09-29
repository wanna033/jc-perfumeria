/* JC Perfumería — panel de administrador.
   Guarda los cambios directamente en el repositorio de GitHub (data/tienda.json y assets/productos/)
   usando la API de GitHub con el token personal del dueño. GitHub Pages vuelve a publicar la tienda sola. */
(() => {
  const DEFAULT_REPO = "wanna033/jc-perfumeria";
  const DATA_PATH = "data/tienda.json";
  const IMG_DIR = "assets/productos";

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const money = n => "$" + Math.round(+n || 0).toLocaleString("es-CO");
  const ls = {
    get(k, d){ try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k){ try { localStorage.removeItem(k); } catch {} }
  };
  const ss = {
    get(k){ try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v){ try { sessionStorage.setItem(k, v); } catch {} },
    del(k){ try { sessionStorage.removeItem(k); } catch {} }
  };
  const slug = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "producto";
  const list = s => String(s || "").split(",").map(x => x.trim()).filter(Boolean);

  let cfg = null;          // { repo, branch, token, local }
  let data = null;         // datos en edición
  let remoteSha = null;
  let published = "";      // JSON de lo último publicado, para saber si hay cambios

  // ---------- GitHub ----------
  const b64encode = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const b64decodeText = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), c => c.charCodeAt(0)));
  async function gh(path, opts = {}){
    const r = await fetch(`https://api.github.com/repos/${cfg.repo}/${path}`, {
      ...opts, cache: "no-store",
      headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${cfg.token}`, "X-GitHub-Api-Version": "2022-11-28", ...(opts.headers || {}) }
    });
    if (!r.ok) {
      let msg = ""; try { msg = (await r.json()).message; } catch {}
      const e = new Error(msg || r.statusText); e.status = r.status; throw e;
    }
    return r.status === 204 ? null : r.json();
  }
  async function getFile(path){
    return gh(`contents/${path}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
  }
  async function putFile(path, base64, message, sha){
    return gh(`contents/${path}`, { method: "PUT", body: JSON.stringify({ message, content: base64, branch: cfg.branch, ...(sha ? { sha } : {}) }) });
  }

  // ---------- Acceso ----------
  const saved = ls.get("jc_admin_cfg", null) || (ss.get("jc_admin_cfg") ? JSON.parse(ss.get("jc_admin_cfg")) : null);
  $("#fRepo").value = saved?.repo || DEFAULT_REPO;
  $("#fBranch").value = saved?.branch || "main";
  if (saved?.token) { $("#fToken").value = saved.token; $("#fRemember").checked = !!ls.get("jc_admin_cfg", null); }

  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn btn-outline btn-sm"; b.textContent = "Probar sin conexión (solo vista previa)";
    b.onclick = () => start({ local: true, repo: "local", branch: "main" });
    $("#loginForm").appendChild(b);
  }

  $("#loginForm").onsubmit = async e => {
    e.preventDefault();
    const c = { repo: $("#fRepo").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, ""), branch: $("#fBranch").value.trim() || "main", token: $("#fToken").value.trim() };
    if (!/^[\w.-]+\/[\w.-]+$/.test(c.repo)) return $("#loginErr").textContent = "Escribe el repositorio como usuario/nombre.";
    if ($("#fRemember").checked) ls.set("jc_admin_cfg", c); else { ls.del("jc_admin_cfg"); ss.set("jc_admin_cfg", JSON.stringify(c)); }
    start(c);
  };

  async function start(c){
    cfg = c; $("#loginErr").textContent = "";
    busy("Cargando tu tienda…");
    try {
      let remote;
      if (cfg.local) {
        remote = await (await fetch(DATA_PATH + "?v=" + Date.now(), { cache: "no-store" })).json();
      } else {
        const f = await getFile(DATA_PATH);
        remoteSha = f.sha; remote = JSON.parse(b64decodeText(f.content));
      }
      published = JSON.stringify(normalize(remote));
      const draft = ls.get("jc_admin_draft", null);
      if (draft && JSON.stringify(normalize(draft)) !== published && confirm("Tienes cambios sin publicar guardados en este equipo. ¿Quieres recuperarlos?")) data = normalize(draft);
      else data = normalize(remote);
      $("#loginView").hidden = true; $("#appView").hidden = false; $("#aBottom").hidden = false;
      if (cfg.local) ["#publishBtn", "#publishBtn2"].forEach(s => { $(s).disabled = true; $(s).title = "Modo sin conexión: no se puede publicar"; });
      renderAll();
    } catch (err) {
      console.error(err);
      $("#loginErr").textContent =
        err.status === 401 ? "La clave (token) no es válida o ya venció." :
        err.status === 404 ? "No encontré el repositorio o la clave no tiene acceso a él." :
        "No se pudo conectar: " + err.message;
    } finally { busy(false); }
  }
  $("#logoutBtn").onclick = () => {
    if (dirty() && !confirm("Tienes cambios sin publicar. Quedan guardados en este equipo. ¿Salir?")) return;
    ss.del("jc_admin_cfg"); ls.del("jc_admin_cfg"); location.reload();
  };

  function normalize(d){
    d = d || {};
    return {
      ajustes: { nombre:"", whatsapp:"", telefonoVisible:"", email:"", anuncio:"", heroEtiqueta:"", heroTitulo:"", heroTexto:"", nosotros:"", envioGratisDesde:0, formasPago:[], instagram:"", facebook:"", tiktok:"", ...(d.ajustes || {}) },
      productos: (d.productos || []).map(p => ({ id:"", nombre:"", marca:"", genero:"", imagenes:[], presentacion:"", precio:0, precioAnterior:0, imagen:"", perfil:[], descripcion:"", notas:[], agotado:false, nuevo:false, destacado:false, ...p })),
      testimonios: d.testimonios || [],
      preguntas: d.preguntas || [],
      cupones: d.cupones || []
    };
  }

  // ---------- Estado de cambios ----------
  const dirty = () => data && JSON.stringify(data) !== published;
  function changed(){
    if (!ls.set("jc_admin_draft", data)) toast("Aviso: no se pudo guardar el borrador en este equipo (espacio lleno).");
    const d = dirty();
    $("#status").classList.toggle("dirty", d);
    $("#statusText").textContent = d ? "Cambios sin publicar" : "Todo publicado";
  }
  addEventListener("beforeunload", e => { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });
  $("#previewBtn").onclick = $("#previewBtn2").onclick = () => ls.set("jc_admin_draft", data);
  $("#publishBtn2").onclick = () => $("#publishBtn").click();

  // ---------- Pestañas ----------
  $("#tabs").onclick = e => {
    const t = e.target.closest("[data-tab]"); if (!t) return;
    $$(".tab").forEach(x => x.classList.toggle("on", x === t));
    $$("[data-panel]").forEach(p => p.hidden = p.dataset.panel !== t.dataset.tab);
  };

  function renderAll(){ renderProducts(); renderSettings(); renderTes(); renderFaq(); renderCup(); changed(); }

  // ---------- Productos ----------
  function renderProducts(){
    const q = $("#pSearch").value.trim().toLowerCase();
    const P = data.productos;
    $("#pCount").textContent = `(${P.length})`;
    $("#brandList").innerHTML = [...new Set(P.map(p => p.marca).filter(Boolean))].map(b => `<option value="${esc(b)}">`).join("");
    const rows = P.map((p, i) => ({ p, i })).filter(({ p }) => !q || (p.nombre + " " + p.marca).toLowerCase().includes(q));
    $("#plist").innerHTML = rows.length ? rows.map(({ p, i }) => `
      <div class="prow">
        <img src="${esc(p.imagen || "assets/logo-600.jpg")}" alt="" data-act="edit" data-i="${i}" style="cursor:pointer" onerror="this.onerror=null;this.src='assets/logo-600.jpg'">
        <div>
          <h3 data-act="edit" data-i="${i}" style="cursor:pointer">${esc(p.nombre)}</h3>
          <div class="sub">${esc(p.marca || "Sin marca")} · <span class="pr">${money(p.precio)}</span>${+p.precioAnterior > +p.precio ? ` <s>${money(p.precioAnterior)}</s>` : ""}</div>
          <div class="pills">
            ${p.agotado ? `<span class="pill red">Agotado</span>` : ""}
            ${p.destacado ? `<span class="pill gold">★ Destacado</span>` : ""}
            ${p.nuevo ? `<span class="pill gold">Nuevo</span>` : ""}
            ${p.genero ? `<span class="pill">${esc(p.genero)}</span>` : ""}
            ${(p.imagenes || []).length ? `<span class="pill">+${p.imagenes.length} fotos</span>` : ""}
            ${[p.imagen, ...(p.imagenes || [])].some(x => String(x).startsWith("data:")) ? `<span class="pill warn">Fotos nuevas sin publicar</span>` : ""}
          </div>
        </div>
        <div class="ractions">
          <button class="ib" data-act="up" data-i="${i}" title="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="ib" data-act="down" data-i="${i}" title="Bajar" ${i === P.length - 1 ? "disabled" : ""}>↓</button>
          <button class="ib" data-act="stock" data-i="${i}" title="${p.agotado ? "Marcar disponible" : "Marcar agotado"}">${p.agotado ? "✓" : "⊘"}</button>
          <button class="ib" data-act="dup" data-i="${i}" title="Duplicar">⧉</button>
          <button class="ib" data-act="edit" data-i="${i}" title="Editar">✎</button>
          <button class="ib danger" data-act="del" data-i="${i}" title="Eliminar">🗑</button>
        </div>
      </div>`).join("") : `<div class="card-box" style="text-align:center;color:var(--muted)">No hay productos${q ? " con esa búsqueda" : ". Crea el primero con “+ Nuevo producto”"}.</div>`;
  }
  $("#pSearch").oninput = renderProducts;
  $("#plist").onclick = e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const i = +b.dataset.i, P = data.productos, p = P[i];
    switch (b.dataset.act) {
      case "up": [P[i - 1], P[i]] = [P[i], P[i - 1]]; break;
      case "down": [P[i + 1], P[i]] = [P[i], P[i + 1]]; break;
      case "stock": p.agotado = !p.agotado; toast(p.agotado ? "Marcado como agotado" : "Marcado como disponible"); break;
      case "dup": { const c = structuredClone(p); c.nombre += " (copia)"; c.id = uniqueId(slug(c.nombre)); P.splice(i + 1, 0, c); break; }
      case "edit": return openEditor(i);
      case "del": if (!confirm(`¿Eliminar “${p.nombre}”?`)) return; P.splice(i, 1); toast("Producto eliminado"); break;
    }
    renderProducts(); changed();
  };
  function uniqueId(base, except){
    let id = base, n = 2;
    while (data.productos.some((p, i) => p.id === id && i !== except)) id = `${base}-${n++}`;
    return id;
  }

  // ---------- Editor ----------
  const form = $("#productForm");
  let editing = -1, pendingImg = null, extras = [];
  function openEditor(i){
    editing = i; pendingImg = null;
    const p = i >= 0 ? data.productos[i] : { nombre:"", marca:"", genero:"", imagenes:[], presentacion:"", precio:"", precioAnterior:"", imagen:"", perfil:[], notas:[], descripcion:"", agotado:false, nuevo:true, destacado:false };
    $("#editTitle").textContent = i >= 0 ? "Editar producto" : "Nuevo producto";
    form.reset();
    for (const k of ["nombre", "marca", "genero", "presentacion", "descripcion"]) form.elements[k].value = p[k] || "";
    extras = [...(p.imagenes || [])]; renderExtras();
    form.elements.precio.value = p.precio || "";
    form.elements.precioAnterior.value = +p.precioAnterior || "";
    form.elements.perfil.value = (p.perfil || []).join(", ");
    form.elements.notas.value = (p.notas || []).join(", ");
    form.elements.imagenUrl.value = /^https?:/.test(p.imagen) ? p.imagen : "";
    for (const k of ["agotado", "nuevo", "destacado"]) form.elements[k].checked = !!p[k];
    $("#imgPreview").src = p.imagen || "assets/logo-600.jpg";
    $("#imgPreview").dataset.src = p.imagen || "";
    $("#editErr").textContent = "";
    $("#editModal").classList.add("show"); $("#overlay").classList.add("show");
    document.body.style.overflow = "hidden";
    $("#editModal").scrollTop = 0;
    setTimeout(() => form.elements.nombre.focus(), 50);
  }
  function closeEditor(){ $("#editModal").classList.remove("show"); $("#overlay").classList.remove("show"); document.body.style.overflow = ""; }
  $("#newProduct").onclick = () => openEditor(-1);
  $("#cancelEdit").onclick = closeEditor;
  $("#overlay").onclick = closeEditor;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#editModal").classList.contains("show")) closeEditor(); });

  form.elements.imagenUrl.oninput = e => { const u = e.target.value.trim(); if (/^https?:\/\//.test(u)) { pendingImg = null; $("#imgPreview").src = u; $("#imgPreview").dataset.src = u; } };

  async function optimize(file){
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
      const max = 1000, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      let out = c.toDataURL("image/webp", .85);
      if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/jpeg", .85);
      return out;
    } finally { URL.revokeObjectURL(url); }
  }
  async function takeFile(file){
    if (!file || !file.type.startsWith("image/")) return toast("Ese archivo no es una imagen.");
    try {
      pendingImg = await optimize(file);
      $("#imgPreview").src = pendingImg; $("#imgPreview").dataset.src = pendingImg;
      form.elements.imagenUrl.value = "";
    } catch { toast("No se pudo leer la imagen."); }
  }
  $("#imgFile").onchange = e => takeFile(e.target.files[0]);

  // Fotos adicionales
  function renderExtras(){
    $("#extraGrid").innerHTML = extras.map((src, k) => `
      <div class="xph"><img src="${esc(src)}" alt="" onerror="this.onerror=null;this.src='assets/logo-600.jpg'">
        <button type="button" data-xdel="${k}" title="Quitar">✕</button>
        <button type="button" class="main-btn" data-xmain="${k}" title="Usar como foto principal">Principal</button>
      </div>`).join("");
  }
  $("#extraGrid").onclick = e => {
    const d = e.target.closest("[data-xdel]"), m = e.target.closest("[data-xmain]");
    if (d) { extras.splice(+d.dataset.xdel, 1); renderExtras(); }
    if (m) {
      const k = +m.dataset.xmain, cur = $("#imgPreview").dataset.src;
      $("#imgPreview").src = $("#imgPreview").dataset.src = extras[k];
      if (cur) extras[k] = cur; else extras.splice(k, 1);
      form.elements.imagenUrl.value = /^https?:/.test($("#imgPreview").dataset.src) ? $("#imgPreview").dataset.src : "";
      renderExtras();
    }
  };
  $("#extraFiles").onchange = async e => {
    const files = [...e.target.files].filter(x => x.type.startsWith("image/")).slice(0, 8);
    for (const file of files) { try { extras.push(await optimize(file)); } catch { toast("No se pudo leer una de las fotos."); } }
    renderExtras(); e.target.value = "";
  };
  const drop = $("#imgDrop");
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); takeFile(e.dataTransfer.files[0]); };

  form.onsubmit = e => {
    e.preventDefault();
    const f = form.elements;
    const precio = Math.round(+f.precio.value), antes = Math.round(+f.precioAnterior.value || 0);
    if (!f.nombre.value.trim()) return $("#editErr").textContent = "El nombre es obligatorio.";
    if (!(precio > 0)) return $("#editErr").textContent = "Escribe un precio válido.";
    if (antes && antes <= precio) return $("#editErr").textContent = "El precio anterior debe ser mayor que el precio actual (o déjalo vacío).";
    const old = editing >= 0 ? data.productos[editing] : null;
    const nombre = f.nombre.value.trim();
    const p = {
      id: old?.id || uniqueId(slug(nombre)),
      nombre, marca: f.marca.value.trim(), genero: f.genero.value, presentacion: f.presentacion.value.trim(),
      precio, precioAnterior: antes,
      imagen: $("#imgPreview").dataset.src || "",
      imagenes: extras.filter(Boolean),
      perfil: list(f.perfil.value), descripcion: f.descripcion.value.trim(), notas: list(f.notas.value),
      agotado: f.agotado.checked, nuevo: f.nuevo.checked, destacado: f.destacado.checked
    };
    if (!p.imagen && p.imagenes.length) p.imagen = p.imagenes.shift();
    if (old) data.productos[editing] = p; else data.productos.unshift(p);
    closeEditor(); renderProducts(); changed();
    toast(old ? "Producto actualizado. Recuerda publicar." : "Producto creado. Recuerda publicar.");
  };

  // ---------- Ajustes ----------
  const sform = $("#settingsForm");
  function renderSettings(){
    const a = data.ajustes;
    for (const el of sform.elements) {
      if (!el.name) continue;
      el.value = el.name === "formasPago" ? (a.formasPago || []).join(", ") : (a[el.name] ?? "");
    }
  }
  sform.oninput = e => {
    const el = e.target; if (!el.name) return;
    data.ajustes[el.name] = el.name === "formasPago" ? list(el.value)
      : el.name === "envioGratisDesde" ? Math.max(0, Math.round(+el.value || 0))
      : el.name === "whatsapp" ? el.value.replace(/\D/g, "")
      : el.value;
    changed();
  };

  // ---------- Testimonios / Preguntas ----------
  function renderTes(){
    $("#tesList").innerHTML = data.testimonios.length ? data.testimonios.map((t, i) => `
      <div class="rowbox a-form" data-i="${i}">
        <button class="ib danger" data-del title="Eliminar">🗑</button>
        <div class="grid3">
          <label>Nombre<input data-k="nombre" value="${esc(t.nombre)}"></label>
          <label>Ciudad<input data-k="ciudad" value="${esc(t.ciudad)}"></label>
          <label>Estrellas (1–5)<input data-k="estrellas" type="number" min="1" max="5" value="${esc(t.estrellas || 5)}"></label>
        </div>
        <label>Comentario<textarea data-k="texto" rows="2">${esc(t.texto)}</textarea></label>
      </div>`).join("") : `<div class="card-box" style="text-align:center;color:var(--muted)">Aún no hay testimonios.</div>`;
  }
  function renderFaq(){
    $("#faqList").innerHTML = data.preguntas.length ? data.preguntas.map((q, i) => `
      <div class="rowbox a-form" data-i="${i}">
        <button class="ib danger" data-del title="Eliminar">🗑</button>
        <label>Pregunta<input data-k="pregunta" value="${esc(q.pregunta)}" style="padding-right:48px"></label>
        <label>Respuesta<textarea data-k="respuesta" rows="3">${esc(q.respuesta)}</textarea></label>
      </div>`).join("") : `<div class="card-box" style="text-align:center;color:var(--muted)">Aún no hay preguntas.</div>`;
  }
  function bindRows(listEl, key, render){
    listEl.oninput = e => {
      const box = e.target.closest("[data-i]"), k = e.target.dataset.k; if (!box || !k) return;
      data[key][+box.dataset.i][k] = k === "estrellas" ? Math.max(1, Math.min(5, +e.target.value || 5)) : e.target.value;
      changed();
    };
    listEl.onclick = e => {
      if (!e.target.closest("[data-del]")) return;
      if (!confirm("¿Eliminar este elemento?")) return;
      data[key].splice(+e.target.closest("[data-i]").dataset.i, 1); render(); changed();
    };
  }
  bindRows($("#tesList"), "testimonios", renderTes);
  bindRows($("#faqList"), "preguntas", renderFaq);
  $("#addTes").onclick = () => { data.testimonios.push({ nombre:"", ciudad:"", estrellas:5, texto:"" }); renderTes(); changed(); };
  $("#addFaq").onclick = () => { data.preguntas.push({ pregunta:"", respuesta:"" }); renderFaq(); changed(); };

  // ---------- Cupones ----------
  function renderCup(){
    $("#cupList").innerHTML = data.cupones.length ? data.cupones.map((c, i) => `
      <div class="rowbox a-form" data-i="${i}">
        <button class="ib danger" data-del title="Eliminar">🗑</button>
        <div class="grid3" style="padding-right:44px">
          <label>Código<input data-k="codigo" value="${esc(c.codigo)}" placeholder="BIENVENIDA10" style="text-transform:uppercase"></label>
          <label>Tipo
            <select data-k="tipo">
              <option value="porcentaje" ${c.tipo !== "valor" ? "selected" : ""}>Porcentaje (%)</option>
              <option value="valor" ${c.tipo === "valor" ? "selected" : ""}>Valor fijo ($)</option>
            </select>
          </label>
          <label>Descuento<input data-k="valor" type="number" min="0" value="${esc(c.valor)}"></label>
        </div>
        <div class="grid2">
          <label>Compra mínima ($, 0 = sin mínimo)<input data-k="minimo" type="number" min="0" step="1000" value="${esc(c.minimo || 0)}"></label>
          <label class="switch"><input type="checkbox" data-k="activo" ${c.activo !== false ? "checked" : ""}> Activo</label>
        </div>
      </div>`).join("") : `<div class="card-box" style="text-align:center;color:var(--muted)">Aún no hay cupones. Crea uno, por ejemplo <b>BIENVENIDA10</b> con 10% de descuento.</div>`;
  }
  $("#cupList").onchange = $("#cupList").oninput = e => {
    const box = e.target.closest("[data-i]"), k = e.target.dataset.k; if (!box || !k) return;
    const c = data.cupones[+box.dataset.i];
    c[k] = k === "activo" ? e.target.checked
      : k === "codigo" ? e.target.value.toUpperCase().replace(/\s+/g, "")
      : (k === "valor" || k === "minimo") ? Math.max(0, +e.target.value || 0)
      : e.target.value;
    if (c.tipo === "porcentaje" && c.valor > 100) c.valor = 100;
    changed();
  };
  $("#cupList").onclick = e => {
    if (!e.target.closest("[data-del]")) return;
    if (!confirm("¿Eliminar este cupón?")) return;
    data.cupones.splice(+e.target.closest("[data-i]").dataset.i, 1); renderCup(); changed();
  };
  $("#addCup").onclick = () => { data.cupones.push({ codigo:"", tipo:"porcentaje", valor:10, minimo:0, activo:true }); renderCup(); changed(); };

  // ---------- Respaldo ----------
  $("#exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `tienda-respaldo-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#importFile").onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!Array.isArray(d.productos)) throw 0;
      if (!confirm(`Se cargarán ${d.productos.length} productos y reemplazarán lo actual en el panel. ¿Continuar?`)) return;
      data = normalize(d); renderAll(); toast("Respaldo cargado. Presiona Publicar para aplicarlo.");
    } catch { toast("Ese archivo no es un respaldo válido."); }
    e.target.value = "";
  };
  $("#discardBtn").onclick = () => {
    if (!dirty()) return toast("No hay cambios sin publicar.");
    if (!confirm("¿Descartar todos los cambios sin publicar?")) return;
    data = normalize(JSON.parse(published)); ls.del("jc_admin_draft"); renderAll(); toast("Cambios descartados");
  };

  // ---------- Publicar ----------
  $("#publishBtn").onclick = async () => {
    if (cfg.local) return;
    if (!dirty()) return toast("No hay cambios para publicar.");
    const bad = data.productos.find(p => !p.nombre || !(p.precio > 0));
    if (bad) return toast("Hay un producto sin nombre o sin precio. Revísalo antes de publicar.");
    try {
      const badCup = data.cupones.find(c => !c.codigo || !(+c.valor > 0));
      if (badCup) return toast("Hay un cupón sin código o sin descuento. Revísalo en la pestaña Cupones.");
      const isData = x => String(x).startsWith("data:");
      const pend = [];
      data.productos.forEach(p => {
        if (isData(p.imagen)) pend.push({ p, set: v => { p.imagen = v; }, src: p.imagen });
        (p.imagenes || []).forEach((x, j) => { if (isData(x)) pend.push({ p, set: v => { p.imagenes[j] = v; }, src: x }); });
      });
      for (let k = 0; k < pend.length; k++) {
        const { p, set, src } = pend[k];
        busy(`Subiendo fotos (${k + 1} de ${pend.length})…`);
        const [meta, b64] = src.split(",");
        const ext = meta.includes("webp") ? "webp" : meta.includes("png") ? "png" : "jpg";
        const path = `${IMG_DIR}/${p.id}-${Date.now().toString(36)}${k}.${ext}`;
        await putFile(path, b64, `Foto de ${p.nombre}`);
        set(path);
        ls.set("jc_admin_draft", data);
      }
      busy("Guardando productos…");
      const body = b64encode(new TextEncoder().encode(JSON.stringify(data, null, 2) + "\n"));
      let res;
      try { res = await putFile(DATA_PATH, body, "Actualizar tienda desde el panel", remoteSha); }
      catch (err) {
        if (err.status !== 409 && err.status !== 422) throw err;
        remoteSha = (await getFile(DATA_PATH)).sha;          // el archivo cambió en GitHub; reintenta con la versión actual
        res = await putFile(DATA_PATH, body, "Actualizar tienda desde el panel", remoteSha);
      }
      remoteSha = res.content.sha;
      published = JSON.stringify(data);
      ls.del("jc_admin_draft");
      renderProducts(); changed();
      busy(false);
      toast("¡Publicado! La tienda se actualiza en 1–2 minutos ✦");
    } catch (err) {
      console.error(err); busy(false);
      const ghMsg = err.message ? `\n\n(Mensaje de GitHub: ${err.status || ""} ${err.message})` : "";
      alert((err.status === 401
        ? "La clave (token) no es válida o ya venció. Presiona Salir (arriba a la derecha) y vuelve a entrar con tu clave nueva."
        : err.status === 403 || err.status === 404
        ? "Tu clave puede VER la tienda pero NO tiene permiso para GUARDAR cambios.\n\nArréglalo en GitHub → Settings → Developer settings → Fine-grained tokens → abre tu token → Edit:\n• Repository access: Only select repositories → jc-perfumeria\n• Permissions → Contents: Read and write\n\nPresiona Update y vuelve a presionar Publicar. Tus cambios siguen guardados aquí."
        : "No se pudo publicar. Tus cambios siguen guardados en este equipo; inténtalo de nuevo.") + ghMsg);
      renderProducts(); changed();
    }
  };

  // ---------- Utilidades ----------
  function busy(msg){ $("#progress").hidden = !msg; if (msg) $("#progressText").textContent = msg; }
  let tt;
  function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2400); }

  if (saved?.token) start(saved);
})();
