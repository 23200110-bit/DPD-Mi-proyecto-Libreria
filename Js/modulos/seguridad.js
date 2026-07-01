/* ==========================================================================
   js/modulos/seguridad.js
   ========================================================================== */
import { supabaseClient } from '../supabase-config.js';

// Alerta actualmente en el modal (para el PDF)
let alertaEnModal = null;

export async function inicializarSeguridad() {
    await cargarAlertas();
    conectarEventos();
}

/* ==========================================================================
   ALERTAS
   ========================================================================== */

async function cargarAlertas() {
    const { data, error } = await supabaseClient
        .from('conteos_auditoria')
        .select(`
            id_conteo,
            vendedor_email,
            stock_sistema,
            stock_contado,
            discrepancia,
            fecha_conteo,
            revisado,
            productos ( nombre, precio_venta )
        `)
        .neq('discrepancia', 0)
        .order('fecha_conteo', { ascending: false });

    if (error) { console.error('Error al cargar alertas:', error); return; }

    const alertas    = data || [];
    const pendientes = alertas.filter(a => !a.revisado).length;
    const revisadas  = alertas.filter(a => a.revisado).length;

    const elPend = document.getElementById('num-pendientes');
    const elRev  = document.getElementById('num-revisadas');
    if (elPend) elPend.textContent = pendientes;
    if (elRev)  elRev.textContent  = revisadas;

    renderizarAlertas(alertas);
}

function renderizarAlertas(alertas) {
    const contenedor = document.getElementById('lista-alertas');
    if (!contenedor) return;

    if (alertas.length === 0) {
        contenedor.innerHTML = '<p class="sin-alertas">✅ No hay anomalías registradas.</p>';
        return;
    }

    contenedor.innerHTML = alertas.map(a => {
        const fecha     = new Date(a.fecha_conteo).toLocaleDateString('es-PE');
        const faltante  = a.discrepancia > 0;
        const difTexto  = faltante
            ? `Diferencia: ${a.discrepancia} unidades faltantes`
            : `Diferencia: ${Math.abs(a.discrepancia)} unidades sobrantes`;
        const difClase  = faltante ? 'alerta-diferencia' : 'alerta-diferencia positiva';

        return `
        <div class="tarjeta-alerta ${a.revisado ? 'revisada-card' : ''}">
            <div class="alerta-circulo">📦</div>
            <div class="alerta-cuerpo">
                <p class="alerta-titulo">Discrepancia en inventario detectada</p>
                <p class="alerta-descripcion">
                    El conteo físico no coincide con el sistema para
                    <strong>${a.productos?.nombre || '—'}</strong>
                </p>
                <div class="alerta-tags">
                    <span class="alerta-tag">👤 Empleado: ${a.vendedor_email}</span>
                    <span class="alerta-tag">Sistema: ${a.stock_sistema} uds</span>
                    <span class="alerta-tag fisico">Físico: ${a.stock_contado} uds</span>
                    <span class="alerta-tag">📅 Fecha: ${fecha}</span>
                </div>
                <p class="${difClase}">${difTexto}</p>
            </div>
            <div class="alerta-acciones">
                <button class="btn-ver-reporte" data-id="${a.id_conteo}">
                    📄 Ver Reporte
                </button>
                <button
                    class="btn-marcar-revisado"
                    data-id="${a.id_conteo}"
                    ${a.revisado ? 'disabled' : ''}
                >
                    ${a.revisado ? '✓ Revisado' : '✓ Marcar Revisado'}
                </button>
            </div>
        </div>`;
    }).join('');

    // Guardar datos completos en memoria para el modal
    const datosAlertas = alertas;

    contenedor.querySelectorAll('.btn-ver-reporte').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            const alerta = datosAlertas.find(a => a.id_conteo === id);
            if (alerta) abrirModalReporte(alerta);
        });
    });

    contenedor.querySelectorAll('.btn-marcar-revisado').forEach(btn => {
        btn.addEventListener('click', () => marcarRevisado(parseInt(btn.dataset.id)));
    });
}

