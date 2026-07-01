import { supabaseClient } from '../supabase-config.js';

let listaProductosAdmin = [];
let nombreTablaDetectada = 'productos'; // Por defecto si falla la autodetección

export async function inicializarInventarioAdmin() {
    console.log('[InventarioAdmin] inicializando módulo de inventario');
    await cargarDatosInventarioGlobal();
    configurarEventosFiltros();
    configurarEventosModalEditar();
}

async function cargarDatosInventarioGlobal() {
    try {
        const tableInfo = await buscarTablaInventario();
        const { table, data } = tableInfo;

        nombreTablaDetectada = table; // Guardamos la tabla activa para los updates/deletes
        console.log(`Inventario cargado desde tabla: ${table}`, { cantidad: data.length, muestra: data.slice(0, 5) });

        listaProductosAdmin = data || [];
        if (listaProductosAdmin.length === 0) {
            const tbody = document.getElementById('admin-tabla-inventario-cuerpo');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: #475569; font-size: 15px;">No hay productos registrados en el inventario.</td></tr>`;
            }
            return;
        }

        renderizarTablaAdmin();
    } catch (err) {
        console.error("Error al cargar inventario:", err);
        const tbody = document.getElementById('admin-tabla-inventario-cuerpo');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: #ef4444; font-size: 15px;">No se pudo cargar el inventario. Error: ${String(err.message || err)}</td></tr>`;
        }
    }
}

async function buscarTablaInventario() {
    const tablas = ['productos', 'Inventario', 'inventario'];
    for (const table of tablas) {
        try {
            // CAMBIO AQUÍ: Agregamos , compras(id_compra, precio_costo) para traer la relación
            let query = supabaseClient.from(table).select('*, compras(id_compra, precio_costo)');
            try {
                query = query.order('nombre', { ascending: true });
            } catch (orderError) {
                console.warn(`No se pudo ordenar por nombre en tabla ${table}:`, orderError);
            }
            const { data, error } = await query;
            if (!error) {
                return { table, data: data || [] };
            }
        } catch (globalError) {
            console.warn(`Fallo leyendo tabla ${table}:`, globalError.message || globalError);
        }
    }
    throw new Error('No se encontró ninguna tabla de inventario válida.');
}

function getStockActual(producto) {
    return Number(producto.stock_actual ?? producto.stock ?? producto.cantidad ?? 0);
}

function getStockMinimo(producto) {
    return Number(producto.stock_minimo_alerta ?? producto.stock_minimo ?? producto.min_stock ?? producto.minimo_stock ?? 0);
}

function getPrecioCosto(producto) {
    return Number(producto.precio_costo ?? producto.costo ?? producto.costo_unitario ?? 0);
}

function getPrecioVenta(producto) {
    return Number(producto.precio_venta ?? producto.precio ?? producto.price_sale ?? 0);
}

function getNombreProducto(producto) {
    return String(producto.nombre ?? producto.producto ?? producto.descripcion ?? 'Sin nombre');
}

function getMarca(producto) {
    return String(producto.marca ?? producto.brand ?? '—');
}

function getCategoria(producto) {
    return String(producto.categoria ?? producto.category ?? '—');
}

function getCodigoBarras(producto) {
    return String(producto.codigo_barras ?? producto.barcode ?? '—');
}

