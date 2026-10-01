// --- Referencias al DOM ---
const formulario = document.getElementById('formularioGasto');
const campoConcepto = document.getElementById('concepto');
const campoImporte = document.getElementById('importe');
const campoFecha = document.getElementById('fecha');
const campoCategoria = document.getElementById('categoria');
const campoMetodoPago = document.getElementById('metodoPago');
const campoNotas = document.getElementById('notas');

const mensajeFormulario = document.getElementById('mensajeFormulario');
const mensajeVacio = document.getElementById('mensajeVacio');
const mensajeGlobal = document.getElementById('mensajeGlobal');
const btnGuardar = document.getElementById('btnGuardar');
const cuerpoTabla = document.getElementById('cuerpoTabla');
const tablaGastos = document.getElementById('tablaGastos');

const filtroTexto = document.getElementById('filtroTexto');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroMes = document.getElementById('filtroMes');
const filtroDesde = document.getElementById('filtroDesde');
const filtroHasta = document.getElementById('filtroHasta');
const filtroOrden = document.getElementById('filtroOrden');
const btnLimpiar = document.getElementById('btnLimpiar');

const modoMes = document.getElementById('modoMes');
const modoRango = document.getElementById('modoRango');
const campoMes = document.getElementById('campoMes');
const campoDesde = document.getElementById('campoDesde');
const campoHasta = document.getElementById('campoHasta');
const filtrosActivos = document.getElementById('filtrosActivos');
const chipsFiltros = document.getElementById('chipsFiltros');

const selectorLimite = document.getElementById('selectorLimite');

const paginacion = document.getElementById('paginacion');
const paginacionInfo = document.getElementById('paginacionInfo');
const btnPaginaAnterior = document.getElementById('btnPaginaAnterior');
const btnPaginaSiguiente = document.getElementById('btnPaginaSiguiente');

const menuExportar = document.getElementById('menuExportar');
const btnExportarCsv = document.getElementById('btnExportarCsv');
const btnExportarJson = document.getElementById('btnExportarJson');
const btnImportar = document.getElementById('btnImportar');
const archivoCsv = document.getElementById('archivoCsv');

const btnVaciar = document.getElementById('btnVaciar');
const confirmacionVaciar = document.getElementById('confirmacionVaciar');
const btnVaciarConfirmar = document.getElementById('btnVaciarConfirmar');
const btnVaciarCancelar = document.getElementById('btnVaciarCancelar');

// Modales de edición y borrado
const modalEditar = document.getElementById('modalEditar');
const formularioModalEditar = document.getElementById('formularioModalEditar');
const idEdicion = document.getElementById('idEdicion');
const editConcepto = document.getElementById('editConcepto');
const editImporte = document.getElementById('editImporte');
const editFecha = document.getElementById('editFecha');
const editCategoria = document.getElementById('editCategoria');
const editMetodoPago = document.getElementById('editMetodoPago');
const editNotas = document.getElementById('editNotas');
const mensajeModalEditar = document.getElementById('mensajeModalEditar');
const btnGuardarEdicion = document.getElementById('btnGuardarEdicion');

const modalBorrar = document.getElementById('modalBorrar');
const textoBorrar = document.getElementById('textoBorrar');
const datosBorrar = document.getElementById('datosBorrar');
const mensajeModalBorrar = document.getElementById('mensajeModalBorrar');
const btnConfirmarBorrar = document.getElementById('btnConfirmarBorrar');

const formularioPresupuesto = document.getElementById('formularioPresupuesto');
const inputPresupuesto = document.getElementById('inputPresupuesto');
const errorPresupuesto = document.getElementById('errorPresupuesto');
const etiquetaPresupuesto = document.getElementById('etiquetaPresupuesto');
const notaPresupuesto = document.getElementById('notaPresupuesto');

const formularioCategoria = document.getElementById('formularioCategoria');
const nombreCategoria = document.getElementById('nombreCategoria');
const errorCategoria = document.getElementById('errorCategoria');
const listaCategoriasForm = document.getElementById('listaCategoriasForm');

const graficoCategorias = document.getElementById('graficoCategorias');
const graficoMeses = document.getElementById('graficoMeses');
const graficoVacioCategorias = document.getElementById('graficoVacioCategorias');
const graficoVacioMeses = document.getElementById('graficoVacioMeses');

const btnTema = document.getElementById('btnTema');
const iconoTema = document.getElementById('iconoTema');