async function marcarRevisado(idConteo) {
    const { error } = await supabaseClient
        .from('conteos_auditoria')
        .update({ revisado: true })
        .eq('id_conteo', idConteo);

    if (error) { alert('❌ Error al actualizar.'); return; }
    await cargarAlertas();
}

/* ==========================================================================
   MODAL VER REPORTE
   ========================================================================== */

function abrirModalReporte(alerta) {
    alertaEnModal = alerta;

    const modal     = document.getElementById('modal-reporte');
    const contenido = document.getElementById('modal-reporte-contenido');
    if (!modal || !contenido) return;

    const fecha      = new Date(alerta.fecha_conteo).toLocaleString('es-PE');
    const faltante   = alerta.discrepancia > 0;
    const sobrante   = alerta.discrepancia < 0;
    const precioUnit = parseFloat(alerta.productos?.precio_venta || 0);
    const impacto    = Math.abs(alerta.discrepancia) * precioUnit;
    const difClase   = faltante ? 'faltante' : sobrante ? 'sobrante' : 'neutro';
    const difTexto   = faltante
        ? `${alerta.discrepancia} unidades FALTANTES`
        : `${Math.abs(alerta.discrepancia)} unidades SOBRANTES`;

    contenido.innerHTML = `
        <p class="reporte-seccion-titulo">Información del Producto</p>
        <div class="reporte-fila">
            <span class="reporte-label">Producto</span>
            <span class="reporte-valor">${alerta.productos?.nombre || '—'}</span>
        </div>

        <p class="reporte-seccion-titulo">Resultado del Conteo</p>
        <div class="reporte-fila">
            <span class="reporte-label">Stock en Sistema</span>
            <span class="reporte-valor">${alerta.stock_sistema} unidades</span>
        </div>
        <div class="reporte-fila">
            <span class="reporte-label">Stock Contado Físico</span>
            <span class="reporte-valor">${alerta.stock_contado} unidades</span>
        </div>
        <div class="reporte-fila">
            <span class="reporte-label">Discrepancia</span>
            <span class="reporte-valor ${difClase}">${difTexto}</span>
        </div>
        <div class="reporte-fila">
            <span class="reporte-label">Impacto Económico Estimado</span>
            <span class="reporte-valor ${difClase}">S/ ${impacto.toFixed(2)}</span>
        </div>

        <p class="reporte-seccion-titulo">Trazabilidad</p>
        <div class="reporte-fila">
            <span class="reporte-label">Registrado por</span>
            <span class="reporte-valor">${alerta.vendedor_email}</span>
        </div>
        <div class="reporte-fila">
            <span class="reporte-label">Fecha y Hora</span>
            <span class="reporte-valor">${fecha}</span>
        </div>
        <div class="reporte-fila">
            <span class="reporte-label">ID de Auditoría</span>
            <span class="reporte-valor">#${String(alerta.id_conteo).padStart(4, '0')}</span>
        </div>
        <div class="reporte-fila">
            <span class="reporte-label">Estado</span>
            <span class="reporte-valor ${alerta.revisado ? 'sobrante' : 'faltante'}">
                ${alerta.revisado ? '✓ Revisado' : '⏳ Pendiente de revisión'}
            </span>
        </div>
    `;

    modal.style.display = 'flex';
}

function cerrarModalReporte() {
    const modal = document.getElementById('modal-reporte');
    if (modal) modal.style.display = 'none';
    alertaEnModal = null;
}

/* ==========================================================================
   GENERAR PDF
   ========================================================================== */

