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
                // Formato idéntico a tu ejemplo visual
                const marcaInfo = prod.marca ? ` [${prod.marca}]` : '';
                option.textContent = `${prod.nombre}${marcaInfo} (Stock actual: ${prod.stock_actual})`;
                selectProducto.appendChild(option);
            });

        } catch (err) {
            console.error("Error cargando productos:", err.message);
            selectProducto.innerHTML = '<option value="">Error al conectar con el inventario</option>';
        }
    }

    // Ejecución inicial de carga de datos
    await obtenerProductosDesdeSupabase();

    // 2. CAPTURAR EL SUBMIT DEL FORMULARIO Y CALCULAR PÉRDIDAS
    formConteo.addEventListener('submit', async (e) => {
        e.preventDefault();

        const idSel = selectProducto.value;
        const stockContado = parseInt(inputStockContado.value);

        if (!idSel) {
            alert("Por favor, selecciona un producto antes de proceder.");
            return;
        }

        if (isNaN(stockContado) || stockContado < 0) {
            alert("El stock físico real no puede ser un valor negativo o vacío.");
            return;
        }

        // Buscar correspondencia en la memoria local
        const prodSistema = listaProductosMemoria.find(p => p.id == idSel);
        if (!prodSistema) return;

        const stockTeoricoSistema = parseInt(prodSistema.stock_actual || 0);
        
        /* CÁLCULO DE DISCREPANCIA SEGÚN TU COMENTARIO SQL: 
           (stock_sistema - stock_contado)
           - Si da POSITIVO: Significa que FALTA stock en físico (pérdida de productos).
           - Si da NEGATIVO: Significa que SOBRA stock físico en la tienda.
        */
        const discrepanciaCalculada = stockTeoricoSistema - stockContado;
        const precioUnitario = parseFloat(prodSistema.precio_venta || 0);
        const valorFinancieroImpacto = discrepanciaCalculada * precioUnitario;

        // Recuperamos el email del usuario en sesión activa o un fallback genérico
        let emailUsuarioActivo = "vendedor.anonimo@lapizdeoro.com";
        try {
            const { data: sessionData } = await supabaseClient.auth.getSession();
            if (sessionData?.session?.user?.email) {
                emailUsuarioActivo = sessionData.session.user.email;
            }
        } catch (sErr) {
            console.log("No se pudo extraer el email de auth, usando por defecto.");
        }

        // Mensaje dinámico de diagnóstico para el usuario
        let resumenAlerta = "";
        if (discrepanciaCalculada === 0) {
            resumenAlerta = `✓ Perfecto: El conteo físico coincide con el sistema de inventario (${stockTeoricoSistema} unidades).`;
        } else if (discrepanciaCalculada > 0) {
            resumenAlerta = `⚠️ ALERTA DE FALTANTE (PÉRDIDA):\nFaltan ${discrepanciaCalculada} unidades físicas en el establecimiento.\nValor estimado de la pérdida: S/ ${valorFinancieroImpacto.toFixed(2)}`;
        } else {
            resumenAlerta = `📢 EXCESO DETECTADO (SOBRANTE):\nSe encontraron ${Math.abs(discrepanciaCalculada)} unidades adicionales físicamente.\nImpacto: S/ ${Math.abs(valorFinancieroImpacto).toFixed(2)}`;
        }

        if (!confirm(`${resumenAlerta}\n\n¿Estás seguro de registrar esta auditoría en el sistema?`)) return;

        try {
            // Guardamos en tu tabla original con tus nombres exactos de columna
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

            alert("¡Auditoría de conteo físico almacenada con éxito!");
            
            // Reestablecer formulario
            inputStockContado.value = "0";
            await obtenerProductosDesdeSupabase();

        } catch (err) {
            alert("Error al procesar e insertar la auditoría: " + err.message);
        }
    });
}