// --- Estado de la interfaz ---
const estado = {
    pagina: 1,
    limite: 10,
    cargando: false,
    // Cada recarga usa un número mayor: si llegan desordenadas, se descartan las viejas
    secuencia: 0,
    gastos: [],
    categorias: [],
    // 'mes' o 'rango'. El servidor combina mes + desde/hasta con AND, así que enviar
    // los dos a la vez daría un recorte que el usuario no ha pedido. Aquí se decide
    // cuál de los dos es el que cuenta y el otro se esconde
    modoPeriodo: 'mes',
    // Gasto pendiente de borrar, guardado al abrir #modalBorrar
    gastoPendienteBorrar: null,
    // Mes al que pertenece la barra de presupuesto que se está mostrando
    presupuestoMes: null,
    // Último resumen recibido: hace falta para repintar los gráficos al cambiar de tema
    resumen: null,
    graficos: { categorias: null, meses: null }
};

// --- Utilidades ---

// Formatea un número como euros (1234.5 -> "1.234,50 €")
function euros(valor) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
    }).format(valor || 0);
}

// Fecha AAAA-MM-DD -> "20 sept. 2026"
function fechaBonita(fecha) {
    if (!fecha) return '';
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${dia} ${meses[mes - 1]} ${anio}`;
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "2026-10" -> "octubre de 2026"
function mesBonito(mes) {
    if (!/^\d{4}-\d{2}$/.test(mes || '')) return '';
    const [anio, numero] = mes.split('-');
    return `${MESES_ES[Number(numero) - 1]} de ${anio}`;
}

// Evita que un texto con HTML se ejecute al inyectarlo en la tabla.
// Se escapan también las comillas porque algunos valores van dentro de atributos
// (por ejemplo data-nombre): sin ellas, un nombre de categoría podría cerrar el
// atributo y añadir manejadores a la etiqueta.
const ENTIDADES_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapar(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, caracter => ENTIDADES_HTML[caracter]);
}

// Muestra un aviso flotante; si es error se pinta en rojo
let avisoTemporizador = null;
function avisar(texto, esError = false) {
    mensajeGlobal.textContent = texto;
    mensajeGlobal.classList.toggle('error', esError);
    mensajeGlobal.hidden = false;
    clearTimeout(avisoTemporizador);
    avisoTemporizador = setTimeout(() => { mensajeGlobal.hidden = true; }, 4000);
}

// Pide los datos a la API y normaliza los errores en un mensaje legible
async function api(ruta, opciones = {}) {
    const respuesta = await fetch(ruta, {
        headers: { 'Content-Type': 'application/json' },
        ...opciones
    });

    let cuerpo = null;
    try {
        cuerpo = await respuesta.json();
    } catch {
        cuerpo = null;
    }

    if (!respuesta.ok) {
        throw new Error(cuerpo?.error || `Error ${respuesta.status}`);
    }
    return cuerpo;
}

// --- Catálogos (categorías y métodos de pago) ---

async function cargarCatalogos() {
    const [categorias, metodos] = await Promise.all([
        api('/api/categorias'),
        api('/api/metodos-pago')
    ]);

    estado.categorias = categorias;

    const opciones = categorias
        .map(c => `<option value="${escapar(c.nombre)}">${escapar(c.nombre)}</option>`)
        .join('');
    const opcionesPago = metodos.map(m => `<option value="${escapar(m)}">${escapar(m)}</option>`).join('');

    campoCategoria.innerHTML = opciones;
    campoMetodoPago.innerHTML = opcionesPago;
    // El modal de edición usa los mismos catálogos
    editCategoria.innerHTML = opciones;
    editMetodoPago.innerHTML = opcionesPago;

    // El filtro de categorías incluye además la opción "todas"
    const filtroActual = filtroCategoria.value;
    filtroCategoria.innerHTML = '<option value="">Todas las categorías</option>' + opciones;
    filtroCategoria.value = filtroActual;

    pintarChipsCategorias();
}

// Muestra las categorías como etiquetas; las propias llevan botón de borrar
function pintarChipsCategorias() {
    listaCategoriasForm.innerHTML = estado.categorias.map(c => `
        <li class="chip ${c.porDefecto ? '' : 'borrable'}">
            ${escapar(c.nombre)}
            ${c.porDefecto
            ? ''
            : `<button type="button" class="borrar-categoria" data-nombre="${escapar(c.nombre)}"
                        title="Borrar categoría">&times;</button>`}
        </li>
    `).join('');
}

formularioCategoria.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    errorCategoria.hidden = true;

    const nombre = nombreCategoria.value.trim();
    if (!nombre) {
        errorCategoria.textContent = "Escribe el nombre de la categoría";
        errorCategoria.hidden = false;
        return;
    }

    try {
        const respuesta = await api('/api/categorias', {
            method: 'POST',
            body: JSON.stringify({ nombre })
        });
        avisar(respuesta.mensaje);
        nombreCategoria.value = '';
        await cargarCatalogos();
    } catch (error) {
        errorCategoria.textContent = error.message;
        errorCategoria.hidden = false;
    }
});

listaCategoriasForm.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('.borrar-categoria');
    if (!boton) return;

    const nombre = boton.dataset.nombre;
    if (!window.confirm(`¿Borrar la categoría "${nombre}"?`)) return;

    try {
        const respuesta = await api(`/api/categorias/${encodeURIComponent(nombre)}`, { method: 'DELETE' });
        avisar(respuesta.mensaje);
        await cargarCatalogos();
        await recargar();
    } catch (error) {
        avisar(error.message, true);
    }
});

// --- Presupuesto dinámico ---

formularioPresupuesto.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    errorPresupuesto.hidden = true;

    const boton = formularioPresupuesto.querySelector('button');
    boton.disabled = true;

    // El límite se guarda para el mes que muestra la barra, no siempre el actual
    const cuerpo = { limite: inputPresupuesto.value };
    if (estado.presupuestoMes) cuerpo.mes = estado.presupuestoMes;

    try {
        const respuesta = await api('/api/presupuesto', {
            method: 'PUT',
            body: JSON.stringify(cuerpo)
        });
        avisar(respuesta.mensaje);
        await recargar();
    } catch (error) {
        errorPresupuesto.textContent = error.message;
        errorPresupuesto.hidden = false;
    } finally {
        boton.disabled = false;
    }
});

// --- Listado, resumen y gráficos ---

// Construye la query de los filtros activos (los vacíos no se envía).
// Del periodo solo sale el modo visible: en modo 'mes' se ignoran desde/hasta, y
// en modo 'rango' se ignora el mes
function queryFiltros(conPagina = true) {
    const params = new URLSearchParams();
    if (filtroTexto.value.trim()) params.set('texto', filtroTexto.value.trim());
    if (filtroCategoria.value) params.set('categoria', filtroCategoria.value);

    if (estado.modoPeriodo === 'mes') {
        if (filtroMes.value) params.set('mes', filtroMes.value);
    } else {
        if (filtroDesde.value) params.set('desde', filtroDesde.value);
        if (filtroHasta.value) params.set('hasta', filtroHasta.value);
    }

    params.set('orden', filtroOrden.value);
    if (conPagina) {
        params.set('page', estado.pagina);
        params.set('limit', estado.limite);
    }
    return params.toString();
}

// Muestra solo el campo del modo elegido. Se toggla 'hidden' y no solo el CSS:
// un input oculto por display:none sigue validándose y podría colarse en la query
function aplicarModoPeriodo() {
    const esMes = estado.modoPeriodo === 'mes';

    modoMes.setAttribute('aria-pressed', String(esMes));
    modoRango.setAttribute('aria-pressed', String(!esMes));

    campoMes.hidden = !esMes;
    campoDesde.hidden = esMes;
    campoHasta.hidden = esMes;

    // Al cambiar de modo se limpia el filtro del otro, para que no reaparezca solo
    if (esMes) {
        filtroDesde.value = '';
        filtroHasta.value = '';
    } else {
        filtroMes.value = '';
    }
}

// Pinta una etiqueta por cada filtro puesto, con su × para quitarlo suelto
function pintarFiltrosActivos() {
    const activos = [];

    if (filtroTexto.value.trim()) {
        activos.push({ clave: 'texto', texto: `"${filtroTexto.value.trim()}"` });
    }
    if (filtroCategoria.value) {
        activos.push({ clave: 'categoria', texto: filtroCategoria.value });
    }
    if (estado.modoPeriodo === 'mes' && filtroMes.value) {
        activos.push({ clave: 'mes', texto: mesBonito(filtroMes.value) });
    }
    if (estado.modoPeriodo === 'rango') {
        if (filtroDesde.value) {
            activos.push({ clave: 'desde', texto: `Desde ${fechaBonita(filtroDesde.value)}` });
        }
        if (filtroHasta.value) {
            activos.push({ clave: 'hasta', texto: `Hasta ${fechaBonita(filtroHasta.value)}` });
        }
    }

    filtrosActivos.hidden = activos.length === 0;
    chipsFiltros.innerHTML = activos.map(f => `
        <span class="chip-filtro">
            ${escapar(f.texto)}
            <button type="button" data-quitar="${f.clave}" aria-label="Quitar el filtro ${escapar(f.texto)}">&times;</button>
        </span>
    `).join('');
}

// Quitar un filtro suelto deja intactos los demás
function quitarFiltro(clave) {
    switch (clave) {
        case 'texto': filtroTexto.value = ''; break;
        case 'categoria': filtroCategoria.value = ''; break;
        case 'mes': filtroMes.value = ''; break;
        case 'desde': filtroDesde.value = ''; break;
        case 'hasta': filtroHasta.value = ''; break;
    }
    estado.pagina = 1;
    recargar();
}

// Dibuja filas grises mientras la API responde
function pintarCargando() {
    estado.cargando = true;
    tablaGastos.setAttribute('aria-busy', 'true');

    cuerpoTabla.innerHTML = Array.from({ length: 6 }, () => `
        <tr>
            <td><span class="skeleton skeleton-corto"></span></td>
            <td><span class="skeleton skeleton-largo"></span></td>
            <td><span class="skeleton skeleton-medio"></span></td>
            <td><span class="skeleton skeleton-corto"></span></td>
            <td><span class="skeleton skeleton-corto"></span></td>
            <td><span class="skeleton skeleton-medio"></span></td>
        </tr>
    `).join('');

    mensajeVacio.hidden = true;
    paginacion.hidden = true;
}

// Pinta las filas de la tabla de gastos
function pintarTabla(lista) {
    cuerpoTabla.innerHTML = lista.map(g => `
        <tr>
            <td>${fechaBonita(g.fecha)}</td>
            <td>
                <span class="concepto">${escapar(g.concepto)}</span>
                ${g.notas ? `<span class="notas">${escapar(g.notas)}</span>` : ''}
            </td>
            <td><span class="tag">${escapar(g.categoria)}</span></td>
            <td>${escapar(g.metodoPago)}</td>
            <td class="importe">${euros(g.importe)}</td>
            <td>
                <div class="acciones-fila">
                    <button type="button" class="btn-icono editar" data-id="${g.id}">Editar</button>
                    <button type="button" class="btn-icono borrar" data-id="${g.id}">Borrar</button>
                </div>
            </td>
        </tr>
    `).join('');

    mensajeVacio.hidden = lista.length > 0;
    pintarFiltrosActivos();
}

// Pinta los controles de paginación según la respuesta del servidor
function pintarPaginacion(info) {
    paginacion.hidden = info.total === 0;
    paginacionInfo.textContent = `Mostrando ${info.desde}-${info.hasta} de ${info.total} gastos (página ${info.pagina} de ${info.totalPaginas})`;

    btnPaginaAnterior.disabled = !info.tieneAnterior;
    btnPaginaSiguiente.disabled = !info.tieneSiguiente;
}

// Pinta las cuatro tarjetas del resumen
function pintarResumen(resumen) {
    document.getElementById('resumenTotal').textContent = euros(resumen.total);
    document.getElementById('resumenCantidad').textContent =
        `${resumen.numeroGastos} ${resumen.numeroGastos === 1 ? 'gasto' : 'gastos'}`;
    document.getElementById('resumenPromedio').textContent = euros(resumen.promedio);

    document.getElementById('resumenMaximo').textContent =
        resumen.gastoMaximo ? euros(resumen.gastoMaximo.importe) : '--';
    document.getElementById('resumenMaximoConcepto').textContent =
        resumen.gastoMaximo ? resumen.gastoMaximo.concepto : 'sin gastos';

    const { limite, gastado, restante, porcentaje, mes, limitePropio } = resumen.presupuesto;
    estado.presupuestoMes = mes;

    document.getElementById('resumenPresupuesto').textContent = `${euros(gastado)} / ${euros(limite)}`;

    const barra = document.getElementById('barraPresupuesto');
    barra.style.width = `${Math.min(porcentaje, 100)}%`;
    barra.classList.toggle('aviso', porcentaje >= 80 && porcentaje < 100);
    barra.classList.toggle('excedido', porcentaje >= 100);

    // La barra siempre corresponde a un mes concreto: se dice cuál es para que
    // no se confunda con los totales, que sí dependen de los filtros
    document.getElementById('resumenRestante').textContent = restante >= 0
        ? `Te quedan ${euros(restante)} en ${mesBonito(mes)}`
        : `Te has pasado por ${euros(Math.abs(restante))} en ${mesBonito(mes)}`;

    etiquetaPresupuesto.textContent = `Ajustar límite de ${mesBonito(mes)} (€)`;

    // Si el mes está usando el límite general en vez de uno propio, se avisa
    notaPresupuesto.textContent = limitePropio
        ? ''
        : 'Este mes usa el límite general.';
    notaPresupuesto.hidden = limitePropio;

    // El campo del presupuesto muestra el límite vigente solo si no se está editando
    if (document.activeElement !== inputPresupuesto) {
        inputPresupuesto.value = limite;
    }
}

// --- Tema claro / oscuro ---

const CLAVE_TEMA = 'tema';

// Si no hay nada guardado se sigue al tema del sistema, que es lo que aplican
// los estilos mediante prefers-color-scheme
function temaDelSistema() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

function temaActual() {
    return document.documentElement.dataset.tema || temaDelSistema();
}

function aplicarTema(tema) {
    document.documentElement.dataset.tema = tema;

    try {
        localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
        // Sin almacenamiento el tema solo dura hasta recargar
    }

    iconoTema.textContent = tema === 'oscuro' ? '☀️' : '🌙';
    btnTema.title = tema === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

    // Los gráficos llevan los colores fijados al crearlos, así que hay que
    // rehacerlos para que no se queden en los tonos del tema anterior
    if (estado.resumen) pintarGraficos(estado.resumen);
}

btnTema.addEventListener('click', () => {
    aplicarTema(temaActual() === 'oscuro' ? 'claro' : 'oscuro');
});

// Si el usuario no ha elegido nada y el sistema cambia de tema, se le sigue
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', evento => {
    if (!document.documentElement.dataset.tema) {
        iconoTema.textContent = evento.matches ? '☀️' : '🌙';
        if (estado.resumen) pintarGraficos(estado.resumen);
    }
});

// --- Gráficos (Chart.js si está disponible) ---

// Si la librería no cargó (sin internet) los gráficos simplemente no se pintan
function tieneChartJs() {
    return typeof window.Chart !== 'undefined';
}

// Los colores salen de la hoja de estilos, no de constantes aquí: así los
// gráficos cambian solos con el tema
function coloresTema() {
    const estilos = getComputedStyle(document.documentElement);
    const leer = (nombre, porDefecto) => estilos.getPropertyValue(nombre).trim() || porDefecto;

    return {
        ok: leer('--cg-primary', '#059669'),
        acento: leer('--cg-acento', '#f59e0b'),
        texto: leer('--cg-texto-suave', '#64748b'),
        borde: leer('--cg-borde', '#e2e8f0'),
        // Tonos extra para cuando hay más categorías que colores
        paleta: [
            leer('--cg-primary', '#059669'),
            leer('--cg-acento', '#f59e0b'),
            leer('--cg-etiqueta-fg', '#334155'),
            '#5b8fa8',
            '#9c6b9e',
            '#c96f4a'
        ]
    };
}

function pintarGraficos(resumen) {
    const hayCategorias = resumen.categorias.length > 0;
    const hayMeses = resumen.meses.length > 0;

    graficoVacioCategorias.hidden = hayCategorias || !tieneChartJs();
    graficoVacioMeses.hidden = hayMeses || !tieneChartJs();
    graficoCategorias.hidden = !tieneChartJs();
    graficoMeses.hidden = !tieneChartJs();

    if (!tieneChartJs()) return;

    // Se destruye el gráfico anterior para no acumular instancias
    if (estado.graficos.categorias) estado.graficos.categorias.destroy();
    if (estado.graficos.meses) estado.graficos.meses.destroy();
    estado.graficos.categorias = null;
    estado.graficos.meses = null;

    const color = coloresTema();
    // Leyenda y ejes usan estos valores por defecto en todo lo que se cree después
    Chart.defaults.color = color.texto;
    Chart.defaults.borderColor = color.borde;

    if (hayCategorias) {
        estado.graficos.categorias = new Chart(graficoCategorias, {
            type: 'doughnut',
            data: {
                labels: resumen.categorias.map(c => c.categoria),
                datasets: [{
                    data: resumen.categorias.map(c => c.importe),
                    backgroundColor: color.paleta
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.label}: ${euros(ctx.parsed)}`
                        }
                    }
                }
            }
        });
    }

    if (hayMeses) {
        const etiquetas = resumen.meses.map(m => m.mes);
        const mesActual = new Date();
        const esteMes = `${mesActual.getFullYear()}-${String(mesActual.getMonth() + 1).padStart(2, '0')}`;

        estado.graficos.meses = new Chart(graficoMeses, {
            type: 'bar',
            data: {
                labels: etiquetas,
                datasets: [{
                    label: 'Gasto por mes',
                    data: resumen.meses.map(m => m.importe),
                    // El mes en curso se resalta para localizarlo de un vistazo
                    backgroundColor: etiquetas.map(mes => (mes === esteMes ? color.acento : color.ok)),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => euros(ctx.parsed.y)
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        grid: { color: color.borde },
                        ticks: {
                            color: color.texto,
                            callback: valor => euros(valor)
                        }
                    }
                }
            }
        });
    }
}

