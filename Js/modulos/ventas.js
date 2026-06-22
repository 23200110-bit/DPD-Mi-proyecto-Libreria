/* ==========================================================================
   js/modulos/ventas.js - LÓGICA DEL PUNTO DE VENTA (CARRITO Y SUPABASE)
   ========================================================================== */
import { supabaseClient } from '../supabase-config.js';

const IGV_PORCENTAJE = 0.18;

let CARRITO = [];
let PRODUCTOS = [];
let categoriaActiva = 'Todos';
let totalActual = 0;

/**
 * Punto de entrada del módulo: carga productos, historial y conecta eventos
 */
export async function inicializarModuloVentas() {
    CARRITO = [];
    categoriaActiva = 'Todos';

    await cargarProductos();
    renderizarCarrito();
    await cargarHistorial();

    const buscador = document.getElementById('buscador-productos');
    if (buscador) {
        buscador.addEventListener('input', renderizarCatalogo);
    }

    const botonesFiltro = document.querySelectorAll('.filtros-categorias button');
    botonesFiltro.forEach(btn => {
        btn.addEventListener('click', () => {
            botonesFiltro.forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
            categoriaActiva = btn.dataset.categoria || 'Todos';
            renderizarCatalogo();
        });
    });

    // Toggle de Tipo de Comprobante y Método de Pago (cada grupo es independiente)
    const gruposBotones = document.querySelectorAll('.grupo-botones');
    gruposBotones.forEach(grupo => {
        grupo.querySelectorAll('.btn-opcion').forEach(btn => {
            btn.addEventListener('click', () => {
                grupo.querySelectorAll('.btn-opcion').forEach(b => b.classList.remove('activo'));
                btn.classList.add('activo');

                if (grupo.dataset.grupo === 'metodo-pago') {
                    actualizarVisibilidadMontoRecibido(btn.dataset.valor);
                }
                if (grupo.dataset.grupo === 'comprobante') {
                    actualizarVisibilidadDatosFactura(btn.dataset.valor);
                }
            });
        });
    });

    const inputRecibido = document.getElementById('monto-recibido');
    if (inputRecibido) {
        inputRecibido.addEventListener('input', actualizarVuelto);
    }

    const btnLimpiar = document.querySelector('.btn-limpiar');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', limpiarCarrito);
    }

    const btnCobrar = document.querySelector('.btn-cobrar');
    if (btnCobrar) {
        btnCobrar.addEventListener('click', confirmarVenta);
    }
}

/**
 * Trae todos los productos de Supabase y los guarda en memoria
 */
async function cargarProductos() {
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) {
        console.error('Error al traer productos:', error);
        return;
    }

    PRODUCTOS = data || [];
    renderizarCatalogo();
}

/**
 * Dibuja las tarjetas de producto aplicando el filtro de texto y categoría activa
 */
function renderizarCatalogo() {
    const contenedor = document.getElementById('contenedor-tarjetas');
    if (!contenedor) return;

    const buscador = document.getElementById('buscador-productos');
    const texto = (buscador?.value || '').toLowerCase().trim();

    const filtrados = PRODUCTOS.filter(p => {
        const coincideCategoria = categoriaActiva === 'Todos' || p.categoria === categoriaActiva;
        const coincideTexto = p.nombre.toLowerCase().includes(texto);
        return coincideCategoria && coincideTexto;
    });

    contenedor.innerHTML = '';

    if (filtrados.length === 0) {
        contenedor.innerHTML = '<p>No se encontraron productos.</p>';
        return;
    }

    filtrados.forEach(p => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-producto';
        tarjeta.innerHTML = `
            <h4>${p.nombre}</h4>
            <div class="precio">S/ ${Number(p.precio_venta).toFixed(2)}</div>
            <div class="stock">Stock: ${p.stock_actual}</div>
        `;
        tarjeta.addEventListener('click', () => agregarAlCarrito(p));
        contenedor.appendChild(tarjeta);
    });
}

/**
 * Agrega un producto al carrito (o aumenta su cantidad si ya estaba)
 */
function agregarAlCarrito(producto) {
    if (producto.stock_actual <= 0) {
        alert('No hay stock disponible de este producto.');
        return;
    }

    const existente = CARRITO.find(item => item.id === producto.id);

    if (existente) {
        if (existente.cantidad >= producto.stock_actual) {
            alert('No hay más stock disponible de este producto.');
            return;
        }
        existente.cantidad += 1;
    } else {
        CARRITO.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: Number(producto.precio_venta),
            cantidad: 1,
            stockDisponible: producto.stock_actual
        });
    }

    renderizarCarrito();
}

/**
 * Suma o resta unidades a un ítem del carrito. Si llega a 0, lo elimina.
 */
function cambiarCantidad(index, delta) {
    const item = CARRITO[index];
    if (!item) return;

    const nuevaCantidad = item.cantidad + delta;

    if (nuevaCantidad <= 0) {
        CARRITO.splice(index, 1);
    } else if (nuevaCantidad > item.stockDisponible) {
        alert('No hay más stock disponible de este producto.');
        return;
    } else {
        item.cantidad = nuevaCantidad;
    }

    renderizarCarrito();
}

