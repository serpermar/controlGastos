const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const app = express();
const PORT = process.env.PORT || 3000;

// Archivo donde se guardan los datos entre reinicios del servidor
const RUTA_DATOS = path.join(__dirname, 'data', 'datos.json');

// Temporal del guardado atómico y copia del archivo cuando llega corrupto
const RUTA_DATOS_TMP = `${RUTA_DATOS}.tmp`;
const RUTA_DATOS_CORRUPTO = `${RUTA_DATOS}.corrupto`;

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
let presupuestoMensual = PRESUPUESTO_INICIAL;
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
        await guardarDatos();
        return;
    }

    gastos = Array.isArray(guardados.gastos) ? guardados.gastos : [];
    categorias = Array.isArray(guardados.categorias) && guardados.categorias.length
        ? guardados.categorias
        : [...CATEGORIAS_POR_DEFECTO];
    presupuestoMensual = Number.isFinite(guardados.presupuesto)
        ? guardados.presupuesto
        : PRESUPUESTO_INICIAL;

    const maximo = gastos.reduce((mayor, g) => Math.max(mayor, g.id || 0), 0);
    siguienteId = Math.max(Number(guardados.siguienteId) || 0, maximo + 1);

    console.log(`Datos cargados desde ${RUTA_DATOS} (${gastos.length} gastos)`);
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
            const contenido = { gastos, categorias, presupuesto: presupuestoMensual, siguienteId };

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

function estadoPresupuesto(limitePedido) {
    const limite = Number.isFinite(limitePedido) ? limitePedido : presupuestoMensual;
    const mes = hoy().slice(0, 7);

    const gastado = gastos
        .filter(g => g.fecha.startsWith(mes))
        .reduce((suma, g) => suma + g.importe, 0);

    return {
        mes,
        limite,
        gastado: Number(gastado.toFixed(2)),
        restante: Number((limite - gastado).toFixed(2)),
        porcentaje: limite ? Number(((gastado / limite) * 100).toFixed(1)) : 0
    };
}

function calcularResumen(lista, limite) {
    const total = lista.reduce((suma, g) => suma + g.importe, 0);

    const porCategoria = {};
    for (const g of lista) {
        porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + g.importe;
    }
    const categoriasResumen = Object.entries(porCategoria)
        .map(([categoria, importe]) => ({ categoria, importe }))
        .sort((a, b) => b.importe - a.importe);

    const porMes = {};
    for (const g of lista) {
        const mes = g.fecha.slice(0, 7);
        porMes[mes] = (porMes[mes] || 0) + g.importe;
    }
    const meses = Object.entries(porMes)
        .map(([mes, importe]) => ({ mes, importe }))
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
        presupuesto: estadoPresupuesto(limite),
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
    const mes = String(query.mes || '').trim();
    const desde = String(query.desde || '').trim();
    const hasta = String(query.hasta || '').trim();

    return lista.filter(g => {
        if (texto && !(`${g.concepto} ${g.notas}`.toLowerCase().includes(texto))) return false;
        if (categoria && g.categoria !== categoria) return false;
        if (mes && !g.fecha.startsWith(mes)) return false;
        if (desde && g.fecha < desde) return false;
        if (hasta && g.fecha > hasta) return false;
        return true;
    });
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
        g.importe.toFixed(2),
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
    res.json(estadoPresupuesto());
});

app.put('/api/presupuesto', async (req, res) => {
    const limite = aNumero(req.body?.limite);

    if (limite === null) {
        return res.status(400).json({ error: "El límite debe ser un número" });
    }
    if (limite <= 0) {
        return res.status(400).json({ error: "El límite debe ser mayor que 0" });
    }
    if (limite > 1000000) {
        return res.status(400).json({ error: "El límite no puede superar 1.000.000 €" });
    }

    presupuestoMensual = Number(limite.toFixed(2));
    await guardarDatos();
    res.json({ mensaje: `Presupuesto mensual actualizado a ${presupuestoMensual} €`, presupuesto: estadoPresupuesto() });
});

app.get('/api/resumen', (req, res) => {
    const limite = aNumero(req.query.presupuesto);
    res.json(calcularResumen(aplicarFiltros(gastos, req.query), limite));
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
        presupuesto: presupuestoMensual,
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
    let insertados = 0;

    for (let fila = 1; fila < filas.length; fila++) {
        const celdas = filas[fila];
        const leer = columna => (indices[columna] === undefined ? '' : (celdas[indices[columna]] ?? '').trim());

        const categoriaTexto = leer('categoria');
        const categoriaAntes = categoriaConocida(categoriaTexto);

        const { errores: fallo, gasto } = validarGasto({
            concepto: leer('concepto'),
            importe: leer('importe'),
            fecha: leer('fecha'),
            categoria: categoriaTexto,
            metodoPago: leer('metodoPago') || 'Tarjeta',
            notas: leer('notas')
        }, { permitirCrearCategoria: true });

        if (fallo.length) {
            errores.push({ fila: fila + 1, concepto: leer('concepto'), motivo: fallo.join(". ") });
            continue;
        }

        if (categoriaTexto && !categoriaAntes && !categoriasCreadas.includes(gasto.categoria)) {
            categoriasCreadas.push(gasto.categoria);
        }

        gastos.push({ id: siguienteId++, ...gasto });
        insertados++;
    }

    await guardarDatos();
    res.status(201).json({
        mensaje: `Importación terminada: ${insertados} ${insertados === 1 ? 'gasto añadido' : 'gastos añadidos'}`,
        insertados,
        omitidos: errores.length,
        errores,
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
    app.listen(PORT, () => {
        console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    });
});