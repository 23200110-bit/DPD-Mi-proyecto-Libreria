import { supabaseClient } from '../supabase-config.js';

let escaner = null;
let escanerActivo = false;

export function inicializarCompras() {
    configurarEventosCompras();
}

function configurarEventosCompras() {
    const btnEscanear = document.getElementById('btn-compras-escanear');
    const formCompra = document.getElementById('form-registro-compra');
    const btnLimpiar = document.getElementById('btn-compras-limpiar');

    // Manejador del Escáner Flotante de la Cámara
    if (btnEscanear) {
        btnEscanear.addEventListener('click', abrirModalEscaner);
    }

    if (formCompra) {
        formCompra.addEventListener('submit', async (e) => {
            e.preventDefault();

            const codigoInput = document.getElementById('compra-codigo').value.trim();
            const codigo = codigoInput ? parseInt(codigoInput) : null;
            
            const nombre = document.getElementById('compra-nombre').value.trim();
            const marca = document.getElementById('compra-marca').value.trim();
            const categoryElement = document.getElementById('compra-categoria');
            const categoria = categoryElement ? categoryElement.value : '';
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
                        .select('id');

                    if (errI) throw errI;
                    
                    if (!nuevoProd || nuevoProd.length === 0) {
                        throw new Error("No se pudo recuperar el ID autogenerado del producto.");
                    }
                    
                    productoIdFinal = nuevoProd[0].id;
                }

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
                const minElement = document.getElementById('compra-minimo');
                if (minElement) minElement.value = 10;

            } catch (err) {
                alert(`❌ Error al procesar:\n${err.message || 'Verifica las columnas.'}`);
            }
        });
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            setTimeout(() => {
                const minElement = document.getElementById('compra-minimo');
                if (minElement) minElement.value = 10;
            }, 10);
        });
    }
}

/* ==========================================================================
   LÓGICA INTERNA DE INTEGRACIÓN PARA EL MODAL DE ESCANEO REAL
   ========================================================================== */

async function abrirModalEscaner() {
    const modal = document.getElementById('modal-escaner');
    if (!modal) return;
    modal.style.display = 'flex';

    if (typeof Html5Qrcode === 'undefined') {
        mostrarResultadoEscaner('❌ Librería Html5Qrcode no cargada en el sistema.', false);
        return;
    }

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
            mostrarResultadoEscaner('❌ Error al acceder a los permisos de cámara.', false);
            return;
        }
    }

    document.getElementById('btn-cerrar-escaner').onclick = cerrarModalEscaner;
    document.getElementById('btn-iniciar-escaner').onclick = iniciarEscaner;
    document.getElementById('btn-detener-escaner').onclick = detenerEscaner;
}

async function iniciarEscaner() {
    if (escanerActivo) return;

    const select = document.getElementById('select-camara');
    const camaraId = select?.value;
    if (!camaraId) return;

    const divResultado = document.getElementById('escaner-resultado');
    if (divResultado) divResultado.style.display = 'none';

    try {
        escaner = new Html5Qrcode('lector-qr');
        await escaner.start(
            camaraId,
            { fps: 10, qrbox: { width: 300, height: 120 }, aspectRatio: 1.5 },
            onCodigoDetectado,
            () => {}
        );

        escanerActivo = true;
        document.getElementById('btn-iniciar-escaner').style.display = 'none';
        document.getElementById('btn-detener-escaner').style.display = '';
    } catch (err) {
        mostrarResultadoEscaner('❌ Error al iniciar la cámara.', false);
    }
}

async function onCodigoDetectado(codigoBarras) {
    await detenerEscaner();
    mostrarResultadoEscaner(`🔍 Código detectado: ${codigoBarras}. Sincronizando...`, true);

    // Mandamos el código directo al input nativo
    document.getElementById('compra-codigo').value = codigoBarras;
    
    // Ejecutamos tu lógica existente de búsqueda y autocompletado en base de datos
    await buscarProductoPorCodigo(codigoBarras);

    setTimeout(cerrarModalEscaner, 1000);
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

            mostrarResultadoEscaner(`📦 ¡Producto detectado! #${p.id} cargado.`, true);
        } else {
            mostrarResultadoEscaner("✨ Código de barras nuevo detectado. ¡Listo para registrar!", true);
        }
    } catch (err) {
        console.error(err);
    }
}

async function detenerEscaner() {
    if (escaner && escanerActivo) {
        try { await escaner.stop(); } catch (e) {}
        escaner = null;
    }
    escanerActivo = false;
    document.getElementById('btn-iniciar-escaner').style.display = '';
    document.getElementById('btn-detener-escaner').style.display = 'none';
}

async function cerrarModalEscaner() {
    await detenerEscaner();
    document.getElementById('modal-escaner').style.display = 'none';
    document.getElementById('lector-qr').innerHTML = '';
    document.getElementById('escaner-resultado').style.display = 'none';
}

function mostrarResultadoEscaner(mensaje, esExito) {
    const div = document.getElementById('escaner-resultado');
    const p = document.getElementById('escaner-mensaje');
    if (div && p) {
        p.textContent = mensaje;
        div.className = `escaner-resultado ${esExito ? 'exito' : 'error'}`;
        div.style.display = '';
    }
}