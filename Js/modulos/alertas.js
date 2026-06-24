import { supabaseClient } from '../supabase-config.js';

let listaAlertas = [];

export async function inicializarAlertas() {
    await cargarAlertas();
}

async function cargarAlertas() {

    try {

        const { data, error } = await supabaseClient
            .from('productos')
            .select('*')
            .order('stock_actual', { ascending: true });

        if (error) throw error;

        listaAlertas = (data || []).filter(producto =>
            producto.stock_actual <= producto.stock_minimo_alerta
        );

        renderizarAlertas();

    } catch (err) {
        console.error("Error al cargar alertas:", err);
    }

}

function renderizarAlertas() {

    const tbody = document.getElementById('tabla-alertas');

    if (!tbody) return;

    const agotados = listaAlertas.filter(p => p.stock_actual === 0).length;
    const bajoStock = listaAlertas.filter(p => p.stock_actual > 0).length;

    document.getElementById("total-alertas").textContent = listaAlertas.length;
    document.getElementById("total-agotados").textContent = agotados;
    document.getElementById("total-bajo-stock").textContent = bajoStock;

    if (listaAlertas.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:30px;">
                    ✅ No existen alertas de inventario.
                </td>
            </tr>
        `;

        return;

    }

    tbody.innerHTML = listaAlertas.map(p => {

        let badge;

        if (p.stock_actual === 0) {

            badge = `<span class="alert-tag tag-danger">Agotado</span>`;

        } else {

            badge = `<span class="alert-tag tag-warning">Bajo Stock</span>`;

        }

        return `

            <tr>

                <td>${p.id}</td>

                <td>${p.nombre}</td>

                <td>${p.categoria}</td>

                <td style="text-align:center;font-weight:bold;">
                    ${p.stock_actual}
                </td>

                <td style="text-align:center;">
                    ${p.stock_minimo_alerta}
                </td>

                <td>${badge}</td>

            </tr>

        `;

    }).join("");

}