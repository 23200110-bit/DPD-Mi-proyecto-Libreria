/* ==========================================================================
   js/modulos/reportes.js
   ========================================================================== */
import { supabaseClient } from '../supabase-config.js';

let datosReporteActual = [];
let miGrafico = null;

export async function inicializarReportes() {
    await cargarKPIs();
    await cargarDatosReporte('ventas');

    const selector = document.getElementById('reporte-tipo');
    if (selector) {
        selector.addEventListener('change', (e) => cargarDatosReporte(e.target.value));
    }

    document.getElementById('btn-exportar-excel')?.addEventListener('click', exportarCSV);
    document.getElementById('btn-imprimir-pdf')?.addEventListener('click', () => window.print());
}

/* ==========================================================================
   KPIs GENERALES
   ========================================================================== */

async function cargarKPIs() {
    const { data: ventas } = await supabaseClient
        .from('ventas')
        .select('total_cobrado');

    const totalVentas    = ventas?.length || 0;
    const ingresoTotal   = ventas?.reduce((s, v) => s + parseFloat(v.total_cobrado || 0), 0) || 0;
    const ticketPromedio = totalVentas > 0 ? ingresoTotal / totalVentas : 0;

    const { data: productos } = await supabaseClient
        .from('productos')
        .select('stock_actual, stock_minimo_alerta');

    const cantidadBajos = (productos || []).filter(p =>
        (p.stock_actual || 0) <= (p.stock_minimo_alerta || 10)
    ).length;

    const el = (id) => document.getElementById(id);
    if (el('kpi-ingresos'))   el('kpi-ingresos').textContent   = `S/ ${ingresoTotal.toFixed(2)}`;
    if (el('kpi-ventas'))     el('kpi-ventas').textContent     = totalVentas;
    if (el('kpi-promedio'))   el('kpi-promedio').textContent   = `S/ ${ticketPromedio.toFixed(2)}`;
    if (el('kpi-stock-bajo')) el('kpi-stock-bajo').textContent = `${cantidadBajos} productos`;
}

/* ==========================================================================
   CARGA DE REPORTES
   ========================================================================== */

async function cargarDatosReporte(tipo) {
    const head   = document.getElementById('tabla-reporte-head');
    const body   = document.getElementById('tabla-reporte-body');
    const titulo = document.getElementById('reporte-titulo');
    if (!body || !head) return;

    body.innerHTML = `<tr><td colspan="6" class="tabla-cargando">⏳ Cargando datos...</td></tr>`;

    try {
        switch (tipo) {
            case 'ventas':          await reporteVentas(head, body, titulo);         break;
            case 'metodo-pago':     await reporteMetodoPago(head, body, titulo);     break;
            case 'top-productos':   await reporteTopProductos(head, body, titulo);   break;
            case 'ventas-dia':      await reporteVentasPorDia(head, body, titulo);   break;
            case 'inventario':      await reporteInventario(head, body, titulo);     break;
            case 'margen-ganancia': await reporteMargenGanancia(head, body, titulo); break;
            case 'hora-pico':      await reporteHoraPico(head, body, titulo);        break;
        }
    } catch (err) {
        console.error('Error en reporte:', err);
        body.innerHTML = `<tr><td colspan="6" class="tabla-cargando texto-rojo">❌ Error al cargar el reporte.</td></tr>`;
    }
}

/* ==========================================================================
   REPORTE 1: Evolución de Ventas
   ========================================================================== */