async function generarPDF() {
    if (!alertaEnModal) return;

    if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
        alert('❌ Librería PDF no disponible. Agrega jsPDF en admin.html.');
        return;
    }

    // Mostrar estado de carga en el botón
    const btnPDF = document.getElementById('btn-descargar-pdf');
    if (btnPDF) {
        btnPDF.disabled = true;
        btnPDF.textContent = '⏳ Generando PDF...';
    }

    // Pequeña pausa para que el navegador renderice el estado de carga
    await new Promise(resolve => setTimeout(resolve, 80));

    try {
        const { jsPDF: JsPDF } = window.jspdf || { jsPDF };
        const doc = new JsPDF();

        const a          = alertaEnModal;
        const fecha      = new Date(a.fecha_conteo).toLocaleString('es-PE');
        const precioUnit = parseFloat(a.productos?.precio_venta || 0);
        const impacto    = Math.abs(a.discrepancia) * precioUnit;
        const faltante   = a.discrepancia > 0;
        const difTexto   = faltante
            ? `${a.discrepancia} unidades FALTANTES`
            : `${Math.abs(a.discrepancia)} unidades SOBRANTES`;
        const idReporte  = `#${String(a.id_conteo).padStart(4, '0')}`;

        // Encabezado
        doc.setFillColor(0, 86, 179);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('SIVEP - El Lapiz de Oro', 14, 12);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Reporte de Anomalia de Inventario', 14, 22);
        doc.setFontSize(9);
        doc.text(`Reporte ${idReporte}`, 150, 12);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-PE')}`, 150, 20);

        let y = 45;
        doc.setTextColor(0, 0, 0);

        const seccion = (titulo) => {
            doc.setFillColor(241, 245, 249);
            doc.rect(14, y - 5, 182, 8, 'F');
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text(titulo.toUpperCase(), 16, y);
            doc.setTextColor(0, 0, 0);
            y += 8;
        };

        const fila = (label, valor, colorValor = null) => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(label, 16, y);
            if (colorValor) doc.setTextColor(...colorValor);
            else doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.text(String(valor), 100, y);
            doc.setTextColor(0, 0, 0);
            doc.setDrawColor(226, 232, 240);
            doc.line(14, y + 3, 196, y + 3);
            y += 12;
        };

        seccion('Información del Producto');
        fila('Producto', a.productos?.nombre || '—');

        y += 4;
        seccion('Resultado del Conteo');
        fila('Stock en Sistema', `${a.stock_sistema} unidades`);
        fila('Stock Contado Físico', `${a.stock_contado} unidades`);
        fila('Discrepancia', difTexto, faltante ? [220, 38, 38] : [22, 163, 74]);
        fila('Impacto Economico Estimado', `S/ ${impacto.toFixed(2)}`, faltante ? [220, 38, 38] : [22, 163, 74]);

        y += 4;
        seccion('Trazabilidad');
        fila('Registrado por', a.vendedor_email);
        fila('Fecha y Hora', fecha);
        fila('ID de Auditoria', idReporte);
        fila('Estado', a.revisado ? 'Revisado' : 'Pendiente de revision',
            a.revisado ? [22, 163, 74] : [220, 38, 38]);

        // Footer
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 275, 210, 22, 'F');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.text('SIVEP - Sistema de Inventario El Lapiz de Oro', 14, 284);
        doc.text('Documento confidencial - Solo para uso interno', 14, 290);

        doc.save(`reporte_anomalia_${idReporte}.pdf`);

        // Confirmar descarga completada
        if (btnPDF) {
            btnPDF.textContent = '✅ PDF Descargado';
            setTimeout(() => {
                btnPDF.disabled = false;
                btnPDF.textContent = '⬇️ Descargar PDF';
            }, 2000);
        }

    } catch (err) {
        console.error('Error al generar PDF:', err);
        if (btnPDF) {
            btnPDF.disabled = false;
            btnPDF.textContent = '❌ Error — Reintentar';
            setTimeout(() => {
                btnPDF.textContent = '⬇️ Descargar PDF';
            }, 2500);
        }
    }
}

/* ==========================================================================
   CONSEJOS ESTÁTICOS
   ========================================================================== */

