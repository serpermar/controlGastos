const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const app = express();
const PORT = process.env.PORT || 3000;

// Archivo donde se guardan los datos entre reinicios del servidor.
// Se puede mover con DATOS_PATH, que es lo que usan las pruebas para no tocar
// los datos de verdad.
const RUTA_DATOS = process.env.DATOS_PATH
    ? path.resolve(process.env.DATOS_PATH)
    : path.join(__dirname, 'data', 'datos.json');

// Temporal del guardado atómico y copia del archivo cuando llega corrupto
const RUTA_DATOS_TMP = `${RUTA_DATOS}.tmp`;
const RUTA_DATOS_CORRUPTO = `${RUTA_DATOS}.corrupto`;

// Copias de seguridad que se crean al arrancar con los datos que ya había
const RUTA_COPIAS = path.join(path.dirname(RUTA_DATOS), 'copias');
const MAX_COPIAS = 10;

// Cuántos errores de una importación se devuelven como máximo (el resto se cuenta)
const MAX_ERRORES_INFORME = 50;

// Middlewares para procesar JSON y formularios
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde el directorio 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- CATÁLOGOS POR DEFECTO (sin base de datos) ---

// Categorías ajustadas según datos_2.json
const CATEGORIAS_POR_DEFECTO = [
    "Alimentación",
    "Transporte",
    "Alojamiento",
    "Ocio",
    "Compras",
    "Salud",
    "Educación",
    "Servicios",
    "Otros"
];

// Métodos de pago habitual de un gasto
const METODOS_PAGO = ["Efectivo", "Tarjeta", "Transferencia", "Domiciliación"];

// Presupuesto mensual inicial ajustado a 100
const PRESUPUESTO_INICIAL = 100;

// Paginación por defecto y máximo permitido por petición
const LIMITE_POR_DEFECTO = 10;
const LIMITE_MAXIMO = 200;

// --- DATOS EN MEMORIA ---
// Se cargan de data/datos.json al arrancar y se vuelven a guardar en cada cambio.
let gastos = [];
let categorias = [...CATEGORIAS_POR_DEFECTO];
let presupuestoPorDefecto = PRESUPUESTO_INICIAL;
let presupuestosPorMes = {};
let siguienteId = 1;

// --- PERSISTENCIA EN ARCHIVO JSON (fs/promises) ---

async function cargarDatos() {
    let guardados = null;

    try {
        guardados = JSON.parse(await fs.readFile(RUTA_DATOS, 'utf8'));
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.error(`${RUTA_DATOS} no contiene JSON válido: ${error.message}`);
            await apartarDatosCorruptos();
        } else if (error.code === 'ENOENT') {
            console.log('No hay archivo de datos todavía: se crean los datos de ejemplo.');
        } else {
            console.error(`No se pudo leer ${RUTA_DATOS}: ${error.message}. Se usan los datos de ejemplo.`);
        }

        gastos = gastosEjemplo();
        siguienteId = calcularSiguienteId(gastos, 0);
        await guardarDatos();
        return;
    }

    // Antes de tocar nada se guarda una copia: si al sanear hay que descartar
    // algún registro, el contenido original sigue disponible en data/copias
    await respaldarDatos();

    categorias = Array.isArray(guardados.categorias) && guardados.categorias.length
        ? guardados.categorias.filter(nombre => typeof nombre === 'string' && nombre.trim())
        : [...CATEGORIAS_POR_DEFECTO];

    // Se admite el formato antiguo (una sola cifra) y el nuevo (límite por mes)
    presupuestoPorDefecto = Number.isFinite(guardados.presupuesto)
        ? guardados.presupuesto
        : PRESUPUESTO_INICIAL;

    presupuestosPorMes = {};
    if (guardados.presupuestos && typeof guardados.presupuestos === 'object') {
        for (const [mes, limite] of Object.entries(guardados.presupuestos)) {
            if (esMesValido(mes) && Number.isFinite(limite) && limite > 0) {
                presupuestosPorMes[mes] = limite;
            }
        }
    }

    // El archivo es la base de datos y además puede editarse a mano, así que
    // nada de lo que venga de ahí se trusts: se descarta lo que no sea válido
    // en lugar de dejar que reviente una petición más adelante
    const { gastos: limpios, descartados } = sanearGastos(
        Array.isArray(guardados.gastos) ? guardados.gastos : []
    );

    gastos = limpios;

    if (descartados.length) {
        console.warn(`Se han descartado ${descartados.length} registro(s) inválidos de ${RUTA_DATOS}:`);
        for (const registro of descartados) {
            console.warn(`  ${registro.id !== null ? `#${registro.id}` : 'sin id'}: ${registro.motivo}`);
        }
        console.warn('Se pueden recuperar en data/copias.');
    }

    siguienteId = calcularSiguienteId(gastos, guardados.siguienteId);

    console.log(`Datos cargados desde ${RUTA_DATOS} (${gastos.length} gastos)`);
}