async function reporteVentas(head, body, titulo) {
    titulo.textContent = 'Consolidado de Ventas';
    document.getElementById('grafico-titulo').textContent = '📈 Evolución de Ingresos por Venta (S/)';

    const { data, error } = await supabaseClient
        .from('ventas')
        .select('*')
        .order('id_venta', { ascending: false });

    if (error) throw error;
    datosReporteActual = data || [];

    head.innerHTML = `<tr>
        <th>ID</th><th>Fecha</th><th>Comprobante</th>
        <th>Método de Pago</th><th style="text-align:right;">Total</th>
    </tr>`;

    body.innerHTML = datosReporteActual.length === 0
        ? `<tr><td colspan="5" class="tabla-cargando">No hay ventas registradas.</td></tr>`
        : datosReporteActual.map(v => {
            const fecha = new Date(v.fecha_hora).toLocaleString('es-PE');
            return `<tr>
                <td class="texto-gris texto-mono">#${v.id_venta}</td>
                <td>${fecha}</td>
                <td>${v.tipo_comprobante || '—'}</td>
                <td><span class="badge-metodo">${v.metodo_pago || 'Efectivo'}</span></td>
                <td style="text-align:right;" class="texto-verde">
                    S/ ${parseFloat(v.total_cobrado).toFixed(2)}
                </td>
            </tr>`;
        }).join('');

    const ultimas = [...datosReporteActual].reverse().slice(-10);
    renderGrafico('line',
        ultimas.map(v => `#${v.id_venta}`),
        ultimas.map(v => parseFloat(v.total_cobrado)),
        'Monto (S/)', 'rgba(2,132,199,0.1)', '#0284c7'
    );
}

/* ==========================================================================
   REPORTE 2: Ventas por Método de Pago
   ========================================================================== */

async function reporteMetodoPago(head, body, titulo) {
    titulo.textContent = 'Ventas por Método de Pago';
    document.getElementById('grafico-titulo').textContent = '💳 Distribución por Método de Pago';

    const { data, error } = await supabaseClient
        .from('ventas')
        .select('metodo_pago, total_cobrado');

    if (error) throw error;

    const agrupado = {};
    (data || []).forEach(v => {
        const m = v.metodo_pago || 'Efectivo';
        if (!agrupado[m]) agrupado[m] = { cantidad: 0, total: 0 };
        agrupado[m].cantidad++;
        agrupado[m].total += parseFloat(v.total_cobrado || 0);
    });

    datosReporteActual = Object.entries(agrupado).map(([metodo, d]) => ({
        metodo, cantidad: d.cantidad, total: d.total
    }));

    head.innerHTML = `<tr>
        <th>Método de Pago</th>
        <th style="text-align:right;">N° Ventas</th>
        <th style="text-align:right;">Total Recaudado</th>
        <th style="text-align:right;">% del Total</th>
    </tr>`;

    const granTotal = datosReporteActual.reduce((s, d) => s + d.total, 0);

    body.innerHTML = datosReporteActual.length === 0
        ? `<tr><td colspan="4" class="tabla-cargando">No hay datos.</td></tr>`
        : datosReporteActual.map(d => `<tr>
            <td><span class="badge-metodo">${d.metodo}</span></td>
            <td style="text-align:right;">${d.cantidad}</td>
            <td style="text-align:right;" class="texto-verde">S/ ${d.total.toFixed(2)}</td>
            <td style="text-align:right;" class="texto-gris">
                ${granTotal > 0 ? ((d.total / granTotal) * 100).toFixed(1) : 0}%
            </td>
        </tr>`).join('');

    renderGrafico('doughnut',
        datosReporteActual.map(d => d.metodo),
        datosReporteActual.map(d => d.total),
        'Total (S/)',
        ['rgba(2,132,199,0.7)', 'rgba(16,185,129,0.7)', 'rgba(139,92,246,0.7)'],
        ['#0284c7', '#10b981', '#8b5cf6']
    );
}

/* ==========================================================================
   REPORTE 3: Top Productos Más Vendidos
   ========================================================================== */

