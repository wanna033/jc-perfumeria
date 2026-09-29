/* JC Perfumería — tienda. Los datos vienen de data/tienda.json (se editan desde admin.html). */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const money = n => "$" + Math.round(+n || 0).toLocaleString("es-CO");
  const store = {
    get(k, d){ try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const FALLBACK = "assets/logo-600.jpg";
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  let S = {}, P = [], CUPONES = [];
  const onSale = p => +p.precioAnterior > +p.precio;
  const pct = p => onSale(p) ? Math.round((1 - p.precio / p.precioAnterior) * 100) : 0;
  const waLink = msg => `https://wa.me/${(S.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
  const byId = id => P.find(p => p.id === id);
  const photos = p => { const a = [p.imagen, ...(p.imagenes || [])].filter(Boolean); return a.length ? a : [FALLBACK]; };
  const imgTag = (src, alt, extra = "", eager = false) => `<img src="${esc(src)}" alt="${esc(alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async" ${extra} onerror="this.onerror=null;this.src='${FALLBACK}'">`;

  // ---------- Carga de datos ----------
  async function load(){
    const preview = new URLSearchParams(location.search).has("preview") && store.get("jc_admin_draft", null);
    if (preview) {
      const bar = document.createElement("div");
      bar.textContent = "Vista previa del administrador — estos cambios aún no están publicados";
      bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:200;background:#c8102e;color:#fff;text-align:center;font-size:.8rem;padding:8px";
      document.body.appendChild(bar);
      return preview;
    }
    const r = await fetch("data/tienda.json?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("No se pudo cargar data/tienda.json");
    return r.json();
  }

  load().then(data => {
    S = data.ajustes || {};
    P = (data.productos || []).filter(p => p && p.id && p.nombre);
    CUPONES = (data.cupones || []).filter(c => c && c.codigo && c.activo !== false && +c.valor > 0);
    applySettings(data);
    buildFilters(); render(); renderRail(); renderRecent(); renderCart(); renderFavCount();
    seo();
    openFromHash();
  }).catch(err => {
    console.error(err);
    $("#grid").innerHTML = `<div class="empty">No pudimos cargar los productos. Recarga la página.</div>`;
    $("#count").textContent = "";
  });

  // ---------- Ajustes / textos ----------
  function applySettings(data){
    $$("[data-set]").forEach(el => { const v = S[el.dataset.set]; if (v) el.textContent = v; });
    document.title = `${S.nombre || "JC Perfumería"} | Tienda en línea`;
    if (S.email) $("#mailLink").href = "mailto:" + S.email;
    $$("[data-wa]").forEach(a => {
      a.href = waLink(`¡Hola, ${S.nombre}! Vengo de tu tienda en línea y quisiera más información.`);
      a.target = "_blank"; a.rel = "noopener";
    });
    if (S.anuncio) {
      $("#announce").hidden = false;
      document.body.classList.add("has-announce");
      const t = esc(S.anuncio);
      $("#announceTrack").innerHTML = `<span>${t}</span><span>${t}</span>`;
    }
    const soc = { instagram:"M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm5.5-1.5h.01",
                  facebook:"M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v7h4v-7h3l1-4h-4V8Z",
                  tiktok:"M16 3c.4 2.3 1.9 3.8 4 4v3.2c-1.5 0-2.9-.5-4-1.2V15a6 6 0 1 1-6-6v3.3A2.8 2.8 0 1 0 12.8 15V3H16Z" };
    $("#socials").innerHTML = Object.keys(soc).filter(k => S[k]).map(k =>
      `<a href="${esc(S[k])}" target="_blank" rel="noopener" aria-label="${k}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="${soc[k]}"/></svg></a>`).join("");
    const pay = Array.isArray(S.formasPago) ? S.formasPago.filter(Boolean) : [];
    $("#payMethod").hidden = !pay.length;
    $("#payMethod").innerHTML = `<option value="">Pago preferido</option>` + pay.map(x => `<option>${esc(x)}</option>`).join("");
    $("#couponForm").hidden = !CUPONES.length;

    $("#statCount").textContent = P.length;
    $("#statBrands").textContent = new Set(P.map(p => p.marca).filter(Boolean)).size;

    const tes = (data.testimonios || []).filter(t => t && t.texto);
    $("#testimonios").hidden = !tes.length;
    $("#reviews").innerHTML = tes.map(t => `
      <div class="review reveal">
        <div class="stars">${"★".repeat(Math.max(1, Math.min(5, +t.estrellas || 5)))}</div>
        <p>“${esc(t.texto)}”</p>
        <b>${esc(t.nombre)}</b>${t.ciudad ? `<small>${esc(t.ciudad)}</small>` : ""}
      </div>`).join("");

    const faq = (data.preguntas || []).filter(f => f && f.pregunta);
    $("#preguntas").hidden = !faq.length;
    $("#faq").innerHTML = faq.map(f => `<details class="reveal"><summary>${esc(f.pregunta)}</summary><p>${esc(f.respuesta)}</p></details>`).join("");
    observe();
  }

  // ---------- Filtros ----------
  const state = { view:"todos", genero:"", marca:"", perfil:"", q:"", sort:"", min:"", max:"" };
  let favs = new Set(store.get("jc_favs", []));
  // "Mujer" y "Hombre" incluyen también los unisex
  const genMatch = (p, g) => !g || p.genero === g || (g !== "Unisex" && p.genero === "Unisex");

  function chip(group, key, label, value, n){
    const b = document.createElement("button");
    b.className = "chip" + (state[key] === value ? " active" : "");
    b.innerHTML = `<span>${esc(label)}</span>${n !== undefined ? `<small>${n}</small>` : ""}`;
    b.onclick = () => { state[key] = (state[key] === value && key !== "view") ? "" : value; buildFilters(); render(); };
    group.appendChild(b);
  }
  function buildFilters(){
    const vg = $("#viewGroup"), gg = $("#genGroup"), bg = $("#brandGroup"), fg = $("#famGroup");
    vg.innerHTML = "<h4>Ver</h4>"; gg.innerHTML = "<h4>Para</h4>"; bg.innerHTML = "<h4>Marca</h4>"; fg.innerHTML = "<h4>Perfil olfativo</h4>";
    chip(vg, "view", "Todos", "todos", P.length);
    const sale = P.filter(onSale).length; if (sale) chip(vg, "view", "Ofertas", "ofertas", sale);
    const nuevos = P.filter(p => p.nuevo).length; if (nuevos) chip(vg, "view", "Nuevos", "nuevos", nuevos);
    chip(vg, "view", "♥ Favoritos", "favoritos", P.filter(p => favs.has(p.id)).length);
    const gens = ["Mujer", "Hombre", "Unisex"].filter(g => P.some(p => p.genero === g));
    gens.forEach(g => chip(gg, "genero", g, g, P.filter(p => genMatch(p, g)).length));
    gg.hidden = !gens.length;
    // En celular: accesos rápidos (ver + para quién) en una fila deslizable
    const qk = $("#quick"); qk.innerHTML = "";
    [...vg.querySelectorAll(".chip"), ...gg.querySelectorAll(".chip")].forEach(c => { const k = c.cloneNode(true); k.onclick = c.onclick; qk.appendChild(k); });
    const count = (arr) => arr.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
    const brands = count(P.map(p => p.marca).filter(Boolean));
    Object.keys(brands).sort().forEach(b => chip(bg, "marca", b, b, brands[b]));
    const fams = count(P.flatMap(p => p.perfil || []));
    Object.keys(fams).sort((a, b) => fams[b] - fams[a] || a.localeCompare(b)).forEach(f => chip(fg, "perfil", f, f, fams[f]));
    bg.hidden = !Object.keys(brands).length; fg.hidden = !Object.keys(fams).length;
  }

  function filtered(){
    const q = norm(state.q.trim());
    const min = +state.min || 0, max = +state.max || Infinity;
    let list = P.filter(p =>
      (state.view !== "ofertas" || onSale(p)) &&
      (state.view !== "nuevos" || p.nuevo) &&
      (state.view !== "favoritos" || favs.has(p.id)) &&
      genMatch(p, state.genero) &&
      (!state.marca || p.marca === state.marca) &&
      (!state.perfil || (p.perfil || []).includes(state.perfil)) &&
      p.precio >= min && p.precio <= max &&
      (!q || norm([p.nombre, p.marca, p.presentacion, p.genero, ...(p.notas || []), ...(p.perfil || [])].join(" ")).includes(q))
    );
    const s = state.sort;
    if (s === "az") list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    else if (s === "za") list.sort((a, b) => b.nombre.localeCompare(a.nombre));
    else if (s === "low") list.sort((a, b) => a.precio - b.precio);
    else if (s === "high") list.sort((a, b) => b.precio - a.precio);
    else if (s === "off") list.sort((a, b) => pct(b) - pct(a));
    else list.sort((a, b) => (!!a.agotado - !!b.agotado) || (!!b.destacado - !!a.destacado) || (!!b.nuevo - !!a.nuevo));
    return list;
  }

  const heart = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>`;
  const waIcon = s => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><use href="#i-wa"/></svg>`;
  const tags = p => `<div class="tagset">
      ${p.agotado ? `<span class="tag out">Agotado</span>` : ""}
      ${onSale(p) ? `<span class="tag off">-${pct(p)}%</span>` : ""}
      ${p.nuevo ? `<span class="tag new">Nuevo</span>` : ""}
      ${p.destacado ? `<span class="tag star">★ Top</span>` : ""}
    </div>`;
  const subline = p => esc([p.marca, p.genero].filter(Boolean).join(" · "));

  function cardHTML(p){
    const ph = photos(p);
    return `
      <article class="card${p.agotado ? " soldout" : ""}">
        ${tags(p)}
        <button class="fav${favs.has(p.id) ? " on" : ""}" data-fav="${esc(p.id)}" aria-label="Favorito">${heart}</button>
        <div class="img${ph[1] ? " has-alt" : ""}" data-open="${esc(p.id)}">${imgTag(ph[0], p.nombre)}${ph[1] ? imgTag(ph[1], "", 'class="alt"') : ""}</div>
        <div class="body">
          <span class="brandname">${subline(p)}</span>
          <h3 data-open="${esc(p.id)}">${esc(p.nombre)}</h3>
          <span class="tags">${esc((p.perfil || []).join(" • "))}</span>
          <div class="price"><b>${money(p.precio)}</b>${onSale(p) ? `<s>${money(p.precioAnterior)}</s>` : ""}</div>
          <div class="actions">
            ${p.agotado
              ? `<a class="btn btn-outline" target="_blank" rel="noopener" href="${waLink(`¡Hola! Quiero que me avisen cuando llegue ${p.nombre}.`)}">Avísame</a>`
              : `<button class="btn btn-gold" data-add="${esc(p.id)}">Añadir</button>`}
            <a class="btn btn-wa wa-mini" target="_blank" rel="noopener" aria-label="Pedir por WhatsApp"
               href="${waLink(`¡Hola, ${S.nombre}! Me interesa el perfume ${p.nombre} (${money(p.precio)}). ¿Está disponible?`)}">${waIcon(18)}</a>
          </div>
        </div>
      </article>`;
  }

  function render(){
    const list = filtered();
    const active = state.view !== "todos" || state.genero || state.marca || state.perfil || state.q || state.min || state.max;
    $("#clearFilters").hidden = !active;
    $("#count").textContent = list.length + (list.length === 1 ? " producto" : " productos");
    const nf = [state.marca, state.perfil, state.min || state.max].filter(Boolean).length;
    $("#filterN").textContent = nf ? `(${nf})` : "";
    $("#filterBtn").classList.toggle("on", !!nf);
    $("#sheetApply").textContent = `Ver ${list.length} ${list.length === 1 ? "producto" : "productos"}`;
    $("#seen").hidden = !list.length;
    $("#grid").innerHTML = list.length ? list.map(cardHTML).join("")
      : `<div class="empty">${state.view === "favoritos" ? "Aún no tienes favoritos. Toca el ♥ en un perfume para guardarlo." : "No encontramos perfumes con esos filtros."}</div>`;
  }

  // Tarjetas pequeñas para carruseles
  const miniCard = p => `
    <article class="mini" data-open="${esc(p.id)}">
      <div class="mini-img">${tags(p)}${imgTag(photos(p)[0], p.nombre)}</div>
      <div class="mini-body">
        <span class="brandname">${subline(p)}</span>
        <h3>${esc(p.nombre)}</h3>
        <div class="price"><b>${money(p.precio)}</b>${onSale(p) ? `<s>${money(p.precioAnterior)}</s>` : ""}</div>
      </div>
    </article>`;

  function renderRail(){
    let list = P.filter(p => p.destacado && !p.agotado), title = "Destacados", eyebrow = "Selección de la casa";
    if (list.length < 2) {
      list = P.filter(p => onSale(p) && !p.agotado).sort((a, b) => pct(b) - pct(a));
      title = "Mejores ofertas"; eyebrow = "Aprovecha";
    }
    $("#destacados").hidden = list.length < 2;
    $("#railTitle").textContent = title; $("#railEyebrow").textContent = eyebrow;
    $("#rail").innerHTML = list.slice(0, 10).map(miniCard).join("");
  }
  $$("[data-rail]").forEach(b => b.onclick = () => { const r = $("#rail"); r.scrollBy({ left: +b.dataset.rail * r.clientWidth * .8, behavior: "smooth" }); });

  let recent = store.get("jc_recent", []);
  function renderRecent(){
    const list = recent.map(byId).filter(Boolean);
    $("#recientes").hidden = !list.length;
    $("#recentRail").innerHTML = list.map(miniCard).join("");
  }

  document.addEventListener("click", e => {
    const t = e.target.closest("#rail [data-open], #recentRail [data-open], #quizBody [data-open]");
    if (t) openProduct(t.dataset.open);
  });
  $("#grid").addEventListener("click", e => {
    const fav = e.target.closest("[data-fav]"); if (fav) return toggleFav(fav.dataset.fav);
    const open = e.target.closest("[data-open]"); if (open) return openProduct(open.dataset.open);
    const add = e.target.closest("[data-add]"); if (add) addToCart(add.dataset.add, 1);
  });
  $("#sort").onchange = e => { state.sort = e.target.value; render(); };
  ["#q", "#q2"].forEach(sel => {
    $(sel).oninput = e => { state.q = e.target.value; $("#q").value = $("#q2").value = state.q; render(); };
    $(sel).onkeydown = e => { if (e.key === "Enter") { e.target.blur(); $("#productos").scrollIntoView(); } };
  });
  $("#pmin").oninput = e => { state.min = e.target.value; render(); };
  $("#pmax").oninput = e => { state.max = e.target.value; render(); };
  const clearAll = () => {
    Object.assign(state, { view:"todos", genero:"", marca:"", perfil:"", q:"", min:"", max:"" });
    $("#q").value = $("#q2").value = $("#pmin").value = $("#pmax").value = "";
    buildFilters(); render();
  };
  $("#clearFilters").onclick = clearAll;
  $("#sheetClear").onclick = clearAll;

  // Filtros como panel inferior en celular
  const filters = $("#filters");
  $("#filterBtn").onclick = () => { filters.classList.add("show"); $("#overlay").classList.add("show"); document.body.style.overflow = "hidden"; };
  const closeFilters = () => { filters.classList.remove("show"); $("#overlay").classList.remove("show"); document.body.style.overflow = ""; };
  $("#closeFilters").onclick = closeFilters;
  $("#sheetApply").onclick = () => { closeFilters(); $("#productos").scrollIntoView(); };

  // ---------- Favoritos ----------
  function toggleFav(id){
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set("jc_favs", [...favs]);
    renderFavCount(); buildFilters(); render();
    const m = $(`#modal [data-mfav]`); if (m) m.classList.toggle("on", favs.has(id));
    toast(favs.has(id) ? "Guardado en favoritos ♥" : "Quitado de favoritos");
  }
  function renderFavCount(){
    const n = P.filter(p => favs.has(p.id)).length;
    const b = $("#favCount"); b.textContent = n; b.dataset.n = n;
  }
  $("#openFavs").onclick = () => { state.view = "favoritos"; buildFilters(); render(); $("#productos").scrollIntoView(); };

  // ---------- Detalle de producto ----------
  const overlay = $("#overlay"), modal = $("#modal"), drawer = $("#drawer"), quiz = $("#quiz");
  function openProduct(id){
    const p = byId(id); if (!p) return;
    quiz.classList.remove("show");
    let qty = 1;
    const ph = photos(p);
    const rel = P.filter(x => x.id !== p.id)
      .map(x => ({ x, s: (x.marca === p.marca ? 2 : 0) + (x.genero && x.genero === p.genero ? 1 : 0) + (x.perfil || []).filter(f => (p.perfil || []).includes(f)).length }))
      .sort((a, b) => b.s - a.s).slice(0, 4).map(r => r.x);
    modal.innerHTML = `
      <div class="modal-grid">
        <div class="pic">
          ${tags(p)}
          <div class="gallery" id="gal">${ph.map((src, i) => `<div class="slide">${imgTag(src, i ? "" : p.nombre, i ? "" : 'id="mImg"', i === 0)}</div>`).join("")}</div>
          ${ph.length > 1 ? `
            <button class="gal-nav prev" data-g="-1" aria-label="Foto anterior">‹</button>
            <button class="gal-nav next" data-g="1" aria-label="Foto siguiente">›</button>
            <div class="dots">${ph.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}
        </div>
        <div class="info">
          <div class="meta">${esc([p.marca, p.presentacion, p.genero].filter(Boolean).join(" • "))}</div>
          <h3 class="gold-text">${esc(p.nombre)}</h3>
          <div class="price" style="padding:0"><b style="font-size:1.6rem">${money(p.precio)}</b>${onSale(p) ? `<s>${money(p.precioAnterior)}</s>` : ""}</div>
          ${onSale(p) ? `<span class="save">Ahorras ${money(p.precioAnterior - p.precio)}</span>` : ""}
          ${ph.length > 1 ? `<div class="thumbs">${ph.map((src, i) => `<button data-thumb="${i}" class="${i ? "" : "on"}">${imgTag(src, "")}</button>`).join("")}</div>` : ""}
          ${(p.perfil || []).length ? `<div class="label">Perfil olfativo</div><div class="desc">${esc(p.perfil.join(" • "))}</div>` : ""}
          ${p.descripcion ? `<div class="label">Descripción</div><p class="desc">${esc(p.descripcion)}</p>` : ""}
          ${(p.notas || []).length ? `<div class="label">Notas</div><div class="notes">${p.notas.map(n => `<span>${esc(n)}</span>`).join("")}</div>` : ""}
          <div class="buybar">
          ${p.agotado ? `
            <div class="row"><a class="btn btn-outline" target="_blank" rel="noopener" href="${waLink(`¡Hola! Quiero que me avisen cuando llegue ${p.nombre}.`)}">Agotado · Avísame cuando llegue</a></div>` : `
            <div class="row">
              <div class="qty"><button data-q="-1" aria-label="Menos">−</button><span id="mq">1</span><button data-q="1" aria-label="Más">+</button></div>
              <button class="btn btn-gold" id="mAdd">Añadir al carrito</button>
              <a class="btn btn-wa wa-buy" id="mWa" target="_blank" rel="noopener" aria-label="Comprar por WhatsApp">${waIcon(18)} <span>Comprar por WhatsApp</span></a>
            </div>`}
          </div>
          <div class="mini-actions">
            <button data-mfav class="${favs.has(p.id) ? "on" : ""}">${heart} <span>Favorito</span></button>
            <button id="mShare"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg> Compartir</button>
          </div>
        </div>
      </div>
      ${rel.length ? `<div class="related"><h4>También te puede gustar</h4><div class="related-row">
        ${rel.map(r => `<div class="rel" data-rel="${esc(r.id)}">${imgTag(photos(r)[0], "")}<div>${esc(r.nombre)}<b>${money(r.precio)}</b></div></div>`).join("")}
      </div></div>` : ""}
      <button class="close" id="mClose" aria-label="Cerrar">✕</button>`;

    // Galería deslizable
    const gal = $("#gal");
    const goTo = i => gal.scrollTo({ left: i * gal.clientWidth, behavior: "smooth" });
    const cur = () => Math.round(gal.scrollLeft / Math.max(1, gal.clientWidth));
    gal.addEventListener("scroll", () => {
      const i = cur();
      modal.querySelectorAll(".dots i").forEach((d, k) => d.classList.toggle("on", k === i));
      modal.querySelectorAll("[data-thumb]").forEach((d, k) => d.classList.toggle("on", k === i));
    }, { passive: true });
    modal.querySelectorAll("[data-g]").forEach(b => b.onclick = () => goTo(Math.max(0, Math.min(ph.length - 1, cur() + +b.dataset.g))));
    modal.querySelectorAll("[data-thumb]").forEach(b => b.onclick = () => goTo(+b.dataset.thumb));
    if (matchMedia("(hover:hover)").matches) gal.querySelectorAll("img").forEach(im => im.onclick = () => im.classList.toggle("zoom"));

    const setWa = () => { const a = $("#mWa"); if (a) a.href = waLink(`¡Hola, ${S.nombre}! Quiero comprar ${qty} x ${p.nombre} (${money(p.precio * qty)}). ¿Está disponible?`); };
    setWa();
    modal.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { qty = Math.max(1, qty + +b.dataset.q); $("#mq").textContent = qty; setWa(); });
    const add = $("#mAdd"); if (add) add.onclick = () => { addToCart(p.id, qty); closeAll(); };
    modal.querySelector("[data-mfav]").onclick = () => toggleFav(p.id);
    $("#mShare").onclick = async () => {
      const url = location.origin + location.pathname + "#p/" + p.id;
      try {
        if (navigator.share) await navigator.share({ title: p.nombre, text: `${p.nombre} en ${S.nombre}`, url });
        else { await navigator.clipboard.writeText(url); toast("Enlace copiado ✦"); }
      } catch {}
    };
    modal.querySelectorAll("[data-rel]").forEach(r => r.onclick = () => openProduct(r.dataset.rel));
    $("#mClose").onclick = closeAll;
    modal.scrollTop = 0;
    modal.classList.add("show"); overlay.classList.add("show");
    document.body.style.overflow = "hidden";
    history.replaceState(null, "", "#p/" + p.id);

    recent = [p.id, ...recent.filter(x => x !== p.id)].slice(0, 8);
    store.set("jc_recent", recent);
    renderRecent();
  }
  function closeAll(){
    const wasModal = modal.classList.contains("show");
    [modal, drawer, overlay, quiz, $("#filters")].forEach(el => el.classList.remove("show"));
    document.body.style.overflow = "";
    if (wasModal && location.hash.startsWith("#p/")) history.replaceState(null, "", location.pathname + location.search);
  }
  function openFromHash(){
    const m = location.hash.match(/^#p\/(.+)$/);
    if (m && byId(decodeURIComponent(m[1]))) openProduct(decodeURIComponent(m[1]));
  }
  window.addEventListener("hashchange", openFromHash);
  overlay.onclick = closeAll;
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });

  // ---------- Test de aroma ----------
  const AROMAS = {
    dulce:     { l: "Dulces", i: "🍯", k: ["vainilla", "dulce", "cremoso", "gourmand", "cacao", "caramelo", "miel", "golos"] },
    fresco:    { l: "Frescos", i: "🌊", k: ["citric", "acuatic", "fresc", "tropical", "marin", "bergamota", "limon", "mandarina"] },
    amaderado: { l: "Amaderados", i: "🪵", k: ["amaderado", "ambar", "oud", "madera", "sandalo", "vetiver", "cuero"] },
    floral:    { l: "Florales / frutales", i: "🌸", k: ["floral", "frutal", "flor", "jazmin", "rosa", "orquidea", "fruta"] },
    especiado: { l: "Especiados", i: "🌶️", k: ["especia", "pimienta", "canela", "nuez moscada", "cardamomo", "clavo"] }
  };
  const OCASION = {
    dia:   { l: "Día a día", i: "☀️", k: ["diario", "dia", "fresc", "calido", "versatil", "informal", "verano"] },
    noche: { l: "Noche y citas", i: "🌙", k: ["noche", "cita", "especial", "intens", "profund", "envolvente", "elegante"] },
    todo:  { l: "Para todo momento", i: "✨", k: [] }
  };
  const BUDGET = [
    { l: "Hasta $200.000", min: 0, max: 200000 },
    { l: "$200.000 – $300.000", min: 200000, max: 300000 },
    { l: "Más de $300.000", min: 300000, max: Infinity },
    { l: "No importa", min: 0, max: Infinity }
  ];
  const STEPS = [
    { key: "genero", q: "¿Para quién es el perfume?", opts: [
      { v: "Mujer", l: "Para mujer", i: "♀" }, { v: "Hombre", l: "Para hombre", i: "♂" }, { v: "", l: "Me da igual / unisex", i: "⚥" } ] },
    { key: "aromas", multi: true, q: "¿Qué aromas te gustan?", hint: "Puedes elegir varios",
      opts: Object.entries(AROMAS).map(([v, a]) => ({ v, l: a.l, i: a.i })) },
    { key: "ocasion", q: "¿Para cuándo lo quieres usar?", opts: Object.entries(OCASION).map(([v, a]) => ({ v, l: a.l, i: a.i })) },
    { key: "budget", q: "¿Cuál es tu presupuesto?", opts: BUDGET.map((b, i) => ({ v: String(i), l: b.l, i: "💰" })) }
  ];
  let qs = { step: 0, a: { aromas: [] } };

  function openQuiz(){
    closeAll();
    qs = { step: 0, a: { aromas: [] } };
    renderQuiz();
    quiz.classList.add("show"); overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  }
  $$("[data-quiz]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); openQuiz(); }));
  $("#quizClose").onclick = closeAll;

  function renderQuiz(){
    const body = $("#quizBody");
    $("#quizBar").style.width = Math.min(100, qs.step / STEPS.length * 100) + "%";
    if (qs.step >= STEPS.length) return renderResults();
    const st = STEPS[qs.step], val = qs.a[st.key];
    body.innerHTML = `
      <div class="quiz-step">
        <small class="quiz-count">Pregunta ${qs.step + 1} de ${STEPS.length}</small>
        <h4>${st.q}</h4>${st.hint ? `<p class="quiz-hint">${st.hint}</p>` : ""}
        <div class="quiz-opts">
          ${st.opts.map(o => `<button class="qopt${(st.multi ? val.includes(o.v) : val === o.v) ? " on" : ""}" data-v="${esc(o.v)}"><span class="qi">${o.i}</span>${esc(o.l)}</button>`).join("")}
        </div>
        <div class="quiz-actions">
          ${qs.step ? `<button class="btn btn-outline" id="qBack">Atrás</button>` : "<span></span>"}
          ${st.multi ? `<button class="btn btn-gold" id="qNext" ${val.length ? "" : "disabled"}>Siguiente</button>` : ""}
        </div>
      </div>`;
    body.querySelectorAll(".qopt").forEach(b => b.onclick = () => {
      if (st.multi) {
        const arr = qs.a[st.key];
        arr.includes(b.dataset.v) ? arr.splice(arr.indexOf(b.dataset.v), 1) : arr.push(b.dataset.v);
        renderQuiz();
      } else { qs.a[st.key] = b.dataset.v; qs.step++; renderQuiz(); }
    });
    const back = $("#qBack"); if (back) back.onclick = () => { qs.step--; renderQuiz(); };
    const next = $("#qNext"); if (next) next.onclick = () => { qs.step++; renderQuiz(); };
  }

  function scoreProduct(p, a){
    const text = norm([...(p.perfil || []), ...(p.notas || []), p.descripcion, p.nombre].join(" "));
    const hits = k => k.filter(w => text.includes(w)).length;
    let score = 0; const why = [];
    for (const key of a.aromas) {
      const h = Math.min(3, hits(AROMAS[key].k));
      if (h) { score += 10 * h; why.push(`aromas ${AROMAS[key].l.toLowerCase()}`); }
    }
    if (a.genero) {
      if (p.genero === a.genero) { score += 15; why.push(`pensado para ${a.genero.toLowerCase()}`); }
      else if (p.genero === "Unisex") { score += 8; why.push("unisex"); }
      else if (p.genero) score -= 40;
    }
    const oc = OCASION[a.ocasion];
    if (oc && oc.k.length && hits(oc.k)) { score += 12; why.push(a.ocasion === "noche" ? "ideal para la noche" : "perfecto para el día a día"); }
    const b = BUDGET[+a.budget];
    if (b) { if (p.precio >= b.min && p.precio <= b.max) { score += 10; if (b.max !== Infinity || b.min) why.push("dentro de tu presupuesto"); } else score -= 12; }
    if (p.agotado) score -= 60;
    if (onSale(p)) score += 2;
    return { p, score, why };
  }

  function renderResults(){
    const a = qs.a;
    const res = P.map(p => scoreProduct(p, a)).sort((x, y) => y.score - x.score).filter(r => r.score > 0).slice(0, 3);
    const summary = [a.genero || "Unisex / me da igual", a.aromas.map(k => AROMAS[k].l).join(", "), OCASION[a.ocasion]?.l, BUDGET[+a.budget]?.l].filter(Boolean);
    const waMsg = `¡Hola, ${S.nombre}! Hice el test de aroma en la tienda:\n• Para: ${summary[0]}\n• Aromas: ${summary[1]}\n• Ocasión: ${summary[2]}\n• Presupuesto: ${summary[3]}` +
      (res.length ? `\n\nMe recomendó: ${res.map(r => r.p.nombre).join(", ")}. ¿Me asesoras?` : "\n\n¿Qué me recomiendas?");
    $("#quizBody").innerHTML = `
      <div class="quiz-step">
        <h4>${res.length ? "Tus perfumes ideales ✦" : "Te ayudamos personalmente"}</h4>
        <p class="quiz-hint">${res.length ? "Según tus respuestas, estos son los que más van contigo:" : "No encontramos una coincidencia exacta en el catálogo actual, pero te podemos recomendar algo por WhatsApp."}</p>
        <div class="quiz-results">
          ${res.map((r, i) => `
            <div class="qres">
              <div class="qres-img" data-open="${esc(r.p.id)}">${imgTag(photos(r.p)[0], r.p.nombre, "", true)}</div>
              <div class="qres-body">
                ${i === 0 ? `<span class="best">★ Tu mejor opción</span>` : ""}
                <b data-open="${esc(r.p.id)}">${esc(r.p.nombre)}</b>
                <small>${subline(r.p)}</small>
                ${r.why.length ? `<small class="why">Por: ${esc([...new Set(r.why)].slice(0, 3).join(" · "))}</small>` : ""}
                <div class="price"><b>${money(r.p.precio)}</b>${onSale(r.p) ? `<s>${money(r.p.precioAnterior)}</s>` : ""}</div>
                <div class="qres-actions">
                  ${r.p.agotado ? "" : `<button class="btn btn-gold btn-xs" data-qadd="${esc(r.p.id)}">Añadir</button>`}
                  <button class="btn btn-outline btn-xs" data-open="${esc(r.p.id)}">Ver</button>
                </div>
              </div>
            </div>`).join("")}
        </div>
        <div class="quiz-actions">
          <button class="btn btn-outline" id="qRestart">Repetir test</button>
          <a class="btn btn-wa" target="_blank" rel="noopener" href="${waLink(waMsg)}">${waIcon(16)} Asesoría</a>
        </div>
      </div>`;
    $("#quizBar").style.width = "100%";
    $("#qRestart").onclick = () => { qs = { step: 0, a: { aromas: [] } }; renderQuiz(); };
    $$("#quizBody [data-qadd]").forEach(b => b.onclick = () => addToCart(b.dataset.qadd, 1));
  }

  // ---------- Carrito y cupones ----------
  let cart = store.get("jc_cart", {});
  let coupon = store.get("jc_coupon", "");
  const saveCart = () => store.set("jc_cart", cart);
  function addToCart(id, n){
    const p = byId(id); if (!p || p.agotado) return;
    cart[id] = (cart[id] || 0) + n; saveCart(); renderCart();
    toast(`${p.nombre} añadido al carrito ✦`);
    const b = $("#openCart"); b.animate([{ transform:"scale(1)" }, { transform:"scale(1.25)" }, { transform:"scale(1)" }], { duration: 400 });
  }
  function cartItems(){ return Object.keys(cart).filter(id => cart[id] > 0 && byId(id) && !byId(id).agotado); }
  const findCoupon = code => CUPONES.find(c => norm(c.codigo) === norm(code));
  function totals(){
    const ids = cartItems();
    const sub = ids.reduce((s, id) => s + cart[id] * byId(id).precio, 0);
    const c = coupon && findCoupon(coupon);
    let disc = 0, note = "";
    if (c) {
      if (sub < (+c.minimo || 0)) note = `Este cupón aplica en compras desde ${money(c.minimo)}`;
      else disc = c.tipo === "valor" ? Math.min(sub, +c.valor) : Math.round(sub * Math.min(100, +c.valor) / 100);
    }
    return { ids, sub, disc, total: sub - disc, c, note };
  }
  function renderCart(){
    const { ids, sub, disc, total, c, note } = totals();
    const count = ids.reduce((s, id) => s + cart[id], 0);
    const b = $("#cartCount"); b.textContent = count; b.dataset.n = count;
    $("#cartTotal").textContent = money(total);
    $("#subtotalRow").hidden = $("#discountRow").hidden = !disc;
    $("#cartSubtotal").textContent = money(sub);
    $("#cartDiscount").textContent = "−" + money(disc);
    if (c) $("#discountLabel").textContent = `Cupón ${c.codigo.toUpperCase()}`;
    const ok = $("#couponOk");
    ok.hidden = !c || !count;
    if (c) ok.innerHTML = `${note ? `⚠ ${esc(note)}` : `✓ Cupón <b>${esc(c.codigo.toUpperCase())}</b> aplicado`} <button class="rm" id="couponRemove">Quitar</button>`;
    const rmc = $("#couponRemove"); if (rmc) rmc.onclick = () => { coupon = ""; store.set("jc_coupon", ""); renderCart(); };
    $("#couponForm").hidden = !CUPONES.length || !count || !!c;
    $("#checkoutForm").hidden = !count;
    const free = +S.envioGratisDesde || 0, ship = $("#ship");
    ship.hidden = !free || !count;
    if (free && count) {
      const left = free - total;
      ship.innerHTML = (left > 0 ? `Te faltan <b>${money(left)}</b> para envío gratis` : `<b>¡Tienes envío gratis!</b>`) +
        `<div class="bar"><i style="width:${Math.min(100, total / free * 100)}%"></i></div>`;
    }
    $("#cartBody").innerHTML = ids.length ? ids.map(id => {
      const p = byId(id);
      return `<div class="line">
        ${imgTag(photos(p)[0], "")}
        <div><h6>${esc(p.nombre)}</h6><small>${money(p.precio)} c/u</small><br><button class="rm" data-rm="${esc(id)}">Quitar</button></div>
        <div class="qty"><button data-dec="${esc(id)}" aria-label="Menos">−</button><span>${cart[id]}</span><button data-inc="${esc(id)}" aria-label="Más">+</button></div>
      </div>`;
    }).join("") : `<div style="color:var(--muted);text-align:center;margin-top:40px">Tu carrito está vacío.<br><br><button class="btn btn-outline" id="goShop">Ver productos</button></div>`;
    const g = $("#goShop"); if (g) g.onclick = () => { closeAll(); $("#productos").scrollIntoView(); };
  }
  $("#couponForm").onsubmit = e => {
    e.preventDefault();
    const code = $("#couponInput").value.trim(); if (!code) return;
    if (findCoupon(code)) { coupon = code; store.set("jc_coupon", code); $("#couponInput").value = ""; renderCart(); toast("¡Cupón aplicado! ✦"); }
    else toast("Ese cupón no es válido");
  };
  $("#cartBody").addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.inc) cart[t.dataset.inc]++;
    if (t.dataset.dec) cart[t.dataset.dec] = Math.max(0, cart[t.dataset.dec] - 1);
    if (t.dataset.rm) delete cart[t.dataset.rm];
    saveCart(); renderCart();
  });
  $("#openCart").onclick = () => { renderCart(); quiz.classList.remove("show"); drawer.classList.add("show"); overlay.classList.add("show"); document.body.style.overflow = "hidden"; };
  $("#closeCart").onclick = closeAll;

  const form = $("#checkoutForm");
  const saved = store.get("jc_cliente", {});
  ["nombre", "ciudad", "direccion"].forEach(k => { if (saved[k]) form.elements[k].value = saved[k]; });
  form.onsubmit = e => {
    e.preventDefault();
    const { ids, sub, disc, total, c } = totals(); if (!ids.length) return;
    const f = Object.fromEntries(new FormData(form));
    store.set("jc_cliente", { nombre: f.nombre, ciudad: f.ciudad, direccion: f.direccion });
    const lines = ids.map(id => { const p = byId(id); return `• ${cart[id]} x ${p.nombre} — ${money(p.precio * cart[id])}`; });
    const msg = [
      `¡Hola, ${S.nombre}! Quiero hacer este pedido:`, "", ...lines, "",
      ...(disc ? [`Subtotal: ${money(sub)}`, `Cupón ${c.codigo.toUpperCase()}: −${money(disc)}`] : []),
      `*Total: ${money(total)}*`, "",
      `Nombre: ${f.nombre}`, `Ciudad: ${f.ciudad}`,
      ...(f.direccion ? [`Dirección: ${f.direccion}`] : []),
      ...(f.pago ? [`Pago preferido: ${f.pago}`] : []),
      ...(f.nota ? [`Nota: ${f.nota}`] : []),
      "", "¿Me confirmas disponibilidad y envío?"
    ].join("\n");
    window.open(waLink(msg), "_blank", "noopener");
  };

  // ---------- Google: datos estructurados de productos ----------
  function seo(){
    const base = location.origin + location.pathname.replace(/index\.html$/, "");
    const abs = u => /^https?:/.test(u) ? u : base + u;
    const ld = {
      "@context": "https://schema.org", "@type": "Store", name: S.nombre, url: base,
      image: abs("assets/og.jpg"), logo: abs("assets/icon-512.png"),
      telephone: S.whatsapp ? "+" + S.whatsapp : undefined, email: S.email || undefined, priceRange: "$$",
      makesOffer: P.map(p => ({
        "@type": "Offer", price: p.precio, priceCurrency: "COP",
        availability: "https://schema.org/" + (p.agotado ? "OutOfStock" : "InStock"),
        url: base + "#p/" + p.id,
        itemOffered: { "@type": "Product", name: p.nombre, brand: p.marca ? { "@type": "Brand", name: p.marca } : undefined, image: photos(p).map(abs), description: p.descripcion || undefined }
      }))
    };
    const s = document.createElement("script"); s.type = "application/ld+json"; s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }

  // ---------- Instalar como app ----------
  let installEvt = null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $$("[data-install]").forEach(a => a.hidden = false); });
  if (isIOS && !standalone) $$("[data-install]").forEach(a => a.hidden = false);
  $$("[data-install]").forEach(a => a.onclick = async e => {
    e.preventDefault();
    if (installEvt) { installEvt.prompt(); await installEvt.userChoice; installEvt = null; $$("[data-install]").forEach(x => x.hidden = true); }
    else if (isIOS) alert("Para instalar la app: toca el botón Compartir (el cuadro con la flecha) y luego “Agregar a inicio”.");
  });
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

  // ---------- Video de fondo ----------
  const video = $("#heroVideo");
  $("#videoToggle").onclick = () => {
    if (video.paused) { video.play(); $("#videoIcon").innerHTML = `<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>`; }
    else { video.pause(); $("#videoIcon").innerHTML = `<path d="M8 5v14l11-7z"/>`; }
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { video.pause(); $("#videoIcon").innerHTML = `<path d="M8 5v14l11-7z"/>`; }

  // ---------- Detalles de interfaz ----------
  let tt;
  function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 1900); }
  $("#burger").onclick = () => { $("#menu").classList.toggle("open"); $("#header").classList.add("solid"); };
  $$("#menu a").forEach(a => a.addEventListener("click", () => $("#menu").classList.remove("open")));
  $("#goCats").addEventListener("click", () => setTimeout(() => {
    if (matchMedia("(max-width:980px)").matches) $("#filterBtn").click(); else $("#filters").scrollIntoView({ block: "center" });
  }, 60));
  $("#yr").textContent = new Date().getFullYear();
  $("#totop").onclick = () => scrollTo({ top: 0 });
  const onScroll = () => {
    $("#header").classList.toggle("solid", scrollY > 40 || $("#menu").classList.contains("open"));
    $("#totop").classList.toggle("show", scrollY > 900);
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  let io;
  function observe(){
    if (!("IntersectionObserver" in window)) return $$(".reveal").forEach(el => el.classList.add("in"));
    io = io || new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: .12 });
    $$(".reveal:not(.in)").forEach(el => io.observe(el));
  }
  observe();
  setTimeout(() => $$(".reveal").forEach(el => el.classList.add("in")), 2500);
})();