function eliminarDelCarrito(index) {
    CARRITO.splice(index, 1);
    renderizarCarrito();
}

function limpiarCarrito() {
    CARRITO = [];
    const montoRecibido = document.getElementById('monto-recibido');
    if (montoRecibido) montoRecibido.value = '';
    const inputRuc = document.getElementById('factura-ruc');
    if (inputRuc) inputRuc.value = '';
    const inputRazon = document.getElementById('factura-razon-social');
    if (inputRazon) inputRazon.value = '';
    renderizarCarrito();
}

/**
 * Dibuja el ticket actual (columna derecha) y recalcula subtotal/IGV/total
 */
function renderizarCarrito() {
    const lista = document.getElementById('lista-carrito');
    if (!lista) return;

    lista.innerHTML = '';
    let subtotal = 0;

    CARRITO.forEach((item, index) => {
        const totalItem = item.precio * item.cantidad;
        subtotal += totalItem;

        const fila = document.createElement('div');
        fila.className = 'item-ticket';
        fila.innerHTML = `
            <div class="info-item">
                <p>${item.nombre}</p>
                <small>S/ ${item.precio.toFixed(2)} c/u</small>
            </div>
            <div class="controles-cantidad">
                <button class="btn-restar" data-index="${index}">-</button>
                <span>${item.cantidad}</span>
                <button class="btn-sumar" data-index="${index}">+</button>
            </div>
            <button class="btn-eliminar-item" data-index="${index}">❌</button>
            <strong>S/ ${totalItem.toFixed(2)}</strong>
        `;
        lista.appendChild(fila);
    });

    lista.querySelectorAll('.btn-restar').forEach(btn => {
        btn.addEventListener('click', e => cambiarCantidad(parseInt(e.currentTarget.dataset.index, 10), -1));
    });
    lista.querySelectorAll('.btn-sumar').forEach(btn => {
        btn.addEventListener('click', e => cambiarCantidad(parseInt(e.currentTarget.dataset.index, 10), 1));
    });
    lista.querySelectorAll('.btn-eliminar-item').forEach(btn => {
        btn.addEventListener('click', e => eliminarDelCarrito(parseInt(e.currentTarget.dataset.index, 10)));
    });

    const igv = subtotal * IGV_PORCENTAJE;
    const total = subtotal + igv;
    totalActual = total;

    const elSubtotal = document.getElementById('monto-subtotal');
    const elIgv = document.getElementById('monto-igv');
    const elTotal = document.getElementById('monto-total');

    if (elSubtotal) elSubtotal.textContent = `S/ ${subtotal.toFixed(2)}`;
    if (elIgv) elIgv.textContent = `S/ ${igv.toFixed(2)}`;
    if (elTotal) elTotal.textContent = `S/ ${total.toFixed(2)}`;

    actualizarVuelto();
}

/**
 * Muestra/oculta la caja de "Monto Recibido" según el método de pago elegido
 */
function actualizarVisibilidadMontoRecibido(metodoPago) {
    const caja = document.getElementById('caja-monto-recibido');
    if (!caja) return;

    if (metodoPago === 'Efectivo') {
        caja.style.display = '';
    } else {
        caja.style.display = 'none';
        const input = document.getElementById('monto-recibido');
        if (input) input.value = '';
        actualizarVuelto();
    }
}

/**
 * Muestra/oculta la caja de RUC y Razón Social según el tipo de comprobante elegido
 */
function actualizarVisibilidadDatosFactura(tipoComprobante) {
    const caja = document.getElementById('caja-datos-factura');
    if (!caja) return;
    caja.style.display = tipoComprobante === 'Factura' ? '' : 'none';
}

/**
 * Calcula y muestra el vuelto (o lo que falta) según el monto recibido en Efectivo
 */
function actualizarVuelto() {
    const inputRecibido = document.getElementById('monto-recibido');
    const elVuelto = document.getElementById('texto-vuelto');
    if (!inputRecibido || !elVuelto) return;

    const recibido = parseFloat(inputRecibido.value) || 0;

    if (recibido === 0) {
        elVuelto.textContent = 'Vuelto: S/ 0.00';
        elVuelto.classList.remove('insuficiente');
        return;
    }

    const vuelto = recibido - totalActual;

    if (vuelto < 0) {
        elVuelto.textContent = `Falta: S/ ${Math.abs(vuelto).toFixed(2)}`;
        elVuelto.classList.add('insuficiente');
    } else {
        elVuelto.textContent = `Vuelto: S/ ${vuelto.toFixed(2)}`;
        elVuelto.classList.remove('insuficiente');
    }
}

/**
 * Lee qué botón está activo dentro del grupo indicado (comprobante o metodo-pago)
 */
function obtenerSeleccionado(nombreGrupo) {
    const grupo = document.querySelector(`.grupo-botones[data-grupo="${nombreGrupo}"]`);
    if (!grupo) return null;
    const activo = grupo.querySelector('.btn-opcion.activo');
    return activo ? activo.dataset.valor : null;
}