async function reporteTopProductos(head, body, titulo) {
    titulo.textContent = 'Top Productos Más Vendidos';
    document.getElementById('grafico-titulo').textContent = '🏆 Top 10 Productos por Unidades Vendidas';

    const { data, error } = await supabaseClient
        .from('detalles_ventas')
        .select(`cantidad, precio_unitario, productos ( nombre )`);

    if (error) throw error;

    const agrupado = {};
    (data || []).forEach(d => {
        const nombre = d.productos?.nombre || 'Desconocido';
        if (!agrupado[nombre]) agrupado[nombre] = { unidades: 0, ingresos: 0 };
        agrupado[nombre].unidades += d.cantidad;
        agrupado[nombre].ingresos += d.cantidad * parseFloat(d.precio_unitario || 0);
    });

    datosReporteActual = Object.entries(agrupado)
        .map(([nombre, d]) => ({ nombre, ...d }))
        .sort((a, b) => b.unidades - a.unidades)
        .slice(0, 10);

    head.innerHTML = `<tr>
        <th>#</th><th>Producto</th>
        <th style="text-align:right;">Unidades Vendidas</th>
        <th style="text-align:right;">Ingresos Generados</th>
    </tr>`;

    body.innerHTML = datosReporteActual.length === 0
        ? `<tr><td colspan="4" class="tabla-cargando">No hay datos de ventas.</td></tr>`
        : datosReporteActual.map((d, i) => `<tr>
            <td class="texto-gris">${i + 1}</td>
            <td style="font-weight:600;">${d.nombre}</td>
            <td style="text-align:right;">${d.unidades} uds</td>
            <td style="text-align:right;" class="texto-verde">S/ ${d.ingresos.toFixed(2)}</td>
        </tr>`).join('');

    renderGrafico('bar',
        datosReporteActual.map(d =>
            d.nombre.length > 18 ? d.nombre.substring(0, 18) + '…' : d.nombre),
        datosReporteActual.map(d => d.unidades),
        'Unidades vendidas', 'rgba(139,92,246,0.2)', '#8b5cf6', true
    );
}

/* ==========================================================================
   REPORTE 4: Ventas por Día de la Semana
   ========================================================================== */

async function reporteVentasPorDia(head, body, titulo) {
    titulo.textContent = 'Ventas por Día de la Semana';
    document.getElementById('grafico-titulo').textContent = '📅 Distribución de Ventas por Día';

    const { data, error } = await supabaseClient
        .from('ventas')
        .select('fecha_hora, total_cobrado');

    if (error) throw error;

    const dias      = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const agrupado  = dias.map(d => ({ dia: d, cantidad: 0, total: 0 }));

    (data || []).forEach(v => {
        const idx = new Date(v.fecha_hora).getDay();
        agrupado[idx].cantidad++;
        agrupado[idx].total += parseFloat(v.total_cobrado || 0);
    });

    datosReporteActual = agrupado;

    head.innerHTML = `<tr>
        <th>Día</th>
        <th style="text-align:right;">N° Ventas</th>
        <th style="text-align:right;">Total Recaudado</th>
        <th style="text-align:right;">Promedio por Venta</th>
    </tr>`;

    body.innerHTML = agrupado.map(d => `<tr>
        <td style="font-weight:600;">${d.dia}</td>
        <td style="text-align:right;">${d.cantidad}</td>
        <td style="text-align:right;" class="texto-verde">S/ ${d.total.toFixed(2)}</td>
        <td style="text-align:right;" class="texto-gris">
            S/ ${d.cantidad > 0 ? (d.total / d.cantidad).toFixed(2) : '0.00'}
        </td>
    </tr>`).join('');

    renderGrafico('bar',
        agrupado.map(d => d.dia),
        agrupado.map(d => d.total),
        'Total (S/)', 'rgba(245,158,11,0.2)', '#f59e0b'
    );
}

/* ==========================================================================
   REPORTE 5: Estado de Inventario
   ========================================================================== */