// Carga gastos y resumen del servidor y los pinta
async function recargar() {
    const miSecuencia = ++estado.secuencia;
    pintarCargando();

    const query = queryFiltros();
    try {
        const [listado, resumen] = await Promise.all([
            api(`/api/gastos?${query}`),
            api(`/api/resumen?${query}`)
        ]);

        // Si mientras cargaba llegó otra petición más nueva, esta se descarta
        if (miSecuencia !== estado.secuencia) return;

        estado.gastos = listado.datos;
        estado.pagina = listado.paginacion.pagina;
        estado.resumen = resumen;

        pintarTabla(listado.datos);
        pintarPaginacion(listado.paginacion);
        pintarResumen(resumen);
        pintarGraficos(resumen);
    } catch (error) {
        if (miSecuencia !== estado.secuencia) return;
        avisar(error.message, true);
        cuerpoTabla.innerHTML = '';
        mensajeVacio.hidden = false;
    } finally {
        if (miSecuencia === estado.secuencia) {
            estado.cargando = false;
            tablaGastos.removeAttribute('aria-busy');
        }
    }
}

// --- Formulario de alta ---

// El formulario lateral solo crea. Editar va por su propio modal, así que aquí no
// hay que alternar entre dos modos ni guardar en qué estado estaba
function resetearFormulario() {
    formulario.reset();

    const hoy = new Date();
    campoFecha.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    btnGuardar.disabled = false;
    mensajeFormulario.hidden = true;
}

formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mensajeFormulario.hidden = true;

    // Evita el doble envío: mientras se guarda, el botón queda deshabilitado
    if (btnGuardar.disabled) return;

    const datos = {
        concepto: campoConcepto.value,
        importe: campoImporte.value,
        fecha: campoFecha.value,
        categoria: campoCategoria.value,
        metodoPago: campoMetodoPago.value,
        notas: campoNotas.value
    };

    // El navegador solo valida el formulario si se le pide explícitamente
    if (!formulario.checkValidity()) {
        mensajeFormulario.textContent = "Revisa los campos obligatorios y el formato del importe y la fecha.";
        mensajeFormulario.hidden = false;
        return;
    }

    const textoOriginal = btnGuardar.textContent;
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    try {
        const respuesta = await api('/api/gastos', { method: 'POST', body: JSON.stringify(datos) });
        avisar(respuesta.mensaje);
        resetearFormulario();
        await recargar();
    } catch (error) {
        mensajeFormulario.textContent = error.message;
        mensajeFormulario.hidden = false;
        btnGuardar.disabled = false;
        btnGuardar.textContent = textoOriginal;
    }
});

// --- Modales de editar y borrar ---

// Mismo dialogue para abrir y cerrar: showModal() y close()
function abrirModal(modal) {
    if (!modal.open) modal.showModal();
}

