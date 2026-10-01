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
| 💸 **CRUD de gastos** | Alta, edición, borrado individual y vaciado masivo con doble confirmación |
| 🗂️ **Categorías propias** | Añade y borra categorías; las 9 por defecto están protegidas |
| 📊 **Resumen financiero** | Gasto total, gasto promedio, mayor imputación y presupuesto restante |
| 🎯 **Presupuesto mensual** | Límite por mes con barra de progreso y nota si es un límite propio |
| 🔎 **Filtros combinables** | Texto, categoría, mes, rango de fechas, orden y tamaño de página |
| 📄 **Paginación** | 10 / 25 / 50 por página, con total y navegación |
| ⬇️ **Exportar CSV / JSON** | Exporta exactamente lo que hay filtrado en pantalla, sin paginar |
| ⬆️ **Importar CSV** | Acepta CSV en español (`33,80`) o inglés (`33.80`), detecta duplicados y crea categorías nuevas |
| 🥧 **Gráficos** | Distribución por categoría (tarta) y evolución mensual (barras) con Chart.js |
| 🌗 **Tema claro / oscuro** | Toggle con preferencia guardada en `localStorage` |
| 💶 **Métodos de pago** | Efectivo, Tarjeta, Transferencia y Domiciliación |
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
