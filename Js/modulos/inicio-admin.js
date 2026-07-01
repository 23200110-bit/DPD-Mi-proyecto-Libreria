import { supabaseClient } from '../supabase-config.js';

let canalMetricas = null;
let timeoutRefresco = null;
let yaRegistradoEscucha = false;

export async function inicializarInicioAdmin() {
    try {
        configurarEscuchaMetricas();
    } catch (err) {
        console.warn('[InicioAdmin] No se pudo configurar la escucha en tiempo real:', err);
    }
    await actualizarMetricaInicio();
}

function configurarEscuchaMetricas() {
    if (yaRegistradoEscucha) return;

    yaRegistradoEscucha = true;
    window.addEventListener('dashboard:refresh', () => programarRefrescoDashboard('custom-event'));
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            programarRefrescoDashboard('visibilitychange');
        }
    });

    canalMetricas = supabaseClient.channel('dashboard-metrics-updates');

    canalMetricas
        .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => programarRefrescoDashboard('productos'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, () => programarRefrescoDashboard('ventas'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'compras' }, () => programarRefrescoDashboard('compras'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'detalles_ventas' }, () => programarRefrescoDashboard('detalles_ventas'))
        .subscribe();

    window.addEventListener('beforeunload', () => {
        if (canalMetricas) {
            supabaseClient.removeChannel(canalMetricas);
        }
    });
}

function programarRefrescoDashboard(origen) {
    if (timeoutRefresco) {
        clearTimeout(timeoutRefresco);
    }

    timeoutRefresco = window.setTimeout(() => {
        actualizarMetricaInicio().catch(error => {
            console.error(`[Dashboard] Error al refrescar métricas (${origen}):`, error);
        });
    }, 250);
}

async function actualizarMetricaInicio() {
    console.log('[InicioAdmin] actualizando métricas del dashboard');
    try {
        const [productosInfo, ventasHoyRes] = await Promise.all([
            buscarTablaInventarioParaInicio(),
            buscarVentasHoy()
        ]);

        const productos = productosInfo.data || [];
        const ventasHoy = ventasHoyRes.data || [];

        const totalProductos = productos.length;
        const stockBajo = productos.filter(p => getStockActual(p) <= getStockMinimo(p)).length;
        const sinMovimiento = await calcularSinMovimiento(productos);
        const capitalStock = productos.reduce((sum, producto) => {
            const precioCosto = getPrecioCosto(producto);
            const stockActual = getStockActual(producto);
            return sum + precioCosto * stockActual;
        }, 0);
        const ventasTotalHoy = ventasHoy.reduce((sum, venta) => sum + getVentaTotal(venta), 0);
        const gananciasHoy = await calcularGananciasHoy(ventasHoy, productos);

        console.log('[InicioAdmin] ventasHoy count:', ventasHoy.length, ventasHoy.slice(0, 5));
        console.log('[InicioAdmin] ventasTotalHoy calculado:', ventasTotalHoy, 'gananciasHoy calculado:', gananciasHoy);

        actualizarElementoTexto('total-productos-count', totalProductos);
        actualizarElementoTexto('stock-bajo-count', stockBajo);
        actualizarElementoTexto('sin-movimiento-count', sinMovimiento);
        actualizarElementoTexto('capital-stock-count', `S/ ${capitalStock.toFixed(2)}`);
        actualizarElementoTexto('ventas-hoy-count', `S/ ${ventasTotalHoy.toFixed(2)}`);
        actualizarElementoTexto('ganancias-hoy-count', `S/ ${gananciasHoy.toFixed(2)}`);

        actualizarAlertasPrincipales(productos, stockBajo);
        renderizarAlertasInicio(productos, stockBajo);
    } catch (error) {
        console.error('[InicioAdmin] Error actualizando métricas del dashboard:', error);
    }
}

function obtenerStockMinimo(producto) {
    return Number(producto.stock_minimo_alerta ?? producto.min_stock ?? producto.minimo_stock ?? 0);
}

function obtenerPrecioCosto(producto) {
    return Number(producto.precio_costo ?? producto.costo ?? producto.costo_unitario ?? producto.precio_venta ?? 0);
}

