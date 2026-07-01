/* ==========================================================================
   js/modulos/precios.js
   ========================================================================== */
import { supabaseClient } from '../supabase-config.js';

export async function inicializarPrecios() {
    const tarjetas           = Array.from(document.querySelectorAll('.strategy-card'));
    const manualPriceInput   = document.getElementById('manual-price-input');
    const applyStrategyBtn   = document.getElementById('btn-apply-strategy');
    const selectInventario   = document.getElementById('select-inventory');
    const productName        = document.getElementById('product-selected-name');
    const productOldCost     = document.getElementById('product-old-cost');
    const productNewCost     = document.getElementById('product-new-cost');
    const productChangeBadge = document.getElementById('product-change-badge');

    const productosPorId   = new Map(); // id → { ...producto, precio_costo }
    let estrategiaActual   = 'ponderado';
    let productoActual     = null;

    /* -----------------------------------------------------------------------
       1. CARGAR PRODUCTOS + SU COSTO MÁS RECIENTE DESDE COMPRAS
    ----------------------------------------------------------------------- */
    async function cargarProductos() {
        const { data: productos, error: errP } = await supabaseClient
            .from('productos')
            .select('id, nombre, precio_venta, stock_actual')
            .order('nombre', { ascending: true });

        if (errP || !productos?.length) {
            if (selectInventario)
                selectInventario.innerHTML = '<option value="">No hay productos</option>';
            return;
        }

        // Costo más reciente de cada producto (tabla compras)
        const { data: compras } = await supabaseClient
            .from('compras')
            .select('producto_id, precio_costo')
            .order('id_compra', { ascending: false });

        const costoMap = {};
        (compras || []).forEach(c => {
            if (!costoMap[c.producto_id])
                costoMap[c.producto_id] = parseFloat(c.precio_costo || 0);
        });

        if (selectInventario) selectInventario.innerHTML = '';

        productos.forEach(p => {
            const conCosto = { ...p, precio_costo: costoMap[p.id] ?? 0 };
            productosPorId.set(String(p.id), conCosto);

            const opt = document.createElement('option');
            opt.value   = p.id;
            opt.textContent = p.nombre;
            selectInventario?.appendChild(opt);
        });

        // Seleccionar el primero por defecto
        const primero = { ...productos[0], precio_costo: costoMap[productos[0].id] ?? 0 };
        mostrarProducto(primero);
        actualizarSugeridos();
    }

    /* -----------------------------------------------------------------------
       2. MOSTRAR PRODUCTO SELECCIONADO EN EL PANEL SUPERIOR
    ----------------------------------------------------------------------- */
    function mostrarProducto(producto) {
        if (!producto) return;
        productoActual = producto;

        const costo = parseFloat(producto.precio_costo || 0);
        const venta = parseFloat(producto.precio_venta  || 0);
        const margen = costo > 0 ? ((venta - costo) / costo) * 100 : 0;

        if (productName)    productName.textContent = producto.nombre || '—';
        if (productOldCost) productOldCost.innerHTML = `<del>S/. ${costo.toFixed(2)}</del>`;
        if (productNewCost) productNewCost.textContent = `S/. ${venta.toFixed(2)}`;

        if (productChangeBadge) {
            const positivo = margen >= 0;
            productChangeBadge.className = `price-change-badge ${positivo ? 'price-up' : 'price-down'}`;
            productChangeBadge.textContent = `${positivo ? '+' : ''}${margen.toFixed(1)}% margen`;
        }

        actualizarSugeridos();
    }

    /* -----------------------------------------------------------------------
       3. CÁLCULO DE PRECIO SUGERIDO POR ESTRATEGIA
    ----------------------------------------------------------------------- */
    function calcularSugerido(producto, estrategia) {
        const costo = parseFloat(producto.precio_costo || 0);
        const venta = parseFloat(producto.precio_venta  || 0);

        switch (estrategia) {
            case 'ponderado':
                // Margen fijo del 35% sobre el costo
                return costo > 0 ? parseFloat((costo * 1.35).toFixed(2)) : venta;
            case 'fifo':
                // Mantener el precio de venta anterior (stock viejo se vende al precio viejo)
                return venta;
            case 'manual':
                const val = parseFloat(manualPriceInput?.value || 0);
                return val > 0 ? val : venta;
            default:
                return venta;
        }
    }

    function actualizarSugeridos() {
        if (!productoActual) return;
        tarjetas.forEach(t => {
            const label = t.querySelector('.strategy-suggestion');
            if (!label) return;
            const est   = t.dataset.estrategia;
            const precio = calcularSugerido(productoActual, est);
            label.textContent = `Precio sugerido: S/. ${precio.toFixed(2)}`;
        });
    }

    /* -----------------------------------------------------------------------
       4. SELECCIÓN DE TARJETA DE ESTRATEGIA
    ----------------------------------------------------------------------- */
    tarjetas.forEach(t => {
        t.addEventListener('click', () => {
            tarjetas.forEach(x => x.classList.remove('activa', 'active'));
            t.classList.add('activa', 'active');
            estrategiaActual = t.dataset.estrategia || 'ponderado';

            // Habilitar/deshabilitar input manual
            if (manualPriceInput) {
                manualPriceInput.disabled = estrategiaActual !== 'manual';
                if (estrategiaActual === 'manual') {
                    manualPriceInput.value = '';
                    manualPriceInput.focus();
                } else {
                    manualPriceInput.value = '';
                }
            }

            actualizarSugeridos();
        });
    });

    if (manualPriceInput) {
        manualPriceInput.addEventListener('input', actualizarSugeridos);
    }

    /* -----------------------------------------------------------------------
       5. CAMBIO DE PRODUCTO EN EL SELECT
    ----------------------------------------------------------------------- */
    selectInventario?.addEventListener('change', () => {
        const prod = productosPorId.get(selectInventario.value);
        if (prod) mostrarProducto(prod);
    });

    /* -----------------------------------------------------------------------
       6. APLICAR ESTRATEGIA → actualiza precio_venta + guarda en historial_precios
    ----------------------------------------------------------------------- */
    applyStrategyBtn?.addEventListener('click', async () => {
        if (!productoActual) { alert('Selecciona un producto.'); return; }

        let precioFinal = calcularSugerido(productoActual, estrategiaActual);

        if (estrategiaActual === 'manual') {
            const manual = parseFloat(manualPriceInput?.value || 0);
            if (isNaN(manual) || manual <= 0) {
                alert('Ingresa un precio manual válido.');
                return;
            }
            precioFinal = manual;
        }

        const precioAnterior = parseFloat(productoActual.precio_venta || 0);

        if (precioFinal === precioAnterior) {
            alert('El precio nuevo es igual al actual. No se realizaron cambios.');
            return;
        }

        applyStrategyBtn.disabled     = true;
        applyStrategyBtn.textContent  = '⏳ Aplicando...';

        try {
            // Actualizar precio_venta en productos
            const { error: errUpdate } = await supabaseClient
                .from('productos')
                .update({ precio_venta: precioFinal })
                .eq('id', productoActual.id);

            if (errUpdate) throw errUpdate;

            // Guardar en historial_precios
            const tipoCambio = precioFinal > precioAnterior ? 'Subió' : 'Bajó';

            const { error: errHist } = await supabaseClient
                .from('historial_precios')
                .insert({
                    producto_id:    productoActual.id,
                    precio_anterior: precioAnterior,
                    precio_nuevo:    precioFinal,
                    tipo_cambio:     tipoCambio
                });

            if (errHist) console.warn('Precio actualizado pero no se guardó en historial:', errHist);

            // Actualizar estado local
            productoActual.precio_venta = precioFinal;
            productosPorId.set(String(productoActual.id), { ...productoActual });
            mostrarProducto(productoActual);

            // Refrescar historial
            await cargarHistorial();

            alert(`✅ Precio actualizado a S/. ${precioFinal.toFixed(2)}`);

        } catch (err) {
            console.error('[Precios] Error:', err);
            alert('❌ Error al actualizar el precio.');
        } finally {
            applyStrategyBtn.disabled    = false;
            applyStrategyBtn.textContent = 'Aplicar Estrategia';
        }
    });

    /* -----------------------------------------------------------------------
       7. CARGAR HISTORIAL REAL DESDE historial_precios
    ----------------------------------------------------------------------- */
    async function cargarHistorial() {
        const tbody = document.getElementById('historial-precios-tbody');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">
            ⏳ Cargando historial...
        </td></tr>`;

        const { data, error } = await supabaseClient
            .from('historial_precios')
            .select(`
                id_historial,
                precio_anterior,
                precio_nuevo,
                tipo_cambio,
                fecha_cambio,
                productos ( nombre )
            `)
            .order('fecha_cambio', { ascending: false })
            .limit(20);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#dc2626;padding:20px;">
                ❌ Error al cargar historial.
            </td></tr>`;
            return;
        }

        if (!data?.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">
                No hay cambios de precio registrados aún.
            </td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(h => {
            const fecha  = new Date(h.fecha_cambio).toLocaleDateString('es-PE');
            const subio  = h.tipo_cambio === 'Subió';
            const pill   = subio
                ? `<span class="change-pill change-up">📈 Subió</span>`
                : `<span class="change-pill change-down">📉 Bajó</span>`;
            return `<tr>
                <td>${h.productos?.nombre || '—'}</td>
                <td>${pill}</td>
                <td>S/. ${parseFloat(h.precio_anterior).toFixed(2)}</td>
                <td><strong>S/. ${parseFloat(h.precio_nuevo).toFixed(2)}</strong></td>
                <td>${fecha}</td>
            </tr>`;
        }).join('');
    }

    /* -----------------------------------------------------------------------
       INICIALIZACIÓN
    ----------------------------------------------------------------------- */
    await cargarProductos();
    await cargarHistorial();
}