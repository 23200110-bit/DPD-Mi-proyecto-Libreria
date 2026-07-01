import { supabaseClient } from '../supabase-config.js';

let listaAlertas = [];
let filtroActual = "todos";

export async function inicializarAlertas() {

    await cargarAlertas();

    const buscador = document.getElementById("buscar-alerta");

    if (buscador) {

        buscador.addEventListener("input", (e) => {

            renderizarAlertas(e.target.value);

        });

    }

    document.getElementById("filtro-todos")?.addEventListener("click", () => {

        cambiarFiltro("todos");

    });

    document.getElementById("filtro-bajo")?.addEventListener("click", () => {

        cambiarFiltro("bajo");

    });

    document.getElementById("filtro-agotado")?.addEventListener("click", () => {

        cambiarFiltro("agotado");

    });

}

function cambiarFiltro(filtro){

    filtroActual = filtro;

    actualizarBotones();

    const texto = document.getElementById("buscar-alerta")?.value || "";

    renderizarAlertas(texto);

}

function actualizarBotones(){

    document.getElementById("filtro-todos").style.background =
        filtroActual==="todos" ? "#0284c7" : "#e2e8f0";

    document.getElementById("filtro-todos").style.color =
        filtroActual==="todos" ? "white" : "black";

    document.getElementById("filtro-bajo").style.background =
        filtroActual==="bajo" ? "#fbbf24" : "#e2e8f0";

    document.getElementById("filtro-bajo").style.color = "black";

    document.getElementById("filtro-agotado").style.background =
        filtroActual==="agotado" ? "#ef4444" : "#e2e8f0";

    document.getElementById("filtro-agotado").style.color =
        filtroActual==="agotado" ? "white" : "black";

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
        
        actualizarBotones();

    } catch (err) {

        console.error("Error al cargar alertas:", err);

    }

}

function renderizarAlertas(busqueda = "") {

    const tbody = document.getElementById("tabla-alertas");

    if (!tbody) return;

    const agotados = listaAlertas.filter(p => p.stock_actual === 0).length;
    const bajoStock = listaAlertas.filter(p => p.stock_actual > 0).length;

    document.getElementById("total-alertas").textContent = listaAlertas.length;
    document.getElementById("total-agotados").textContent = agotados;
    document.getElementById("total-bajo-stock").textContent = bajoStock;

    let productosFiltrados = listaAlertas.filter(producto =>
        producto.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    if(filtroActual==="bajo"){

        productosFiltrados = productosFiltrados.filter(p=>p.stock_actual>0);

    }

    if(filtroActual==="agotado"){

        productosFiltrados = productosFiltrados.filter(p=>p.stock_actual===0);

    }

    if (productosFiltrados.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:30px;color:#64748b;">
                    🔍 No se encontraron productos.
                </td>
            </tr>
        `;

        return;

    }

    tbody.innerHTML = productosFiltrados.map(p => {

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

                <td style="text-align:center;">
                    ${badge}
                </td>

            </tr>

        `;

    }).join("");

}