async function calcularSinMovimiento(productos) {
    if (!productos.length) return 0;

    const diasSinMovimiento = 30;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasSinMovimiento);

    const { data: ventasRecientes, error: ventasError } = await buscarVentasRecientes(fechaLimite.toISOString());

    if (ventasError) {
        console.error('Error consultando ventas recientes:', ventasError);
        return 0;
    }

    const ventaIds = (ventasRecientes || []).map(v => v.id_venta);
    if (ventaIds.length === 0) {
        return productos.length;
    }

    const { data, error } = await supabaseClient
        .from('detalles_ventas')
        .select('producto_id')
        .in('venta_id', ventaIds);

    if (error) {
        console.error('Error calculando productos sin movimiento:', error);
        return 0;
    }

    const idsMovidos = new Set((data || []).map(item => item.producto_id));
    return productos.filter(producto => !idsMovidos.has(producto.id)).length;
}

async function calcularGananciasHoy(ventasHoy, productos) {
    if (!ventasHoy.length) return 0;

    const ventaIds = ventasHoy.map(v => v.id_venta || v.venta_id || v.id);
    const { data, error } = await buscarDetallesVentas(ventaIds);

    if (error) {
        console.error('Error calculando ganancias hoy:', error);
        return ventasHoy.reduce((sum, venta) => sum + Number(getVentaTotal(venta)), 0);
    }

    const costoPorVenta = {};
    data.forEach(detalle => {
        const ventaKey = detalle.venta_id || detalle.id_venta || detalle.venta || 'unknown';
        if (!costoPorVenta[ventaKey]) {
            costoPorVenta[ventaKey] = 0;
        }

        const producto = productos.find(p => p?.id === detalle.producto_id);
        const precioCosto = Number(producto ? getPrecioCosto(producto) : 0);
        costoPorVenta[ventaKey] += precioCosto * Number(detalle.cantidad || 0);
    });

    return ventasHoy.reduce((ganancia, venta) => {
        const total = Number(getVentaTotal(venta));
        const ventaKey = venta.id_venta || venta.venta_id || venta.id || 'unknown';
        const costo = Number(costoPorVenta[ventaKey] || 0);
        return ganancia + Math.max(total - costo, 0);
    }, 0);
}

function actualizarElementoTexto(id, texto) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = texto;
}

function actualizarAlertasPrincipales(productos, stockBajo) {
    const badge = document.getElementById('active-alerts-badge');
    if (badge) {
        badge.textContent = `${stockBajo} alerta${stockBajo === 1 ? '' : 's'}`;
    }
}

async function buscarTablaInventarioParaInicio() {
    const tablas = ['productos', 'Inventario', 'inventario'];
    for (const table of tablas) {
        try {
            let query = supabaseClient.from(table).select('*').limit(1000);
            try {
                query = query.order('nombre', { ascending: true });
            } catch (orderError) {
                console.warn(`[InicioAdmin] no se pudo ordenar inventario por nombre en tabla ${table}:`, orderError.message || orderError);
            }

            const { data, error } = await query;
            if (!error) {
                console.log(`[InicioAdmin] tabla de inventario encontrada: ${table} (${(data || []).length} registros)`);
                return { table, data: data || [] };
            }
        } catch (err) {
            console.warn(`No existe tabla ${table} para métricas de inicio:`, err.message || err);
        }
    }
    throw new Error('No se encontró tabla de inventario para el dashboard de inicio.');
}

function getValor(obj, keys, fallback = 0) {
    if (!obj || typeof obj !== 'object') return fallback;
    for (const key of keys) {
        if (obj[key] != null) return obj[key];
    }
    return fallback;
}

function getStockActual(producto) {
    return Number(getValor(producto, ['stock_actual', 'stock', 'cantidad']));
}

function getStockMinimo(producto) {
    return Number(getValor(producto, ['stock_minimo_alerta', 'stock_minimo', 'min_stock', 'minimo_stock']));
}

function getPrecioCosto(producto) {
    return Number(getValor(producto, ['precio_costo', 'costo', 'costo_unitario', 'precio_costo_unitario', 'precio_venta']));
}

function getVentaTotal(venta) {
    return Number(getValor(venta, ['total_cobrado', 'total', 'monto', 'total_venta', 'valor_total']));
}

