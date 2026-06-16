import { supabaseClient } from '../supabase-config.js';

let listaProductosAdmin = [];

export async function inicializarInventarioAdmin() {
    await cargarDatosInventarioGlobal();
    configurarEventosFiltros();
}

async function cargarDatosInventarioGlobal() {
    try {
        // Hacemos un JOIN automático pidiendo los datos del producto
        // y su historial de compras ordenado para capturar el último costo cargado
        const { data, error } = await supabaseClient
            .from('productos')
            .select(`
                id,
                nombre,
                marca,
                categoria,
                precio_venta,
                stock_actual,
                stock_minimo_alerta,
                compras (
                    id_compra,
                    precio_costo
                )
            `)
            .order('id', { ascending: true });

        if (error) throw error;
        listaProductosAdmin = data || [];
        renderizarTablaAdmin();
    } catch (err) {
        console.error("Error al cargar inventario:", err);
    }
}

function renderizarTablaAdmin(busqueda = "", filtroStock = "todos") {
    const tbody = document.getElementById('admin-tabla-inventario-cuerpo');
    if (!tbody) return;

    const filtrados = listaProductosAdmin.filter(p => {
        const texto = busqueda.toLowerCase();
        const coincide = p.nombre.toLowerCase().includes(texto) || (p.marca || "").toLowerCase().includes(texto);
        if (!coincide) return false;

        const stock = p.stock_actual || 0;
        const min = p.stock_minimo_alerta || 10;

        if (filtroStock === "agotado") return stock === 0;
        if (filtroStock === "alerta") return stock > 0 && stock <= min;
        if (filtroStock === "disponible") return stock > min;
        return true;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;">No se encontraron productos.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(p => {
        const stock = p.stock_actual || 0;
        const min = p.stock_minimo_alerta || 10;
        
        // Calculamos el Estado Visual
        let badge = `<span class="alert-tag status-pill badge-disponible">Óptimo</span>`;
        if (stock === 0) badge = `<span class="alert-tag tag-danger">Agotado</span>`;
        else if (stock <= min) badge = `<span class="alert-tag tag-warning">Bajo Stock</span>`;

        // Lógica del JOIN: Extraemos el precio de costo del último registro en compras
        let costoFinal = 0.00;
        if (p.compras && p.compras.length > 0) {
            // Ordenamos por id_compra descendente para asegurar el más reciente
            const comprasOrdenadas = [...p.compras].sort((a, b) => b.id_compra - a.id_compra);
            costoFinal = Number(comprasOrdenadas[0].precio_costo) || 0.00;
        }

        return `
            <tr>
                <td>${p.id}</td> <td>${p.nombre}</td>
                <td>${p.marca || '-'}</td>
                <td>${p.categoria}</td>
                <td style="color: #475569;">S/. ${costoFinal.toFixed(2)}</td> <td style="font-weight: 600;">S/. ${(Number(p.precio_venta) || 0).toFixed(2)}</td>
                <td style="text-align: center; font-weight: bold;">${stock}</td>
                <td>${badge}</td>
                <td>
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                        <button class="btn-action" style="width: 32px !important; height: 32px !important; padding: 0 !important; background-color: #0284c7; font-size: 12px; display: flex; align-items: center; justify-content: center; border-radius: 6px;" title="Editar">✏️</button>
                        <button class="btn-action" style="width: 32px !important; height: 32px !important; padding: 0 !important; background-color: #dc2626; font-size: 12px; display: flex; align-items: center; justify-content: center; border-radius: 6px;" title="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function configurarEventosFiltros() {
    const b = document.getElementById('admin-buscar-inventario');
    const f = document.getElementById('admin-filtros-stock');
    if (b) b.addEventListener('input', () => renderizarTablaAdmin(b.value, f?.value));
    if (f) f.addEventListener('change', () => renderizarTablaAdmin(b?.value || "", f.value));
}