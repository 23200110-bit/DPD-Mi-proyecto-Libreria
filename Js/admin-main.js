import { supabaseClient } from './supabase-config.js';
import { inicializarInventarioAdmin } from './modulos/inventario-admin.js';
// 🚀 IMPORTACIÓN DEL MÓDULO NUEVO DE COMPRAS:
import { inicializarCompras } from './modulos/compras.js';

document.addEventListener('DOMContentLoaded', () => {
    // Verificar sesión activa
    const emailSalvado = localStorage.getItem('SESION_EMAIL');
    if (!emailSalvado) { window.location.href = "index.html"; return; }

    const badge = document.getElementById('session-user-badge');
    if (badge) badge.textContent = emailSalvado;

    // Capturar clicks en el menú horizontal superior del Admin
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

    // Botón Salir
    const btnSalir = document.getElementById('btn-logout');
    if (btnSalir) { btnSalir.addEventListener('click', () => { logout(); }); }

    // Vista por defecto al abrir el panel
    cambiarSubVistaAdmin('inicio');
});

async function cambiarSubVistaAdmin(subVistaID) {
    // Cambiar estado visual de botones activos
    const botones = document.querySelectorAll('.nav-btn');
    botones.forEach(b => b.classList.remove('active'));
    const botonDestino = document.getElementById(`btn-nav-${subVistaID}`);
    if (botonDestino) botonDestino.classList.add('active');

    const contenedorPrincipal = document.getElementById('admin-main-container');
    if (!contenedorPrincipal) return;

    try {
        // Concatenamos el sufijo para buscar las vistas reales del admin
        let nombreArchivoReal = subVistaID;
        if (subVistaID === 'inicio' || subVistaID === 'inventario') {
            nombreArchivoReal = `${subVistaID}-admin`;
        }

        const respuesta = await fetch(`vistas/admin/${nombreArchivoReal}.html`);
        
        if (respuesta.ok) {
            contenedorPrincipal.innerHTML = await respuesta.text();
            
            // 🚀 DISPARADORES DE LÓGICA DINÁMICA DE LOS MÓDULOS
            if (subVistaID === 'inventario') {
                inicializarInventarioAdmin(); // Mantiene vivo tu inventario intacto
            } else if (subVistaID === 'compras') {
                inicializarCompras(); // Despierta el formulario inteligente de compras
            }
        } else {
            contenedorPrincipal.innerHTML = `
                <div class="temporary-empty-view">
                    <h3>⚠️ Módulo en Construcción</h3>
                    <p>El archivo "vistas/admin/${nombreArchivoReal}.html" está listo en el mapa pero vacío en disco.</p>
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