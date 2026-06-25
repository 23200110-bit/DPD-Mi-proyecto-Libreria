import { supabaseClient } from '../supabase-config.js';

// Variable global para guardar los datos actuales del reporte y poder exportarlos
let datosReporteActual = [];

export function inicializarReportes() {
    console.log("Módulo Reportes cargado");

    // Cargar reporte por defecto (Ventas)
    cargarReporte();

    // Escuchar cambios en el selector de tipo de reporte
    const selector = document.getElementById('reporte-tipo');
    if (selector) {
        selector.addEventListener('change', cargarReporte);
    }

    // Escuchar botón de Excel
    const btnExcel = document.getElementById('btn-exportar-excel');
    if (btnExcel) {
        btnExcel.addEventListener('click', exportarExcelCSV);
    }

    // Escuchar botón de PDF
    const btnPDF = document.getElementById('btn-imprimir-pdf');
    if (btnPDF) {
        btnPDF.addEventListener('click', () => {
            window.print(); // Abre el cuadro de diálogo nativo para guardar como PDF
        });
    }
}

async function cargarReporte() {
    const tipo = document.getElementById('reporte-tipo').value;
    const titulo = document.getElementById('reporte-titulo');
    const thContainer = document.getElementById('reporte-th-container');
    const tbody = document.getElementById('reporte-tbody-container');

    if (!tbody || !thContainer) return;

    tbody.innerHTML = `<tr><td style="text-align:center; padding:20px;">Generando matriz analítica...</td></tr>`;

    try {
        if (tipo === 'ventas') {
            titulo.textContent = "Consolidado General de Tickets de Venta";
            
            // Consultamos la tabla 'ventas' de tu base de datos
            const { data, error } = await supabaseClient
                .from('ventas')
                .select('*')
                .order('fecha_hora', { ascending: false });

            if (error) throw error;
            datosReporteActual = data || [];

            // Definir cabeceras para ventas
            thContainer.innerHTML = `
                <th style="padding:12px;">ID Venta</th>
                <th style="padding:12px;">Comprobante</th>
                <th style="padding:12px;">Método de Pago</th>
                <th style="padding:12px;">Total Cobrado</th>
                <th style="padding:12px;">Fecha y Hora</th>
            `;

            // Pintar filas de ventas
            tbody.innerHTML = '';
            datosReporteActual.forEach(v => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding:12px; border-bottom:1px solid #e2e8f0;">${v.id_venta}</td>
                    <td style="padding:12px; border-bottom:1px solid #e2e8f0;">${v.tipo_comprobante}</td>
                    <td style="padding:12px; border-bottom:1px solid #e2e8f0;">${v.metodo_pago}</td>
                    <td style="padding:12px; border-bottom:1px solid #e2e8f0; font-weight:bold; color:#16a34a;">S/ ${Number(v.total_cobrado).toFixed(2)}</td>
                    <td style="padding:12px; border-bottom:1px solid #e2e8f0;">${new Date(v.fecha_hora).toLocaleString()}</td>
                `;
                tbody.appendChild(tr);
            });

        } else if (tipo === 'inventario') {
            titulo.textContent = "Estado de Almacén e Inventario de Productos";

            // Consultamos la tabla 'productos' de tu base de datos
            const { data, error } = await supabaseClient
                .from('productos')
                .select('id, nombre, marca, categoria, stock_actual, precio_venta')
                .order('stock_actual', { ascending: true });

            if (error) throw error;
            datosReporteActual = data || [];

            // Definir cabeceras para inventario
            thContainer.innerHTML = `
                <th style="padding:12px;">ID</th>
                <th style="padding:12px;">Producto</th>
                <th style="padding:12px;">Marca / Categoría</th>
                <th style="padding:12px;">Stock Actual</th>
                <th style="padding:12px;">Precio Público</th>
            `;

            // Pintar filas de productos
            tbody.innerHTML = '';
            datosReporteActual.forEach(p => {
                const tr = document.createElement('tr');
                // Alerta visual si tiene stock bajo
                const stockStyle = p.stock_actual <= 5 ? 'color:#ef4444; font-weight:bold;' : '';
                
                tr.innerHTML = `
                    <td style="padding:12px; border-bottom:1px solid #e2e8f0;">${p.id}</td>
                    <td style="padding:12px; border-bottom:1px solid #e2e8f0; font-weight:500;">${p.nombre}</td>
                    <td style="padding:12px; border-bottom:1px solid #e2e8f0; color:#64748b;">${p.marca || 'N/A'} - ${p.categoria}</td>
                    <td style="padding:12px; border-bottom:1px solid #e2e8f0; ${stockStyle}">${p.stock_actual} unidades</td>
                    <td style="padding:12px; border-bottom:1px solid #e2e8f0;">S/ ${Number(p.precio_venta).toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

    } catch (error) {
        console.error("Error generando reporte:", error.message);
        tbody.innerHTML = `<tr><td style="text-align:center; color:red; padding:20px;">Error al procesar la analítica.</td></tr>`;
    }
}

// ==========================================
// TRUCO NATIVO: EXPORTAR EXCEL (.CSV)
// ==========================================
function exportarExcelCSV() {
    if (datosReporteActual.length === 0) {
        alert("No hay datos disponibles en este momento para exportar.");
        return;
    }

    // Obtener las llaves (columnas) de los objetos de datos
    const cabeceras = Object.keys(datosReporteActual[0]);
    
    // Crear filas uniendo los valores por comas
    const filasCsv = [
        cabeceras.join(','), // Primera fila: títulos de columnas
        ...datosReporteActual.map(obj => 
            cabeceras.map(llave => {
                // Limpiar textos por si contienen comas internas que rompan el archivo
                let valor = String(obj[llave]).replace(/,/g, ' ');
                return `"${valor}"`;
            }).join(',')
        )
    ];

    // Unir todo con saltos de línea y añadir codificación UTF-8 para las tildes/eñes
    const contenidoCsv = "\uFEFF" + filasCsv.join('\n');
    
    // Crear el archivo virtual en memoria
    const blob = new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    
    // Configurar la descarga del navegador
    const tipoReporte = document.getElementById('reporte-tipo').value;
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Reporte_SIVEP_${tipoReporte}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