async function reporteInventario(head, body, titulo) {
    titulo.textContent = 'Estado de Inventario';
    document.getElementById('grafico-titulo').textContent = '📦 Niveles de Stock por Producto';

    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('stock_actual', { ascending: true });

    if (error) throw error;
    datosReporteActual = data || [];

    head.innerHTML = `<tr>
        <th>Código</th><th>Producto</th>
        <th style="text-align:right;">Precio Venta</th>
        <th style="text-align:right;">Stock</th>
        <th style="text-align:right;">Valor en Almacén</th>
    </tr>`;

    body.innerHTML = datosReporteActual.length === 0
        ? `<tr><td colspan="5" class="tabla-cargando">No hay productos.</td></tr>`
        : datosReporteActual.map(p => {
            const stock  = p.stock_actual || 0;
            const minimo = p.stock_minimo_alerta || 10;
            const bajo   = stock <= minimo;
            const valor  = stock * parseFloat(p.precio_venta || 0);
            return `<tr>
                <td class="texto-gris texto-mono">${p.codigo_barras || p.id}</td>
                <td style="font-weight:600;">${p.nombre}</td>
                <td style="text-align:right;" class="texto-gris">
                    S/ ${parseFloat(p.precio_venta).toFixed(2)}
                </td>
                <td style="text-align:right;" class="${bajo ? 'texto-rojo' : 'texto-verde'}">
                    ${stock} uds
                </td>
                <td style="text-align:right;" class="texto-mono">S/ ${valor.toFixed(2)}</td>
            </tr>`;
        }).join('');

    const top7 = datosReporteActual.slice(-7);
    renderGrafico('bar',
        top7.map(p => p.nombre.length > 15 ? p.nombre.substring(0, 15) + '…' : p.nombre),
        top7.map(p => p.stock_actual),
        'Unidades en stock', 'rgba(16,185,129,0.15)', '#10b981'
    );
}

/* ==========================================================================
   REPORTE 6: Margen de Ganancia por Producto
   ========================================================================== */

async function reporteMargenGanancia(head, body, titulo) {
    titulo.textContent = 'Margen de Ganancia por Producto';
    document.getElementById('grafico-titulo').textContent = '💹 Margen de Ganancia por Producto (%)';

    const { data: productos, error: errP } = await supabaseClient
        .from('productos')
        .select('id, nombre, precio_venta')
        .order('nombre', { ascending: true });

    if (errP) throw errP;

    const { data: compras, error: errC } = await supabaseClient
        .from('compras')
        .select('producto_id, precio_costo')
        .order('id_compra', { ascending: false });

    if (errC) throw errC;

    // Tomar el precio de costo más reciente por producto
    const costoMap = {};
    (compras || []).forEach(c => {
        if (!costoMap[c.producto_id]) {
            costoMap[c.producto_id] = parseFloat(c.precio_costo || 0);
        }
    });

    datosReporteActual = (productos || [])
        .filter(p => costoMap[p.id] !== undefined)
        .map(p => {
            const venta    = parseFloat(p.precio_venta || 0);
            const costo    = costoMap[p.id];
            const ganancia = venta - costo;
            const margen   = venta > 0 ? ((venta - costo) / venta) * 100 : 0;
            return { nombre: p.nombre, venta, costo, ganancia, margen };
        })
        .sort((a, b) => b.margen - a.margen);

    head.innerHTML = `<tr>
        <th>#</th>
        <th>Producto</th>
        <th style="text-align:right;">Precio Costo</th>
        <th style="text-align:right;">Precio Venta</th>
        <th style="text-align:right;">Ganancia x Und</th>
        <th style="text-align:right;">Margen %</th>
    </tr>`;

    body.innerHTML = datosReporteActual.length === 0
        ? `<tr><td colspan="6" class="tabla-cargando">
               No hay productos con historial de compras registrado.
           </td></tr>`
        : datosReporteActual.map((d, i) => {
            const color = d.margen >= 30 ? 'texto-verde'
                        : d.margen >= 10 ? ''
                        : 'texto-rojo';
            return `<tr>
                <td class="texto-gris">${i + 1}</td>
                <td style="font-weight:600;">${d.nombre}</td>
                <td style="text-align:right;" class="texto-gris">S/ ${d.costo.toFixed(2)}</td>
                <td style="text-align:right;">S/ ${d.venta.toFixed(2)}</td>
                <td style="text-align:right;" class="${color}">S/ ${d.ganancia.toFixed(2)}</td>
                <td style="text-align:right; font-weight:700;" class="${color}">
                    ${d.margen.toFixed(1)}%
                </td>
            </tr>`;
        }).join('');

    renderGrafico('bar',
        datosReporteActual.map(d =>
            d.nombre.length > 20 ? d.nombre.substring(0, 20) + '…' : d.nombre),
        datosReporteActual.map(d => parseFloat(d.margen.toFixed(1))),
        'Margen (%)',
        datosReporteActual.map(d =>
            d.margen >= 30 ? 'rgba(16,185,129,0.25)'
            : d.margen >= 10 ? 'rgba(245,158,11,0.25)'
            : 'rgba(220,38,38,0.25)'
        ),
        datosReporteActual.map(d =>
            d.margen >= 30 ? '#10b981'
            : d.margen >= 10 ? '#f59e0b'
            : '#dc2626'
        ),
        true
    );
}


