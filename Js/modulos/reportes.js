import { supabaseClient } from '../supabase-config.js';

// Variables globales para el manejo del reporte actual y el gráfico
let datosReporteActual = [];
let miGrafico = null;

export function inicializarReportes() {
    console.log("Módulo de Reportes con Dashboard cargado y optimizado");

    // Cargar reporte inicial (Ventas)
    cargarDatosReporte('ventas');

    // Escuchar cambios en el selector de tipo de reporte
    const selector = document.getElementById('reporte-tipo');
    if (selector) {
        selector.addEventListener('change', (e) => {
            cargarDatosReporte(e.target.value);
        });
    }

    // Escuchar botones de exportación
    document.getElementById('btn-exportar-excel')?.addEventListener('click', exportarCSV);
    document.getElementById('btn-imprimir-pdf')?.addEventListener('click', () => window.print());
}

async function cargarDatosReporte(tipo) {
    const head = document.getElementById('tabla-reporte-head');
    const body = document.getElementById('tabla-reporte-body');
    const titulo = document.getElementById('reporte-titulo');
    const graficoTitulo = document.getElementById('grafico-titulo');

    if (!body || !head) return;

    body.innerHTML = `<tr><td style="text-align:center; padding:30px; color:#64748b;">Procesando analítica en tiempo real...</td></tr>`;

    try {
        if (tipo === 'ventas') {
            titulo.textContent = "Consolidado de Ventas Realizadas";
            graficoTitulo.textContent = "📈 Evolución de Ingresos por Venta (S/)";

            // Consultar tabla de ventas en Supabase
            const { data: ventas, error } = await supabaseClient
                .from('ventas')
                .select('*')
                .order('id_venta', { ascending: false });

            if (error) throw error;
            datosReporteActual = ventas || [];

            // Armar cabecera Senior de ventas
            head.innerHTML = `
                <tr style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">
                    <th style="padding: 12px 16px; text-align: left;">ID Venta</th>
                    <th style="padding: 12px 16px; text-align: left;">Fecha Emitida</th>
                    <th style="padding: 12px 16px; text-align: left;">Método de Pago</th>
                    <th style="padding: 12px 16px; text-align: right; width: 150px;">Total Cobrado</th>
                </tr>`;

            if (datosReporteActual.length === 0) {
                body.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">No hay registros de ventas en la base de datos.</td></tr>`;
                return;
            }

            // Inyección limpia no destructiva
            body.innerHTML = datosReporteActual.map(v => {
                const f = new Date(v.fecha_venta).toLocaleDateString();
                return `
                    <tr style="background: #ffffff;">
                        <td style="padding: 14px 16px; color: #64748b; font-weight: 500; font-size: 14px; border-bottom: 1px solid #f1f5f9;">#${v.id_venta}</td>
                        <td style="padding: 14px 16px; color: #1e293b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${f}</td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
                            <span style="background-color: #f1f5f9; color: #334155; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 50px;">
                                💳 ${v.metodo_pago || 'Efectivo'}
                            </span>
                        </td>
                        <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #16a34a; font-size: 14px; font-family: monospace; border-bottom: 1px solid #f1f5f9;">S/. ${parseFloat(v.total_cobrado).toFixed(2)}</td>
                    </tr>`;
            }).join('');

        } else if (tipo === 'inventario') {
            titulo.textContent = "Estado de Almacén e Inventario Global";
            graficoTitulo.textContent = "📊 Niveles de Stock por Producto";

            // Consultar tabla de productos en Supabase
            const { data: productos, error } = await supabaseClient
                .from('productos')
                .select('*')
                .order('stock_actual', { ascending: true });

            if (error) throw error;
            datosReporteActual = productos || [];

            // Armar cabecera Senior de inventario
            head.innerHTML = `
                <tr style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">
                    <th style="padding: 12px 16px; text-align: left; width: 160px;">Código de Barras</th>
                    <th style="padding: 12px 16px; text-align: left;">Descripción del Producto</th>
                    <th style="padding: 12px 16px; text-align: right; width: 130px;">Precio Venta</th>
                    <th style="padding: 12px 16px; text-align: right; width: 130px;">Disponibilidad</th>
                </tr>`;

            if (datosReporteActual.length === 0) {
                body.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">No hay productos registrados en almacén.</td></tr>`;
                return;
            }

            // Inyección limpia sin alterar listeners globales
            body.innerHTML = datosReporteActual.map(p => {
                const stock = p.stock_actual || 0;
                const min = p.stock_minimo_alerta || 10;
                const colorStock = stock <= min ? '#dc2626' : '#0f172a';
                const pesoStock = stock <= min ? '700' : '600';

                return `
                    <tr style="background: #ffffff;">
                        <td style="padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
                            <span style="background-color: #f1f5f9; color: #475569; font-family: monospace; font-size: 13px; font-weight: 600; padding: 4px 8px; border-radius: 6px;">
                                ${p.codigo_barras || p.id}
                            </span>
                        </td>
                        <td style="padding: 14px 16px; color: #1e293b; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${p.nombre}</td>
                        <td style="padding: 14px 16px; text-align: right; color: #475569; font-size: 14px; font-family: monospace; border-bottom: 1px solid #f1f5f9;">S/. ${parseFloat(p.precio_venta).toFixed(2)}</td>
                        <td style="padding: 14px 16px; text-align: right; font-weight: ${pesoStock}; color: ${colorStock}; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${stock} und</td>
                    </tr>`;
            }).join('');
        }

        // --- RENDERIZAR EL GRÁFICO ESTADÍSTICO ---
        renderizarGraficoDashboard(tipo);

    } catch (error) {
        console.error("Error cargando reporte:", error.message);
        body.innerHTML = `<tr><td style="text-align:center; color:#dc2626; font-weight:600; padding:30px;">❌ Error de sincronización de analíticas con Supabase.</td></tr>`;
    }
}

