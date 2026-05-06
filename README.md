# SeeleScans Client

SPA vanilla (HTML + CSS + JS puro) que consume la SeeleScans API. Sin frameworks, sin bundler. ES modules nativos.

## Levantar el cliente

Asegurate primero que la API está corriendo en `http://localhost:3000`:

```bash
cd ../SeeleScans-API
docker compose up --build
```

Después, desde **esta** carpeta:

```bash
bunx serve
```

Abrí la URL que imprime `serve` (típicamente `http://localhost:3000` choca con la API; `serve` suele usar otro puerto como `5000` o `3000`. Si choca, pasale flag `-p 5500`).

Alternativas si no tenés Bun:
- `npx serve`
- `python -m http.server 5500`
- Cualquier servidor estático

> ⚠️ Abrir `index.html` con `file://` también funciona, pero la consola va a quejarse de CORS si los módulos hacen fetch desde `file:`. Usar un server estático es más seguro.

## Stack

- HTML semántico
- CSS puro con variables (sin Tailwind, sin SCSS)
- JS vanilla, ES modules
- Google Fonts: `Bangers` (display) + `Nunito Sans` (body)
- Hash routing (sin History API → no requiere config de servidor)

## Rutas (hash)

| Hash | Vista |
|---|---|
| `#/` | Home — listado paginado, search, sort, order, CSV |
| `#/manga/:id` | Detalle — cover, sinopsis, tags, capítulos |
| `#/read/:chapterId` | Reader — pages apiladas vertical |
| `#/new` | Form crear (solo admin) |
| `#/edit/:id` | Form editar (solo admin) |

Si admin OFF y el usuario navega a `#/new` o `#/edit/:id`, redirige a `#/` con un toast.

## Estructura

```
SeeleScans-Client/
├── index.html              ← scaffold con secciones, header, toast/loading containers
├── assets/
│   └── SeeleScans.png      ← logo
├── styles/
│   └── main.css            ← tokens (paleta, sombras, fuentes) + componentes + vistas
├── js/
│   ├── api.js              ← fetch wrappers + manejo de errores
│   ├── ui.js               ← DOM helpers, renderers, toast/loading/modal, CSV helpers
│   └── app.js              ← state + router + event delegation
└── README.md
```

### Separación de responsabilidades

- **`api.js`** no toca el DOM. Solo HTTP + parseo + errores.
- **`ui.js`** no llama a la API. Solo DOM puro a partir de datos.
- **`app.js`** orquesta: lee state, llama a `api`, le pasa el resultado a `ui`, escucha eventos.

Las vistas se acoplan vía atributos `data-action` en el DOM. `app.js` escucha en `#main` con event delegation y dispatcha según la acción.

## Features

| Feature | Detalle |
|---|---|
| Listado paginado | `meta` del backend, prev/next con disabled en bordes |
| Búsqueda | Input header con debounce 300ms + `AbortController` para cancelar requests anteriores |
| Sort | Select con `title`, `year`, `created_at`, `updated_at` |
| Order | Botón toggle `ASC ↑` / `DESC ↓` |
| Limit | Select 5 / 10 / 20 / 40 |
| Detalle | Cover sticky, meta grid, sinopsis con drop-cap, lista de capítulos |
| Capítulos | Badge "Sin páginas" en los que el reader detectó vacíos |
| Reader | Pages apiladas, max-width 820, animación stagger por página |
| Reader vacío | Mensaje "Aún no disponible" |
| Reader nav | Botones prev/next chapter (disabled en bordes) |
| Admin toggle | Persistido en `localStorage` (`seele.admin`) |
| Admin overlay | Botones Editar/Borrar aparecen on-hover sobre cards |
| Crear | Form con validación cliente-side antes de POST |
| Editar | Form prefilled con manga actual + tags |
| Borrar | Confirm modal antes de DELETE; redirige a home tras éxito |
| Validación cliente | Slug regex, título required, status enum, año 1900–2100, URL válida |
| CSV export | Página actual → CSV con BOM UTF-8, escape de comas/quotes/saltos |
| Errores | Toast bottom-right con mensaje del backend (`{ error: "..." }`) |
| Loading | Overlay con spinner orbital (4 puntos) durante fetches |
| Confirm modal | Modal centrado, Esc cierra, Enter confirma |
| Image fallback | SVG inline si `cover_url` o `image_url` falla |
| Accesibilidad | Skip link, `aria-live` toasts, focus visible con ring, `role` apropiados, `prefers-reduced-motion` |
| Responsive | Mobile (1 col) → tablet (2-3) → desktop (4+) |

## Estilo

Paleta y sombras siguen `seele_ui_style.md`. Tokens definidos como CSS variables en `:root` para fácil ajuste:

```css
--primary:    #1E3A8A;   /* azul deep */
--secondary:  #3B82F6;   /* azul medio */
--accent:     #93C5FD;   /* glow */
--bg:         #F8FAFC;
--card-bg:    #FFFFFF;
--text:       #1F2937;
--danger:     #EF4444;
--radius:     16px;
--font-body:    'Nunito Sans', system-ui, sans-serif;
--font-display: 'Bangers', 'Impact', system-ui, sans-serif;
```

Detalles distintivos:
- Halftone SVG fijo de fondo (textura manga sutil)
- Background de mesh radial multicapa
- Cards con stripe-accent en top que aparece on-hover
- Status badges como sellos de manga rotados −2°
- Drop cap en sinopsis con la display font
- Spinner de 4 puntos orbitando con colores de la paleta
- Reader pages con stagger animado (delay incremental)

## Uso del CSV

El botón **CSV** en el toolbar exporta los mangas de la **página actual visible** (no toda la DB). El archivo se llama `seele-mangas-pagina-N.csv`. Columnas: `id`, `slug`, `title`, `author`, `artist`, `status`, `year`, `tags`, `cover_url`. Tags se serializan como `slug1|slug2`.

Si querés exportar la DB completa, subí `limit=100` antes de exportar.

## Admin mode

El toggle del header activa controles de admin (botón "+ Nuevo", overlay edit/delete en cards, botones Editar/Borrar en el detalle). Se persiste en `localStorage` para que sobreviva reloads.

> No hay autenticación. Es un toggle visual; cualquier persona con acceso al cliente puede activarlo. La API tampoco protege rutas todavía.

## Modificar el endpoint

`BASE_URL` está hardcoded en `js/api.js`:

```js
export const BASE_URL = 'http://localhost:3000';
```

Cambiar ahí si la API corre en otro host/puerto.

## Smoke tests manuales

1. Abrir `#/` → ver grid con 6+ mangas
2. Buscar `naruto` → 1 resultado
3. Sort `title` + `ASC` → orden alfabético
4. Cambiar limit a 5 → ver paginación con 2+ páginas
5. Click una card → detalle con tags + capítulos
6. Click capítulo 1 → reader con pages
7. Click capítulo 2 → "Aún no disponible"
8. Volver al detalle → badge "Sin páginas" en cap 2
9. Toggle admin → "+ Nuevo" aparece
10. `#/new` → form, crear con slug inválido → toast warning + error inline
11. Crear válido → redirect a detalle del nuevo manga
12. Editar → cambios reflejados
13. Borrar → confirm modal → redirect a home
14. CSV → archivo descargado correctamente

## Errores comunes

- **CORS** → `BASE_URL` debe coincidir con el `Access-Control-Allow-Origin` del backend (la API responde `*`, así que cualquier origen funciona)
- **Imágenes rotas** → fallback SVG aparece automático; no rompe layout
- **`bunx serve` no instalado** → `npm i -g serve` o usar `python -m http.server`