const CONSEJOS = [
    {
        numero: '1',
        titulo: 'Realiza conteos físicos sorpresa',
        detalle: 'No avises con anticipación cuándo se hará el conteo. Los conteos programados pueden ser manipulados. Varía los días y horarios para obtener resultados reales.'
    },
    {
        numero: '2',
        titulo: 'Rota a los empleados por zonas',
        detalle: 'Evita que un mismo empleado esté siempre en la misma sección. La rotación dificulta que alguien pueda ocultar pérdidas de manera sistemática en un área específica.'
    },
    {
        numero: '3',
        titulo: 'Prioriza el conteo de productos de alto valor',
        detalle: 'Los artículos de mayor precio deben contarse con mayor frecuencia. Son los más rentables para quien intente sustraerlos.'
    },
    {
        numero: '4',
        titulo: 'Investiga discrepancias de inmediato',
        detalle: 'No dejes pasar más de 48 horas antes de hablar con el empleado que registró el conteo. Cuanto más tiempo pase, más difícil es rastrear qué ocurrió.'
    },
    {
        numero: '5',
        titulo: 'Controla el acceso al almacén',
        detalle: 'Solo las personas autorizadas deben tener acceso al stock de reserva. Registra quién entra y en qué horario.'
    },
    {
        numero: '6',
        titulo: 'Cruza ventas con inventario semanalmente',
        detalle: 'Compara el total de unidades vendidas según el sistema contra la reducción real del stock. Si las cifras no cuadran, hay una fuga que investigar.'
    },
    {
        numero: '7',
        titulo: 'Establece un sistema de doble verificación',
        detalle: 'Para productos de alto valor, exige que dos personas distintas confirmen el conteo. Una sola persona puede equivocarse o falsificar el registro.'
    },
    {
        numero: '8',
        titulo: 'Revisa el historial de un empleado con alertas repetidas',
        detalle: 'Si el mismo empleado aparece en múltiples discrepancias, no es casualidad. Analiza el patrón antes de tomar una decisión.'
    },
    {
        numero: '9',
        titulo: 'Instala una cámara en la zona de caja y almacén',
        detalle: 'No necesita ser costosa. Una cámara visible actúa como disuasivo. Colócala donde el empleado pueda verla claramente durante su turno.'
    },
    {
        numero: '10',
        titulo: 'Numera y sella los productos de alto riesgo',
        detalle: 'Artículos pequeños y caros como calculadoras o juegos de geometría pueden marcarse con stickers internos para identificar si fueron vendidos o sustraídos.'
    },
    {
        numero: '11',
        titulo: 'No dejes cajas abiertas sin supervisión',
        detalle: 'El efectivo sin contar es el riesgo más inmediato. Cierra y cuadra la caja al final de cada turno, no solo al final del día.'
    },
    {
        numero: '12',
        titulo: 'Comunica las políticas de seguridad desde el primer día',
        detalle: 'El empleado nuevo debe saber desde su ingreso que existen conteos físicos y auditorías. La transparencia desde el inicio reduce los intentos de fraude.'
    },
];

function mostrarConsejos() {
    const contenedor = document.getElementById('contenedor-consejos');
    const textoDiv   = document.getElementById('texto-consejos');
    const btn        = document.getElementById('btn-pedir-consejos');

    if (!contenedor || !textoDiv) return;

    const html = CONSEJOS.map(c => `
        <div style="margin-bottom:4px; padding-bottom:4px; border-bottom:1px solid #e2e8f0;">
            <p style="margin:0 0 1px 0; font-weight:700; color:#0f172a; font-size:13px;">
                ${c.numero}. ${c.titulo}
            </p>
            <p style="margin:0; color:#475569; font-size:12px; line-height:1.4;">
                ${c.detalle}
            </p>
        </div>
    `).join('');
    
    textoDiv.innerHTML = html;
    contenedor.style.display = '';

    if (btn) btn.textContent = '🔄 Actualizar Consejos';
}

/* ==========================================================================
   EVENTOS
   ========================================================================== */

function conectarEventos() {
    // Consejos
    const btnConsejos = document.getElementById('btn-pedir-consejos');
    if (btnConsejos) btnConsejos.addEventListener('click', mostrarConsejos);

    // Cerrar modal reporte
    const btnCerrar = document.getElementById('btn-cerrar-reporte');
    if (btnCerrar) btnCerrar.addEventListener('click', cerrarModalReporte);

    // Descargar PDF
    const btnPDF = document.getElementById('btn-descargar-pdf');
    if (btnPDF) btnPDF.addEventListener('click', generarPDF);

    // Cerrar modal al hacer clic fuera
    const modal = document.getElementById('modal-reporte');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cerrarModalReporte();
        });
    }
}