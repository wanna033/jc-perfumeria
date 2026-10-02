/* Panel de administrador en este computador.
   Abre admin.html en http://localhost:5174 y publica los cambios con Git,
   usando la sesión de GitHub que ya está guardada en este equipo (no necesita clave). */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile, exec } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PORT = 5174;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webmanifest": "application/manifest+json" };

const git = (...args) => new Promise((resolve, reject) =>
  execFile("git", args, { cwd: ROOT, windowsHide: true, maxBuffer: 1 << 24 }, (err, stdout, stderr) =>
    err ? reject(new Error((stderr || stdout || err.message).trim())) : resolve(stdout.trim())));

let cola = Promise.resolve();                 // una publicación a la vez
const enCola = fn => (cola = cola.then(fn, fn));

// Una ruta es válida solo si queda dentro de la tienda y no toca carpetas ocultas (.git, .claude…)
const dentro = f => { const rel = path.relative(ROOT, f); return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !rel.split(path.sep).some(s => s.startsWith(".")); };

async function sincronizar(){
  try { await git("pull", "--rebase", "--autostash", "-q", "origin", "main"); return true; }
  catch (e) {
    console.log("Aviso: no se pudo traer la última versión de GitHub:", e.message);
    await git("rebase", "--abort").catch(() => {});
    return false;
  }
}

// Commits guardados en el equipo que todavía no llegaron a GitHub (por ejemplo, si se cortó el internet)
const pendientes = async () => +(await git("rev-list", "--count", "origin/main..HEAD").catch(() => "0")) > 0;

async function subir(){
  try { await git("push", "-q", "origin", "main"); }
  catch (e) {                                 // alguien publicó antes: se integra y se reintenta
    if (!(await sincronizar())) throw new Error("No se pudo conectar con GitHub. Revisa el internet. (" + e.message + ")");
    await git("push", "-q", "origin", "main");
  }
}

async function publicar({ archivos = [], datos }){
  if (typeof datos !== "string") throw new Error("Faltan los datos de la tienda.");
  JSON.parse(datos);                          // valida que sea JSON
  await sincronizar();
  const escritos = [];
  for (const a of archivos) {
    const ruta = path.normalize(String(a.ruta || ""));
    const destino = path.join(ROOT, ruta);
    if (!ruta.startsWith(path.join("assets", "productos") + path.sep) || !dentro(destino) || !/\.(webp|png|jpe?g)$/i.test(ruta))
      throw new Error("Ruta de imagen no permitida: " + a.ruta);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, Buffer.from(String(a.base64 || ""), "base64"));
    escritos.push(ruta);
  }
  fs.writeFileSync(path.join(ROOT, "data", "tienda.json"), datos);
  await git("add", "--", "data/tienda.json", ...escritos);
  const cambios = await git("diff", "--cached", "--name-only");
  if (cambios) await git("commit", "-q", "-m", "Actualizar tienda desde el panel del computador");
  else if (!(await pendientes())) return "No había cambios nuevos para publicar.";
  await subir();                              // también sube lo que quedó pendiente de un intento anterior
  return "Publicado";
}

function leerCuerpo(req, limite = 80 * 1024 * 1024){
  return new Promise((resolve, reject) => {
    let n = 0; const partes = [];
    req.on("data", c => { n += c.length; if (n > limite) { reject(new Error("Demasiado grande")); req.destroy(); } else partes.push(c); });
    req.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
    req.on("error", reject);
  });
}
const responder = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };

const HOSTS = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];

http.createServer(async (req, res) => {
  // Solo responde si se abrió como localhost (evita que otra página se haga pasar por el panel)
  if (!HOSTS.includes(req.headers.host)) { res.writeHead(403); return res.end("No permitido"); }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  // Solo acepta peticiones de esta misma página (evita que otros sitios usen el panel)
  if (url.pathname.startsWith("/api/")) {
    const origen = req.headers.origin;
    if (origen && origen !== `http://localhost:${PORT}` && origen !== `http://127.0.0.1:${PORT}`) return responder(res, 403, { ok: false, error: "Origen no permitido" });
    try {
      if (url.pathname === "/api/estado" && req.method === "GET") {
        const sincronizado = await enCola(async () => {
          const ok = await sincronizar();
          if (ok && await pendientes()) await subir().then(() => console.log("Se subieron cambios que habían quedado pendientes.")).catch(() => {});
          return ok;
        });
        return responder(res, 200, { ok: true, modo: "computador", sincronizado });
      }
      if (url.pathname === "/api/publicar" && req.method === "POST") {
        if (!String(req.headers["content-type"] || "").includes("application/json")) return responder(res, 415, { ok: false, error: "Formato no válido" });
        const cuerpo = JSON.parse(await leerCuerpo(req));
        const mensaje = await enCola(() => publicar(cuerpo));
        console.log(new Date().toLocaleTimeString(), "→", mensaje);
        return responder(res, 200, { ok: true, mensaje });
      }
      return responder(res, 404, { ok: false, error: "No encontrado" });
    } catch (e) {
      console.log("Error:", e.message);
      return responder(res, 500, { ok: false, error: e.message });
    }
  }
  // Archivos de la tienda
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end("Dirección no válida"); }
  if (p === "/") p = "/admin.html";
  const f = path.join(ROOT, p);
  if (!dentro(f) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("No encontrado"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("  Panel de JC Perfumería listo en http://localhost:" + PORT + "/admin.html");
  console.log("  Deja esta ventana abierta mientras usas el panel. Ciérrala cuando termines.");
  console.log("");
  if (process.platform === "win32" && !process.env.NO_ABRIR) exec(`start "" "http://localhost:${PORT}/admin.html"`);
}).on("error", e => {
  if (e.code === "EADDRINUSE") {
    console.log("El panel ya está abierto. Abriendo el navegador…");
    if (process.platform === "win32" && !process.env.NO_ABRIR) exec(`start "" "http://localhost:${PORT}/admin.html"`);
    setTimeout(() => process.exit(0), 1500);
  } else { console.error(e); }
});