/**
 * Inserta la venta y sus detalles en Supabase, y descuenta el stock vendido
 */
async function confirmarVenta() {
    if (CARRITO.length === 0) {
        alert('El carrito está vacío.');
        return;
    }

    const tipoComprobante = obtenerSeleccionado('comprobante') || 'Boleta';
    const metodoPago = obtenerSeleccionado('metodo-pago') || 'Efectivo';

    const subtotal = CARRITO.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
    const total = subtotal * (1 + IGV_PORCENTAJE);

    // Validación: Factura exige RUC (11 dígitos) y Razón Social
    let rucCliente = null;
    let razonSocialCliente = null;

    if (tipoComprobante === 'Factura') {
        const inputRuc = document.getElementById('factura-ruc');
        const inputRazon = document.getElementById('factura-razon-social');
        rucCliente = (inputRuc?.value || '').trim();
        razonSocialCliente = (inputRazon?.value || '').trim();

        if (!/^\d{11}$/.test(rucCliente)) {
            alert('Para Factura, el RUC debe tener exactamente 11 dígitos.');
            inputRuc?.focus();
            return;
        }
        if (!razonSocialCliente) {
            alert('Para Factura, la Razón Social es obligatoria.');
            inputRazon?.focus();
            return;
        }
    }

    // Validación: Efectivo exige un monto recibido suficiente
    if (metodoPago === 'Efectivo') {
        const inputRecibido = document.getElementById('monto-recibido');
        const recibido = parseFloat(inputRecibido?.value) || 0;
        if (recibido < total) {
            alert('El monto recibido es insuficiente para cubrir el total.');
            inputRecibido?.focus();
            return;
        }
    }

    const btnCobrar = document.querySelector('.btn-cobrar');
    if (btnCobrar) btnCobrar.disabled = true;

    try {
        // 1. Crear la venta
        const datosVenta = {
            tipo_comprobante: tipoComprobante,
            metodo_pago: metodoPago,
            total_cobrado: total
            // empleado_id: TODO -> asignar cuando el módulo de sesión/login esté listo
        };

        if (tipoComprobante === 'Factura') {
            datosVenta.ruc_cliente = rucCliente;
            datosVenta.razon_social_cliente = razonSocialCliente;
        }

        const { data: ventaCreada, error: errorVenta } = await supabaseClient
            .from('ventas')
            .insert(datosVenta)
            .select()
            .single();

        if (errorVenta) throw errorVenta;

        // 2. Crear el detalle de cada producto vendido
        const detalles = CARRITO.map(item => ({
            venta_id: ventaCreada.id_venta,
            producto_id: item.id,
            cantidad: item.cantidad,
            precio_unitario: item.precio
        }));

        const { error: errorDetalles } = await supabaseClient
            .from('detalles_ventas')
            .insert(detalles);

        if (errorDetalles) throw errorDetalles;

        // 3. Descontar el stock vendido de cada producto
        for (const item of CARRITO) {
            const productoActual = PRODUCTOS.find(p => p.id === item.id);
            const stockBase = productoActual ? productoActual.stock_actual : item.stockDisponible;
            const nuevoStock = stockBase - item.cantidad;

            const { error: errorStock } = await supabaseClient
                .from('productos')
                .update({ stock_actual: nuevoStock })
                .eq('id', item.id);

            if (errorStock) {
                console.error(`Error al actualizar stock de "${item.nombre}":`, errorStock);
            }
        }

        alert('🟢 Venta registrada correctamente.');
        limpiarCarrito();
        await cargarProductos();
        await cargarHistorial();

    } catch (err) {
        console.error('Error al registrar la venta:', err);
        alert('❌ Ocurrió un error al registrar la venta. Revisa la consola para más detalles.');
    } finally {
        if (btnCobrar) btnCobrar.disabled = false;
    }
}

/**
 * Trae las últimas ventas registradas y llena la tabla de historial
 */
async function cargarHistorial() {
    const tbody = document.getElementById('cuerpo-historial');
    if (!tbody) return;

    const { data, error } = await supabaseClient
        .from('ventas')
        .select('*')
        .order('fecha_hora', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error al traer historial de ventas:', error);
        return;
    }

    tbody.innerHTML = '';

    (data || []).forEach(venta => {
        const fila = document.createElement('tr');
        const fecha = new Date(venta.fecha_hora).toLocaleString('es-PE');
        fila.innerHTML = `
            <td>#${String(venta.id_venta).padStart(3, '0')}</td>
            <td>${fecha}</td>
            <td>${venta.tipo_comprobante}</td>
            <td>${venta.metodo_pago}</td>
            <td><strong>S/ ${Number(venta.total_cobrado).toFixed(2)}</strong></td>
        `;
        tbody.appendChild(fila);
    });

    const contador = document.querySelector('.cabecera-historial p');
    if (contador) {
        const n = (data || []).length;
        contador.textContent = `${n} venta${n === 1 ? '' : 's'} registrada${n === 1 ? '' : 's'}`;
    }
}