/* ==========================================================================
   REPORTE 7: Hora Pico de Ventas
   ========================================================================== */

async function reporteHoraPico(head, body, titulo) {
    titulo.textContent = 'Hora Pico de Ventas';
    document.getElementById('grafico-titulo').textContent = '🕐 Distribución de Ventas por Hora del Día';

    const { data, error } = await supabaseClient
        .from('ventas')
        .select('fecha_hora, total_cobrado');

    if (error) throw error;

    // Agrupar por hora (0-23)
    const porHora = Array.from({ length: 24 }, (_, h) => ({
        hora: h,
        etiqueta: `${String(h).padStart(2, '0')}:00`,
        cantidad: 0,
        total: 0
    }));

    (data || []).forEach(v => {
        const hora = new Date(v.fecha_hora).getHours();
        porHora[hora].cantidad++;
        porHora[hora].total += parseFloat(v.total_cobrado || 0);
    });

    // Solo mostrar horas con al menos una venta en la tabla
    const horasConVentas = porHora.filter(h => h.cantidad > 0);
    datosReporteActual   = horasConVentas.sort((a, b) => b.cantidad - a.cantidad);

    // Hora con más ventas para destacarla
    const horaPico = porHora.reduce((max, h) => h.cantidad > max.cantidad ? h : max, porHora[0]);

    head.innerHTML = `<tr>
        <th>Hora</th>
        <th style="text-align:right;">N° Ventas</th>
        <th style="text-align:right;">Total Recaudado</th>
        <th style="text-align:right;">Promedio por Venta</th>
        <th style="text-align:center;">Actividad</th>
    </tr>`;

    body.innerHTML = datosReporteActual.length === 0
        ? `<tr><td colspan="5" class="tabla-cargando">No hay ventas registradas aún.</td></tr>`
        : datosReporteActual.map(h => {
            const esPico    = h.hora === horaPico.hora;
            const promedio  = h.cantidad > 0 ? h.total / h.cantidad : 0;
            const maxCant   = horaPico.cantidad;
            const pctBarra  = maxCant > 0 ? Math.round((h.cantidad / maxCant) * 100) : 0;
            const colorBarra = pctBarra >= 80 ? '#dc2626'
                             : pctBarra >= 50 ? '#f59e0b'
                             : '#10b981';
            return `<tr style="${esPico ? 'background:#fff7ed;' : ''}">
                <td style="font-weight:${esPico ? '700' : '500'};">
                    ${h.etiqueta} ${esPico ? '🔥' : ''}
                </td>
                <td style="text-align:right; font-weight:600;">${h.cantidad}</td>
                <td style="text-align:right;" class="texto-verde">S/ ${h.total.toFixed(2)}</td>
                <td style="text-align:right;" class="texto-gris">S/ ${promedio.toFixed(2)}</td>
                <td style="padding:10px 14px;">
                    <div style="background:#f1f5f9; border-radius:4px; height:8px; overflow:hidden;">
                        <div style="
                            width:${pctBarra}%;
                            height:100%;
                            background:${colorBarra};
                            border-radius:4px;
                            transition:width 0.4s;
                        "></div>
                    </div>
                </td>
            </tr>`;
        }).join('');

    // Gráfico de barras con todas las horas (0-23) para ver el patrón completo
    const colores = porHora.map(h => {
        const pct = horaPico.cantidad > 0 ? h.cantidad / horaPico.cantidad : 0;
        return pct >= 0.8 ? 'rgba(220,38,38,0.7)'
             : pct >= 0.5 ? 'rgba(245,158,11,0.7)'
             : 'rgba(16,185,129,0.5)';
    });

    renderGrafico('bar',
        porHora.map(h => h.etiqueta),
        porHora.map(h => h.cantidad),
        'N° de Ventas',
        colores,
        colores.map(c => c.replace('0.7', '1').replace('0.5', '1'))
    );
}

