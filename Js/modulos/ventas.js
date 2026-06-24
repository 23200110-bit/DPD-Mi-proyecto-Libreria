/* ==========================================================================
   js/modulos/ventas.js - LÓGICA DEL PUNTO DE VENTA (CARRITO Y SUPABASE)
   ========================================================================== */
import { supabaseClient } from '../supabase-config.js';

const IGV_PORCENTAJE = 0.18;

// ⬇ Cambia este número por el celular registrado en Yape/Plin de la tienda
const NUMERO_YAPE_TIENDA = '987654321';

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
    totalActual = 0;

    await cargarProductos();
    renderizarCarrito();
    await cargarHistorial();

    // Buscador de texto
    const buscador = document.getElementById('buscador-productos');
    if (buscador) {
        buscador.addEventListener('input', renderizarCatalogo);
    }

    // Filtros de categoría
    const botonesFiltro = document.querySelectorAll('.filtros-categorias button');
    botonesFiltro.forEach(btn => {
        btn.addEventListener('click', () => {
            botonesFiltro.forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
            categoriaActiva = btn.dataset.categoria || 'Todos';
            renderizarCatalogo();
        });
    });

    // Toggle de Tipo de Comprobante y Método de Pago
    const gruposBotones = document.querySelectorAll('.grupo-botones');
    gruposBotones.forEach(grupo => {
        grupo.querySelectorAll('.btn-opcion').forEach(btn => {
            btn.addEventListener('click', () => {
                grupo.querySelectorAll('.btn-opcion').forEach(b => b.classList.remove('activo'));
                btn.classList.add('activo');

                if (grupo.dataset.grupo === 'metodo-pago') {
                    actualizarVisibilidadMetodoPago(btn.dataset.valor);
                }
                if (grupo.dataset.grupo === 'comprobante') {
                    actualizarVisibilidadDatosFactura(btn.dataset.valor);
                }
            });
        });
    });

    // Listener del campo "Monto Recibido" para calcular vuelto en vivo
    const inputRecibido = document.getElementById('monto-recibido');
    if (inputRecibido) {
        inputRecibido.addEventListener('input', actualizarVuelto);
    }

    const btnLimpiar = document.querySelector('.btn-limpiar');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', limpiarCarrito);
    }

    // Botón Escanear → abre el modal
    const btnEscanear = document.getElementById('btn-abrir-escaner');
    if (btnEscanear) {
        btnEscanear.addEventListener('click', abrirModalEscaner);
    }

    const btnCobrar = document.querySelector('.btn-cobrar');
    if (btnCobrar) {
        btnCobrar.addEventListener('click', confirmarVenta);
    }

    // Toggle del historial de ventas
    const cabeceraHistorial = document.querySelector('.cabecera-historial');
    if (cabeceraHistorial) {
        cabeceraHistorial.addEventListener('click', () => {
            const tabla     = document.querySelector('.tabla-historial-contenedor');
            const icono     = document.querySelector('.icono-desplegar');
            const abierto   = tabla.style.display !== 'none';

            tabla.style.display = abierto ? 'none' : '';
            if (icono) icono.textContent = abierto ? '🔼' : '🔽';
        });
    }
}

/* ==========================================================================
   CATÁLOGO
   ========================================================================== */

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
        contenedor.innerHTML = '<p style="color:#888;font-size:14px;">No se encontraron productos.</p>';
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

/* ==========================================================================
   CARRITO
   ========================================================================== */

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
        btn.addEventListener('click', e =>
            cambiarCantidad(parseInt(e.currentTarget.dataset.index, 10), -1));
    });
    lista.querySelectorAll('.btn-sumar').forEach(btn => {
        btn.addEventListener('click', e =>
            cambiarCantidad(parseInt(e.currentTarget.dataset.index, 10), 1));
    });
    lista.querySelectorAll('.btn-eliminar-item').forEach(btn => {
        btn.addEventListener('click', e =>
            eliminarDelCarrito(parseInt(e.currentTarget.dataset.index, 10)));
    });

    const igv = subtotal * IGV_PORCENTAJE;
    const total = subtotal + igv;
    totalActual = total;

    const elSubtotal = document.getElementById('monto-subtotal');
    const elIgv     = document.getElementById('monto-igv');
    const elTotal   = document.getElementById('monto-total');

    if (elSubtotal) elSubtotal.textContent = `S/ ${subtotal.toFixed(2)}`;
    if (elIgv)      elIgv.textContent      = `S/ ${igv.toFixed(2)}`;
    if (elTotal)    elTotal.textContent    = `S/ ${total.toFixed(2)}`;

    // Actualizar el vuelto (si efectivo está activo) y el QR (si Yape/Plin está activo)
    actualizarVuelto();
    actualizarQRSiVisible();
}

