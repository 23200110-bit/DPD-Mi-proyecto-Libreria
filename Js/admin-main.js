/* ==========================================================================
   js/admin-main.js - CONTROLADOR DEL PANEL DE ADMINISTRADOR
   ========================================================================== */

import { supabaseClient } from './supabase-config.js';
import { inicializarInicioAdmin } from './modulos/inicio-admin.js';
import { inicializarInventarioAdmin } from './modulos/inventario-admin.js';
import { inicializarCompras } from './modulos/compras.js';
import { inicializarModuloVentas } from './modulos/ventas.js';
import { inicializarAlertas } from './modulos/alertas.js';
import { inicializarSeguridad } from './modulos/seguridad.js';
import { inicializarModuloCaja } from './modulos/caja.js';
import { inicializarEmpleados } from './modulos/empleados.js';
import { inicializarReportes } from './modulos/reportes.js';
import { inicializarPrecios } from './modulos/precios.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('[AdminMain] DOMContentLoaded iniciado');
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

    console.log('[AdminMain] Iniciando panel de administrador');
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

        const ruta = `vistas/${carpeta}/${nombreArchivo}.html`;
        console.log(`[AdminMain] cargando subvista: ${subVistaID} -> ${ruta}`);

        const respuesta = await fetch(ruta);
        if (!respuesta.ok) {
            throw new Error(`Fetch falló para ${ruta}: ${respuesta.status} ${respuesta.statusText}`);
        }

        const html = await respuesta.text();
        contenedorPrincipal.innerHTML = html;
        console.log(`[AdminMain] subvista cargada: ${subVistaID}`);

        try {
            if (subVistaID === 'inicio') {
                await inicializarInicioAdmin();

            } else if (subVistaID === 'inventario') {
                await inicializarInventarioAdmin();

            } else if (subVistaID === 'compras') {
                inicializarCompras();

            } else if (subVistaID === 'ventas') {
                inicializarModuloVentas();

            } else if (subVistaID === 'alertas') {
                await inicializarAlertas();

            } else if (subVistaID === 'seguridad') {
                inicializarSeguridad();

            } else if (subVistaID === 'caja') {
                inicializarModuloCaja();

            } else if (subVistaID === 'empleados') {
                inicializarEmpleados();

            } else if (subVistaID === 'precios') {
                inicializarPrecios();

            } else if (subVistaID === 'reportes') {
                inicializarReportes();
            }
        } catch (inicializarError) {
            console.error(`[AdminMain] Error inicializando módulo ${subVistaID}:`, inicializarError);
            contenedorPrincipal.innerHTML = `
                <div class="temporary-empty-view">
                    <h3>❌ Error al inicializar módulo</h3>
                    <p>No se pudo cargar la lógica de la vista "${subVistaID}".</p>
                    <pre style="white-space: pre-wrap; color:#b91c1c;">${String(inicializarError)}</pre>
                </div>
            `;
        }

    } catch (error) {

        console.error("Error al renderizar subvista:", error);
        contenedorPrincipal.innerHTML = `
            <div class="temporary-empty-view">
                <h3>❌ Error al cargar la vista</h3>
                <p>${String(error.message || error)}</p>
            </div>
        `;

    }

}

async function cargarVista(ruta) {
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) {
        throw new Error(`Fetch falló para ${ruta}: ${respuesta.status} ${respuesta.statusText}`);
    }
    return await respuesta.text();
}

function logout() {
    localStorage.removeItem('SESION_EMAIL');
    window.location.href = "index.html";
}