function renderizarGraficoDashboard(tipo) {
    const ctx = document.getElementById('graficoReporte');
    if (!ctx) return;

    // Destruir gráfico anterior si existe para evitar duplicados visuales al mover el mouse
    if (miGrafico) {
        miGrafico.destroy();
    }

    let labels = [];
    let valores = [];
    let nombreDataset = '';
    let colorFondo = '';
    let colorBorde = '';
    let tipoGrafico = 'bar'; 

    if (tipo === 'ventas') {
        tipoGrafico = 'line'; // Gráfico de línea ideal para tendencias financieras
        const ultimasVentas = [...datosReporteActual].slice(0, 7).reverse();
        labels = ultimasVentas.map(v => `Venta #${v.id_venta}`);
        valores = ultimasVentas.map(v => v.total_cobrado);
        nombreDataset = 'Monto Recaudado (S/)';
        colorFondo = 'rgba(2, 132, 199, 0.1)';
        colorBorde = '#0284c7';
    } else {
        tipoGrafico = 'bar'; // Gráfico de barras ideal para comparar inventario
        const pocosProductos = datosReporteActual.slice(0, 7);
        labels = pocosProductos.map(p => p.nombre.length > 15 ? p.nombre.substring(0, 15) + '...' : p.nombre);
        valores = pocosProductos.map(p => p.stock_actual);
        nombreDataset = 'Unidades en Almacén';
        colorFondo = 'rgba(16, 185, 129, 0.15)';
        colorBorde = '#10b981';
    }

    // Crear la nueva instancia de Chart.js con diseño refinado
    miGrafico = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: labels,
            datasets: [{
                label: nombreDataset,
                data: valores,
                backgroundColor: colorFondo,
                borderColor: colorBorde,
                borderWidth: 2.5,
                tension: 0.35, 
                fill: true,
                pointBackgroundColor: colorBorde,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true, 
                    position: 'top',
                    labels: { font: { weight: '600', size: 12 }, color: '#334155' }
                }
            },
            scales: {
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

function exportarCSV() {
    if (datosReporteActual.length === 0) return alert("No hay datos para exportar");
    
    let contenido = "data:text/csv;charset=utf-8,";
    const filas = datosReporteActual.map(obj => Object.values(obj).join(","));
    contenido += Object.keys(datosReporteActual[0]).join(",") + "\n" + filas.join("\n");
    
    const uriEncriptada = encodeURI(contenido);
    const link = document.createElement("a");
    link.setAttribute("href", uriEncriptada);
    link.setAttribute("download", `Reporte_${document.getElementById('reporte-tipo').value}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}