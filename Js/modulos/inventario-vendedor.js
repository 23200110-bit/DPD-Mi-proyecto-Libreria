import { supabaseClient } from '../supabase-config.js';

export async function inicializarInventarioVendedor() {
    console.log('Inventario vendedor cargado');

    const tbody = document.getElementById('tabla-inventario-body');
    if (!tbody) return;

    const { data, error } = await supabaseClient
        .from('productos')
        .select('nombre, marca, stock_actual, precio_venta')
        .order('nombre');

    if (error) {
        console.error('Error cargando productos:', error);
        return;
    }

    tbody.innerHTML = '';

    data.forEach(producto => {
        tbody.innerHTML += `
            <tr>
                <td>${producto.nombre}</td>
                <td>${producto.marca ?? '-'}</td>
                <td>${producto.stock_actual}</td>
                <td>S/ ${Number(producto.precio_venta).toFixed(2)}</td>
            </tr>
        `;
    });
}