/* ==========================================================================
   VISIBILIDAD DE SECCIONES SEGÚN SELECCIÓN
   ========================================================================== */

/**
 * Muestra "Efectivo" → caja de monto recibido
 * Muestra "Yape/Plin" → QR
 * Muestra "Tarjeta" → nada extra
 */
function actualizarVisibilidadMetodoPago(metodoPago) {
    const cajaEfectivo = document.getElementById('caja-monto-recibido');
    const cajaQR       = document.getElementById('caja-qr-yape');

    // Ocultar todo primero
    if (cajaEfectivo) cajaEfectivo.style.display = 'none';
    if (cajaQR)       cajaQR.style.display       = 'none';

    if (metodoPago === 'Efectivo') {
        if (cajaEfectivo) cajaEfectivo.style.display = '';
        const input = document.getElementById('monto-recibido');
        if (input) input.value = '';
        actualizarVuelto();

    } else if (metodoPago === 'Yape/Plin') {
        if (cajaQR) cajaQR.style.display = '';
        generarQR();
    }
}

function actualizarVisibilidadDatosFactura(tipoComprobante) {
    const caja = document.getElementById('caja-datos-factura');
    if (!caja) return;
    caja.style.display = tipoComprobante === 'Factura' ? '' : 'none';
}

/* ==========================================================================
   QR YAPE / PLIN
   ========================================================================== */

/**
 * Regenera el QR si la caja ya está visible (p.ej. cuando cambia el total)
 */
function actualizarQRSiVisible() {
    const cajaQR = document.getElementById('caja-qr-yape');
    if (cajaQR && cajaQR.style.display !== 'none') {
        generarQR();
    }
}

/**
 * Muestra el número de Yape/Plin de la tienda y el monto a cobrar.
 * Nota: Yape y Plin usan QR propietarios que requieren registro como
 * comercio afiliado. Para tiendas pequeñas, mostrar el número es la
 * solución práctica — el cliente lo busca en su app manualmente.
 */
function generarQR() {
    const elMonto = document.getElementById('qr-monto-mostrado');

    // Recalcular el total directo del carrito para asegurar que siempre sea correcto
    const subtotal = CARRITO.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
    const total    = subtotal * (1 + IGV_PORCENTAJE);

    if (elMonto) elMonto.textContent = `S/ ${total.toFixed(2)}`;
}

/* ==========================================================================
   EFECTIVO: VUELTO
   ========================================================================== */

