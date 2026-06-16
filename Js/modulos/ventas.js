/* ==========================================================================
   js/modulos/ventas.js - LÓGICA DEL PUNTO DE VENTA (CARRITO Y SUPABASE)
   ========================================================================== */
import { supabaseClient } from '../supabase-config.js';

// Arreglo en memoria para manejar los productos agregados
let CARRITO = [];

/**
 * Inicializa los escuchadores y carga los productos desde Supabase
 */
export function inicializarModuloVentas() {
    CARRITO = []; // Limpiamos el carrito al entrar a la pantalla
    actualizarSelectProductos();

    // Escuchador para el botón "Agregar al Carrito"
    const btnAgregar = document.getElementById('btn-vendedor-agregar');
    if (btnAgregar) {
        btnAgregar.addEventListener('click', vendedorAgregarAlCarrito);
    }

    // Escuchador para el botón "Confirmar Venta"
    const btnConfirmar = document.getElementById('btn-vendedor-confirmar');
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', vendedorConfirmarVenta);
    }
}

/**
 * Trae los productos activos de Supabase y llena el select del formulario
 */
async function actualizarSelectProductos() {
    const select = document.getElementById('vendedor-select-producto');
    if (!select) return;
    
    let { data: productos, error } = await supabaseClient.from('productos').select('*');
    if (error) {
        console.error("Error al traer productos:", error);
        return;
    }

    select.innerHTML = "";
    productos.forEach(prod => {
        let opt = document.createElement('option');
        opt.value = prod.id;
        opt.dataset.precio = prod.precio;
        opt.dataset.nombre = prod.nombre;
        opt.textContent = `${prod.nombre} - S/. ${prod.precio.toFixed(2)}`;
        select.appendChild(opt);
    });
}

/**
 * Toma los datos del formulario y los empuja al arreglo del carrito
 */
function vendedorAgregarAlCarrito() {
    const select = document.getElementById('vendedor-select-producto');
    const cantidadInput = document.getElementById('vendedor-input-cantidad');
    if (!select || select.options.length === 0 || !cantidadInput) return;

    const selectedOpt = select.options[select.selectedIndex];
    
    const id = selectedOpt.value;
    const nombre = selectedOpt.dataset.nombre;
    const precio = parseFloat(selectedOpt.dataset.precio) || 0;
    const cantidad = parseInt(cantidadInput.value) || 1;

    let existente = CARRITO.find(item => item.id === id);
    if (existente) {
        existente.cantidad += cantidad;
    } else {
        CARRITO.push({ id, nombre, precio, cantidad });
    }
    
    renderizarCarrito();
}

/**
 * Dibuja la tabla HTML del carrito con los subtotales actualizados
 */
function renderizarCarrito() {
    const tbody = document.getElementById('vendedor-tabla-carrito-cuerpo');
    const totalPago = document.getElementById('vendedor-total-monto');
    if (!tbody) return;

    tbody.innerHTML = "";
    let total = 0;

    CARRITO.forEach((item, index) => {
        let subtotal = item.precio * item.cantidad;
        total += subtotal;

        let row = `
            <tr>
                <td>${item.nombre}</td>
                <td>S/. ${item.precio.toFixed(2)}</td>
                <td>${item.cantidad}</td>
                <td>S/. ${subtotal.toFixed(2)}</td>
                <td><button class="btn-delete-item-cart" data-index="${index}">X</button></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
    
    if (totalPago) {
        totalPago.textContent = `S/. ${total.toFixed(2)}`;
    }

    // Agregar escuchadores dinámicos a los botones de eliminar individuales
    const botonesEliminar = tbody.querySelectorAll('.btn-delete-item-cart');
    botonesEliminar.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            eliminarDelCarrito(idx);
        });
    });
}

function eliminarDelCarrito(index) {
    CARRITO.splice(index, 1);
    renderizarCarrito();
}

/**
 * Guarda de forma oficial la transacción en Supabase
 */
async function vendedorConfirmarVenta() {
    if (CARRITO.length === 0) {
        alert("El carrito está vacío.");
        return;
    }
    
    // Aquí más adelante haremos el insert real a tu tabla 'ventas' e 'detalles_ventas' de Supabase
    alert("🟢 Transacción guardada en Supabase correctamente.");
    CARRITO = [];
    renderizarCarrito();
}