// El siguiente id nunca puede ser menor que el mayor id que ya existe: si no,
// el primer gasto nuevo se pisaría con uno que ya está guardado
function calcularSiguienteId(lista, guardado) {
    const maximo = lista.reduce((mayor, g) => Math.max(mayor, Math.trunc(Number(g.id)) || 0), 0);
    return Math.max(Math.trunc(Number(guardado)) || 0, maximo + 1, 1);
}

// Copia el archivo actual a data/copias y se queda solo con las más recientes
async function respaldarDatos() {
    try {
        const contenido = await fs.readFile(RUTA_DATOS);
        await fs.mkdir(RUTA_COPIAS, { recursive: true });

        const archivos = (await fs.readdir(RUTA_COPIAS))
            .filter(nombre => /^datos-\d{14}\.json$/.test(nombre))
            .sort();

        // Si la copia más reciente es idéntica no se crea otra. Con --watch el
        // servidor reinicia en cada guardado y sin esto se llenan de copias
        // iguales del mismo archivo.
        if (archivos.length) {
            const reciente = archivos[archivos.length - 1];
            const anterior = await fs.readFile(path.join(RUTA_COPIAS, reciente));
            if (contenido.equals(anterior)) {
                console.log(`Los datos no han cambiado: se reutiliza la copia ${reciente}`);
                return;
            }
        }

        const marca = new Date().toISOString().slice(0, 19).replace(/\D/g, '');
        const nombre = `datos-${marca}.json`;
        await fs.writeFile(path.join(RUTA_COPIAS, nombre), contenido);

        const todos = [...archivos, nombre].sort();
        for (const sobra of todos.slice(0, Math.max(0, todos.length - MAX_COPIAS))) {
            await fs.unlink(path.join(RUTA_COPIAS, sobra));
        }

        console.log(`Copia de seguridad creada en data/copias/${nombre} (${Math.min(todos.length, MAX_COPIAS)} de ${MAX_COPIAS})`);
    } catch (error) {
        console.error(`No se pudo crear la copia de seguridad: ${error.message}`);
    }
}

async function apartarDatosCorruptos() {
    try {
        await fs.rename(RUTA_DATOS, RUTA_DATOS_CORRUPTO);
        console.log(`Se ha conservado el archivo anterior en ${RUTA_DATOS_CORRUPTO}`);
    } catch (error) {
        console.error(`No se pudo apartar el archivo dañado: ${error.message}`);
    }
}

let cadenaGuardado = Promise.resolve();

function guardarDatos() {
    cadenaGuardado = cadenaGuardado.then(async () => {
        try {
            await fs.mkdir(path.dirname(RUTA_DATOS), { recursive: true });
            const contenido = {
                version: 2,
                gastos,
                categorias,
                presupuesto: presupuestoPorDefecto,
                presupuestos: presupuestosPorMes,
                siguienteId
            };

            await fs.writeFile(RUTA_DATOS_TMP, JSON.stringify(contenido, null, 2), 'utf8');
            await fs.rename(RUTA_DATOS_TMP, RUTA_DATOS);
        } catch (error) {
            console.error('No se pudo guardar el archivo de datos:', error.message);
        }
    });
    return cadenaGuardado;
}

// --- UTILIDADES ---

