# 💰 Control de Gastos

![Node](https://img.shields.io/badge/node-%3E%3D18-5FA611?style=flat-square&logo=node.js)
![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)
![Licencia](https://img.shields.io/badge/licencia-ISC-blue?style=flat-square)
![Sin build](https://img.shields.io/badge/build-ninguno-lightgrey?style=flat-square)

Aplicación web para llevar el control de gastos personales: registras cada gasto, lo
consultas con filtros, vigilas el presupuesto mensual y ves en qué te lo gastas.

Sin base de datos: todo se persiste en un único archivo JSON. Sin framework de
frontend, sin paso de compilación. Se clona, se ejecuta y funciona.

---

## ✨ Funcionalidades

| | |
|---|---|
| 💸 **CRUD de gastos** | Alta, edición y borrado desde modales propios, más vaciado masivo con doble confirmación |
| 🗂️ **Categorías propias** | Añade y borra categorías; las 9 por defecto están protegidas |
| 📊 **Resumen financiero** | Gasto total, gasto promedio, mayor imputación y presupuesto restante |
| 🎯 **Presupuesto mensual** | Límite por mes con barra de progreso y nota si es un límite propio |
| 🔎 **Filtros combinables** | Texto y categoría, con periodo de **mes o rango** (excluyentes), orden y tamaño de página |
| 🏷️ **Filtros activos** | Cada filtro puesto sale como etiqueta y se quita por separado, sin vaciar el resto |
| 📄 **Paginación** | 10 / 25 / 50 por página, con total y navegación |
| ⬇️ **Exportar CSV / JSON** | Un único botón con elección de formato; descarga lo que hay filtrado, sin paginar |
| ⬆️ **Importar CSV** | Acepta CSV en español (`33,80`) o inglés (`33.80`), detecta duplicados y crea categorías nuevas |
| 🥧 **Gráficos** | Distribución por categoría (tarta) y evolución mensual (barras) con Chart.js |
| 🌗 **Tema claro / oscuro** | Toggle con preferencia guardada en `localStorage` |
| 💶 **Métodos de pago** | Efectivo, Tarjeta, Transferencia y Domiciliación |
| 🖥️ **Interfaz centrada** | Todo el texto, los botones y los bloques alineados al centro en escritorio y móvil |
| 🛟 **Recuperación ante fallos** | Copias de seguridad, guardado atómico y apartado de ficheros corruptos |

---

## 🛠️ Stack

- **Backend:** Node.js + Express 5 (`server.js`, sin dependencias más allá de Express)
- **Frontend:** HTML + CSS + JavaScript plano (`public/`)
- **Gráficos:** Chart.js 4.4.1 vía CDN
- **Persistencia:** archivo JSON con `fs/promises`
- **Base de datos:** ninguna

---

## 🚀 Puesta en marcha

```bash
npm install
npm start          # arranca en http://localhost:3000
```

Para desarrollo con recarga automática:

```bash
npm run dev        # node --watch server.js
```

### Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |
| `DATOS_PATH` | `data/datos.json` | Ubicación del archivo de datos (lo usan las pruebas para no tocar los reales) |

```bash
PORT=3001 npm start
```

---

## 🔌 API

Todas las rutas devuelven JSON. Los filtros de `GET /api/gastos` y `GET /api/resumen`
aceptan `texto`, `categoria`, `mes` (`YYYY-MM`), `desde`, `hasta`, `orden`
(`fecha` \| `importe`), `page` y `limit`.

> **Ojo con el periodo.** El API sigue aplicando `mes`, `desde` y `hasta` de forma
> independiente: si se envían varios a la vez se combinan con AND, y el resultado es
> un recorte que no se anuncia. Por eso la interfaz es la que garantiza que solo
> salga uno — el cliente elige entre el modo *Mes* y el modo *Rango* y envía
> únicamente los parámetros de ese modo. Es una decisión de diseño del frontend, no
> una restricción del servidor.

**Gastos**

| Método | Ruta | |
|---|---|---|
| `GET` | `/api/gastos` | Listado filtrado, ordenado y paginado |
| `GET` | `/api/gastos/:id` | Un gasto concreto |
| `POST` | `/api/gastos` | Crear |
| `PUT` | `/api/gastos/:id` | Actualizar |
| `DELETE` | `/api/gastos/:id` | Borrar uno |
| `DELETE` | `/api/gastos` | Vaciar todo |

**Catálogos y presupuesto**

| Método | Ruta | |
|---|---|---|
| `GET` | `/api/categorias` | Categorías y cuáles son por defecto |
| `POST` | `/api/categorias` | Crear categoría |
| `DELETE` | `/api/categorias/:nombre` | Borrar categoría |
| `GET` | `/api/metodos-pago` | Métodos de pago disponibles |
| `GET` | `/api/presupuesto` | Límite y gastado del mes |
| `PUT` | `/api/presupuesto` | Ajustar límite |
| `GET` | `/api/resumen` | Totales y series para los gráficos |

**Importación / exportación**

| Método | Ruta | |
|---|---|---|
| `GET` | `/api/gastos/exportar.csv` | CSV de lo filtrado |
| `GET` | `/api/gastos/exportar.json` | JSON de lo filtrado |
| `POST` | `/api/gastos/importar` | Importar CSV con informe de errores |

---

## 🗂️ Estructura

```
controlGastos/
├── server.js          API Express, persistencia y toda la lógica
├── public/
│   ├── index.html     Interfaz
│   ├── script.js      Lógica del cliente
│   └── styles.css     Estilos (tema claro y oscuro)
├── data/
│   └── datos.json     Tus gastos (no se versiona)
└── package.json
```

---

## 🖥️ Interfaz

### Modales de edición y borrado

Editar y borrar ya no happen en el formulario lateral ni con `window.confirm`:

- `#modalEditar` — `<dialog>` nativo con el gasto precargado. Guarda con `PUT
  /api/gastos/:id`; Escape o la × cierran sin tocar nada.
- `#modalBorrar` — pide confirmación y llama a `DELETE /api/gastos/:id`.
- El formulario lateral queda **solo para altas**. Antes se reutilizaba para editar,
  lo que obligaba a esconder el botón de guardar y a enseñar un "Cancelar" según el
  estado; al separarlo, la ruta de alta no tiene ramas que puedan desincronizarse.

### Barra de filtros

Reorganizada en dos grupos ("¿Qué buscas?" y "¿Qué periodo?"), con etiquetas
visibles en vez de depender de `title`, que no se lee de forma fiable:

- Selector **Mes / Rango** excluyente: solo se envía un tipo de periodo.
- **Etiquetas de filtros activos**: cada filtro puesto aparece como *chip* con su
  ×, para quitarlo sin tocar el resto.
- Al cambiar un filtro se reinicia a la página 1 y se repinta la tabla.

### Barra de vista y acciones

Separada en dos grupos con nombre —"Ver" (orden y tamaño de página) y las acciones de
datos— en lugar de una fila larga y sin títulos. Exportar pasa a ser un desplegable
con CSV y JSON. `Vaciar todo` queda separado del resto por una línea divisoria, para
que no quede a un clic de distancia de las acciones inofensivas.

### Centrado general

Todo el contenido sale centrado: texto, botones, formularios, tabla y modales.

Dos detalles que no son obvios y que conviene no deshacer:

- **El texto de los campos hay que centrarlo a mano.** El navegador aplica
  `text-align: start` a `input`, `select` y `textarea`, y eso gana a la herencia de
  `body { text-align: center }`. Sin fijarlo explícitamente, los campos se quedan
  pegados a la izquierda mientras todo lo demás sale centrado.
- **Las columnas del grid usan `minmax(0, 1fr)`, nunca `1fr`.** `1fr` a secas es
  `minmax(auto, 1fr)`, y su mínimo es el *min-content* del panel: los inputs nunca
  bajan de su tamaño intrínseco, el panel no encoge y la página desborda en móvil.

---

## 💾 Cómo se guardan los datos

- El archivo se carga en memoria al arrancar y se reescribe en cada cambio.
- **Guardado atómico:** se escribe en `datos.json.tmp` y se renombra, para que un
  corte de luz no deje el archivo a medias.
- **Copias de seguridad:** al arrancar se guarda una copia del contenido anterior en
  `data/copias/`, deduplicando si no ha cambiado y poda a las 10 últimas.
- **Si el JSON llega corrupto:** se aparta como `datos.json.corrupto` y se regenera
  con datos de ejemplo, en lugar de dejar la aplicación inservible.
- **Si no existe:** se crea con dos gastos de ejemplo la primera vez.

---

## 🔒 Datos personales

`data/datos.json` está en `.gitignore` a propósito: contiene tu información real y
no debe subirse al repositorio. La aplicación se regenera sola con datos de ejemplo,
así que el repo queda limpio sin perder funcionalidad.

---

## 📄 Licencia

ISC.