function renderizarTablaAdmin(busqueda = "", filtroStock = "todos") {
    const tbody = document.getElementById('admin-tabla-inventario-cuerpo');
    if (!tbody) return;

    const bVal = document.getElementById('admin-buscar-inventario')?.value || "";
    const fVal = document.getElementById('admin-filtros-stock')?.value || "todos";

    const texto = String(busqueda || bVal).toLowerCase();
    const currentFiltro = filtroStock !== "todos" ? filtroStock : fVal;

    const filtrados = listaProductosAdmin.filter(p => {
        const nombre = getNombreProducto(p).toLowerCase();
        const marca = getMarca(p).toLowerCase();
        const coincide = nombre.includes(texto) || marca.includes(texto);
        if (!coincide) return false;

        const stock = getStockActual(p);
        const min = getStockMinimo(p);

        if (currentFiltro === "agotado") return stock === 0;
        if (currentFiltro === "alerta") return stock > 0 && stock <= min;
        if (currentFiltro === "disponible") return stock > min;
        return true;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 30px; color: #94a3b8; font-size: 14px;">No se encontraron productos coincidentes.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(p => {
        const stock = getStockActual(p);
        const min = getStockMinimo(p);
        const nombre = getNombreProducto(p);
        const marca = getMarca(p);
        const categoria = getCategoria(p);
        const codigoBarras = getCodigoBarras(p);
        const precioCosto = getPrecioCosto(p);
        const precioVenta = getPrecioVenta(p);

        let badge = `<span class="alert-tag status-pill badge-disponible" style="display: inline-block; padding: 4px 10px; border-radius: 50px; font-size: 12px; font-weight: 600;">Óptimo</span>`;
        if (stock === 0) badge = `<span class="alert-tag tag-danger" style="display: inline-block; padding: 4px 10px; border-radius: 50px; font-size: 12px; font-weight: 600;">Agotado</span>`;
        else if (stock <= min) badge = `<span class="alert-tag tag-warning" style="display: inline-block; padding: 4px 10px; border-radius: 50px; font-size: 12px; font-weight: 600;">Bajo Stock</span>`;

        let costoFinal = precioCosto;
        if ((!precioCosto || precioCosto === 0) && p.compras && p.compras.length > 0) {
            const comprasOrdenadas = [...p.compras].sort((a, b) => Number(b.id_compra || 0) - Number(a.id_compra || 0));
            costoFinal = Number(comprasOrdenadas[0].precio_costo || 0);
        }

        return `
            <tr style="background: #ffffff; transition: background 0.2s;">
                <td style="padding: 14px 16px; color: #64748b; font-weight: 500; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${p.id ?? ''}</td>
                <td style="padding: 14px 16px; color: #1e293b; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${nombre}</td>
                <td style="padding: 14px 16px; color: #475569; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${marca}</td>
                <td style="padding: 14px 16px; color: #475569; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${categoria}</td>
                <td style="padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
                    <span style="background-color: #f1f5f9; color: #334155; font-family: monospace; font-size: 13px; font-weight: 600; padding: 4px 8px; border-radius: 6px; letter-spacing: 0.02em;">
                        ${codigoBarras}
                    </span>
                </td>
                <td style="padding: 14px 16px; text-align: right; color: #64748b; font-size: 14px; font-family: 'Courier New', Courier, monospace; border-bottom: 1px solid #f1f5f9;">S/. ${costoFinal.toFixed(2)}</td>
                <td style="padding: 14px 16px; text-align: right; color: #0f172a; font-weight: 700; font-size: 14px; font-family: 'Courier New', Courier, monospace; border-bottom: 1px solid #f1f5f9;">S/. ${precioVenta.toFixed(2)}</td>
                <td style="padding: 14px 16px; text-align: center; color: #0f172a; font-weight: 700; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${stock}</td>
                <td style="padding: 14px 16px; text-align: center; border-bottom: 1px solid #f1f5f9;">${badge}</td>
                <td style="padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                        <button class="btn-action" onclick="abrirEditarProducto(${p.id})" style="width: 32px !important; height: 32px !important; padding: 0 !important; background-color: #0284c7; font-size: 12px; display: flex; align-items: center; justify-content: center; border-radius: 6px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.1); cursor:pointer;" title="Editar">✏️</button>
                        <button class="btn-action" onclick="eliminarProductoInventario(${p.id})" style="width: 32px !important; height: 32px !important; padding: 0 !important; background-color: #dc2626; font-size: 12px; display: flex; align-items: center; justify-content: center; border-radius: 6px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.1); cursor:pointer;" title="Eliminar">🗑️</button>
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

/* ==========================================================================
   LÓGICA SENIOR DE ACCIONES DE INVENTARIO (EDITAR Y ELIMINAR)
   ========================================================================== */

function configurarEventosModalEditar() {
    const btnCerrar = document.getElementById('btn-cerrar-modal-editar');
    const btnCancelar = document.getElementById('btn-cancelar-modal-editar');
    const formEditar = document.getElementById('form-editar-inventario');

    const cerrar = () => {
        const modal = document.getElementById('modal-editar-producto');
        if (modal) modal.style.display = 'none';
    };

    if (btnCerrar) btnCerrar.onclick = cerrar;
    if (btnCancelar) btnCancelar.onclick = cerrar;

    if (formEditar) {
        formEditar.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-prod-id').value;
            
            const payload = {
                nombre: document.getElementById('edit-prod-nombre').value.trim(),
                marca: document.getElementById('edit-prod-marca').value.trim() || null,
                categoria: document.getElementById('edit-prod-categoria').value,
                codigo_barras: document.getElementById('edit-prod-codigo').value ? parseInt(document.getElementById('edit-prod-codigo').value) : null,
                precio_venta: parseFloat(document.getElementById('edit-prod-venta').value) || 0,
                stock_actual: parseInt(document.getElementById('edit-prod-stock').value) || 0
            };

            try {
                const { error } = await supabaseClient
                    .from(nombreTablaDetectada)
                    .update(payload)
                    .eq('id', id);

                if (error) throw error;

                alert('✅ ¡Inventario Sincronizado exitosamente!');
                cerrar();
                await cargarDatosInventarioGlobal(); // Recarga la tabla de Supabase en tiempo real
            } catch (err) {
                alert(`❌ Error al actualizar:\n${err.message || err}`);
            }
        };
    }
}

// Inyección de funciones en el objeto global Window para que respondan los clicks de los renglones HTML
window.abrirEditarProducto = function(id) {
    const p = listaProductosAdmin.find(item => item.id === id);
    if (!p) return;

    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('edit-prod-nombre').value = getNombreProducto(p);
    document.getElementById('edit-prod-marca').value = getMarca(p) === '—' ? '' : getMarca(p);
    document.getElementById('edit-prod-categoria').value = getCategoria(p) === '—' ? 'Utiles Escolares' : getCategoria(p);
    document.getElementById('edit-prod-codigo').value = getCodigoBarras(p) === '—' ? '' : getCodigoBarras(p);
    document.getElementById('edit-prod-venta').value = getPrecioVenta(p);
    document.getElementById('edit-prod-stock').value = getStockActual(p);

    const modal = document.getElementById('modal-editar-producto');
    if (modal) modal.style.display = 'flex';
};

window.eliminarProductoInventario = async function(id) {
    const confirmacion = confirm(`⚠️ ¿Estás absolutamente seguro de que deseas eliminar permanentemente este producto del inventario?\nEsta acción no se puede deshacer.`);
    if (!confirmacion) return;

    try {
        const { error } = await supabaseClient
            .from(nombreTablaDetectada)
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('🗑️ El producto ha sido removido del sistema de forma segura.');
        await cargarDatosInventarioGlobal(); // Refresca los cambios
    } catch (err) {
        alert(`❌ No se pudo eliminar:\n${err.message || err}`);
    }
};