function clave(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function aNumero(valor) {
    if (valor === '' || valor === null || valor === undefined) return null;
    const num = Number(valor);
    return Number.isFinite(num) ? num : null;
}

function esFechaValida(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const d = new Date(Date.UTC(anio, mes - 1, dia));
    return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

function hoy() {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
}

function mesActual() {
    return hoy().slice(0, 7);
}

function esMesValido(mes) {
    if (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return false;
    return Number(mes.slice(0, 4)) >= 1000 && Number(mes.slice(0, 4)) <= 9999;
}

// --- SANEADO DE DATOS AL CARGAR ---

// El archivo es la base de datos y también puede editarse a mano. Al leerlo se
// descarta lo que no cumpla el formato en lugar de guardarlo y que reviente una
// petición más adelante (por ejemplo, un gasto sin fecha rompe la suma del mes).
function sanearGastos(lista) {
    const saneados = [];
    const descartados = [];
    const idsUsados = new Set();

    for (const bruto of lista) {
        if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) {
            descartados.push({ id: null, motivo: 'el registro no es un objeto' });
            continue;
        }

        const motivos = [];
        const id = Math.trunc(Number(bruto.id));

        if (!Number.isInteger(id) || id < 1) motivos.push(`id inválido (${JSON.stringify(bruto.id)})`);
        else if (idsUsados.has(id)) motivos.push(`id repetido (${id})`);

        const concepto = typeof bruto.concepto === 'string' ? bruto.concepto.trim() : '';
        if (!concepto) motivos.push('concepto vacío');
        else if (concepto.length > 80) motivos.push('concepto de más de 80 caracteres');

        const importe = aNumero(bruto.importe);
        if (importe === null) motivos.push(`importe no numérico (${JSON.stringify(bruto.importe)})`);
        else if (importe <= 0) motivos.push('importe menor o igual que 0');
        else if (importe > 100000) motivos.push('importe mayor que 100.000');

        const fecha = typeof bruto.fecha === 'string' ? bruto.fecha.trim() : '';
        if (!esFechaValida(fecha)) motivos.push(`fecha inválida (${JSON.stringify(bruto.fecha)})`);

        const categoria = categoriaConocida(bruto.categoria);
        if (!categoria) motivos.push(`categoría desconocida (${JSON.stringify(bruto.categoria)})`);

        const metodoPago = metodoConocido(bruto.metodoPago);
        if (!metodoPago) motivos.push(`método de pago desconocido (${JSON.stringify(bruto.metodoPago)})`);

        if (motivos.length) {
            descartados.push({ id: Number.isInteger(id) ? id : null, motivo: motivos.join('. ') });
            continue;
        }

        idsUsados.add(id);
        saneados.push({
            id,
            concepto,
            categoria,
            importe: Number(importe.toFixed(2)),
            metodoPago,
            fecha,
            notas: typeof bruto.notas === 'string' ? bruto.notas.trim().slice(0, 140) : ''
        });
    }

    return { gastos: saneados, descartados };
}

function categoriaConocida(categoria) {
    return categorias.find(c => clave(c) === clave(categoria)) || null;
}

function metodoConocido(metodo) {
    return METODOS_PAGO.find(m => clave(m) === clave(metodo)) || null;
}

function esCategoriaPorDefecto(categoria) {
    return CATEGORIAS_POR_DEFECTO.some(c => clave(c) === clave(categoria));
}

function crearCategoriaSiFalta(nombre) {
    const limpio = typeof nombre === 'string' ? nombre.trim() : '';
    if (!limpio) return null;

    const existente = categoriaConocida(limpio);
    if (existente) return existente;

    categorias.push(limpio);
    return limpio;
}

// El límite puede fijarse mes a mes; los meses sin límite propio usan el general
function limitePresupuesto(mes) {
    const limite = aNumero(presupuestosPorMes[mes]);
    return limite === null ? presupuestoPorDefecto : limite;
}

function estadoPresupuesto(mesPedido, limitePedido) {
    const mes = esMesValido(mesPedido) ? mesPedido : mesActual();
    const limite = Number.isFinite(limitePedido) ? limitePedido : limitePresupuesto(mes);

    const gastado = gastos
        .filter(g => g.fecha.startsWith(mes))
        .reduce((suma, g) => suma + g.importe, 0);

    return {
        mes,
        limite,
        limitePropio: Object.prototype.hasOwnProperty.call(presupuestosPorMes, mes),
        gastado: Number(gastado.toFixed(2)),
        restante: Number((limite - gastado).toFixed(2)),
        porcentaje: limite ? Number(((gastado / limite) * 100).toFixed(1)) : 0
    };
}

function calcularResumen(lista, { mes, limite } = {}) {
    const total = lista.reduce((suma, g) => suma + g.importe, 0);

    const porCategoria = {};
    for (const g of lista) {
        porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + g.importe;
    }
    const categoriasResumen = Object.entries(porCategoria)
        .map(([categoria, importe]) => ({ categoria, importe: Number(importe.toFixed(2)) }))
        .sort((a, b) => b.importe - a.importe);

    const porMes = {};
    for (const g of lista) {
        const mesGasto = g.fecha.slice(0, 7);
        porMes[mesGasto] = (porMes[mesGasto] || 0) + g.importe;
    }
    const meses = Object.entries(porMes)
        .map(([mes, importe]) => ({ mes, importe: Number(importe.toFixed(2)) }))
        .sort((a, b) => a.mes.localeCompare(b.mes));

    const gastoMaximo = lista.reduce(
        (mayor, g) => (mayor === null || g.importe > mayor.importe ? g : mayor),
        null
    );

    return {
        numeroGastos: lista.length,
        total: Number(total.toFixed(2)),
        promedio: lista.length ? Number((total / lista.length).toFixed(2)) : 0,
        categorias: categoriasResumen,
        meses,
        presupuesto: estadoPresupuesto(mes, limite),
        gastoMaximo: gastoMaximo
            ? { id: gastoMaximo.id, concepto: gastoMaximo.concepto, importe: gastoMaximo.importe }
            : null
    };
}

function validarGasto(datos, { permitirCrearCategoria = false } = {}) {
    const errores = [];

    const concepto = typeof datos.concepto === 'string' ? datos.concepto.trim() : '';
    const notas = typeof datos.notas === 'string' ? datos.notas.trim() : '';
    const fecha = typeof datos.fecha === 'string' ? datos.fecha.trim() : '';
    const importe = aNumero(datos.importe);

    if (!concepto) errores.push("El concepto es obligatorio");
    else if (concepto.length > 80) errores.push("El concepto no puede superar los 80 caracteres");

    if (notas.length > 140) errores.push("Las notas no pueden superar los 140 caracteres");

    if (importe === null) errores.push("El importe debe ser un número");
    else if (importe <= 0) errores.push("El importe debe ser mayor que 0");
    else if (importe > 100000) errores.push("El importe no puede superar los 100.000 €");

    if (!fecha) errores.push("La fecha es obligatoria");
    else if (!esFechaValida(fecha)) errores.push("La fecha debe tener formato AAAA-MM-DD y ser real");

    let categoria = categoriaConocida(datos.categoria);
    if (!categoria && permitirCrearCategoria) {
        categoria = crearCategoriaSiFalta(datos.categoria);
    }
    if (!categoria) errores.push(`Categoría no válida. Opciones: ${categorias.join(", ")}`);

    const metodoPago = metodoConocido(datos.metodoPago);
    if (!metodoPago) errores.push(`Método de pago no válido. Opciones: ${METODOS_PAGO.join(", ")}`);

    return {
        errores,
        gasto: {
            concepto,
            categoria,
            importe: importe === null ? null : Number(importe.toFixed(2)),
            metodoPago,
            fecha,
            notas
        }
    };
}

function aplicarFiltros(lista, query) {
    const texto = String(query.texto || '').trim().toLowerCase();
    const categoria = query.categoria;
    const mes = esMesValido(String(query.mes || '').trim()) ? String(query.mes).trim() : '';

    // Un rango invertido se invierte en lugar de devolver una lista vacía
    let desde = esFechaValida(String(query.desde || '').trim()) ? String(query.desde).trim() : '';
    let hasta = esFechaValida(String(query.hasta || '').trim()) ? String(query.hasta).trim() : '';
    if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];

    return lista.filter(g => {
        if (texto && !(`${g.concepto} ${g.notas}`.toLowerCase().includes(texto))) return false;
        if (categoria && g.categoria !== categoria) return false;
        if (mes && !g.fecha.startsWith(mes)) return false;
        if (desde && g.fecha < desde) return false;
        if (hasta && g.fecha > hasta) return false;
        return true;
    });
}

// Mes al que se refiere el presupuesto que se muestra. Si no se filtra por mes,
// un rango de fechas que cae entero dentro de un mes ya indica cuál es.
function mesDelFiltro(query) {
    if (esMesValido(String(query.mes || '').trim())) return String(query.mes).trim();

    const desde = esFechaValida(String(query.desde || '').trim()) ? String(query.desde).trim() : '';
    const hasta = esFechaValida(String(query.hasta || '').trim()) ? String(query.hasta).trim() : '';

    if (desde && hasta && desde.slice(0, 7) === hasta.slice(0, 7)) {
        return desde.slice(0, 7);
    }
    return null;
}

function paginar(lista, query) {
    const limitePedido = aNumero(query.limit) ?? LIMITE_POR_DEFECTO;
    const limite = Math.min(Math.max(Math.trunc(limitePedido), 1), LIMITE_MAXIMO);
    const paginaPedida = aNumero(query.page) ?? 1;
    const totalPaginas = Math.max(1, Math.ceil(lista.length / limite));
    const pagina = Math.min(Math.max(Math.trunc(paginaPedida), 1), totalPaginas);

    const desde = (pagina - 1) * limite;
    const datos = lista.slice(desde, desde + limite);

    return {
        datos,
        paginacion: {
            pagina,
            limite,
            total: lista.length,
            totalPaginas,
            desde: lista.length ? desde + 1 : 0,
            hasta: desde + datos.length,
            tieneAnterior: pagina > 1,
            tieneSiguiente: pagina < totalPaginas
        }
    };
}

// --- CSV ---

function celdaCsv(valor) {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function gastosACsv(lista) {
    const cabecera = ['id', 'concepto', 'categoria', 'importe', 'fecha', 'metodoPago', 'notas'];
    const filas = lista.map(g => [
        g.id,
        g.concepto,
        g.categoria,
        Number(g.importe || 0).toFixed(2),
        g.fecha,
        g.metodoPago,
        g.notas
    ]);

    return [cabecera, ...filas].map(fila => fila.map(celdaCsv).join(';')).join('\r\n');
}

function parsearCsv(texto) {
    const limpio = String(texto || '').replace(/^\uFEFF/, '');
    if (!limpio.trim()) return [];

    const primeraLinea = limpio.split(/\r?\n/, 1)[0];
    const separador = (primeraLinea.match(/;/g) || []).length > (primeraLinea.match(/,/g) || []).length
        ? ';'
        : ',';

    const filas = [];
    let fila = [];
    let celda = '';
    let dentroDeComillas = false;

    for (let i = 0; i < limpio.length; i++) {
        const caracter = limpio[i];

        if (dentroDeComillas) {
            if (caracter === '"') {
                if (limpio[i + 1] === '"') {
                    celda += '"';
                    i++;
                } else {
                    dentroDeComillas = false;
                }
            } else {
                celda += caracter;
            }
            continue;
        }

        if (caracter === '"') {
            dentroDeComillas = true;
        } else if (caracter === separador) {
            fila.push(celda);
            celda = '';
        } else if (caracter === '\n' || caracter === '\r') {
            fila.push(celda);
            filas.push(fila);
            fila = [];
            celda = '';
            if (caracter === '\r' && limpio[i + 1] === '\n') i++;
        } else {
            celda += caracter;
        }
    }

    if (celda !== '' || fila.length) {
        fila.push(celda);
        filas.push(fila);
    }

    return filas.filter(f => f.some(c => c.trim() !== ''));
}

const COLUMNAS_CSV = {
    id: 'id',
    concepto: 'concepto',
    descripcion: 'concepto',
    categoria: 'categoria',
    'categoría': 'categoria',
    importe: 'importe',
    cantidad: 'importe',
    precio: 'importe',
    fecha: 'fecha',
    metodo: 'metodoPago',
    'método': 'metodoPago',
    metodopago: 'metodoPago',
    'método de pago': 'metodoPago',
    notas: 'notas',
    comentario: 'notas'
};

// Al exportar desde Excel en español los importes llegan como "33,80" o como
// "1.234,56". Solo se tocan los patrones inequívocos; cualquier otra cosa se
// deja como está y la fila acaba informada como error.
function normalizarImporteCsv(texto) {
    const limpio = String(texto ?? '').replace(/[\s\u00a0]/g, '').replace(/€|eur/gi, '');

    if (/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(limpio)) {
        return limpio.replace(/\./g, '').replace(',', '.');
    }
    if (/^-?\d+,\d{1,2}$/.test(limpio)) {
        return limpio.replace(',', '.');
    }
    return limpio;
}

// Un gasto se identifica por sus propios datos. Sirve para no meter dos veces
// la misma fila cuando el CSV no trae la columna id.
function huellaGasto(g) {
    return [
        clave(g.concepto),
        g.fecha,
        Number(g.importe).toFixed(2),
        clave(g.categoria),
        clave(g.metodoPago),
        clave(g.notas)
    ].join('|');
}

// La misma huella pero calculada sobre una fila de CSV todavía sin validar.
// Devuelve null si la fila no tiene los datos mínimos para compararla.
function huellaTentativa(candidato) {
    const concepto = String(candidato.concepto || '').trim();
    const fecha = String(candidato.fecha || '').trim();
    const importe = Number(normalizarImporteCsv(candidato.importe));

    if (!concepto || !esFechaValida(fecha) || !Number.isFinite(importe)) return null;

    return [
        clave(concepto),
        fecha,
        importe.toFixed(2),
        clave(candidato.categoria),
        clave(candidato.metodoPago),
        clave(candidato.notas)
    ].join('|');
}

// --- DATOS DE EJEMPLO (se usan únicamente si no existe data/datos.json) ---

function gastosEjemplo() {
    return [
        {
            id: 1,
            concepto: "Digger IMAX",
            categoria: "Ocio",
            importe: 5,
            metodoPago: "Tarjeta",
            fecha: "2026-10-03",
            notas: ""
        },
        {
            id: 2,
            concepto: "Comida",
            categoria: "Alimentación",
            importe: 40,
            metodoPago: "Tarjeta",
            fecha: "2026-09-24",
            notas: "Ramen"
        }
    ];
}

// --- RUTAS API ---

app.get('/api/categorias', (req, res) => {
    res.json(categorias.map(nombre => ({ nombre, porDefecto: esCategoriaPorDefecto(nombre) })));
});

app.get('/api/metodos-pago', (req, res) => {
    res.json(METODOS_PAGO);
});

app.post('/api/categorias', async (req, res) => {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';

    if (!nombre) {
        return res.status(400).json({ error: "El nombre de la categoría es obligatorio" });
    }
    if (nombre.length > 40) {
        return res.status(400).json({ error: "La categoría no puede superar los 40 caracteres" });
    }
    if (categoriaConocida(nombre)) {
        return res.status(400).json({ error: `La categoría "${nombre}" ya existe` });
    }

    crearCategoriaSiFalta(nombre);
    await guardarDatos();
    res.status(201).json({ mensaje: `Categoría "${nombre}" creada`, categoria: nombre });
});

app.delete('/api/categorias/:nombre', async (req, res) => {
    const categoria = categoriaConocida(req.params.nombre);

    if (!categoria) {
        return res.status(404).json({ error: "Categoría no encontrada" });
    }
    if (esCategoriaPorDefecto(categoria)) {
        return res.status(400).json({ error: "Las categorías por defecto no se pueden borrar" });
    }

    const usados = gastos.filter(g => g.categoria === categoria).length;
    if (usados > 0) {
        return res.status(409).json({
            error: `No se puede borrar "${categoria}": hay ${usados} ${usados === 1 ? 'gasto' : 'gastos'} con esa categoría`
        });
    }

    categorias = categorias.filter(c => c !== categoria);
    await guardarDatos();
    res.json({ mensaje: `Categoría "${categoria}" eliminada` });
});

app.get('/api/presupuesto', (req, res) => {
    res.json({
        ...estadoPresupuesto(mesDelFiltro(req.query)),
        limitePorDefecto: presupuestoPorDefecto,
        mesesConLimite: Object.keys(presupuestosPorMes).sort()
    });
});

app.put('/api/presupuesto', async (req, res) => {
    const cuerpo = req.body || {};
    const cambios = [];

    const comprobarLimite = (valor, etiqueta) => {
        if (valor <= 0) return `${etiqueta} debe ser mayor que 0`;
        if (valor > 1000000) return `${etiqueta} no puede superar 1.000.000 €`;
        return null;
    };

    // { limitePorDefecto: 500 } cambia el valor general para todos los meses
    // que no tengan un límite propio
    const general = aNumero(cuerpo.limitePorDefecto);
    if (general !== null) {
        const problema = comprobarLimite(general, 'El límite general');
        if (problema) return res.status(400).json({ error: problema });

        presupuestoPorDefecto = Number(general.toFixed(2));
        cambios.push(`límite general a ${presupuestoPorDefecto} €`);
    }

    // { limite: 200, mes: "2026-08" } fija el límite de un mes concreto.
    // Si no viene mes, se toma el actual para no romper las llamadas antiguas.
    const vieneMes = cuerpo.mes !== undefined && cuerpo.mes !== null && cuerpo.mes !== '';
    const vieneLimite = cuerpo.limite !== undefined;
    const mes = vieneMes ? String(cuerpo.mes).trim() : (vieneLimite ? mesActual() : null);

    if (mes !== null) {
        if (!esMesValido(mes)) {
            return res.status(400).json({ error: "El mes debe tener formato AAAA-MM, por ejemplo 2026-08" });
        }

        const limite = aNumero(cuerpo.limite);

        if (limite === null) {
            // Sin límite propio en ese mes: vuelve a valer el general
            if (Object.prototype.hasOwnProperty.call(presupuestosPorMes, mes)) {
                delete presupuestosPorMes[mes];
                cambios.push(`${mes} vuelve al límite general`);
            }
        } else {
            const problema = comprobarLimite(limite, 'El límite');
            if (problema) return res.status(400).json({ error: problema });

            presupuestosPorMes[mes] = Number(limite.toFixed(2));
            cambios.push(`${mes} a ${presupuestosPorMes[mes]} €`);
        }
    }

    if (!cambios.length) {
        return res.status(400).json({ error: "No hay ningún límite que actualizar" });
    }

    await guardarDatos();
    res.json({
        mensaje: `Presupuesto actualizado: ${cambios.join(' y ')}`,
        presupuesto: estadoPresupuesto(mes ?? mesActual()),
        limitePorDefecto: presupuestoPorDefecto,
        mesesConLimite: Object.keys(presupuestosPorMes).sort()
    });
});

app.get('/api/resumen', (req, res) => {
    res.json(calcularResumen(aplicarFiltros(gastos, req.query), {
        mes: mesDelFiltro(req.query),
        limite: aNumero(req.query.presupuesto)
    }));
});

// --- RUTAS API PARA GASTOS (CRUD) ---

app.get('/api/gastos/exportar.csv', (req, res) => {
    const filtrados = aplicarFiltros(gastos, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gastos.csv"');
    res.send('\uFEFF' + gastosACsv(filtrados));
});

app.get('/api/gastos/exportar.json', (req, res) => {
    const filtrados = aplicarFiltros(gastos, req.query);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gastos.json"');
    res.json({
        exportadoEn: new Date().toISOString(),
        presupuesto: presupuestoPorDefecto,
        presupuestos: presupuestosPorMes,
        numeroGastos: filtrados.length,
        gastos: filtrados
    });
});

app.post('/api/gastos/importar', async (req, res) => {
    const contenido = typeof req.body?.contenido === 'string' ? req.body.contenido : '';
    const filas = parsearCsv(contenido);

    if (filas.length < 2) {
        return res.status(400).json({
            error: "El CSV necesita una fila de cabecera y al menos un gasto"
        });
    }

    const indices = {};
    filas[0].forEach((columna, i) => {
        indices[COLUMNAS_CSV[clave(columna)]] = i;
    });

    if (indices.concepto === undefined || indices.importe === undefined || indices.fecha === undefined) {
        return res.status(400).json({
            error: "Faltan columnas obligatorias en el CSV (concepto, importe y fecha)"
        });
    }

    const errores = [];
    const categoriasCreadas = [];
    const idsExistentes = new Set(gastos.map(g => g.id));
    const hayColumnaId = indices.id !== undefined;
    const huellas = new Set(gastos.map(g => huellaGasto(g)));

    let insertados = 0;
    let duplicados = 0;
    let omitidos = 0;

    for (let fila = 1; fila < filas.length; fila++) {
        const celdas = filas[fila];
        const leer = columna => (indices[columna] === undefined ? '' : (celdas[indices[columna]] ?? '').trim());

        const categoriaTexto = leer('categoria');
        const categoriaAntes = categoriaConocida(categoriaTexto);

        const candidato = {
            concepto: leer('concepto'),
            importe: normalizarImporteCsv(leer('importe')),
            fecha: leer('fecha'),
            categoria: categoriaTexto,
            metodoPago: leer('metodoPago') || 'Tarjeta',
            notas: leer('notas')
        };

        // Reimportar el mismo fichero no debe duplicar los gastos. Si el CSV
        // trae la columna id se compara con ella; si no, se ignoran las filas
        // idénticas a un gasto que ya existe.
        if (hayColumnaId) {
            const id = Math.trunc(Number(leer('id')));
            if (Number.isInteger(id) && id >= 1) {
                if (idsExistentes.has(id)) {
                    duplicados++;
                    continue;
                }
            }
        } else {
            const huella = huellaTentativa(candidato);
            if (huella && huellas.has(huella)) {
                duplicados++;
                continue;
            }
        }

        const { errores: fallo, gasto } = validarGasto(candidato, { permitirCrearCategoria: true });

        if (fallo.length) {
            omitidos++;
            if (errores.length < MAX_ERRORES_INFORME) {
                errores.push({ fila: fila + 1, concepto: candidato.concepto, motivo: fallo.join(". ") });
            }
            continue;
        }

        if (categoriaTexto && !categoriaAntes && !categoriasCreadas.includes(gasto.categoria)) {
            categoriasCreadas.push(gasto.categoria);
        }

        const idPropio = hayColumnaId ? Math.trunc(Number(leer('id'))) : siguienteId;
        const id = Number.isInteger(idPropio) && idPropio >= 1 ? idPropio : siguienteId;

        gastos.push({ id, ...gasto });
        idsExistentes.add(id);
        huellas.add(huellaGasto({ id, ...gasto }));
        siguienteId = Math.max(siguienteId, id + 1);
        insertados++;
    }

    await guardarDatos();

    const partes = [`Importación terminada: ${insertados} ${insertados === 1 ? 'gasto añadido' : 'gastos añadidos'}`];
    if (duplicados) partes.push(`${duplicados} ${duplicados === 1 ? 'duplicado omitido' : 'duplicados omitidos'}`);
    if (omitidos) partes.push(`${omitidos} ${omitidos === 1 ? 'fila con errores' : 'filas con errores'}`);

    res.status(201).json({
        mensaje: partes.join('. '),
        insertados,
        duplicados,
        omitidos,
        errores,
        erroresOmitidos: Math.max(0, omitidos - errores.length),
        categoriasCreadas
    });
});

app.get('/api/gastos', (req, res) => {
    const filtrados = aplicarFiltros(gastos, req.query);
    const orden = req.query.orden === 'importe' ? 'importe' : 'fecha';

    const ordenados = [...filtrados].sort((a, b) => {
        const cmp = orden === 'importe'
            ? b.importe - a.importe
            : b.fecha.localeCompare(a.fecha);
        return cmp !== 0 ? cmp : b.id - a.id;
    });

    res.json(paginar(ordenados, req.query));
});

app.get('/api/gastos/:id', (req, res) => {
    const id = Number(req.params.id);
    const gasto = gastos.find(g => g.id === id);
    if (!gasto) {
        return res.status(404).json({ error: "Gasto no encontrado" });
    }
    res.json(gasto);
});

app.post('/api/gastos', async (req, res) => {
    const { errores, gasto } = validarGasto(req.body || {});
    if (errores.length) {
        return res.status(400).json({ error: errores.join(". ") });
    }

    const nuevoGasto = { id: siguienteId++, ...gasto };
    gastos.push(nuevoGasto);
    await guardarDatos();
    res.status(201).json({ mensaje: "Gasto añadido con éxito", gasto: nuevoGasto });
});

app.put('/api/gastos/:id', async (req, res) => {
    const id = Number(req.params.id);
    const index = gastos.findIndex(g => g.id === id);
    if (index === -1) {
        return res.status(404).json({ error: "Gasto no encontrado" });
    }

    const { errores, gasto } = validarGasto({ ...gastos[index], ...req.body });
    if (errores.length) {
        return res.status(400).json({ error: errores.join(". ") });
    }

    gastos[index] = { id, ...gasto };
    await guardarDatos();
    res.json({ mensaje: "Gasto actualizado con éxito", gasto: gastos[index] });
});

app.delete('/api/gastos/:id', async (req, res) => {
    const id = Number(req.params.id);
    const existe = gastos.some(g => g.id === id);
    if (!existe) {
        return res.status(404).json({ error: "Gasto no encontrado" });
    }

    gastos = gastos.filter(g => g.id !== id);
    await guardarDatos();
    res.json({ mensaje: "Gasto eliminado con éxito" });
});

app.delete('/api/gastos', async (req, res) => {
    const borrados = gastos.length;
    gastos = [];
    await guardarDatos();
    res.json({ mensaje: `Se han borrado ${borrados} ${borrados === 1 ? 'gasto' : 'gastos'}`, borrados });
});

app.use('/api', (req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
});

cargarDatos().finally(() => {
    // OJO: el callback no se pasa a app.listen a propósito. Express 5 envuelve
    // el último argumento con once() y lo registra también en 'error'
    // (express/lib/application.js:601-604), así que con el puerto ocupado ese
    // callback se ejecutaría con servidor.address() === null y reventaría con un
    // TypeError en lugar de avisar. Por eso el aviso va en 'listening'.
    const servidor = app.listen(PORT);

    servidor.once('listening', () => {
        console.log(`Servidor ejecutándose en http://localhost:${servidor.address().port}`);
    });

    servidor.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`El puerto ${PORT} ya está ocupado.`);
            console.error('Si el servidor ya estaba arrancado, esto es normal: ciérralo o usa otro con PORT=3001 npm start');
        } else if (err.code === 'EACCES') {
            console.error(`No hay permiso para usar el puerto ${PORT}. Prueba con otro: PORT=3001 npm start`);
        } else {
            console.error('No se pudo arrancar el servidor:', err.message);
        }
        process.exit(1);
    });
});