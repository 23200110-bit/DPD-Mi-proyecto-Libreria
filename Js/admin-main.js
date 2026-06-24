/* ==========================================================================
    js/admin-main.js - CONTROLADOR DEL PANEL DE ADMINISTRADOR
   ========================================================================== */
import { supabaseClient } from './supabase-config.js';
import { inicializarInventarioAdmin } from './modulos/inventario-admin.js';
import { inicializarCompras } from './modulos/compras.js';
import { inicializarModuloVentas } from './modulos/ventas.js';
// === SE AGREGA LA IMPORTACIÓN DE LA CAJA SIN TOCAR LO ANTERIOR ===
import { inicializarModuloCaja } from './modulos/caja.js';

document.addEventListener('DOMContentLoaded', () => {
    const emailSalvado = localStorage.getItem('SESION_EMAIL');
    if (!emailSalvado) { window.location.href = "index.html"; return; }

    const badge = document.getElementById('session-user-badge');
    if (badge) badge.textContent = emailSalvado;

    const contenedorMenu = document.querySelector('.nav-menu-options');
    if (contenedorMenu) {
        contenedorMenu.addEventListener('click', (e) => {
            const boton = e.target.closest('.nav-btn');
            if (!boton) return;
            e.preventDefault();
            const subVistaID = boton.id.replace('btn-nav-', '');
            cambiarSubVistaAdmin(subVistaID);
        });
    }

    const btnSalir = document.getElementById('btn-logout');
    if (btnSalir) { btnSalir.addEventListener('click', () => { logout(); }); }

    cambiarSubVistaAdmin('inicio');
});

async function cambiarSubVistaAdmin(subVistaID) {
    const botones = document.querySelectorAll('.nav-btn');
    botones.forEach(b => b.classList.remove('active'));
    const botonDestino = document.getElementById(`btn-nav-${subVistaID}`);
    if (botonDestino) botonDestino.classList.add('active');

    const contenedorPrincipal = document.getElementById('admin-main-container');
    if (!contenedorPrincipal) return;

    try {
        // Determinar carpeta y nombre de archivo según la vista
        let carpeta = 'admin';
        let nombreArchivo = subVistaID;

        if (subVistaID === 'inicio' || subVistaID === 'inventario') {
            nombreArchivo = `${subVistaID}-admin`;
        } else if (subVistaID === 'ventas') {
            // ventas.html vive en compartido, igual que en el panel vendedor
            carpeta = 'compartido';
            nombreArchivo = 'ventas';
        }

        const respuesta = await fetch(`vistas/${carpeta}/${nombreArchivo}.html`);

        if (respuesta.ok) {
            contenedorPrincipal.innerHTML = await respuesta.text();

            // Disparadores de lógica por módulo
            if (subVistaID === 'inventario') {
                inicializarInventarioAdmin();
            } else if (subVistaID === 'compras') {
                inicializarCompras();
            } else if (subVistaID === 'ventas') {
                inicializarModuloVentas();
            // === SE AGREGA EL DISPARADOR DE LA CAJA PARA QUE TU BOTÓN POR FIN RESPONDA ===
            } else if (subVistaID === 'caja') {
                inicializarModuloCaja();
            }

        } else {
            contenedorPrincipal.innerHTML = `
                <div class="temporary-empty-view">
                    <h3>⚠️ Módulo en Construcción</h3>
                    <p>El archivo "vistas/${carpeta}/${nombreArchivo}.html" está listo en el mapa pero vacío en disco.</p>
                </div>`;
        }
    } catch (error) {
        console.error("Error al renderizar subvista:", error);
    }
}

function logout() {
    localStorage.removeItem('SESION_EMAIL');
    window.location.href = "index.html";
}