/* ==========================================================================
   RENDER DEL GRÁFICO
   ========================================================================== */

function renderGrafico(tipo, labels, valores, labelDataset, colorFondo, colorBorde, horizontal = false) {
    const ctx = document.getElementById('graficoReporte');
    if (!ctx) return;

    if (miGrafico) miGrafico.destroy();

    const esDoughnut = tipo === 'doughnut';

    // Registrar plugin datalabels solo si está disponible
    const pluginsRegistrados = {};
    if (esDoughnut && typeof ChartDataLabels !== 'undefined') {
        pluginsRegistrados.datalabels = {
            color: '#ffffff',
            font: { weight: 'bold', size: 13 },
            formatter: (value, ctx) => {
                const total = ctx.chart.data.datasets[0].data
                    .reduce((a, b) => a + b, 0);
                const pct = ((value / total) * 100).toFixed(1);
                return `${pct}%`;
            }
        };
    } else {
        pluginsRegistrados.datalabels = false;
    }

    miGrafico = new Chart(ctx, {
        type: tipo,
        plugins: typeof ChartDataLabels !== 'undefined' && esDoughnut
            ? [ChartDataLabels]
            : [],
        data: {
            labels,
            datasets: [{
                label: labelDataset,
                data: valores,
                backgroundColor: colorFondo,
                borderColor: colorBorde,
                borderWidth: esDoughnut ? 3 : 2,
                tension: 0.35,
                fill: !esDoughnut,
                pointBackgroundColor: colorBorde,
                pointRadius: tipo === 'line' ? 4 : 0,
                hoverOffset: esDoughnut ? 8 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: horizontal ? 'y' : 'x',
            plugins: {
                legend: {
                    display: esDoughnut,
                    position: 'right',
                    labels: { font: { size: 12 }, color: '#334155' }
                },
                ...pluginsRegistrados,
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.parsed.y ?? ctx.parsed;
                            return typeof val === 'number' && labelDataset.includes('S/')
                                ? ` S/ ${val.toFixed(2)}`
                                : ` ${val}`;
                        }
                    }
                }
            },
            scales: esDoughnut ? {} : {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#64748b', font: { size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { size: 11 } }
                }
            }
        }
    });
}

/* ==========================================================================
   EXPORTAR CSV
   ========================================================================== */

function exportarCSV() {
    if (datosReporteActual.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }

    const tipo  = document.getElementById('reporte-tipo')?.value || 'reporte';
    const keys  = Object.keys(datosReporteActual[0]);
    const filas = datosReporteActual.map(obj =>
        keys.map(k => `"${String(obj[k] ?? '').replace(/"/g, '""')}"`).join(',')
    );

    const csv  = [keys.join(','), ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `Reporte_${tipo}_${new Date().toLocaleDateString('es-PE').replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}