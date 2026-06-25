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
                    <td colspan="6" style="text-align:center;padding:20px;">No hay empleados registrados.</td>
                </tr>`;
            return;
        }

        tbody.innerHTML = '';
        empleados.forEach(emp => {
            const fechaFormateada = new Date(emp.fecha_registro).toLocaleDateString();
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${emp.id}</td>
                <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${emp.nombre_completo}</td>
                <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${emp.email}</td>
                <td style="padding:10px; border-bottom:1px solid #e2e8f0;"><span class="badge-${emp.rol}">${emp.rol}</span></td>
                <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${fechaFormateada}</td>
                <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:center;">
                    <button class="btn-editar" data-id="${emp.id}" style="background:#3b82f6; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-right:5px;">Editar</button>
                    <button class="btn-eliminar" data-id="${emp.id}" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        agregarEventosBotones();

    } catch (error) {
        console.error("Error al obtener empleados:", error.message);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">Error al cargar datos.</td></tr>`;
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
            alert("Empleado actualizado con éxito");
            empleadoEditandoId = null;
            document.getElementById('btn-guardar-empleado').textContent = "Guardar";
        } else {
            // --- MODO CREAR (CREATE) ---
            if (!password) {
                alert("Por favor, asigna una contraseña para el nuevo acceso.");
                return;
            }

            // 1. Crear el usuario en la autenticación de Supabase (Petición del líder)
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
            alert("Empleado y cuenta de acceso creados con éxito");
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

        alert("Empleado eliminado de la base de datos");
        obtenerEmpleados();
    } catch (error) {
        alert("Error al eliminar: " + error.message);
    }
}

// ==========================================
// FUNCIONES AUXILIARES DE EVENTOS
// ==========================================
function agregarEventosBotones() {
    document.querySelectorAll('.btn-eliminar').forEach(boton => {
        boton.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            eliminarEmpleado(id);
        });
    });

    document.querySelectorAll('.btn-editar').forEach(boton => {
        boton.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            
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
function limpiarFormulario() {
    document.getElementById('empleado-nombre').value = '';
    document.getElementById('empleado-email').value = '';
    document.getElementById('empleado-rol').value = 'empleado';
}
