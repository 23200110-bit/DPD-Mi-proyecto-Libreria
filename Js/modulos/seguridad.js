import { supabaseClient } from '../supabase-config.js';

let listaAuditoria = [];

export async function inicializarSeguridad() {
    await cargarAuditoria();
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

        renderizarAuditoria();

    } catch (err) {

        console.error("Error al cargar auditoría:", err);

    }

}

function renderizarAuditoria() {

    const tbody = document.getElementById('tabla-seguridad');

    if (!tbody) return;

    if (listaAuditoria.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:30px;">
                    No existen registros de auditoría.
                </td>
            </tr>
        `;

        return;

    }

    tbody.innerHTML = listaAuditoria.map(registro => {

        const fecha = new Date(registro.fecha_conteo);

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

                <td style="text-align:center;font-weight:bold;">
                    ${registro.discrepancia}
                </td>

                <td>
                    ${fecha.toLocaleString()}
                </td>

            </tr>

        `;

    }).join("");

}