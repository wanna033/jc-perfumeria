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
  const FALLBACK = "assets/logo.png";

  let S = {}, P = [];
  const onSale = p => +p.precioAnterior > +p.precio;
  const pct = p => onSale(p) ? Math.round((1 - p.precio / p.precioAnterior) * 100) : 0;
  const waLink = msg => `https://wa.me/${(S.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
  const byId = id => P.find(p => p.id === id);

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
    applySettings(data);
    buildFilters(); render(); renderCart(); renderFavCount();
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
  const state = { view:"todos", marca:"", perfil:"", q:"", sort:"", min:"", max:"" };
  let favs = new Set(store.get("jc_favs", []));

  function chip(group, key, label, value, n){
    const b = document.createElement("button");
    b.className = "chip" + (state[key] === value ? " active" : "");
    b.innerHTML = `<span>${esc(label)}</span>${n !== undefined ? `<small>${n}</small>` : ""}`;
    b.onclick = () => { state[key] = (state[key] === value && key !== "view") ? "" : value; buildFilters(); render(); };
    group.appendChild(b);
  }
  function buildFilters(){
    const vg = $("#viewGroup"), bg = $("#brandGroup"), fg = $("#famGroup");
    vg.innerHTML = "<h4>Ver</h4>"; bg.innerHTML = "<h4>Marca</h4>"; fg.innerHTML = "<h4>Perfil olfativo</h4>";
    chip(vg, "view", "Todos", "todos", P.length);
    const sale = P.filter(onSale).length; if (sale) chip(vg, "view", "Ofertas", "ofertas", sale);
    const nuevos = P.filter(p => p.nuevo).length; if (nuevos) chip(vg, "view", "Nuevos", "nuevos", nuevos);
    chip(vg, "view", "♥ Favoritos", "favoritos", P.filter(p => favs.has(p.id)).length);
    // En celular, los mismos accesos rápidos van en una fila deslizable sobre los productos
    const qk = $("#quick"); qk.innerHTML = "";
    [...vg.querySelectorAll(".chip")].forEach(c => { const k = c.cloneNode(true); k.onclick = c.onclick; qk.appendChild(k); });
    const count = (arr) => arr.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
    const brands = count(P.map(p => p.marca).filter(Boolean));
    Object.keys(brands).sort().forEach(b => chip(bg, "marca", b, b, brands[b]));
    const fams = count(P.flatMap(p => p.perfil || []));
    Object.keys(fams).sort((a, b) => fams[b] - fams[a] || a.localeCompare(b)).forEach(f => chip(fg, "perfil", f, f, fams[f]));
    bg.hidden = !Object.keys(brands).length; fg.hidden = !Object.keys(fams).length;
  }

  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function filtered(){
    const q = norm(state.q.trim());
    const min = +state.min || 0, max = +state.max || Infinity;
    let list = P.filter(p =>
      (state.view !== "ofertas" || onSale(p)) &&
      (state.view !== "nuevos" || p.nuevo) &&
      (state.view !== "favoritos" || favs.has(p.id)) &&
      (!state.marca || p.marca === state.marca) &&
      (!state.perfil || (p.perfil || []).includes(state.perfil)) &&
      p.precio >= min && p.precio <= max &&
      (!q || norm([p.nombre, p.marca, p.presentacion, ...(p.notas || []), ...(p.perfil || [])].join(" ")).includes(q))
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

  function render(){
    const list = filtered();
    const active = state.view !== "todos" || state.marca || state.perfil || state.q || state.min || state.max;
    $("#clearFilters").hidden = !active;
    $("#count").textContent = list.length + (list.length === 1 ? " producto" : " productos");
    const nf = [state.marca, state.perfil, state.min || state.max].filter(Boolean).length;
    $("#filterN").textContent = nf ? `(${nf})` : "";
    $("#filterBtn").classList.toggle("on", !!nf);
    $("#sheetApply").textContent = `Ver ${list.length} ${list.length === 1 ? "producto" : "productos"}`;
    $("#seen").hidden = !list.length;
    $("#grid").innerHTML = list.length ? list.map(p => `
      <article class="card${p.agotado ? " soldout" : ""}">
        ${tags(p)}
        <button class="fav${favs.has(p.id) ? " on" : ""}" data-fav="${esc(p.id)}" aria-label="Favorito">${heart}</button>
        <div class="img" data-open="${esc(p.id)}"><img src="${esc(p.imagen || FALLBACK)}" alt="${esc(p.nombre)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK}'"></div>
        <div class="body">
          <span class="brandname">${esc(p.marca)}</span>
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
      </article>`).join("")
      : `<div class="empty">${state.view === "favoritos" ? "Aún no tienes favoritos. Toca el ♥ en un perfume para guardarlo." : "No encontramos perfumes con esos filtros."}</div>`;
  }

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
    Object.assign(state, { view:"todos", marca:"", perfil:"", q:"", min:"", max:"" });
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
  const overlay = $("#overlay"), modal = $("#modal"), drawer = $("#drawer");
  function openProduct(id){
    const p = byId(id); if (!p) return;
    let qty = 1;
    const rel = P.filter(x => x.id !== p.id)
      .map(x => ({ x, s: (x.marca === p.marca ? 2 : 0) + (x.perfil || []).filter(f => (p.perfil || []).includes(f)).length }))
      .sort((a, b) => b.s - a.s).slice(0, 4).map(r => r.x);
    modal.innerHTML = `
      <div class="modal-grid">
        <div class="pic">${tags(p)}<img id="mImg" src="${esc(p.imagen || FALLBACK)}" alt="${esc(p.nombre)}" onerror="this.onerror=null;this.src='${FALLBACK}'"></div>
        <div class="info">
          <div class="meta">${esc([p.marca, p.presentacion].filter(Boolean).join(" • "))}</div>
          <h3 class="gold-text">${esc(p.nombre)}</h3>
          <div class="price" style="padding:0"><b style="font-size:1.6rem">${money(p.precio)}</b>${onSale(p) ? `<s>${money(p.precioAnterior)}</s>` : ""}</div>
          ${onSale(p) ? `<span class="save">Ahorras ${money(p.precioAnterior - p.precio)}</span>` : ""}
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
        ${rel.map(r => `<div class="rel" data-rel="${esc(r.id)}"><img src="${esc(r.imagen || FALLBACK)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK}'"><div>${esc(r.nombre)}<b>${money(r.precio)}</b></div></div>`).join("")}
      </div></div>` : ""}
      <button class="close" id="mClose" aria-label="Cerrar">✕</button>`;

    const setWa = () => { const a = $("#mWa"); if (a) a.href = waLink(`¡Hola, ${S.nombre}! Quiero comprar ${qty} x ${p.nombre} (${money(p.precio * qty)}). ¿Está disponible?`); };
    setWa();
    modal.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { qty = Math.max(1, qty + +b.dataset.q); $("#mq").textContent = qty; setWa(); });
    const add = $("#mAdd"); if (add) add.onclick = () => { addToCart(p.id, qty); closeAll(); };
    modal.querySelector("[data-mfav]").onclick = () => toggleFav(p.id);
    $("#mImg").onclick = e => e.target.classList.toggle("zoom");
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
  }
  function closeAll(){
    const wasModal = modal.classList.contains("show");
    modal.classList.remove("show"); drawer.classList.remove("show"); overlay.classList.remove("show"); $("#filters").classList.remove("show");
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

  // ---------- Carrito ----------
  let cart = store.get("jc_cart", {});
  const saveCart = () => store.set("jc_cart", cart);
  function addToCart(id, n){
    const p = byId(id); if (!p || p.agotado) return;
    cart[id] = (cart[id] || 0) + n; saveCart(); renderCart();
    toast(`${p.nombre} añadido al carrito ✦`);
    const b = $("#openCart"); b.animate([{ transform:"scale(1)" }, { transform:"scale(1.25)" }, { transform:"scale(1)" }], { duration: 400 });
  }
  function cartItems(){ return Object.keys(cart).filter(id => cart[id] > 0 && byId(id) && !byId(id).agotado); }
  function renderCart(){
    const ids = cartItems();
    const count = ids.reduce((s, id) => s + cart[id], 0);
    const total = ids.reduce((s, id) => s + cart[id] * byId(id).precio, 0);
    const b = $("#cartCount"); b.textContent = count; b.dataset.n = count;
    $("#cartTotal").textContent = money(total);
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
        <img src="${esc(p.imagen || FALLBACK)}" alt="" onerror="this.onerror=null;this.src='${FALLBACK}'">
        <div><h6>${esc(p.nombre)}</h6><small>${money(p.precio)} c/u</small><br><button class="rm" data-rm="${esc(id)}">Quitar</button></div>
        <div class="qty"><button data-dec="${esc(id)}" aria-label="Menos">−</button><span>${cart[id]}</span><button data-inc="${esc(id)}" aria-label="Más">+</button></div>
      </div>`;
    }).join("") : `<div style="color:var(--muted);text-align:center;margin-top:40px">Tu carrito está vacío.<br><br><button class="btn btn-outline" id="goShop">Ver productos</button></div>`;
    const g = $("#goShop"); if (g) g.onclick = () => { closeAll(); $("#productos").scrollIntoView(); };
  }
  $("#cartBody").addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.inc) cart[t.dataset.inc]++;
    if (t.dataset.dec) cart[t.dataset.dec] = Math.max(0, cart[t.dataset.dec] - 1);
    if (t.dataset.rm) delete cart[t.dataset.rm];
    saveCart(); renderCart();
  });
  $("#openCart").onclick = () => { renderCart(); drawer.classList.add("show"); overlay.classList.add("show"); document.body.style.overflow = "hidden"; };
  $("#closeCart").onclick = closeAll;

  const form = $("#checkoutForm");
  const saved = store.get("jc_cliente", {});
  ["nombre", "ciudad", "direccion"].forEach(k => { if (saved[k]) form.elements[k].value = saved[k]; });
  form.onsubmit = e => {
    e.preventDefault();
    const ids = cartItems(); if (!ids.length) return;
    const f = Object.fromEntries(new FormData(form));
    store.set("jc_cliente", { nombre: f.nombre, ciudad: f.ciudad, direccion: f.direccion });
    let total = 0;
    const lines = ids.map(id => { const p = byId(id), sub = p.precio * cart[id]; total += sub; return `• ${cart[id]} x ${p.nombre} — ${money(sub)}`; });
    const msg = [
      `¡Hola, ${S.nombre}! Quiero hacer este pedido:`, "", ...lines, "", `*Total: ${money(total)}*`, "",
      `Nombre: ${f.nombre}`, `Ciudad: ${f.ciudad}`,
      ...(f.direccion ? [`Dirección: ${f.direccion}`] : []),
      ...(f.pago ? [`Pago preferido: ${f.pago}`] : []),
      ...(f.nota ? [`Nota: ${f.nota}`] : []),
      "", "¿Me confirmas disponibilidad y envío?"
    ].join("\n");
    window.open(waLink(msg), "_blank", "noopener");
  };

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
  $("#goCats").addEventListener("click", () => setTimeout(() => $("#filters").scrollIntoView({ block: "center" }), 50));
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
