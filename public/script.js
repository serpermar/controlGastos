// --- Referencias al DOM ---
const formulario = document.getElementById('formularioGasto');
const campoId = document.getElementById('gastoId');
const campoConcepto = document.getElementById('concepto');
const campoImporte = document.getElementById('importe');
const campoFecha = document.getElementById('fecha');
const campoCategoria = document.getElementById('categoria');
const campoMetodoPago = document.getElementById('metodoPago');
const campoNotas = document.getElementById('notas');

const mensajeFormulario = document.getElementById('mensajeFormulario');
const mensajeVacio = document.getElementById('mensajeVacio');
const mensajeGlobal = document.getElementById('mensajeGlobal');
const tituloFormulario = document.getElementById('tituloFormulario');
const btnGuardar = document.getElementById('btnGuardar');
const btnCancelar = document.getElementById('btnCancelar');
const cuerpoTabla = document.getElementById('cuerpoTabla');
const tablaGastos = document.getElementById('tablaGastos');

const filtroTexto = document.getElementById('filtroTexto');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroMes = document.getElementById('filtroMes');
const filtroDesde = document.getElementById('filtroDesde');
const filtroHasta = document.getElementById('filtroHasta');
const filtroOrden = document.getElementById('filtroOrden');
const filtroLimite = document.getElementById('filtroLimite');
const btnLimpiar = document.getElementById('btnLimpiar');

const paginacion = document.getElementById('paginacion');
const paginacionInfo = document.getElementById('paginacionInfo');
const btnPaginaAnterior = document.getElementById('btnPaginaAnterior');
const btnPaginaSiguiente = document.getElementById('btnPaginaSiguiente');

const btnExportarCsv = document.getElementById('btnExportarCsv');
const btnExportarJson = document.getElementById('btnExportarJson');
const btnImportar = document.getElementById('btnImportar');
const archivoCsv = document.getElementById('archivoCsv');

const btnVaciar = document.getElementById('btnVaciar');
const confirmacionVaciar = document.getElementById('confirmacionVaciar');
const btnVaciarConfirmar = document.getElementById('btnVaciarConfirmar');
const btnVaciarCancelar = document.getElementById('btnVaciarCancelar');

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

    campoCategoria.innerHTML = opciones;
    campoMetodoPago.innerHTML = metodos.map(m => `<option value="${escapar(m)}">${escapar(m)}</option>`).join('');

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

// Construye la query de los filtros activos (los vacíos no se envían)
function queryFiltros(conPagina = true) {
    const params = new URLSearchParams();
    if (filtroTexto.value.trim()) params.set('texto', filtroTexto.value.trim());
    if (filtroCategoria.value) params.set('categoria', filtroCategoria.value);
    if (filtroMes.value) params.set('mes', filtroMes.value);
    if (filtroDesde.value) params.set('desde', filtroDesde.value);
    if (filtroHasta.value) params.set('hasta', filtroHasta.value);
    params.set('orden', filtroOrden.value);
    if (conPagina) {
        params.set('page', estado.pagina);
        params.set('limit', estado.limite);
    }
    return params.toString();
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
            <td class="derecha importe">${euros(g.importe)}</td>
            <td>
                <div class="acciones-fila">
                    <button type="button" class="btn-icono editar" data-id="${g.id}">Editar</button>
                    <button type="button" class="btn-icono borrar" data-id="${g.id}">Borrar</button>
                </div>
            </td>
        </tr>
    `).join('');

    mensajeVacio.hidden = lista.length > 0;
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

// --- Formulario: alta y edición ---

// Vuelve al modo "nuevo gasto" y limpia el formulario
function resetearFormulario() {
    formulario.reset();
    campoId.value = '';

    const hoy = new Date();
    campoFecha.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    tituloFormulario.textContent = 'Nuevo gasto';
    btnGuardar.textContent = 'Añadir gasto';
    btnGuardar.disabled = false;
    btnCancelar.hidden = true;
    mensajeFormulario.hidden = true;
}

// Pasa el formulario a modo edición con los datos del gasto
function modoEditar(gasto) {
    campoId.value = gasto.id;
    campoConcepto.value = gasto.concepto;
    campoImporte.value = gasto.importe;
    campoFecha.value = gasto.fecha;
    campoCategoria.value = gasto.categoria;
    campoMetodoPago.value = gasto.metodoPago;
    campoNotas.value = gasto.notas || '';

    tituloFormulario.textContent = `Editando #${gasto.id}`;
    btnGuardar.textContent = 'Guardar cambios';
    btnGuardar.disabled = false;
    btnCancelar.hidden = false;
    mensajeFormulario.hidden = true;
    campoConcepto.focus();
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

    const id = campoId.value;
    const textoOriginal = btnGuardar.textContent;
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    try {
        const respuesta = id
            ? await api(`/api/gastos/${id}`, { method: 'PUT', body: JSON.stringify(datos) })
            : await api('/api/gastos', { method: 'POST', body: JSON.stringify(datos) });

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

btnCancelar.addEventListener('click', resetearFormulario);

// --- Acciones de la tabla ---

cuerpoTabla.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('button');
    if (!boton || estado.cargando) return;

    const id = Number(boton.dataset.id);
    const gasto = estado.gastos.find(g => g.id === id);
    if (!gasto) return;

    if (boton.classList.contains('editar')) {
        modoEditar(gasto);
        return;
    }

    if (boton.classList.contains('borrar')) {
        const ok = window.confirm(
            `¿Seguro que quieres borrar el gasto "${gasto.concepto}" (${euros(gasto.importe)})?`
        );
        if (!ok) return;

        boton.disabled = true;
        try {
            const respuesta = await api(`/api/gastos/${id}`, { method: 'DELETE' });
            avisar(respuesta.mensaje);

            // Si se estaba editando justo ese gasto, el formulario vuelve a modo alta
            if (campoId.value === String(id)) resetearFormulario();
            await recargar();
        } catch (error) {
            avisar(error.message, true);
            boton.disabled = false;
        }
    }
});

// --- Filtros y paginación ---

// Cada cambio en un filtro vuelve a la primera página
filtroCategoria.addEventListener('change', () => { estado.pagina = 1; recargar(); });
filtroMes.addEventListener('change', () => { estado.pagina = 1; recargar(); });
filtroOrden.addEventListener('change', () => { estado.pagina = 1; recargar(); });
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

filtroLimite.addEventListener('change', () => {
    estado.limite = Number(filtroLimite.value);
    estado.pagina = 1;
    recargar();
});

btnLimpiar.addEventListener('click', () => {
    clearTimeout(temporizadorBusqueda);
    filtroTexto.value = '';
    filtroCategoria.value = '';
    filtroMes.value = '';
    filtroDesde.value = '';
    filtroHasta.value = '';
    filtroOrden.value = 'fecha';
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

btnExportarCsv.addEventListener('click', () => {
    // La exportación no pagina: el servidor devuelve todo lo que cumple el filtro
    descargar(`/api/gastos/exportar.csv?${queryFiltros(false)}`);
    avisar("Descargando los gastos filtrados en CSV");
});

btnExportarJson.addEventListener('click', () => {
    descargar(`/api/gastos/exportar.json?${queryFiltros(false)}`);
    avisar("Descargando los gastos filtrados en JSON");
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
        resetearFormulario();
        await recargar();
    } catch (error) {
        avisar(`No se pudo cargar la aplicación: ${error.message}`, true);
    }
}

iniciar();