function parseFechaVenta(valor) {
    if (!valor) return null;
    if (valor instanceof Date) return valor;

    if (typeof valor === 'number') {
        return new Date(valor);
    }

    const texto = String(valor).trim();
    const fechaISO = Date.parse(texto);
    if (!Number.isNaN(fechaISO)) {
        return new Date(fechaISO);
    }

    // Soporte para formatos comunes sin zona horaria explícita
    const regexDMY = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
    const matchDMY = texto.match(regexDMY);
    if (matchDMY) {
        const dia = Number(matchDMY[1]);
        const mes = Number(matchDMY[2]) - 1;
        const anio = Number(matchDMY[3]);
        const hora = Number(matchDMY[4] || 0);
        const minuto = Number(matchDMY[5] || 0);
        const segundo = Number(matchDMY[6] || 0);
        return new Date(anio, mes, dia, hora, minuto, segundo);
    }

    const regexYMD = /^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
    const matchYMD = texto.match(regexYMD);
    if (matchYMD) {
        const anio = Number(matchYMD[1]);
        const mes = Number(matchYMD[2]) - 1;
        const dia = Number(matchYMD[3]);
        const hora = Number(matchYMD[4] || 0);
        const minuto = Number(matchYMD[5] || 0);
        const segundo = Number(matchYMD[6] || 0);
        return new Date(anio, mes, dia, hora, minuto, segundo);
    }

    return null;
}

function getFechaVenta(venta) {
    return getValor(venta, ['fecha_hora', 'created_at', 'fecha', 'fecha_venta', 'timestamp']);
}

function esVentaDeHoy(venta) {
    const fechaValor = getFechaVenta(venta);
    const fecha = parseFechaVenta(fechaValor);
    const ahora = new Date();

    const rawFecha = String(fechaValor || '').trim();
    const diaHoy = ahora.getDate();
    const mesHoy = ahora.getMonth() + 1;
    const anioHoy = ahora.getFullYear();
    const rawDMY = `${diaHoy}/${mesHoy}/${anioHoy}`;
    const rawDMYDash = `${diaHoy}-${mesHoy}-${anioHoy}`;
    const rawYMD = `${anioHoy}-${mesHoy}-${diaHoy}`;
    const rawCoincide = rawFecha.includes(rawDMY) || rawFecha.includes(rawDMYDash) || rawFecha.includes(rawYMD);

    if (rawCoincide) {
        return true;
    }

    if (!fecha || Number.isNaN(fecha.getTime())) {
        return false;
    }

    const mismoDiaLocal = fecha.getDate() === ahora.getDate() && fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
    const hoyUTC = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
    const fechaUTC = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const mismoDiaUTC = fechaUTC.getTime() === hoyUTC.getTime();

    const diferenciaMs = ahora.getTime() - fecha.getTime();
    const dentroUltimas24h = diferenciaMs >= 0 && diferenciaMs <= 24 * 60 * 60 * 1000;
    const dentroFuturoCercano = diferenciaMs >= -2 * 60 * 60 * 1000 && diferenciaMs < 0;

    const esHoy = mismoDiaLocal || mismoDiaUTC || dentroUltimas24h || dentroFuturoCercano;
    if (!esHoy) {
        console.log('[InicioAdmin] venta no considerada hoy:', {
            fechaRaw: fechaValor,
            fechaParsed: fecha,
            fechaIso: fecha?.toISOString?.(),
            mismoDiaLocal,
            mismoDiaUTC,
            dentroUltimas24h,
            dentroFuturoCercano,
            rawDMY,
            rawDMYDash,
            rawYMD
        });
    }
    return esHoy;
}

