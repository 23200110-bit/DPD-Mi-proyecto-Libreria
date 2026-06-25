/* ==========================================================================
   js/modulos/caja.js - CONTROLADOR CON CONTROL DE DISPLAY TOTAL (CORREGIDO)
   ========================================================================== */

import { supabaseClient } from '../supabase-config.js';

export async function inicializarModuloCaja() {
    let idCajaActiva = null;
    let montoApertura = 0;
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalDigital = 0;
    let totalGastos = 0;

    const sectionApertura = document.getElementById('section-apertura');
    const sectionOperativa = document.getElementById('section-operativa');
    const btnAbrirCaja = document.getElementById('btn-abrir-caja');
    const btnRegistrarGasto = document.getElementById('btn-registrar-gasto');
    const btnCerrarCajaExcel = document.getElementById('btn-cerrar-caja-excel');

    const inputApertura = document.getElementById('input-monto-apertura');
    const inputGastoMonto = document.getElementById('input-gasto-monto');
    const inputGastoDesc = document.getElementById('input-gasto-desc');
    const inputDineroContado = document.getElementById('input-dinero-contado');
    const txtObservaciones = document.getElementById('txt-observaciones-caja');
    const wrapperDescuadre = document.getElementById('wrapper-descuadre');

    if (!sectionApertura) return;

    await verificarCajaActiva();

    async function verificarCajaActiva() {
        try {
            const { data, error } = await supabaseClient
                .from('cajas')
                .select('*')
                .eq('estado', 'Abierta')
                .order('fecha_apertura', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                const caja = data[0];
                idCajaActiva = caja.id_caja;
                montoApertura = parseFloat(caja.monto_apertura);
                
                await calcularMetricasDelDia(caja.fecha_apertura);
                
                sectionApertura.style.display = 'none';
                sectionOperativa.style.display = 'block';
            } else {
                sectionApertura.style.display = 'block';
                sectionOperativa.style.display = 'none';
            }
        } catch (err) {
            console.error("Error comprobando estado de caja:", err.message);
        }
    }

    async function calcularMetricasDelDia(fechaApertura) {
        try {
            const { data: ventas, error: errVentas } = await supabaseClient
                .from('ventas')
                .select('metodo_pago, total_cobrado')
                .gte('fecha_hora', fechaApertura);

            if (errVentas) throw errVentas;

            totalEfectivo = 0;
            totalTarjeta = 0;
            totalDigital = 0;

            ventas.forEach(v => {
                const total = parseFloat(v.total_cobrado || 0);
                if (v.metodo_pago === 'Efectivo') totalEfectivo += total;
                else if (v.metodo_pago === 'Tarjeta') totalTarjeta += total;
                else if (v.metodo_pago === 'Yape/Plin') totalDigital += total;
            });

            const { data: gastos, error: errGastos } = await supabaseClient
                .from('gastos_caja')
                .select('monto')
                .eq('caja_id', idCajaActiva);

            if (errGastos) throw errGastos;

            totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);

            actualizarTableroUI();
        } catch (err) {
            console.error("Error recalculando métricas de caja:", err.message);
        }
    }

    function actualizarTableroUI() {
        const totalVentas = totalEfectivo + totalTarjeta + totalDigital;
        const ganancias = totalVentas - totalGastos;
        const cajaEsperada = montoApertura + totalEfectivo - totalGastos;

        document.getElementById('txt-card-apertura').textContent = `S/ ${montoApertura.toFixed(2)}`;
        document.getElementById('txt-card-efectivo').textContent = `S/ ${totalEfectivo.toFixed(2)}`;
        document.getElementById('txt-card-tarjeta').textContent = `S/ ${totalTarjeta.toFixed(2)}`;
        document.getElementById('txt-card-digital').textContent = `S/ ${totalDigital.toFixed(2)}`;
        document.getElementById('txt-card-total-ventas').textContent = `S/ ${totalVentas.toFixed(2)}`;
        document.getElementById('txt-card-ganancias').textContent = `S/ ${ganancias.toFixed(2)}`;
        document.getElementById('txt-card-gastos').textContent = `S/ ${totalGastos.toFixed(2)}`;
        document.getElementById('txt-caja-esperada').textContent = `S/ ${cajaEsperada.toFixed(2)}`;
    }

    btnAbrirCaja.addEventListener('click', async () => {
        const monto = parseFloat(inputApertura.value);
        if (isNaN(monto) || monto < 0) {
            alert("Ingresa un monto de apertura numérico válido.");
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('cajas')
                .insert([{ monto_apertura: monto, estado: 'Abierta' }]);

            if (error) throw error;

            alert("¡Caja iniciada correctamente!");
            await verificarCajaActiva();
        } catch (err) {
            alert("Error al abrir caja: " + err.message);
        }
    });

    btnRegistrarGasto.addEventListener('click', async () => {
        const montoGasto = parseFloat(inputGastoMonto.value);
        const descGasto = inputGastoDesc.value.trim() || "Gasto sin descripción";

        if (isNaN(montoGasto) || montoGasto <= 0) {
            alert("Ingrese un monto de egreso numérico válido.");
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('gastos_caja')
                .insert([{
                    caja_id: idCajaActiva,
                    monto: montoGasto,
                    descripcion: descGasto
                 }]);

            if (error) throw error;

            inputGastoMonto.value = '';
            inputGastoDesc.value = '';

            await verificarCajaActiva();
            calcularDescuadreFisico();
        } catch (err) {
            alert("No se pudo registrar el gasto: " + err.message);
        }
    });

    inputDineroContado.addEventListener('input', calcularDescuadreFisico);

    function calcularDescuadreFisico() {
        wrapperDescuadre.innerHTML = '';
        const dineroContado = parseFloat(inputDineroContado.value);
        const cajaEsperada = montoApertura + totalEfectivo - totalGastos;

        if (isNaN(dineroContado) || dineroContado < 0) return;

        const diferencia = dineroContado - cajaEsperada;

        if (diferencia === 0) {
            wrapperDescuadre.innerHTML = `
                <div class="alert-success-caja" style="padding: 15px; border-radius: 8px;">
                    <strong>✓ Caja Cuadrada Perfecta:</strong> El dinero físico cuadra con el sistema.
                </div>`;
        } else {
            const esSobrante = diferencia > 0;
            const claseAlerta = esSobrante ? 'alert-sobrante-caja' : 'alert-faltante-caja';
            const tipoTexto = esSobrante ? 'Sobrante' : 'Faltante';

            wrapperDescuadre.innerHTML = `
                <div class="${claseAlerta}" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-radius: 8px; margin-top: 15px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-size: 1.15rem; font-weight: bold; color: inherit;">${tipoTexto}</span>
                        <span style="font-size: 0.85rem; opacity: 0.8; color: inherit;">Diferencia entre lo esperado y lo contado</span>
                    </div>
                    <div style="font-size: 1.6rem; font-weight: bold; color: inherit;">
                        S/ ${Math.abs(diferencia).toFixed(2)}
                    </div>
                </div>`;
        }
    }

    btnCerrarCajaExcel.addEventListener('click', async () => {
        const dineroContado = parseFloat(inputDineroContado.value);
        if (isNaN(dineroContado) || dineroContado < 0) {
            alert("Digita el monto del dinero físico contado para cerrar.");
            return;
        }

        const totalVentas = totalEfectivo + totalTarjeta + totalDigital;
        const gananciasNetas = totalVentas - totalGastos;
        const cajaEsperada = montoApertura + totalEfectivo - totalGastos;
        const diferenciaCalculada = dineroContado - cajaEsperada;
        const obs = txtObservaciones.value || "Cierre diario normal.";

        // Veredictos contables automáticos
        const resultadoCuadre = diferenciaCalculada === 0 ? "CAJA CUADRADA" : (diferenciaCalculada > 0 ? "SOBRANTE" : "FALTANTE");
        const diagnosticoFinanciero = gananciasNetas > 0 ? "RENTABLE (Hubo Ganancia)" : (gananciasNetas < 0 ? "PÉRDIDA OPERATIVA" : "PUNTO DE EQUILIBRIO");

        let explicacionFinal = "";
        if (diferenciaCalculada === 0) {
            explicacionFinal = "El dinero físico coincide perfectamente con el sistema. Excelente control.";
        } else if (diferenciaCalculada > 0) {
            explicacionFinal = `Sobran S/ ${Math.abs(diferenciaCalculada).toFixed(2)}. Esto significa que olvidaron registrar alguna venta en el sistema pero el dinero sí entró.`;
        } else {
            explicacionFinal = `Faltan S/ ${Math.abs(diferenciaCalculada).toFixed(2)}. Esto representa una pérdida directa. Revisar errores de vuelto o salidas no autorizadas.`;
        }

        try {
            // CORREGIDO: "difference" cambiado a "diferencia" para coincidir exactamente con tu script SQL
            const { error } = await supabaseClient
                .from('cajas')
                .update({
                    monto_cierre_esperado: cajaEsperada,
                    monto_cierre_real: dineroContado,
                    diferencia: diferenciaCalculada, 
                    estado: 'Cerrada',
                    observaciones: obs,
                    fecha_cierre: new Date().toISOString()
                })
                .eq('id_caja', idCajaActiva);

            if (error) throw error;

            // Reporte detallado explicando qué significa cada cosa
            const filas = [
                ["REPORTE DIARIO DE CIERRE DE JORNADA"],
                ["ID Sesión de Caja", idCajaActiva],
                ["Fecha y Hora de Cierre", new Date().toLocaleString()],
                [""],
                ["CONCEPTO / PARÁMETRO", "MONTO (S/)", "EXPLICACIÓN Y SIGNIFICADO FINANCIERO"],
                ["Monto Apertura Inicial", montoApertura.toFixed(2), "Dinero en efectivo ('sencillo') con el que se abrió la caja por la mañana."],
                ["Ventas Efectivo (+)", totalEfectivo.toFixed(2), "Ingresos en billetes y monedas que entraron físicamente al cajón."],
                ["Ventas Tarjeta", totalTarjeta.toFixed(2), "Ventas liquidadas vía POS. El dinero va directo a la cuenta bancaria."],
                ["Ventas Yape/Plin", totalDigital.toFixed(2), "Ingresos digitales directos a la cuenta móvil vinculada."],
                ["Total Ventas Brutas", totalVentas.toFixed(2), "El volumen total de todo lo vendido en el día (Efectivo + Tarjeta + Digital)."],
                ["Gastos de Caja Chica (-)", totalGastos.toFixed(2), "Salidas de efectivo autorizadas para compras de emergencia o insumos."],
                ["Ganancia Neta del Día", gananciasNetas.toFixed(2), `Rendimiento de hoy: Ventas totales menos gastos. Estado: ${diagnosticoFinanciero}.`],
                ["Monto Esperado en Caja", cajaEsperada.toFixed(2), "Fórmula Matemática obligatoria en el cajón: (Apertura + Ventas Efectivo - Gastos)."],
                ["Efectivo Real Contado", dineroContado.toFixed(2), "Cantidad de dinero físico real que contaste con tus manos al cerrar."],
                ["Diferencia de Arqueo", diferenciaCalculada.toFixed(2), `Estado del cuadre físico: ${resultadoCuadre}.`],
                [""],
                ["ANÁLISIS Y CONCLUSIÓN DEL DÍA:"],
                [explicacionFinal],
                [""],
                ["Observaciones / Bitácora registrada:", obs]
            ];

            let contenidoCsv = "\uFEFF"; 
            filas.forEach(f => {
                contenidoCsv += f.map(c => `"${c.toString().replace(/"/g, '""')}"`).join(",") + "\n";
            });

            const blob = new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Cierre_Caja_ID_${idCajaActiva}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            alert("¡Caja cerrada exitosamente en Supabase y reporte detallado descargado!");
            
            inputApertura.value = '';
            inputDineroContado.value = '';
            txtObservaciones.value = '';
            wrapperDescuadre.innerHTML = '';
            await verificarCajaActiva();

        } catch (err) {
            alert("No se pudo cerrar la caja en Supabase: " + err.message);
        }
    });
}