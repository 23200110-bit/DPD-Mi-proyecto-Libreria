/* ==========================================================================
   js/auth.js - CEREBRO DE AUTENTICACIÓN Y ROLES (INDEX.HTML)
   ========================================================================== */
import { supabaseClient } from './supabase-config.js';

// Inicializar el rol por defecto en el almacenamiento local si no existe
if (!localStorage.getItem('ROL_ELEGIDO')) {
    localStorage.setItem('ROL_ELEGIDO', 'admin');
}

/**
 * 1. INTERCAMBIO VISUAL EN EL LOGIN (Tus hermosas tarjetas de cristal)
 */
function seleccionarRol(rol) {
    localStorage.setItem('ROL_ELEGIDO', rol);
    const adminCard = document.getElementById('role-admin');
    const vendCard = document.getElementById('role-vendedor');
    
    if (adminCard && vendCard) {
        adminCard.classList.remove('active');
        vendCard.classList.remove('active');
        if (rol === 'admin') {
            adminCard.classList.add('active');
        } else {
            vendCard.classList.add('active');
        }
    }
}

function mostrarPantallaAuth(pantalla) {
    const boxLogin = document.getElementById('box-login');
    const boxRegistro = document.getElementById('box-registro');
    if (!boxLogin || !boxRegistro) return;
    
    if (pantalla === 'registro') {
        boxLogin.style.display = 'none';
        boxRegistro.style.display = 'block';
    } else {
        boxLogin.style.display = 'block';
        boxRegistro.style.display = 'none';
    }
}

/**
 * 2. ESCUCHADORES DE EVENTOS (Reemplazan a los viejos onclick del HTML)
 */
document.addEventListener('DOMContentLoaded', () => {
    // Escuchadores para las tarjetas de Rol
    const btnAdminCard = document.getElementById('role-admin');
    const btnVendedorCard = document.getElementById('role-vendedor');
    
    if (btnAdminCard) btnAdminCard.addEventListener('click', () => seleccionarRol('admin'));
    if (btnVendedorCard) btnVendedorCard.addEventListener('click', () => seleccionarRol('vendedor'));

    // Escuchadores para los enlaces de cambiar de tarjeta
    const linkIrARegistro = document.getElementById('link-ir-a-registro');
    const linkIrALogin = document.getElementById('link-ir-a-login');
    
    if (linkIrARegistro) linkIrARegistro.addEventListener('click', (e) => { e.preventDefault(); mostrarPantallaAuth('registro'); });
    if (linkIrALogin) linkIrALogin.addEventListener('click', (e) => { e.preventDefault(); mostrarPantallaAuth('login'); });

    // FORMULARIO DE REGISTRO
    const formRegistro = document.getElementById('registroForm');
    const errorRegistro = document.getElementById('registro-error');

    if (formRegistro) {
        formRegistro.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (errorRegistro) errorRegistro.style.display = "none";

            const nombre = document.getElementById('registro-name').value.trim();
            const email = document.getElementById('registro-email').value.trim();
            const password = document.getElementById('registro-password').value;
            const confirmPassword = document.getElementById('registro-confirm-password').value;
            const rolActual = localStorage.getItem('ROL_ELEGIDO');

            if (password !== confirmPassword) {
                if (errorRegistro) {
                    errorRegistro.textContent = "⚠️ Las contraseñas no coinciden.";
                    errorRegistro.style.display = "block";
                }
                return;
            }

            let { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: { data: { display_name: nombre, user_role: rolActual } }
            });

            if (error) {
                if (errorRegistro) {
                    errorRegistro.textContent = error.message;
                    errorRegistro.style.display = "block";
                }
            } else {
                alert(`✅ Personal registrado correctamente: ${nombre}`);
                formRegistro.reset();
                mostrarPantallaAuth('login');
            }
        });
    }

    // FORMULARIO DE LOGIN
    const formLogin = document.getElementById('loginForm');
    const errorLogin = document.getElementById('login-error');

    if (formLogin) {
        formLogin.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (errorLogin) errorLogin.style.display = "none";

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const rolSeleccionado = localStorage.getItem('ROL_ELEGIDO');

            let { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                if (errorLogin) {
                    errorLogin.textContent = "❌ Credenciales inválidas.";
                    errorLogin.style.display = "block";
                }
            } else {
                localStorage.setItem('SESION_EMAIL', email);
                // REPARADO: Usamos location.replace al cambiar de ventana para que limpie la caché visual del navegador y no arrastre menús activos
                if (rolSeleccionado === 'admin') {
                    window.location.replace("admin.html");
                } else {
                    window.location.replace("vendedor.html");
                }
            }
        });
    }
});