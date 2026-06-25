/* ==========================================================================
   js/auth.js - CEREBRO DE AUTENTICACIÓN Y ROLES BLINDADO (INDEX.HTML)
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

            // Registrar usuario en la autenticación de Supabase
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
                try {
                    // Sincronizamos guardando al nuevo usuario también en tu tabla de 'empleados'
                    await supabaseClient
                        .from('empleados')
                        .insert([{ nombre_completo: nombre, email: email, rol: rolActual }]);
                } catch (dbErr) {
                    console.error("Error al registrar en tabla empleados:", dbErr);
                }

                alert(`✅ Personal registrado correctamente: ${nombre}`);
                formRegistro.reset();
                mostrarPantallaAuth('login');
            }
        });
    }

    // FORMULARIO DE LOGIN BLINDADO CON VERIFICACIÓN DE ROL REAL
    const formLogin = document.getElementById('loginForm');
    const errorLogin = document.getElementById('login-error');

    if (formLogin) {
        formLogin.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (errorLogin) errorLogin.style.display = "none";

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const rolSeleccionado = localStorage.getItem('ROL_ELEGIDO'); // 'admin' o 'vendedor'

            // 1. Intentar inicio de sesión por credenciales generales
            let { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                if (errorLogin) {
                    errorLogin.textContent = "❌ Credenciales inválidas.";
                    errorLogin.style.display = "block";
                }
                return;
            }

            // 2. VERIFICACIÓN CRÍTICA DE SEGURIDAD: Consultar el rol real en la tabla 'empleados'
            try {
                const { data: empleado, error: empleadoError } = await supabaseClient
                    .from('empleados')
                    .select('rol')
                    .eq('email', email)
                    .single();

                if (empleadoError || !empleado) {
                    // Si no se encuentra en la tabla de empleados por seguridad abortamos
                    await supabaseClient.auth.signOut();
                    if (errorLogin) {
                        errorLogin.textContent = "⚠️ Usuario no autorizado o sin rol asignado.";
                        errorLogin.style.display = "block";
                    }
                    return;
                }

                // Estandarizamos el término 'vendedor' si en tu DB guardaste 'empleado'
                const rolRealEnBaseDatos = empleado.rol === 'empleado' ? 'vendedor' : empleado.rol;

                // 3. Comparar el rol real contra la tarjeta que seleccionó en la interfaz
                if (rolRealEnBaseDatos !== rolSeleccionado) {
                    // Forzamos el cierre de sesión inmediato en Supabase por suplantación de rol
                    await supabaseClient.auth.signOut();
                    if (errorLogin) {
                        errorLogin.textContent = `🚫 Acceso denegado. Este correo no tiene permisos de ${rolSeleccionado === 'admin' ? 'Administrador' : 'Empleado'}.`;
                        errorLogin.style.display = "block";
                    }
                    return;
                }

                // Si todo coincide de forma transparente, se otorga acceso oficial
                localStorage.setItem('SESION_EMAIL', email);
                
                if (rolSeleccionado === 'admin') {
                    window.location.replace("admin.html");
                } else {
                    window.location.replace("vendedor.html");
                }

            } catch (errDb) {
                await supabaseClient.auth.signOut();
                if (errorLogin) {
                    errorLogin.textContent = "❌ Error interno de verificación.";
                    errorLogin.style.display = "block";
                }
            }
        });
    }
});