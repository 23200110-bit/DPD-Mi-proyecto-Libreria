import { supabaseClient } from '../supabase-config.js';

// Variables globales para el manejo del reporte actual y el gráfico
let datosReporteActual = [];
let miGrafico = null;

export function inicializarReportes() {
    console.log("Módulo de Reportes con Dashboard cargado");

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

    body.innerHTML = `<tr><td style="text-align:center; padding:20px;">Procesando analítica...</td></tr>`;

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

            // Armar cabecera de ventas
            head.innerHTML = `
                <tr>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1; text-align:left;">ID Venta</th>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1; text-align:left;">Fecha</th>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1; text-align:left;">Método Pago</th>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1; text-align:right;">Total Cobrado</th>
                </tr>`;

            if (datosReporteActual.length === 0) {
                body.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">No hay registros de ventas.</td></tr>`;
                return;
            }

            // Llenar filas de la tabla
            body.innerHTML = '';
            datosReporteActual.forEach(v => {
                const f = new Date(v.fecha_venta).toLocaleDateString();
                body.innerHTML += `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0;">#${v.id_venta}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${f}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${v.metodo_pago || 'Efectivo'}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:600; color:#16a34a;">S/ ${parseFloat(v.total_cobrado).toFixed(2)}</td>
                    </tr>`;
            });

        } else if (tipo === 'inventario') {
            titulo.textContent = "Estado de Almacén e Inventario";
            graficoTitulo.textContent = "📊 Niveles de Stock por Producto";

            // Consultar tabla de productos en Supabase
            const { data: productos, error } = await supabaseClient
                .from('productos')
                .select('*')
                .order('stock_actual', { ascending: true });

            if (error) throw error;
            datosReporteActual = productos || [];

            // Armar cabecera de inventario
            head.innerHTML = `
                <tr>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1; text-align:left;">Código</th>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1; text-align:left;">Producto</th>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1; text-align:right;">Precio</th>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1; text-align:right;">Stock Actual</th>
                </tr>`;

            if (datosReporteActual.length === 0) {
                body.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">No hay productos en inventario.</td></tr>`;
                return;
            }

            body.innerHTML = '';
            datosReporteActual.forEach(p => {
                const stockColor = p.stock_actual <= p.stock_minimo ? '#ef4444' : '#1e293b';
                body.innerHTML += `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; color:#64748b;">${p.codigo_barras || p.id}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-weight:500;">${p.nombre}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right;">S/ ${parseFloat(p.precio_venta).toFixed(2)}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:600; color:${stockColor};">${p.stock_actual} und</td>
                    </tr>`;
            });
        }

        // --- RENDERIZAR EL GRÁFICO ESTADÍSTICO ---
        renderizarGraficoDashboard(tipo);

    } catch (error) {
        console.error("Error cargando reporte:", error.message);
        body.innerHTML = `<tr><td style="text-align:center; color:red; padding:20px;">Error de sincronización con Supabase.</td></tr>`;
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
        // Tomar las últimas 7 ventas para el histórico
        const ultimasVentas = [...datosReporteActual].slice(0, 7).reverse();
        labels = ultimasVentas.map(v => `Venta #${v.id_venta}`);
        valores = ultimasVentas.map(v => v.total_cobrado);
        nombreDataset = 'Monto Recaudado (S/)';
        colorFondo = 'rgba(59, 130, 246, 0.15)';
        colorBorde = '#3b82f6';
    } else {
        tipoGrafico = 'bar'; // Gráfico de barras ideal para comparar inventario
        // Tomar los primeros 7 productos
        const pocosProductos = datosReporteActual.slice(0, 7);
        labels = pocosProductos.map(p => p.nombre.length > 15 ? p.nombre.substring(0, 15) + '...' : p.nombre);
        valores = pocosProductos.map(p => p.stock_actual);
        nombreDataset = 'Unidades en Almacén';
        colorFondo = 'rgba(16, 185, 129, 0.2)';
        colorBorde = '#10b981';
    }

    // Crear la nueva instancia de Chart.js
    miGrafico = new Chart(ctx, {
        type: tipoGrafico,
        data: {
            labels: labels,
            datasets: [{
                label: nombreDataset,
                data: valores,
                backgroundColor: colorFondo,
                borderColor: colorBorde,
                borderWidth: 2,
                tension: 0.3, // Suaviza la línea del gráfico financiero
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
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