function cerrarModal(modal) {
    if (modal.open) modal.close();
}

// Los botones de cerrar llevan data-cerrar="idDelModal"
document.querySelectorAll('[data-cerrar]').forEach(boton => {
    boton.addEventListener('click', () => {
        const modal = document.getElementById(boton.dataset.cerrar);
        if (modal) cerrarModal(modal);
    });
});

// Al cerrar #modalBorrar se olvida el gasto pendiente, para que un clic posterior
// en "Sí, borrar" no pueda borrar lo que se confirmó en una apertura anterior
modalBorrar.addEventListener('close', () => {
    estado.gastoPendienteBorrar = null;
});

function abrirModalEditar(gasto) {
    idEdicion.value = gasto.id;
    editConcepto.value = gasto.concepto;
    editImporte.value = gasto.importe;
    editFecha.value = gasto.fecha;
    editCategoria.value = gasto.categoria;
    editMetodoPago.value = gasto.metodoPago;
    editNotas.value = gasto.notas || '';
    mensajeModalEditar.hidden = true;
    mensajeModalEditar.textContent = '';

    abrirModal(modalEditar);
    editConcepto.focus();
}

formularioModalEditar.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mensajeModalEditar.hidden = true;

    if (btnGuardarEdicion.disabled) return;

    if (!formularioModalEditar.checkValidity()) {
        mensajeModalEditar.textContent = "Revisa los campos obligatorios y el formato del importe y la fecha.";
        mensajeModalEditar.hidden = false;
        return;
    }

    const id = idEdicion.value;
    const datos = {
        concepto: editConcepto.value,
        importe: editImporte.value,
        fecha: editFecha.value,
        categoria: editCategoria.value,
        metodoPago: editMetodoPago.value,
        notas: editNotas.value
    };

    btnGuardarEdicion.disabled = true;
    const textoOriginal = btnGuardarEdicion.textContent;
    btnGuardarEdicion.textContent = 'Guardando...';

    try {
        const respuesta = await api(`/api/gastos/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
        avisar(respuesta.mensaje);
        cerrarModal(modalEditar);
        await recargar();
    } catch (error) {
        mensajeModalEditar.textContent = error.message;
        mensajeModalEditar.hidden = false;
    } finally {
        btnGuardarEdicion.disabled = false;
        btnGuardarEdicion.textContent = textoOriginal;
    }
});

function abrirModalBorrar(gasto) {
    estado.gastoPendienteBorrar = gasto;

    textoBorrar.textContent = `¿Seguro que quieres borrar "${gasto.concepto}"?`;

    // Se repiten los datos en el modal para que el borrado nodependa de
    // acordarse de la fila de la tabla
    datosBorrar.innerHTML = `
        <dt>Importe</dt>
        <dd>${euros(gasto.importe)}</dd>
        <dt>Fecha</dt>
        <dd>${escapar(fechaBonita(gasto.fecha))}</dd>
        <dt>Categoría</dt>
        <dd>${escapar(gasto.categoria)}</dd>
        <dt>Método de pago</dt>
        <dd>${escapar(gasto.metodoPago)}</dd>
    `;

    mensajeModalBorrar.hidden = true;
    mensajeModalBorrar.textContent = '';

    abrirModal(modalBorrar);
    btnConfirmarBorrar.focus();
}

btnConfirmarBorrar.addEventListener('click', async () => {
    const gasto = estado.gastoPendienteBorrar;
    if (!gasto) return;

    btnConfirmarBorrar.disabled = true;
    const textoOriginal = btnConfirmarBorrar.textContent;
    btnConfirmarBorrar.textContent = 'Borrando...';

    try {
        const respuesta = await api(`/api/gastos/${gasto.id}`, { method: 'DELETE' });
        avisar(respuesta.mensaje);
        cerrarModal(modalBorrar);
        await recargar();
    } catch (error) {
        mensajeModalBorrar.textContent = error.message;
        mensajeModalBorrar.hidden = false;
    } finally {
        btnConfirmarBorrar.disabled = false;
        btnConfirmarBorrar.textContent = textoOriginal;
    }
});

// --- Acciones de la tabla ---

cuerpoTabla.addEventListener('click', evento => {
    const boton = evento.target.closest('button');
    if (!boton || estado.cargando) return;

    const id = Number(boton.dataset.id);
    const gasto = estado.gastos.find(g => g.id === id);
    if (!gasto) return;

    if (boton.classList.contains('editar')) {
        abrirModalEditar(gasto);
        return;
    }

    if (boton.classList.contains('borrar')) {
        abrirModalBorrar(gasto);
    }
});

// --- Filtros y paginación ---

// Cada cambio en un filtro vuelve a la primera página
filtroCategoria.addEventListener('change', () => { estado.pagina = 1; recargar(); });
filtroOrden.addEventListener('change', () => { estado.pagina = 1; recargar(); });
filtroMes.addEventListener('change', () => { estado.pagina = 1; recargar(); });
filtroDesde.addEventListener('change', () => { estado.pagina = 1; recargar(); });
filtroHasta.addEventListener('change', () => { estado.pagina = 1; recargar(); });

// En el texto se espera a que el usuario pare de escribir: sin esto se lanzarían
// dos peticiones a la API por cada tecla
let temporizadorBusqueda = null;
filtroTexto.addEventListener('input', () => {
    estado.pagina = 1;
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(recargar, 300);
});

// Cambiar de modo limpia el filtro del otro modo, para que no se queden datos
// ocultos que vuelve a la lista al cambiar de pestaña
modoMes.addEventListener('click', () => {
    if (estado.modoPeriodo === 'mes') return;
    estado.modoPeriodo = 'mes';
    aplicarModoPeriodo();
    estado.pagina = 1;
    recargar();
});

modoRango.addEventListener('click', () => {
    if (estado.modoPeriodo === 'rango') return;
    estado.modoPeriodo = 'rango';
    aplicarModoPeriodo();
    estado.pagina = 1;
    recargar();
});

chipsFiltros.addEventListener('click', evento => {
    const boton = evento.target.closest('[data-quitar]');
    if (!boton) return;
    clearTimeout(temporizadorBusqueda);
    quitarFiltro(boton.dataset.quitar);
});

// Marca el tamaño de página que está activo
function pintarLimite() {
    selectorLimite.querySelectorAll('[data-limite]').forEach(boton => {
        boton.setAttribute('aria-pressed', String(Number(boton.dataset.limite) === estado.limite));
    });
}

selectorLimite.addEventListener('click', evento => {
    const boton = evento.target.closest('[data-limite]');
    if (!boton) return;
    estado.limite = Number(boton.dataset.limite);
    pintarLimite();
    estado.pagina = 1;
    recargar();
});

btnLimpiar.addEventListener('click', () => {
    clearTimeout(temporizadorBusqueda);
    filtroTexto.value = '';
    filtroCategoria.value = '';
    filtroOrden.value = 'fecha';
    // Se vuelve al modo Mes, que es el de partida, y se limpian los tres campos
    estado.modoPeriodo = 'mes';
    filtroMes.value = '';
    filtroDesde.value = '';
    filtroHasta.value = '';
    aplicarModoPeriodo();
    estado.pagina = 1;
    recargar();
});

btnPaginaAnterior.addEventListener('click', () => {
    if (estado.pagina > 1) {
        estado.pagina--;
        recargar();
    }
});

btnPaginaSiguiente.addEventListener('click', () => {
    estado.pagina++;
    recargar();
});

// --- Exportar / importar ---

// Descarga un archivo usando los filtros que hay en pantalla
function descargar(url) {
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = '';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
}

function cerrarMenuExportar() {
    menuExportar.open = false;
}

btnExportarCsv.addEventListener('click', () => {
    // La exportación no pagina: el servidor devuelve todo lo que cumple el filtro
    descargar(`/api/gastos/exportar.csv?${queryFiltros(false)}`);
    avisar("Descargando los gastos filtrados en CSV");
    cerrarMenuExportar();
});

btnExportarJson.addEventListener('click', () => {
    descargar(`/api/gastos/exportar.json?${queryFiltros(false)}`);
    avisar("Descargando los gastos filtrados en JSON");
    cerrarMenuExportar();
});

// Un <details> se queda abierto hasta que se pulse otra vez el resumen. Se cierra
// solo al elegir una opción, al pulsar fuera o al darle a Escape
document.addEventListener('click', evento => {
    if (menuExportar.open && !menuExportar.contains(evento.target)) cerrarMenuExportar();
});

document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && menuExportar.open) {
        cerrarMenuExportar();
        menuExportar.querySelector('summary').focus();
    }
});

btnImportar.addEventListener('click', () => archivoCsv.click());

archivoCsv.addEventListener('change', async () => {
    const archivo = archivoCsv.files[0];
    archivoCsv.value = '';
    if (!archivo) return;

    try {
        const contenido = await archivo.text();
        const respuesta = await api('/api/gastos/importar', {
            method: 'POST',
            body: JSON.stringify({ contenido })
        });

        let mensaje = respuesta.mensaje;
        if (respuesta.categoriasCreadas.length) {
            mensaje += `. Categorías nuevas: ${respuesta.categoriasCreadas.join(', ')}`;
        }

        // La importación avisa de lo que se saltó, y con detalle si hubo que hacerlo
        const saltados = (respuesta.omitidos || 0) + (respuesta.duplicados || 0);
        if (saltados) mensaje += `. ${saltados} fila(s) no importada(s)`;

        avisar(mensaje, saltados > 0);

        // El detalle de los fallos se muestra en consola por no saturar la pantalla
        if (respuesta.errores.length) {
            console.warn('Filas omitidas en la importación:', respuesta.errores);
            if (respuesta.erroresOmitidos) {
                console.warn(`... y ${respuesta.erroresOmitidos} error(es) más no detallados.`);
            }
        }

        await cargarCatalogos();
        await recargar();
    } catch (error) {
        avisar(error.message, true);
    }
});

// --- Vaciar todo en dos pasos ---

function ocultarConfirmacion() {
    confirmacionVaciar.hidden = true;
    btnVaciar.focus();
}

// El primer clic solo muestra la confirmación: nada se borra todavía
btnVaciar.addEventListener('click', () => {
    confirmacionVaciar.hidden = false;
    btnVaciarConfirmar.focus();
});

btnVaciarCancelar.addEventListener('click', ocultarConfirmacion);

btnVaciarConfirmar.addEventListener('click', async () => {
    btnVaciarConfirmar.disabled = true;
    btnVaciarConfirmar.textContent = 'Borrando...';
    ocultarConfirmacion();

    try {
        const respuesta = await api('/api/gastos', { method: 'DELETE' });
        avisar(respuesta.mensaje);
        resetearFormulario();
        await recargar();
    } catch (error) {
        avisar(error.message, true);
    } finally {
        btnVaciarConfirmar.disabled = false;
        btnVaciarConfirmar.textContent = 'Sí, borrar todo';
    }
});

// --- Arranque ---

async function iniciar() {
    // El icono del botón se pone al abrir, sin llamar a aplicarTema para no
    // machacar lo que hubiera elegido el usuario ni escribir en localStorage
    const tema = temaActual();
    iconoTema.textContent = tema === 'oscuro' ? '☀️' : '🌙';
    btnTema.title = tema === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

    try {
        await cargarCatalogos();
        aplicarModoPeriodo();
        pintarLimite();
        resetearFormulario();
        await recargar();
    } catch (error) {
        avisar(`No se pudo cargar la aplicación: ${error.message}`, true);
    }
}

iniciar();