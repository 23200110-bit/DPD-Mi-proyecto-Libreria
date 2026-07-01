import { supabaseClient } from '../supabase-config.js';

// Variable global para controlar si estamos editando o creando
let empleadoEditandoId = null;

export function inicializarEmpleados() {
    console.log("Módulo Empleados cargado y sincronizado con Supabase");

    // 1. Cargar la lista automáticamente al abrir la vista
    obtenerEmpleados();

    // 2. Escuchar el evento del botón Guardar
    const btnGuardar = document.getElementById('btn-guardar-empleado');
    if (btnGuardar) {
        btnGuardar.addEventListener('click', guardarEmpleado);
    }
}

// ==========================================
// OPERACIÓN: LEER (READ)
// ==========================================
async function obtenerEmpleados() {
    const tbody = document.getElementById('tabla-empleados');
    if (!tbody) return;

    try {
        const { data: empleados, error } = await supabaseClient
            .from('empleados')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        if (!empleados || empleados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:30px; color: #94a3b8; font-size: 14px;">No hay empleados registrados en el sistema.</td>
                </tr>`;
            return;
        }

        tbody.innerHTML = '';
        empleados.forEach(emp => {
            const fechaFormateada = new Date(emp.fecha_registro).toLocaleDateString();
            
            // Renderizado estético Senior en base a roles
            let badgeRol = `<span class="alert-tag status-pill badge-disponible" style="display: inline-block; padding: 4px 10px; border-radius: 50px; font-size: 12px; font-weight: 600; text-transform: capitalize;">${emp.rol}</span>`;
            if (emp.rol === 'admin') {
                badgeRol = `<span class="alert-tag tag-warning" style="display: inline-block; padding: 4px 10px; border-radius: 50px; font-size: 12px; font-weight: 600; text-transform: capitalize;">Administrador</span>`;
            }

            const tr = document.createElement('tr');
            tr.style.background = '#ffffff';
            tr.style.transition = 'background 0.2s';
            
            tr.innerHTML = `
                <td style="padding: 14px 16px; color: #64748b; font-weight: 500; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${emp.id}</td>
                <td style="padding: 14px 16px; color: #1e293b; font-weight: 600; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${emp.nombre_completo}</td>
                <td style="padding: 14px 16px; color: #475569; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${emp.email}</td>
                <td style="padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">${badgeRol}</td>
                <td style="padding: 14px 16px; color: #64748b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${fechaFormateada}</td>
                <td style="padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                        <button class="btn-editar" data-id="${emp.id}" style="background-color: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);" title="Editar">✏️ Editar</button>
                        <button class="btn-eliminar" data-id="${emp.id}" style="background-color: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);" title="Eliminar">🗑️ Eliminar</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        agregarEventosBotones();

    } catch (error) {
        console.error("Error al obtener empleados:", error.message);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; font-weight: 600; padding:30px;">❌ Error al cargar los registros oficiales de Supabase.</td></tr>`;
    }
}

// ==========================================
// OPERACIÓN: CREAR / ACTUALIZAR (CREATE / UPDATE)
// ==========================================
async function guardarEmpleado() {
    const nombreCompleto = document.getElementById('empleado-nombre').value.trim();
    const email = document.getElementById('empleado-email').value.trim();
    const passwordInput = document.getElementById('empleado-password');
    const password = passwordInput ? passwordInput.value.trim() : '';
    const rol = document.getElementById('empleado-rol').value;

    if (!nombreCompleto || !email) {
        alert("Por favor, completa el nombre y el correo electrónico.");
        return;
    }

    try {
        if (empleadoEditandoId) {
            // --- MODO ACTUALIZAR (UPDATE) ---
            const { error } = await supabaseClient
                .from('empleados')
                .update({ 
                    nombre_completo: nombreCompleto,
                    email: email, 
                    rol: rol 
                })
                .eq('id', empleadoEditandoId);

            if (error) throw error;
            alert("Empleado actualizado con éxito.");
            empleadoEditandoId = null;
            document.getElementById('btn-guardar-empleado').textContent = "Guardar";
        } else {
            // --- MODO CREAR (CREATE) ---
            if (!password) {
                alert("Por favor, asigna una contraseña para el nuevo acceso.");
                return;
            }

            // 1. Crear el usuario en la autenticación de Supabase (Sign Up)
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
            });

            if (authError) throw authError;

            // 2. Guardar el registro en tu tabla maestra de empleados
            const { error } = await supabaseClient
                .from('empleados')
                .insert([{ 
                    nombre_completo: nombreCompleto,
                    email: email, 
                    rol: rol 
                }]);

            if (error) throw error;
            alert("Empleado y cuenta de acceso creados con éxito.");
        }

        limpiarFormulario();
        obtenerEmpleados();

    } catch (error) {
        alert("Error en la operación: " + error.message);
    }
}

// ==========================================
// OPERACIÓN: ELIMINAR (DELETE)
// ==========================================
async function eliminarEmpleado(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar a este empleado?")) return;

    try {
        const { error } = await supabaseClient
            .from('empleados')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert("Empleado eliminado de la base de datos.");
        obtenerEmpleados();
    } catch (error) {
        alert("Error al eliminar: " + error.message);
    }
}

// ==========================================
// FUNCIONES AUXILIARES DE EVENTOS
// ==========================================
function agregarEventosBotones() {
    // Eventos para botones Eliminar
    document.querySelectorAll('.btn-eliminar').forEach(boton => {
        boton.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            eliminarEmpleado(id);
        });
    });

    // Eventos para botones Editar
    document.querySelectorAll('.btn-editar').forEach(boton => {
        boton.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            
            const { data: emp, error } = await supabaseClient
                .from('empleados')
                .select('*')
                .eq('id', id)
                .single();

            if (!error && emp) {
                document.getElementById('empleado-nombre').value = emp.nombre_completo;
                document.getElementById('empleado-email').value = emp.email;
                document.getElementById('empleado-rol').value = emp.rol;
                
                // Limpiamos el input de contraseña al editar por seguridad
                if (document.getElementById('empleado-password')) {
                    document.getElementById('empleado-password').value = '';
                }
                
                empleadoEditandoId = id;
                document.getElementById('btn-guardar-empleado').textContent = "Actualizar";
            }
        });
    });
}

function limpiarFormulario() {
    document.getElementById('empleado-nombre').value = '';
    document.getElementById('empleado-email').value = '';
    if (document.getElementById('empleado-password')) {
        document.getElementById('empleado-password').value = '';
    }
    document.getElementById('empleado-rol').value = 'empleado';
}