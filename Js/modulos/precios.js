import { supabaseClient } from '../supabase-config.js';

export function inicializarPrecios() {
  const tarjetas = Array.from(document.querySelectorAll('.strategy-card'));
  const manualInput = document.querySelector('.precio-manual-input');
  const manualPriceInput = document.getElementById('manual-price-input');
  const applyStrategyButton = document.getElementById('btn-apply-strategy');
  const selectInventario = document.getElementById('select-inventory');
  const productName = document.getElementById('product-selected-name');
  const productOldCost = document.getElementById('product-old-cost');
  const productNewCost = document.getElementById('product-new-cost');
  const productChangeBadge = document.getElementById('product-change-badge');
  const listaProductosInventario = document.getElementById('inventory-product-list');

  const productosPorId = new Map();
  let estrategiaSeleccionada = 'ponderado';
  let productoActual = null;

  function mostrarProductoSeleccionado(producto) {
    if (!producto) return;
    productoActual = producto;
    if (productName) productName.textContent = producto.nombre || 'Sin nombre';
    if (productOldCost) {
      const costoAnterior = Number(producto.precio_costo || 0).toFixed(2);
      productOldCost.innerHTML = `<del>S/. ${costoAnterior}</del>`;
    }
    if (productNewCost) {
      const precioVenta = Number(producto.precio_venta || 0).toFixed(2);
      productNewCost.textContent = `S/. ${precioVenta}`;
    }
    if (productChangeBadge) {
      const costoAnterior = Number(producto.precio_costo || 0);
      const precioVenta = Number(producto.precio_venta || 0);
      const cambio = costoAnterior > 0 ? ((precioVenta - costoAnterior) / costoAnterior) * 100 : 0;
      const porcentaje = cambio.toFixed(1);
      if (cambio >= 0) {
        productChangeBadge.classList.add('price-up');
        productChangeBadge.classList.remove('price-down');
        productChangeBadge.textContent = `+${porcentaje}% margen`;
      } else {
        productChangeBadge.classList.add('price-down');
        productChangeBadge.classList.remove('price-up');
        productChangeBadge.textContent = `${porcentaje}% margen`;
      }
    }
  }

  function seleccionarProducto(producto) {
    mostrarProductoSeleccionado(producto);
    if (selectInventario) selectInventario.value = producto.id;
    actualizarSeleccionVisual(producto.id);
  }

  async function cargarProductosInventario() {
    if (!selectInventario) return;

    try {
      const { data, error } = await supabaseClient
        .from('productos')
        .select('id, nombre, precio_venta, precio_costo, stock_actual')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('[Precios] Error cargando productos:', error);
        return;
      }

      selectInventario.innerHTML = '';
      if (listaProductosInventario) listaProductosInventario.innerHTML = '';

      if (!Array.isArray(data) || data.length === 0) {
        selectInventario.innerHTML = '<option value="">No hay productos disponibles</option>';
        if (listaProductosInventario) {
          listaProductosInventario.innerHTML = '<div class="inventory-product-empty">No hay productos disponibles</div>';
        }
        return;
      }

      data.forEach((producto) => {
        const option = document.createElement('option');
        option.value = producto.id;
        option.textContent = producto.nombre || 'Producto sin nombre';
        selectInventario.appendChild(option);
        productosPorId.set(String(producto.id), producto);

        if (listaProductosInventario) {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'inventory-product-item';
          item.dataset.id = producto.id;
          item.innerHTML = `
            <div class="inventory-product-name">${producto.nombre || 'Producto sin nombre'}</div>
            <div class="inventory-product-meta">
              <span>Stock: ${producto.stock_actual ?? 0}</span>
              <span>Precio: S/. ${Number(producto.precio_venta || 0).toFixed(2)}</span>
            </div>
          `;

          item.addEventListener('click', () => {
            selectInventario.value = producto.id;
            seleccionarProducto(producto);
            actualizarSeleccionVisual(producto.id);
          });

          listaProductosInventario.appendChild(item);
        }
      });

      const primerProducto = data[0];
      selectInventario.value = primerProducto.id;
      seleccionarProducto(primerProducto);
      if (listaProductosInventario) actualizarSeleccionVisual(primerProducto.id);
    } catch (err) {
      console.error('[Precios] Excepción cargando productos:', err);
    }
  }

  function activarTarjeta(tarjetaSeleccionada) {
    tarjetas.forEach((tarjeta) => {
      const esManual = tarjeta.dataset.estrategia === 'manual';
      const estaActiva = tarjeta === tarjetaSeleccionada;

      tarjeta.classList.toggle('activa', estaActiva);

      if (esManual && manualInput) {
        manualInput.disabled = !estaActiva;
      }

      if (estaActiva) {
        estrategiaSeleccionada = tarjeta.dataset.estrategia || 'ponderado';
      }
    });

    if (estrategiaSeleccionada === 'manual' && manualPriceInput) {
      manualPriceInput.disabled = false;
      manualPriceInput.focus();
    } else if (manualPriceInput) {
      manualPriceInput.disabled = true;
      manualPriceInput.value = '';
    }
  }

  function actualizarSeleccionVisual(productoId) {
    if (!listaProductosInventario) return;
    const items = listaProductosInventario.querySelectorAll('.inventory-product-item');
    items.forEach((item) => {
      item.classList.toggle('selected', item.dataset.id === String(productoId));
    });
  }

  tarjetas.forEach((tarjeta) => {
    tarjeta.addEventListener('click', () => activarTarjeta(tarjeta));
  });

  function calcularPrecioSugerido(producto, estrategia) {
    const costo = Number(producto.precio_costo || 0);
    const venta = Number(producto.precio_venta || 0);
    if (estrategia === 'manual') {
      return manualPriceInput && manualPriceInput.value ? Number(manualPriceInput.value) : venta;
    }
    if (estrategia === 'fifo') {
      return Number((venta + costo * 0.15).toFixed(2));
    }
    const margen = 0.35;
    return Number((costo * (1 + margen)).toFixed(2));
  }

  function actualizarPreciosSugeridos() {
    tarjetas.forEach((tarjeta) => {
      const label = tarjeta.querySelector('.strategy-suggestion');
      if (!label) return;
      const estrategia = tarjeta.dataset.estrategia || (tarjeta.classList.contains('active') ? 'ponderado' : '');
      const producto = productoActual || { precio_costo: 0, precio_venta: 0 };
      const precioSugerido = calcularPrecioSugerido(producto, estrategia);
      label.textContent = `Precio sugerido: S/. ${precioSugerido.toFixed(2)}`;
    });
  }

  if (selectInventario) {
    selectInventario.addEventListener('change', () => {
      const productoSeleccionado = productosPorId.get(selectInventario.value);
      seleccionarProducto(productoSeleccionado);
      actualizarPreciosSugeridos();
    });
    cargarProductosInventario();
  }

  tarjetas.forEach((tarjeta) => {
    tarjeta.addEventListener('click', () => {
      activarTarjeta(tarjeta);
      actualizarPreciosSugeridos();
    });
  });

  if (applyStrategyButton) {
    applyStrategyButton.addEventListener('click', async () => {
      if (!productoActual) return;
      let precioFinal = calcularPrecioSugerido(productoActual, estrategiaSeleccionada);
      if (estrategiaSeleccionada === 'manual' && manualPriceInput) {
        const manual = Number(manualPriceInput.value);
        if (isNaN(manual) || manual <= 0) {
          alert('Ingresa un precio manual válido.');
          return;
        }
        precioFinal = manual;
      }

      try {
        const { error } = await supabaseClient
          .from('productos')
          .update({ precio_venta: precioFinal })
          .eq('id', productoActual.id);

        if (error) {
          console.error('[Precios] Error actualizando precio:', error);
          alert('No se pudo actualizar el precio. Revisa la consola.');
          return;
        }

        productoActual.precio_venta = precioFinal;
        mostrarProductoSeleccionado(productoActual);
        actualizarPreciosSugeridos();
        alert('Precio actualizado correctamente.');
      } catch (err) {
        console.error('[Precios] Excepción actualizando precio:', err);
        alert('Error al actualizar el precio.');
      }
    });
  }
}
