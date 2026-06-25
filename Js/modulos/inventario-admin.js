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
                codigo_barras,
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
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 30px; color: #94a3b8; font-size: 14px;">No se encontraron productos coincidentes.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(p => {
        const stock = p.stock_actual || 0;
        const min = p.stock_minimo_alerta || 10;
        
        // Calculamos el Estado Visual
        let badge = `<span class="alert-tag status-pill badge-disponible" style="display: inline-block; padding: 4px 10px; border-radius: 50px; font-size: 12px; font-weight: 600;">Óptimo</span>`;
        if (stock === 0) badge = `<span class="alert-tag tag-danger" style="display: inline-block; padding: 4px 10px; border-radius: 50px; font-size: 12px; font-weight: 600;">Agotado</span>`;
        else if (stock <= min) badge = `<span class="alert-tag tag-warning" style="display: inline-block; padding: 4px 10px; border-radius: 50px; font-size: 12px; font-weight: 600;">Bajo Stock</span>`;

        // Lógica del JOIN: Extraemos el precio de costo del último registro en compras
        let costoFinal = 0.00;
        if (p.compras && p.compras.length > 0) {
            // Ordenamos por id_compra descendente para asegurar el más reciente
            const comprasOrdenadas = [...p.compras].sort((a, b) => b.id_compra - a.id_compra);
            costoFinal = Number(comprasOrdenadas[0].precio_costo) || 0.00;
        }

        // Renderizado Senior con espaciados amplios y limpios
        return `
            <tr style="background: #ffffff; transition: background 0.2s;">
                <td style="padding: 14px 16px; color: #64748b; font-weight: 500; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${p.id}</td>
                <td style="padding: 14px 16px; color: #1e293b; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${p.nombre}</td>
                <td style="padding: 14px 16px; color: #475569; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${p.marca || '-'}</td>
                <td style="padding: 14px 16px; color: #475569; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${p.categoria}</td>
                <td style="padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
                    <span style="background-color: #f1f5f9; color: #334155; font-family: monospace; font-size: 13px; font-weight: 600; padding: 4px 8px; border-radius: 6px; letter-spacing: 0.02em;">
                        ${p.codigo_barras || '—'}
                    </span>
                </td>
                <td style="padding: 14px 16px; text-align: right; color: #64748b; font-size: 14px; font-family: 'Courier New', Courier, monospace; border-bottom: 1px solid #f1f5f9;">S/. ${costoFinal.toFixed(2)}</td>
                <td style="padding: 14px 16px; text-align: right; color: #0f172a; font-weight: 700; font-size: 14px; font-family: 'Courier New', Courier, monospace; border-bottom: 1px solid #f1f5f9;">S/. ${(Number(p.precio_venta) || 0).toFixed(2)}</td>
                <td style="padding: 14px 16px; text-align: center; color: #0f172a; font-weight: 700; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${stock}</td>
                <td style="padding: 14px 16px; text-align: center; border-bottom: 1px solid #f1f5f9;">${badge}</td>
                <td style="padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                        <button class="btn-action" style="width: 32px !important; height: 32px !important; padding: 0 !important; background-color: #0284c7; font-size: 12px; display: flex; align-items: center; justify-content: center; border-radius: 6px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);" title="Editar">✏️</button>
                        <button class="btn-action" style="width: 32px !important; height: 32px !important; padding: 0 !important; background-color: #dc2626; font-size: 12px; display: flex; align-items: center; justify-content: center; border-radius: 6px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);" title="Eliminar">🗑️</button>
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