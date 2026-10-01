/* Control de gastos - lógica del cliente (CRUD contra la API Express) */

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

const formularioCategoria = document.getElementById('formularioCategoria');
const nombreCategoria = document.getElementById('nombreCategoria');
const errorCategoria = document.getElementById('errorCategoria');
const listaCategoriasForm = document.getElementById('listaCategoriasForm');

const graficoCategorias = document.getElementById('graficoCategorias');
const graficoMeses = document.getElementById('graficoMeses');
const graficoVacioCategorias = document.getElementById('graficoVacioCategorias');
const graficoVacioMeses = document.getElementById('graficoVacioMeses');

// --- Estado de la interfaz ---
const estado = {
    pagina: 1,
    limite: 10,
    cargando: false,
    // Cada recarga usa un número mayor: si llegan desordenadas, se descartan las viejas
    secuencia: 0,
    gastos: [],
    categorias: [],
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
    try {
        const respuesta = await api('/api/presupuesto', {
            method: 'PUT',
            body: JSON.stringify({ limite: inputPresupuesto.value })
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

    const { limite, gastado, restante, porcentaje } = resumen.presupuesto;
    document.getElementById('resumenPresupuesto').textContent = `${euros(gastado)} / ${euros(limite)}`;

    const barra = document.getElementById('barraPresupuesto');
    barra.style.width = `${Math.min(porcentaje, 100)}%`;
    barra.classList.toggle('aviso', porcentaje >= 80 && porcentaje < 100);
    barra.classList.toggle('excedido', porcentaje >= 100);

    document.getElementById('resumenRestante').textContent = restante >= 0
        ? `Te quedan ${euros(restante)} este mes`
        : `Te has pasado por ${euros(Math.abs(restante))}`;

    // El campo del presupuesto muestra el límite vigente solo si no se está editando
    if (document.activeElement !== inputPresupuesto) {
        inputPresupuesto.value = limite;
    }
}

// --- Gráficos (Chart.js si está disponible) ---

const COLOR_ESTADO = {
    ok: '#2f6f4f',
    acento: '#e8a33d'
};

// Si la librería no cargó (sin internet) los gráficos simplemente no se pintan
function tieneChartJs() {
    return typeof window.Chart !== 'undefined';
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

    if (hayCategorias) {
        estado.graficos.categorias = new Chart(graficoCategorias, {
            type: 'doughnut',
            data: {
                labels: resumen.categorias.map(c => c.categoria),
                datasets: [{
                    data: resumen.categorias.map(c => c.importe),
                    backgroundColor: [COLOR_ESTADO.ok, COLOR_ESTADO.acento, '#5b8fa8', '#9c6b9e', '#c96f4a', '#7a9e5b']
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
        estado.graficos.meses = new Chart(graficoMeses, {
            type: 'bar',
            data: {
                labels: etiquetas,
                datasets: [{
                    label: 'Gasto por mes',
                    data: resumen.meses.map(m => m.importe),
                    backgroundColor: etiquetas.map((_, i) => COLOR_ESTADO.ok),
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
                    y: {
                        beginAtZero: true,
                        ticks: {
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
        if (respuesta.omitidos) {
            mensaje += `. ${respuesta.omitidos} fila(s) omitidas por errores`;
        }
        avisar(mensaje, respuesta.omitidos > 0);

        // El detalle de los fallos se muestra en consola por no saturar la pantalla
        if (respuesta.errores.length) {
            console.warn('Filas omitidas en la importación:', respuesta.errores);
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
    try {
        await cargarCatalogos();
        resetearFormulario();
        await recargar();
    } catch (error) {
        avisar(`No se pudo cargar la aplicación: ${error.message}`, true);
    }
}

iniciar();