function actualizarVuelto() {
    const inputRecibido = document.getElementById('monto-recibido');
    const elVuelto      = document.getElementById('texto-vuelto');
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

/* ==========================================================================
   CONFIRMAR VENTA
   ========================================================================== */

function obtenerSeleccionado(nombreGrupo) {
    const grupo = document.querySelector(`.grupo-botones[data-grupo="${nombreGrupo}"]`);
    if (!grupo) return null;
    const activo = grupo.querySelector('.btn-opcion.activo');
    return activo ? activo.dataset.valor : null;
}

async function confirmarVenta() {
    if (CARRITO.length === 0) {
        alert('El carrito está vacío.');
        return;
    }

    const tipoComprobante = obtenerSeleccionado('comprobante') || 'Boleta';
    const metodoPago      = obtenerSeleccionado('metodo-pago') || 'Efectivo';

    const subtotal = CARRITO.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
    const total    = subtotal * (1 + IGV_PORCENTAJE);

    // Validación Factura: RUC (11 dígitos) y Razón Social obligatorios
    let rucCliente         = null;
    let razonSocialCliente = null;

    if (tipoComprobante === 'Factura') {
        const inputRuc   = document.getElementById('factura-ruc');
        const inputRazon = document.getElementById('factura-razon-social');
        rucCliente         = (inputRuc?.value || '').trim();
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

    // Validación Efectivo: monto recibido debe cubrir el total
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
        // 1. Insertar la venta principal
        const datosVenta = {
            tipo_comprobante: tipoComprobante,
            metodo_pago:      metodoPago,
            total_cobrado:    total
            // empleado_id: TODO → asignar cuando esté el módulo de sesión
        };
        if (tipoComprobante === 'Factura') {
            datosVenta.ruc_cliente          = rucCliente;
            datosVenta.razon_social_cliente = razonSocialCliente;
        }

        const { data: ventaCreada, error: errorVenta } = await supabaseClient
            .from('ventas')
            .insert(datosVenta)
            .select()
            .single();

        if (errorVenta) throw errorVenta;

        // 2. Insertar el detalle de cada producto
        const detalles = CARRITO.map(item => ({
            venta_id:        ventaCreada.id_venta,
            producto_id:     item.id,
            cantidad:        item.cantidad,
            precio_unitario: item.precio
        }));

        const { error: errorDetalles } = await supabaseClient
            .from('detalles_ventas')
            .insert(detalles);

        if (errorDetalles) throw errorDetalles;

        // 3. Descontar stock
        for (const item of CARRITO) {
            const productoActual = PRODUCTOS.find(p => p.id === item.id);
            const stockBase  = productoActual ? productoActual.stock_actual : item.stockDisponible;
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
        alert('❌ Ocurrió un error al registrar la venta. Revisa la consola.');
    } finally {
        if (btnCobrar) btnCobrar.disabled = false;
    }
}

/* ==========================================================================
   HISTORIAL
   ========================================================================== */

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
        const fila  = document.createElement('tr');
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

/* ==========================================================================
   ESCÁNER DE CÓDIGO DE BARRAS (Html5Qrcode)
   ========================================================================== */

let escaner = null;        // instancia de Html5Qrcode
let escanerActivo = false; // para evitar iniciar dos veces

/**
 * Abre el modal, lista las cámaras disponibles y deja al usuario elegir
 */
async function abrirModalEscaner() {
    const modal = document.getElementById('modal-escaner');
    if (!modal) return;
    modal.style.display = 'flex';

    // Verificar que la librería esté cargada
    if (typeof Html5Qrcode === 'undefined') {
        mostrarResultadoEscaner('❌ Librería Html5Qrcode no disponible. Agrega el script en vendedor.html', false);
        return;
    }

    // Listar cámaras disponibles
    const select = document.getElementById('select-camara');
    if (select && select.options.length === 0) {
        try {
            const camaras = await Html5Qrcode.getCameras();
            if (!camaras || camaras.length === 0) {
                mostrarResultadoEscaner('❌ No se detectaron cámaras en este dispositivo.', false);
                return;
            }
            camaras.forEach(cam => {
                const opt = document.createElement('option');
                opt.value = cam.id;
                opt.textContent = cam.label || `Cámara ${cam.id}`;
                select.appendChild(opt);
            });
        } catch (err) {
            mostrarResultadoEscaner('❌ No se pudo acceder a las cámaras. Verifica los permisos del navegador.', false);
            return;
        }
    }

    // Listeners del modal (solo una vez)
    const btnCerrar   = document.getElementById('btn-cerrar-escaner');
    const btnIniciar  = document.getElementById('btn-iniciar-escaner');
    const btnDetener  = document.getElementById('btn-detener-escaner');

    // Usamos onclick para evitar acumular listeners cada vez que se abre el modal
    if (btnCerrar)  btnCerrar.onclick  = cerrarModalEscaner;
    if (btnIniciar) btnIniciar.onclick = iniciarEscaner;
    if (btnDetener) btnDetener.onclick = detenerEscaner;

    // Cerrar al hacer clic fuera de la caja
    modal.onclick = (e) => {
        if (e.target === modal) cerrarModalEscaner();
    };
}

/**
 * Inicia la cámara seleccionada y comienza a buscar códigos de barras
 */
async function iniciarEscaner() {
    if (escanerActivo) return;

    const select     = document.getElementById('select-camara');
    const btnIniciar = document.getElementById('btn-iniciar-escaner');
    const btnDetener = document.getElementById('btn-detener-escaner');

    const camaraId = select?.value;
    if (!camaraId) {
        mostrarResultadoEscaner('⚠️ Selecciona una cámara primero.', false);
        return;
    }

    // Limpiar resultado anterior
    const divResultado = document.getElementById('escaner-resultado');
    if (divResultado) divResultado.style.display = 'none';

    try {
        escaner = new Html5Qrcode('lector-qr');

        await escaner.start(
            camaraId,
            {
                fps: 10,
                qrbox: { width: 300, height: 120 },  // rectángulo horizontal, ideal para barras
                aspectRatio: 1.5
            },
            onCodigoDetectado,   // éxito
            () => {}             // errores de frame (normales mientras no hay código)
        );

        escanerActivo = true;
        if (btnIniciar) btnIniciar.style.display = 'none';
        if (btnDetener) btnDetener.style.display = '';

    } catch (err) {
        console.error('Error al iniciar escáner:', err);
        mostrarResultadoEscaner('❌ No se pudo iniciar la cámara. Verifica los permisos.', false);
    }
}

/**
 * Se ejecuta cuando se detecta un código. Busca el producto en Supabase.
 */
async function onCodigoDetectado(codigoBarras) {
    // Detener para no seguir leyendo mientras procesamos
    await detenerEscaner();

    mostrarResultadoEscaner(`🔍 Código detectado: ${codigoBarras}. Buscando producto...`, true);

    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('codigo_barras', codigoBarras)
        .single();

    if (error || !data) {
        mostrarResultadoEscaner(
            `⚠️ Código "${codigoBarras}" no encontrado en el inventario.`,
            false
        );
        // Permitir reintentar
        const btnIniciar = document.getElementById('btn-iniciar-escaner');
        if (btnIniciar) btnIniciar.style.display = '';
        return;
    }

    // Producto encontrado: agregarlo al carrito y cerrar el modal
    agregarAlCarrito(data);
    mostrarResultadoEscaner(`✅ "${data.nombre}" agregado al carrito.`, true);

    // Cerrar el modal después de 1.2 segundos para que el usuario vea el mensaje
    setTimeout(cerrarModalEscaner, 1200);
}

/**
 * Detiene la cámara y limpia la instancia
 */
async function detenerEscaner() {
    const btnIniciar = document.getElementById('btn-iniciar-escaner');
    const btnDetener = document.getElementById('btn-detener-escaner');

    if (escaner && escanerActivo) {
        try {
            await escaner.stop();
        } catch (e) {
            // Ignorar errores al detener
        }
        escaner = null;
    }
    escanerActivo = false;

    if (btnIniciar) btnIniciar.style.display = '';
    if (btnDetener) btnDetener.style.display = 'none';
}

/**
 * Cierra el modal y libera la cámara
 */
async function cerrarModalEscaner() {
    await detenerEscaner();

    const modal = document.getElementById('modal-escaner');
    if (modal) modal.style.display = 'none';

    // Limpiar el video del DOM
    const lector = document.getElementById('lector-qr');
    if (lector) lector.innerHTML = '';

    // Resetear resultado
    const divResultado = document.getElementById('escaner-resultado');
    if (divResultado) divResultado.style.display = 'none';
}

/**
 * Muestra un mensaje de resultado dentro del modal (éxito o error)
 */
function mostrarResultadoEscaner(mensaje, esExito) {
    const div = document.getElementById('escaner-resultado');
    const p   = document.getElementById('escaner-mensaje');
    if (!div || !p) return;

    p.textContent = mensaje;
    div.className = `escaner-resultado ${esExito ? 'exito' : 'error'}`;
    div.style.display = '';
}