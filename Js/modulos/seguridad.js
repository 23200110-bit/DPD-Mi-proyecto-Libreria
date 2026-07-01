import { supabaseClient } from '../supabase-config.js';

let listaAuditoria = [];

export async function inicializarSeguridad() {

    await cargarAuditoria();

    const buscador = document.getElementById("buscar-seguridad");

    if (buscador) {

        buscador.addEventListener("input", (e) => {

            renderizarAuditoria(e.target.value);

        });

    }

    const btnConsejos = document.getElementById("btn-consejos");

    if (btnConsejos) {

        btnConsejos.addEventListener("click", mostrarConsejos);

    }

}

async function cargarAuditoria() {

    try {

        const { data, error } = await supabaseClient
            .from('conteos_auditoria')
            .select(`
                id_conteo,
                vendedor_email,
                stock_sistema,
                stock_contado,
                discrepancia,
                fecha_conteo,
                productos (
                    nombre
                )
            `)
            .order('fecha_conteo', { ascending: false });

        if (error) throw error;

        listaAuditoria = data || [];

        renderizarKPIs();

        renderizarAuditoria();

    } catch (err) {

        console.error("Error al cargar auditoría:", err);

    }

}

function renderizarKPIs() {

    document.getElementById("total-auditorias").textContent = listaAuditoria.length;

    const diferencias = listaAuditoria.filter(r => r.discrepancia > 0).length;

    document.getElementById("total-diferencias").textContent = diferencias;

    const hoy = new Date().toLocaleDateString();

    const auditoriasHoy = listaAuditoria.filter(r => {

        return new Date(r.fecha_conteo).toLocaleDateString() === hoy;

    }).length;

    document.getElementById("auditorias-hoy").textContent = auditoriasHoy;

}

function renderizarAuditoria(busqueda = "") {

    const tbody = document.getElementById('tabla-seguridad');

    if (!tbody) return;

    const registros = listaAuditoria.filter(r => {

        return r.vendedor_email.toLowerCase().includes(busqueda.toLowerCase()) ||

            (r.productos?.nombre || "").toLowerCase().includes(busqueda.toLowerCase());

    });

    if (registros.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center;padding:30px;">
                    🔍 No se encontraron registros.
                </td>
            </tr>
        `;

        return;

    }

    tbody.innerHTML = registros.map(registro => {

        const fecha = new Date(registro.fecha_conteo);

        const fechaTexto = fecha.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const horaTexto = fecha.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        let color = "#16a34a";
        let estado = "🟢 Correcto";

        if (registro.discrepancia > 5) {

            color = "#dc2626";
            estado = "🔴 Crítico";

        } else if (registro.discrepancia > 0) {

            color = "#d97706";
            estado = "🟡 Revisar";

        }

        return `

            <tr>

                <td>${registro.id_conteo}</td>

                <td>${registro.vendedor_email}</td>

                <td>${registro.productos?.nombre || '-'}</td>

                <td style="text-align:center;">
                    ${registro.stock_sistema}
                </td>

                <td style="text-align:center;">
                    ${registro.stock_contado}
                </td>

                <td style="
                    text-align:center;
                    font-weight:bold;
                    color:${color};
                ">
                    ${registro.discrepancia}
                </td>

                <td style="font-weight:600;">
                    ${estado}
                </td>

                <td>
                    ${fechaTexto}<br>
                    <span style="color:#64748b;font-size:13px;">
                        ${horaTexto}
                    </span>
                </td>

            </tr>

        `;

    }).join("");

}

function mostrarConsejos() {

    alert(`
💡 RECOMENDACIONES DE SEGURIDAD

✅ Realice conteos físicos al finalizar la jornada.

✅ Revise diariamente los productos con diferencias de inventario.

✅ Investigue inmediatamente las discrepancias superiores a 5 unidades.

✅ Registre correctamente todas las ventas y compras.

✅ Mantenga actualizado el stock del sistema.

✅ Programe auditorías periódicas para prevenir pérdidas.
`);

}