async function buscarVentasHoy() {
    const tablas = ['ventas', 'Ventas'];
    for (const table of tablas) {
        try {
            const { data, error } = await supabaseClient.from(table).select('*').limit(1000);
            if (!error) {
                const todasVentas = data || [];
                const ventas = todasVentas.filter(esVentaDeHoy);
                console.log(`[InicioAdmin] tabla de ventas encontrada (JS filter): ${table} (${ventas.length} ventas hoy, ${todasVentas.length} totales)`);
                console.log('[InicioAdmin] ventas hoy muestra:', ventas.slice(0, 5));
                if (ventas.length === 0 && todasVentas.length > 0) {
                    console.warn('[InicioAdmin] No se detectaron ventas de hoy. Muestra raw de primeras filas:', todasVentas.slice(0, 5).map(v => ({
                        id: v.id_venta || v.venta_id || v.id,
                        fechaRaw: getFechaVenta(v),
                        fechaParsed: parseFechaVenta(getFechaVenta(v)),
                        fechaParsedIso: parseFechaVenta(getFechaVenta(v))?.toISOString(),
                        total: getVentaTotal(v)
                    })));
                }
                return { table, data: ventas };
            }
        } catch (err) {
            console.warn(`No se pudo consultar ${table} para ventas de hoy:`, err.message || err);
        }
    }
    throw new Error('No se encontró tabla de ventas para el dashboard de inicio.');
}

async function buscarVentasRecientes(fechaLimite) {
    const tablas = ['ventas', 'Ventas'];
    for (const table of tablas) {
        try {
            const { data, error } = await supabaseClient.from(table).select('id_venta, venta_id, id, producto_id').gte('fecha_hora', fechaLimite);
            if (!error) {
                return { data: data || [] };
            }
        } catch (err) {
            console.warn(`No existe tabla ${table} para ventas recientes:`, err.message || err);
        }
    }
    return { data: [] };
}

async function buscarDetallesVentas(ventaIds) {
    const tablas = ['detalles_ventas', 'detallesVentas', 'venta_detalles'];
    for (const table of tablas) {
        try {
            const query = supabaseClient.from(table).select('venta_id, producto_id, cantidad, precio_unitario');
            if (ventaIds.length) {
                query.in('venta_id', ventaIds);
            }
            const { data, error } = await query;
            if (!error) {
                return { data: data || [] };
            }
        } catch (err) {
            console.warn(`No existe tabla ${table} para detalles de ventas:`, err.message || err);
        }
    }
    return { data: [] };
}

function renderizarAlertasInicio(productos, stockBajo) {
    const lista = document.getElementById('alerts-list');
    if (!lista) return;

    console.log('[InicioAdmin] renderizando alertas con', productos.length, 'productos y', stockBajo, 'alertas en stock bajo');

    if (!productos.length) {
        lista.innerHTML = `
            <li class="alert-item alert-item--empty">
                <span class="alert-item__icon" aria-hidden="true">📦</span>
                <div class="alert-item__content">
                    <strong>No hay productos registrados</strong>
                    <p>Cuando agregues productos al inventario, aquí verás las alertas de stock.</p>
                </div>
            </li>
        `;
        return;
    }

    const productosAlertas = productos
        .filter(p => getStockActual(p) <= getStockMinimo(p))
        .sort((a, b) => getStockActual(a) - getStockActual(b))
        .slice(0, 5);

    if (productosAlertas.length === 0) {
        lista.innerHTML = `
            <li class="alert-item alert-item--empty">
                <span class="alert-item__icon" aria-hidden="true">✅</span>
                <div class="alert-item__content">
                    <strong>No hay alertas de inventario</strong>
                    <p>Todos los productos están arriba del mínimo definido.</p>
                </div>
            </li>
        `;
        return;
    }

    lista.innerHTML = productosAlertas.map(producto => {
        const stockActual = getStockActual(producto);
        const estado = stockActual === 0 ? 'Agotado' : 'Stock Bajo';
        const claseIcono = stockActual === 0 ? 'alert-item__icon--red' : 'alert-item__icon--orange';
        const mensaje = stockActual === 0
            ? 'AGOTADO - Sin stock disponible'
            : `Stock bajo - Quedan ${stockActual} unidad${stockActual === 1 ? '' : 'es'}`;

        return `
            <li class="alert-item">
                <span class="alert-item__icon ${claseIcono}" aria-hidden="true">
                    ${stockActual === 0 ? '⛔' : '⚠️'}
                </span>
                <div class="alert-item__content">
                    <strong>${getValor(producto, ['nombre', 'producto', 'descripcion'], 'Sin nombre')}</strong>
                    <p>${mensaje}</p>
                </div>
                <span class="alert-badge ${stockActual === 0 ? 'alert-badge--red' : 'alert-badge--orange'}">${estado}</span>
            </li>
        `;
    }).join('');
}
