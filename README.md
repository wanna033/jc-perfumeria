# JC Perfumería — Tienda en línea

Tienda web de **JC Perfumería** (fragancias árabes). Los pedidos llegan por WhatsApp.

- **Tienda:** `index.html`
- **Panel de administrador:** `admin.html` (agregar, editar o quitar productos; cambiar textos, WhatsApp, redes, testimonios y preguntas frecuentes)

## Cómo usar el panel de administrador

1. Abre `https://<tu-usuario>.github.io/jc-perfumeria/admin.html`.
2. La primera vez crea tu clave de acceso (token) en GitHub:
   - Ve a **GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token**
     (enlace directo: https://github.com/settings/personal-access-tokens/new).
   - **Repository access:** *Only select repositories* → `jc-perfumeria`.
   - **Permissions → Contents:** *Read and write*.
   - Crea el token y pégalo en el panel. Marca "Recordar en este equipo" solo en tu propio computador o celular.
3. Agrega o edita productos, cambia lo que quieras y presiona **Vista previa** para verlo antes.
4. Presiona **Publicar**. La tienda se actualiza sola en 1–2 minutos.

> El panel es público pero no sirve sin tu token: solo quien tenga el token puede guardar cambios. No compartas el token.

## Qué puedes manejar desde el panel

- **Productos:** nombre, marca, para quién (Mujer / Hombre / Unisex), precio y precio anterior, foto principal y más fotos, perfil olfativo, notas, descripción, y las marcas Destacado, Nuevo y Agotado.
- **Cupones:** códigos de descuento en porcentaje o valor fijo, con compra mínima opcional. Se pueden activar y desactivar.
- **Ajustes:** WhatsApp, anuncio superior, textos de portada y "Nosotros", envío gratis, formas de pago y redes sociales.
- **Testimonios, preguntas frecuentes y copia de seguridad.**

> Si al publicar aparece "no tiene permiso para guardar cambios", edita tu token en GitHub y pon
> **Repository access → Only select repositories → jc-perfumeria** y **Contents → Read and write**.

## Estructura

| Carpeta / archivo | Qué es |
|---|---|
| `data/tienda.json` | Productos, textos y ajustes (lo edita el panel) |
| `assets/` | Logo, banner, video y fotos de productos (`assets/productos/`) |
| `css/tienda.css` | Estilos |
| `js/tienda.js` | Funciones de la tienda (carrito, favoritos, filtros, WhatsApp) |
| `js/admin.js` | Panel de administrador |
