import { supabaseClient } from '../supabase-config.js';

export function inicializarInicioVendedor() {
    console.count('Inicio vendedor cargado');
    cargarDashboard();

    // Botón Consultar Inventario
    const btnVenta = document.querySelector('.btn-acceso:nth-child(1)');
const btnInventario = document.querySelector('.btn-acceso:nth-child(2)');
const btnConteo = document.querySelector('.btn-acceso:nth-child(3)');

if (btnVenta) {
    btnVenta.addEventListener('click', () => {
        document
            .getElementById('btn-vendedor-nav-ventas')
            .click();
    });
}

if (btnInventario) {
    btnInventario.addEventListener('click', () => {
        document
            .getElementById('btn-vendedor-nav-inventario')
            .click();
    });
}

if (btnConteo) {
    btnConteo.addEventListener('click', () => {
        document
            .getElementById('btn-vendedor-nav-conteo')
            .click();
    });
}

    // Buscador
const input = document.getElementById('buscar-producto');
const lista = document.getElementById('lista-productos');
const resultado = document.getElementById('resultado-producto');

if (!input || !lista || !resultado) return;

if (input.dataset.inicializado) return;
input.dataset.inicializado = 'true';

input.addEventListener('input', async () => {
const texto = input.value.trim();

lista.innerHTML = '';

if (texto === '') {
    resultado.innerHTML = '';
    lista.innerHTML = '';
    return;
}

// Guardamos el texto que el usuario escribió
const textoBusqueda = texto;

const { data, error } = await supabaseClient
    .from('productos')
    .select('id, nombre, precio_venta, stock_actual')
    .ilike('nombre', `%${textoBusqueda}%`)
    .limit(5);

// Si el usuario ya cambió el texto, ignoramos esta respuesta
if (input.value.trim() !== textoBusqueda) {
    return;
}

        console.log('Texto:', texto);
console.log('Cantidad:', data?.length);
console.table(data);

    if (error || !data || data.length === 0) {
        lista.innerHTML = `
            <p>No se encontraron productos.</p>
        `;
        return;
    }

    lista.innerHTML = '';
    data.forEach(producto => {
        const item = document.createElement('div');

        item.textContent = `📦 ${producto.nombre}`;
        item.style.cursor = 'pointer';
        item.style.padding = '8px';
        item.style.marginTop = '5px';
        item.style.border = '1px solid #ddd';
        item.style.borderRadius = '8px';
        item.style.backgroundColor = '#ffffff';
        item.style.transition = 'all 0.2s ease';

        item.addEventListener('mouseenter', () => {
    item.style.backgroundColor = '#e0f2fe';
    item.style.borderColor = '#38bdf8';
    });

    item.addEventListener('mouseleave', () => {
    item.style.backgroundColor = '#ffffff';
    item.style.borderColor = '#ddd';
    });

        item.addEventListener('click', () => {
            resultado.innerHTML = `
    <div class="info-card">
        <small>📦 Producto</small>
        <h3>${producto.nombre}</h3>
    </div>

    <div class="info-card">
        <small>💲 Precio</small>
        <h3>S/ ${Number(producto.precio_venta).toFixed(2)}</h3>
    </div>

    <div class="info-card">
        <small>📚 Stock</small>
        <h3>${producto.stock_actual} unidades</h3>
    </div>
`;

            input.value = producto.nombre;
            lista.innerHTML = '';
        });

        lista.appendChild(item);
    });
});

    
}

async function cargarDashboard() {

    // ===========================
// Últimas ventas
// ===========================

const { data: ventas } = await supabaseClient
    .from('ventas')
    .select('id_venta, tipo_comprobante, metodo_pago, total_cobrado, fecha_hora')
    .order('fecha_hora', { ascending: false })
    .limit(5);

const tbody = document.getElementById('tabla-ultimas-ventas');

tbody.innerHTML = '';

if (!ventas || ventas.length === 0) {

    tbody.innerHTML = `
        <tr>
            <td colspan="5">
                No existen ventas registradas.
            </td>
        </tr>
    `;

}
else{

    ventas.forEach(venta=>{

        tbody.innerHTML += `

        <tr>

            <td>${venta.id_venta}</td>

            <td>${venta.tipo_comprobante}</td>

            <td>${venta.metodo_pago}</td>

            <td>S/ ${Number(venta.total_cobrado).toFixed(2)}</td>

            <td>${new Date(venta.fecha_hora).toLocaleString()}</td>

        </tr>

        `;

    });

}

    try {

        // ===========================
        // Productos registrados
        // ===========================

        const { count: totalProductos } = await supabaseClient
            .from('productos')
            .select('*', { count: 'exact', head: true });

        document.getElementById('productos-total').textContent =
            totalProductos ?? 0;


        // ===========================
        // Productos con stock bajo
        // ===========================

        const { count: stockBajo } = await supabaseClient
            .from('productos')
            .select('*', { count: 'exact', head: true })
            .lte('stock_actual', 10);

        document.getElementById('stock-bajo').textContent =
            stockBajo ?? 0;


        // ===========================
        // Conteos realizados
        // ===========================

        const { count: conteos } = await supabaseClient
            .from('conteos_auditoria')
            .select('*', { count: 'exact', head: true });

        document.getElementById('conteos-pendientes').textContent =
            conteos ?? 0;


        // ===========================
        // Ventas de hoy
        // ===========================

        const hoy = new Date();

        hoy.setHours(0,0,0,0);

        const fechaHoy = hoy.toISOString();

        const { count: ventasHoy } = await supabaseClient
            .from('ventas')
            .select('*', { count: 'exact', head: true })
            .gte('fecha_hora', fechaHoy);

        document.getElementById('ventas-hoy').textContent =
            ventasHoy ?? 0;

    }

    catch(error){

        console.error(error);

    }

}