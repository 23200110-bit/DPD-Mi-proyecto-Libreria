/* ==========================================================================
   js/admin-main.js - CONTROLADOR DEL PANEL DE ADMINISTRADOR
   ========================================================================== */

import { supabaseClient } from './supabase-config.js';
import { inicializarInventarioAdmin } from './modulos/inventario-admin.js';
import { inicializarCompras } from './modulos/compras.js';
import { inicializarModuloVentas } from './modulos/ventas.js';
import { inicializarAlertas } from './modulos/alertas.js';
import { inicializarSeguridad } from './modulos/seguridad.js';
import { inicializarModuloCaja } from './modulos/caja.js';
import { inicializarEmpleados } from './modulos/empleados.js';
import { inicializarReportes } from './modulos/reportes.js';

document.addEventListener('DOMContentLoaded', () => {
    const emailSalvado = localStorage.getItem('SESION_EMAIL');
    if (!emailSalvado) {
        window.location.href = "index.html";
        return;
    }

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
    if (btnSalir) {
        btnSalir.addEventListener('click', () => {
            logout();
        });
    }

    // Manejo de enlaces dentro del contenido (ej. "Ver todas las alertas")
    // Si hay enlaces con la clase .alerts-button dentro del main, redirigimos
    // usando la misma función SPA `cambiarSubVistaAdmin` para evitar navegación
    // completa y mantener el estado del panel.
    document.body.addEventListener('click', (e) => {
        const enlace = e.target.closest && e.target.closest('.alerts-button');
        if (!enlace) return;
        e.preventDefault();
        // Forzamos la carga del módulo de alertas
        cambiarSubVistaAdmin('alertas');
    });

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

        let carpeta = 'admin';
        let nombreArchivo = subVistaID;

        if (subVistaID === 'inicio' || subVistaID === 'inventario') {

            nombreArchivo = `${subVistaID}-admin`;

        } else if (subVistaID === 'ventas') {

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

            } else if (subVistaID === 'alertas') {

                inicializarAlertas();

            } else if (subVistaID === 'seguridad') {

                inicializarSeguridad();

            } else if (subVistaID === 'caja') {

                inicializarModuloCaja();

            } else if (subVistaID === 'empleados') {

                inicializarEmpleados();

            } else if (subVistaID === 'reportes') {

                inicializarReportes();
               
            }

        } else {

            contenedorPrincipal.innerHTML = `
                <div class="temporary-empty-view">
                    <h3>⚠️ Módulo en Construcción</h3>
                    <p>El archivo "vistas/${carpeta}/${nombreArchivo}.html" está listo en el mapa pero vacío en disco.</p>
                </div>
            `;

        }

    } catch (error) {

        console.error("Error al renderizar subvista:", error);

    }

}

function logout() {
    localStorage.removeItem('SESION_EMAIL');
    window.location.href = "index.html";
}
