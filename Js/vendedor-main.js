/* ==========================================================================
   js/vendedor-main.js - CONTROLADOR ACTUALIZADO (REPARADO BUG DE CIERRE)
   ========================================================================== */
import { inicializarModuloVentas } from './modulos/ventas.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Validar sesión
    const emailSalvado = localStorage.getItem('SESION_EMAIL');
    if (!emailSalvado) {
        window.location.href = "index.html";
        return;
    }

    // 2. Colocar correo
    const badge = document.getElementById('session-user-badge');
    if (badge) badge.textContent = emailSalvado;

    // 3. Botón Salir (REPARADO PARA EVITAR EL ENGAÑO VISUAL DE ROLES)
    const btnSalir = document.getElementById('btn-logout');
    if (btnSalir) {
        btnSalir.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Limpiamos los datos de la sesión del vendedor
            localStorage.removeItem('SESION_EMAIL');
            
            // SOLUCIÓN: Reseteamos el rol a 'admin' para que coincida perfectamente
            // con la tarjeta que se iluminará por defecto en el HTML del login
            localStorage.setItem('ROL_ELEGIDO', 'admin');
            
            // Redirección limpia
            window.location.replace("index.html");
        });
    }

    // 4. Escuchar el menú con tus 4 botones reales
    const menuVendedor = document.getElementById('vendedor-menu-options');
    if (menuVendedor) {
        menuVendedor.addEventListener('click', (e) => {
            const boton = e.target.closest('.nav-btn');
            if (!boton) return;
            e.preventDefault();

            const vistaID = boton.id.replace('btn-vendedor-nav-', '');
            cambiarVistaVendedor(vistaID);
        });
    }

    // 5. CARGA INICIAL DIRECTA: Apunta a 'inicio' desde el arranque limpio
    cambiarVistaVendedor('inicio');
});

async function cambiarVistaVendedor(vistaID) {
    // Alternar clase activa en tus botones (Limpia todos y marca solo el correcto)
    const botones = document.querySelectorAll('#vendedor-menu-options .nav-btn');
    botones.forEach(b => b.classList.remove('active'));

    const botonActivo = document.getElementById(`btn-vendedor-nav-${vistaID}`);
    if (botonActivo) botonActivo.classList.add('active');

    const contenedor = document.getElementById('vendedor-main-container');
    if (!contenedor) return;

    // Control para la pestaña 'conteo' (Módulo en Desarrollo)
    if (vistaID === 'conteo') {
        contenedor.innerHTML = `
            <div class="temporary-empty-view" style="text-align:center; padding:50px; color:#64748b;">
                <h3>⚠️ Módulo en Desarrollo</h3>
                <p>La pantalla de "vistas/vendedor/conteo.html" se creará pronto.</p>
            </div>`;
        return;
    }

   try {
    let carpetaVista = 'vendedor';
    let archivoVista = `${vistaID}.html`;

    if (vistaID === 'inicio') {
        archivoVista = 'inicio-vendedor.html';
    } else if (vistaID === 'inventario') {
        archivoVista = 'inventario-vendedor.html';
    } else if (vistaID === 'ventas') {
        carpetaVista = 'compartido';
        archivoVista = 'ventas.html';
    }

    const respuesta = await fetch(`vistas/${carpetaVista}/${archivoVista}`);

    if (respuesta.ok) {
        contenedor.innerHTML = await respuesta.text();

        // Inicializar ventas
        if (vistaID === 'ventas') {
            inicializarModuloVentas();
        }

        // Inicializar módulo Inicio Vendedor
        if (vistaID === 'inicio') {
            const modulo = await import('./modulos/inicio-vendedor.js');
            modulo.inicializarInicioVendedor();
        }

        // Inicializar módulo Inventario Vendedor
        if (vistaID === 'inventario') {
            const modulo = await import('./modulos/inventario-vendedor.js');
            modulo.inicializarInventarioVendedor();
        }

    } else {
        contenedor.innerHTML = `
            <div class="temporary-empty-view">
                <h3>⚠️ Módulo en Desarrollo</h3>
                <p>La pantalla de "vistas/vendedor/${archivoVista}" se creará pronto.</p>
            </div>`;
    }

} catch (err) {
    console.error("Error al cargar sub-vista:", err);
}
}