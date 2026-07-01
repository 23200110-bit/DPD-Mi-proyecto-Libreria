/* ==========================================================================
   js/modulos/conteo.js - CONTROLADOR DE AUDITORÍA TOTALMENTE ADAPTADO A TU DB
   ========================================================================== */

import { supabaseClient } from '../supabase-config.js';

export async function inicializarModuloConteo() {
    const selectProducto = document.getElementById('select-producto-conteo'); 
    const inputStockContado = document.getElementById('input-stock-contado');
    const formConteo = document.getElementById('form-conteo-fisico');

    if (!selectProducto || !inputStockContado || !formConteo) {
        console.warn("Elementos de la interfaz de conteo no encontrados en esta vista.");
        return;
    }

    let listaProductosMemoria = [];

    // 1. CARGAR PRODUCTOS DESDE TU TABLA REAL 'productos'
    async function obtenerProductosDesdeSupabase() {
        try {
            selectProducto.innerHTML = '<option value="">Obteniendo productos del inventario...</option>';

            const { data, error } = await supabaseClient
                .from('productos') 
                .select('id, nombre, stock_actual, precio_venta, marca')
                .order('nombre', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                selectProducto.innerHTML = '<option value="">No existen productos en el inventario</option>';
                return;
            }

            listaProductosMemoria = data;
            selectProducto.innerHTML = '<option value="">-- Elige un producto existente --</option>';

            data.forEach(prod => {
                const option = document.createElement('option');
                option.value = prod.id;
                const marcaInfo = prod.marca ? ` [${prod.marca}]` : '';             
                option.textContent = `${prod.nombre}${marcaInfo}`;
                selectProducto.appendChild(option);
            });

        } catch (err) {
            console.error("Error cargando productos:", err.message);
            selectProducto.innerHTML = '<option value="">Error al conectar con el inventario</option>';
        }
    }

    await obtenerProductosDesdeSupabase();

    // 2. CAPTURAR EL SUBMIT DEL FORMULARIO
    formConteo.addEventListener('submit', async (e) => {
        e.preventDefault();

        const idSel = selectProducto.value;
        const stockContado = parseInt(inputStockContado.value);

        if (!idSel) {
            alert("Por favor, selecciona un producto antes de proceder.");
            return;
        }

        if (isNaN(stockContado) || stockContado < 0) {
            alert("El stock físico no puede ser un valor negativo o vacío.");
            return;
        }

        const prodSistema = listaProductosMemoria.find(p => p.id == idSel);
        if (!prodSistema) return;

        const stockTeoricoSistema = parseInt(prodSistema.stock_actual || 0);

        // Discrepancia calculada pero NO mostrada al empleado
        const discrepanciaCalculada = stockTeoricoSistema - stockContado;

        // Confirmación neutra — el empleado no ve si hay diferencia o no
        if (!confirm("¿Confirmas que deseas registrar este conteo físico?")) return;

        let emailUsuarioActivo = "vendedor.anonimo@lapizdeoro.com";
        try {
            const { data: sessionData } = await supabaseClient.auth.getSession();
            if (sessionData?.session?.user?.email) {
                emailUsuarioActivo = sessionData.session.user.email;
            }
        } catch (sErr) {
            console.log("No se pudo extraer el email de auth, usando por defecto.");
        }

        try {
            const { error: errInsert } = await supabaseClient
                .from('conteos_auditoria')
                .insert([{
                    producto_id: parseInt(idSel),
                    vendedor_email: emailUsuarioActivo,
                    stock_sistema: stockTeoricoSistema,
                    stock_contado: stockContado,
                    discrepancia: discrepanciaCalculada
                }]);

            if (errInsert) throw errInsert;

            // Mensaje neutro — sin revelar si hubo diferencia
            alert("✅ Conteo registrado correctamente.");
            
            inputStockContado.value = "0";
            await obtenerProductosDesdeSupabase();

        } catch (err) {
            alert("Error al procesar el conteo: " + err.message);
        }
    });
}