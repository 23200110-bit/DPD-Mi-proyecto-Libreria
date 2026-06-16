import { supabaseClient } from '../supabase-config.js';

export function inicializarCompras() {
    configurarEventosCompras();
}

function configurarEventosCompras() {
    const btnEscanear = document.getElementById('btn-compras-escanear');
    const formCompra = document.getElementById('form-registro-compra');
    const btnLimpiar = document.getElementById('btn-compras-limpiar');

    if (btnEscanear) {
        btnEscanear.addEventListener('click', async () => {
            const codigoEscaneado = prompt("📷 [ESCÁNER ACTIVO]\nEscanea el código de barras de la caja:");
            if (!codigoEscaneado) return;

            document.getElementById('compra-codigo').value = codigoEscaneado;
            await buscarProductoPorCodigo(codigoEscaneado);
        });
    }

    if (formCompra) {
        formCompra.addEventListener('submit', async (e) => {
            e.preventDefault();

            const codigo = document.getElementById('compra-codigo').value.trim();
            const nombre = document.getElementById('compra-nombre').value.trim();
            const marca = document.getElementById('compra-marca').value.trim();
            const categoria = document.getElementById('compra-categoria').value;
            const cantidadComprada = parseInt(document.getElementById('compra-stock').value) || 0;
            const precioCosto = parseFloat(document.getElementById('compra-costo').value) || 0;
            const precioVenta = parseFloat(document.getElementById('compra-venta').value) || 0;
            const stockMinimo = parseInt(document.getElementById('compra-minimo').value) || 10;

            try {
                let query = supabaseClient.from('productos').select('*');
                if (codigo) {
                    query = query.eq('codigo_barras', codigo);
                } else {
                    query = query.eq('nombre', nombre);
                }

                const { data: existentes, error: errB } = await query;
                if (errB) throw errB;

                let productoIdFinal = null;

                if (existentes && existentes.length > 0) {
                    // EL PRODUCTO YA EXISTE: Sumamos stock y actualizamos precio de venta
                    const prodViejo = existentes[0];
                    productoIdFinal = prodViejo.id;
                    const nuevoStock = (prodViejo.stock_actual || 0) + cantidadComprada;

                    const { error: errU } = await supabaseClient
                        .from('productos')
                        .update({
                            nombre, 
                            marca: marca || null, 
                            categoria,
                            stock_actual: nuevoStock,
                            precio_venta: precioVenta,
                            stock_minimo_alerta: stockMinimo
                        })
                        .eq('id', productoIdFinal);

                    if (errU) throw errU;
                } else {
                    // EL PRODUCTO ES NUEVO: Estructura limpia dejando que el ID se cree solo en Supabase
                    const productoNuevoPayload = {
                        nombre,
                        categoria,
                        stock_actual: cantidadComprada,
                        precio_venta: precioVenta,
                        stock_minimo_alerta: stockMinimo
                    };

                    if (marca) productoNuevoPayload.marca = marca;
                    if (codigo) productoNuevoPayload.codigo_barras = codigo;

                    const { data: nuevoProd, error: errI } = await supabaseClient
                        .from('productos')
                        .insert([productoNuevoPayload])
                        .select('id'); // Pedimos explícitamente solo el ID asignado por el SERIAL

                    if (errI) throw errI;
                    
                    if (!nuevoProd || nuevoProd.length === 0) {
                        throw new Error("No se pudo recuperar el ID autogenerado del producto.");
                    }
                    
                    productoIdFinal = nuevoProd[0].id;
                }

                // REGISTRO EN LA TABLA COMPRAS (Historial de Almacén)
                const { error: errCompra } = await supabaseClient
                    .from('compras')
                    .insert([{
                        producto_id: productoIdFinal,
                        cantidad: cantidadComprada,
                        precio_costo: precioCosto
                    }]);

                if (errCompra) throw errCompra;

                alert(`💾 ¡Operación Exitosa!\nEl producto e historial de compra se sincronizaron correctamente.`);
                formCompra.reset();
                document.getElementById('compra-minimo').value = 10;

            } catch (err) {
                alert(`❌ Error al procesar:\n${err.message || 'Verifica las columnas.'}`);
            }
        });
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            setTimeout(() => document.getElementById('compra-minimo').value = 10, 10);
        });
    }
}

async function buscarProductoPorCodigo(codigo) {
    try {
        const { data, error } = await supabaseClient
            .from('productos')
            .select('*')
            .eq('codigo_barras', codigo);

        if (error) throw error;

        if (data && data.length > 0) {
            const p = data[0];
            document.getElementById('compra-nombre').value = p.nombre || "";
            document.getElementById('compra-marca').value = p.marca || "";
            document.getElementById('compra-categoria').value = p.categoria || "";
            document.getElementById('compra-venta').value = p.precio_venta || 0;
            document.getElementById('compra-minimo').value = p.stock_minimo_alerta || 10;

            // Buscamos el último costo de compra histórico para auto-rellenar
            const { data: historicoCompra } = await supabaseClient
                .from('compras')
                .select('precio_costo')
                .eq('producto_id', p.id)
                .order('id_compra', { ascending: false })
                .limit(1);

            if (historicoCompra && historicoCompra.length > 0) {
                document.getElementById('compra-costo').value = historicoCompra[0].precio_costo;
            } else {
                document.getElementById('compra-costo').value = 0;
            }

            alert(`📦 ¡Producto detectado! Datos del ID #${p.id} cargados.`);
        } else {
            alert("✨ Código de barras nuevo detectado. Registra el producto por primera vez.");
        }
    } catch (err) {
        console.error(err);
    }
}