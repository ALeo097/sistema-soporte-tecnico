/**
 * ====================================================
 * SISTEMA DE GESTIÓN DE ACTIVIDADES DE SOPORTE TÉCNICO
 * ====================================================
 * 
 * Desarrollado por: Alberto Leo Pantoja
 * Institución: Instituto Tecnológico de Veracruz
 * Departamento: Centro de Cómputo
 * Fecha: 2026
 * Versión: 1.0.0
 * 
 * Descripción:
 *   Sistema completo para gestionar actividades de soporte técnico,
 *   con autenticación de usuarios, múltiples técnicos por actividad,
 *   panel de estadísticas y exportación de datos.
 * 
 * Contacto: afleop09@gmail.com
 * ====================================================
 */

// ========== CONFIGURACION SUPABASE ==========
const SUPABASE_URL = '';
const SUPABASE_KEY = '';

let db;
try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (error) {
    console.error('Error creando cliente Supabase:', error);
    alert('Error critico: No se pudo conectar a Supabase.');
}

// ========== CONFIGURACION INICIAL ==========
const configuracionOpciones = {
    problemas: [
        'Impresora no enciende',
        'No hay conexion a internet',
        'Computadora lenta',
        'Software no se ejecuta',
        'Problema con correo electronico',
        'Teclado/mouse no funcionan',
        'Pantalla en blanco',
        'Sonido no funciona',
        'Error de red',
        'Virus/malware detectado'
    ],
    departamentos: [
        'Direccion',
        'Administracion',
        'Vinculacion',
        'Recursos Humanos',
        'Finanzas',
        'Mantenimiento',
        'Academico',
        'Biblioteca',
        'Laboratorios',
        'Cafeteria'
    ],
    solicitantes: [
        'Juan Perez',
        'Maria Garcia',
        'Carlos Lopez',
        'Ana Martinez',
        'Pedro Rodriguez',
        'Laura Sanchez',
        'Miguel Gonzalez',
        'Isabel Fernandez',
        'Jose Ramirez',
        'Carmen Torres'
    ]
};

let cargandoActividades = false;
let opcionesProblemas = [...configuracionOpciones.problemas];
let opcionesDepartamentos = [...configuracionOpciones.departamentos];
let opcionesSolicitantes = [...configuracionOpciones.solicitantes];

// ========== SISTEMA DE USUARIOS ==========
let usuarioActual = null;
let listaTecnicos = [];

async function verificarCredenciales(usuario, contrasena) {
    try {
        const { data, error } = await db
            .from('usuarios')
            .select('*')
            .eq('usuario', usuario)
            .single();
        
        if (error || !data) {
            return { valido: false, mensaje: 'Usuario no encontrado' };
        }
        
        if (!data.activo) {
            return { valido: false, mensaje: 'Cuenta pendiente de activacion por el administrador' };
        }
        
        if (data.contrasena_hash !== contrasena) {
            return { valido: false, mensaje: 'Contrasena incorrecta' };
        }
        
        await db
            .from('usuarios')
            .update({ ultimo_login: new Date().toISOString() })
            .eq('id', data.id);
        
        return {
            valido: true,
            usuario: {
                id: data.id,
                usuario: data.usuario,
                nombre: data.nombre,
                email: data.email,
                telefono: data.telefono,
                fecha_nacimiento: data.fecha_nacimiento,
                foto_perfil: data.foto_perfil,
                rol: data.rol,
                activo: data.activo,
                permisos: obtenerPermisosPorRol(data.rol)
            }
        };
    } catch (error) {
        console.error('Error verificando credenciales:', error);
        return { valido: false, mensaje: 'Error del sistema' };
    }
}

function obtenerPermisosPorRol(rol) {
    const permisos = {
        admin: ['crear', 'ver', 'editar', 'eliminar', 'exportar', 'estadisticas', 'gestion_opciones', 'gestion_usuarios', 'crear_usuarios', 'editar_usuarios', 'eliminar_usuarios'],
        tecnico: ['crear', 'ver', 'completar', 'marcar_progreso', 'editar_notas', 'editar_propias']
    };
    return permisos[rol] || ['ver'];
}

function tienePermiso(permiso) {
    if (!usuarioActual || !usuarioActual.permisos) return false;
    return usuarioActual.permisos.includes(permiso);
}

// ========== GESTION DE USUARIOS ==========
async function cargarUsuarios() {
    if (!tienePermiso('gestion_usuarios')) return [];
    
    try {
        const { data, error } = await db
            .from('usuarios')
            .select('*')
            .order('creado_en', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        return [];
    }
}

window.cargarUsuariosParaGestion = async function() {
    const contenedor = document.getElementById('contenedorTablaUsuarios');
    if (!contenedor) return;

    try {
        const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual') || '{}');
        if (usuarioActual.rol !== 'admin') {
            contenedor.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Solo los administradores pueden gestionar usuarios.
                </div>`;
            return;
        }

        contenedor.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando usuarios...</span>
                </div>
                <p class="mt-2">Cargando lista de usuarios...</p>
            </div>`;

        const { data: usuarios, error } = await db
            .from('usuarios')
            .select('*')
            .order('nombre', { ascending: true });

        if (error) throw error;

        if (!usuarios || usuarios.length === 0) {
            contenedor.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    No hay usuarios registrados en el sistema.
                </div>`;
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table table-hover align-middle" id="tablaUsuarios">
                    <thead class="table-light">
                        <tr>
                            <th>Usuario / Nombre</th>
                            <th>Contacto</th>
                            <th>Fecha Nac.</th>
                            <th>Rol</th>
                            <th>Estado</th>
                            <th>Ultimo Acceso</th>
                            <th class="text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>`;

        usuarios.forEach(user => {
            const badgeRol = user.rol === 'admin' ? 'bg-danger' : 'bg-primary';
            const badgeEstado = user.activo ? 'bg-success' : 'bg-secondary';
            const estadoTexto = user.activo ? 'ACTIVO' : 'INACTIVO';
            const estadoIcono = user.activo ? 'bi-check-circle' : 'bi-clock';
            
            const fechaLogin = user.ultimo_login 
                ? new Date(user.ultimo_login).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'Nunca';

            let fechaNacimientoFormateada = '<span class="text-muted">—</span>';
            if (user.fecha_nacimiento) {
                if (typeof user.fecha_nacimiento === 'string' && user.fecha_nacimiento.includes('-')) {
                    const [año, mes, dia] = user.fecha_nacimiento.split('T')[0].split('-');
                    fechaNacimientoFormateada = `${dia}/${mes}/${año}`;
                } else {
                    const fecha = new Date(user.fecha_nacimiento + 'T12:00:00');
                    const dia = String(fecha.getDate()).padStart(2, '0');
                    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
                    const año = fecha.getFullYear();
                    fechaNacimientoFormateada = `${dia}/${mes}/${año}`;
                }
            }

            const esUsuarioActual = user.id === usuarioActual.id;
            const puedeActivarDesactivar = !esUsuarioActual;
            const accionTexto = user.activo ? 'Desactivar' : 'Activar';
            const accionIcono = user.activo ? 'bi-person-x' : 'bi-person-check';
            const accionClase = user.activo ? 'btn-outline-warning' : 'btn-outline-success';

            let telefonoMostrar = 'No registrado';
            if (user.telefono) {
                telefonoMostrar = user.telefono.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
            }

            html += `
                <tr class="${!user.activo ? 'table-warning' : ''}">
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="rounded-circle bg-light me-2 d-flex align-items-center justify-content-center" 
                                 style="width: 40px; height: 40px; overflow: hidden; border: 2px solid ${user.rol === 'admin' ? '#dc3545' : '#0d6efd'};">
                                ${user.foto_perfil ? 
                                    `<img src="${user.foto_perfil}" style="width: 100%; height: 100%; object-fit: cover;" 
                                          alt="Foto de ${user.nombre}">` : 
                                    `<i class="bi bi-person-circle" style="font-size: 1.5rem; color: ${user.rol === 'admin' ? '#dc3545' : '#0d6efd'};"></i>`
                                }
                            </div>
                            <div>
                                <strong>${user.nombre}</strong>
                                <div class="text-muted small">
                                    <i class="bi bi-at"></i> ${user.usuario}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div>
                            ${user.email ? 
                                `<div><i class="bi bi-envelope text-muted me-1"></i> ${user.email}</div>` : 
                                '<div class="text-muted"><i class="bi bi-envelope me-1"></i> Sin email</div>'
                            }
                            ${user.telefono ? 
                                `<div><i class="bi bi-phone text-muted me-1"></i> ${telefonoMostrar}</div>` : 
                                ''
                            }
                        </div>
                    </td>
                    <td class="text-center">
                        <span class="badge bg-info bg-opacity-10 text-info border border-info">
                            <i class="bi bi-calendar3 me-1"></i> ${fechaNacimientoFormateada}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${badgeRol}">
                            <i class="bi ${user.rol === 'admin' ? 'bi-shield-check' : 'bi-person-gear'} me-1"></i>
                            ${user.rol === 'admin' ? 'ADMIN' : 'TECNICO'}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${badgeEstado}">
                            <i class="bi ${estadoIcono} me-1"></i>${estadoTexto}
                        </span>
                    </td>
                    <td>
                        <small class="text-muted">
                            <i class="bi bi-clock-history me-1"></i> ${fechaLogin}
                        </small>
                    </td>
                    <td class="text-center">
                        <div class="btn-group btn-group-sm" role="group">
                            ${puedeActivarDesactivar ? `
                                <button class="btn ${accionClase}" 
                                        onclick="cambiarEstadoUsuario('${user.id}', ${!user.activo})"
                                        title="${accionTexto} cuenta">
                                    <i class="bi ${accionIcono}"></i>
                                </button>
                            ` : `
                                <span class="badge bg-info me-1" title="Tu cuenta actual">
                                    <i class="bi bi-person-check"></i>
                                </span>
                            `}
                            <button class="btn btn-outline-warning" 
                                    onclick="editarUsuario('${user.id}')"
                                    title="Editar usuario">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger" 
                                    onclick="confirmarEliminarUsuario('${user.id}')"
                                    title="Eliminar usuario permanentemente"
                                    ${esUsuarioActual ? 'disabled' : ''}>
                                <i class="bi bi-trash"></i>
                            </button>
                            <button class="btn btn-outline-primary" 
                                    onclick="verDetallesUsuario('${user.id}')"
                                    title="Ver detalles del usuario">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;

        contenedor.innerHTML = html;
        actualizarBadgeUsuariosPendientes(usuarios);

    } catch (error) {
        console.error('Error cargando usuarios:', error);
        contenedor.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Error al cargar usuarios: ${error.message}
            </div>`;
    }
};

async function crearUsuario(usuarioData) {
    try {
        const { data: usuarioExistente } = await db
            .from('usuarios')
            .select('usuario, email')
            .or(`usuario.eq.${usuarioData.usuario},email.eq.${usuarioData.email}`)
            .maybeSingle();
        
        if (usuarioExistente) {
            if (usuarioExistente.usuario === usuarioData.usuario) {
                return { exito: false, mensaje: 'El nombre de usuario ya existe' };
            } else {
                return { exito: false, mensaje: 'El correo electronico ya esta registrado' };
            }
        }
        
        if (usuarioData.rol === 'admin' && usuarioActual && usuarioActual.rol !== 'admin') {
            return { exito: false, mensaje: 'Solo administradores pueden crear otros administradores' };
        }
        
        let activo = false;
        if (usuarioData.rol === 'admin' || (usuarioActual && usuarioActual.rol === 'admin')) {
            activo = true;
        }
        if (usuarioActual && usuarioActual.rol === 'admin' && usuarioData.rol === 'tecnico') {
            activo = true;
        }
        
        const usuarioParaInsertar = {
            usuario: usuarioData.usuario,
            nombre: usuarioData.nombre,
            contrasena_hash: usuarioData.contrasena,
            email: usuarioData.email,
            rol: usuarioData.rol,
            activo: activo,
            fecha_nacimiento: usuarioData.fecha_nacimiento || null,
            foto_perfil: usuarioData.foto_perfil || null
        };
        
        const { error } = await db
            .from('usuarios')
            .insert([usuarioParaInsertar]);
        
        if (error) throw error;
        
        return { 
            exito: true, 
            mensaje: usuarioParaInsertar.activo 
                ? 'Usuario creado y activado exitosamente' 
                : 'Usuario creado. Debe ser activado por un administrador',
            activo: usuarioParaInsertar.activo
        };
    } catch (error) {
        console.error('Error creando usuario:', error);
        return { exito: false, mensaje: 'Error al crear usuario: ' + error.message };
    }
}

async function actualizarUsuario(id, datosActualizados) {
    try {
        if (datosActualizados.rol === 'admin' && usuarioActual.rol !== 'admin') {
            return { exito: false, mensaje: 'Solo administradores pueden asignar rol de administrador' };
        }
        
        const { error } = await db
            .from('usuarios')
            .update(datosActualizados)
            .eq('id', id);
        
        if (error) throw error;
        
        return { exito: true, mensaje: 'Usuario actualizado exitosamente' };
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        return { exito: false, mensaje: 'Error al actualizar usuario' };
    }
}

// ========== FUNCIONES PARA FOTO DE PERFIL ==========
window.previewFotoPerfil = function(input, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.innerHTML = '';
            
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '50%';
            
            preview.appendChild(img);
        };
        
        reader.readAsDataURL(input.files[0]);
    }
};

window.guardarFotoPerfil = async function() {
    const input = document.getElementById('perfilFoto_input');
    if (!input || !input.files || !input.files[0]) return;
    
    const file = input.files[0];
    
    if (file.size > 2 * 1024 * 1024) {
        mostrarMensaje('La imagen no debe superar los 2MB', 'error');
        return;
    }
    
    if (!file.type.match('image.*')) {
        mostrarMensaje('Solo se permiten archivos de imagen', 'error');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        const fotoBase64 = e.target.result;
        
        try {
            const { error } = await db
                .from('usuarios')
                .update({ foto_perfil: fotoBase64 })
                .eq('id', usuarioActual.id);
            
            if (error) throw error;
            
            usuarioActual.foto_perfil = fotoBase64;
            localStorage.setItem('usuarioActual', JSON.stringify(usuarioActual));
            
            mostrarMensaje('Foto de perfil actualizada', 'success');
            actualizarFotoEnHeader();
            
        } catch (error) {
            mostrarMensaje('Error al guardar la foto: ' + error.message, 'error');
        }
    };
    
    reader.readAsDataURL(file);
};

window.eliminarFotoPerfil = async function() {
    if (!confirm('¿Eliminar tu foto de perfil?')) return;
    
    try {
        const { error } = await db
            .from('usuarios')
            .update({ foto_perfil: null })
            .eq('id', usuarioActual.id);
        
        if (error) throw error;
        
        usuarioActual.foto_perfil = null;
        localStorage.setItem('usuarioActual', JSON.stringify(usuarioActual));
        
        mostrarMensaje('Foto de perfil eliminada', 'success');
        
        const preview = document.getElementById('vistaPreviaPerfil');
        if (preview) {
            preview.innerHTML = '<i class="bi bi-person-circle text-secondary" style="font-size: 3rem;"></i>';
        }
        
        actualizarFotoEnHeader();
        document.getElementById('perfilFoto_input').value = '';
        
    } catch (error) {
        mostrarMensaje('Error al eliminar la foto: ' + error.message, 'error');
    }
};

function actualizarFotoEnHeader() {
    const fotoContainer = document.getElementById('fotoPerfilHeader');
    if (!fotoContainer) return;
    
    if (usuarioActual && usuarioActual.foto_perfil) {
        fotoContainer.innerHTML = `<img src="${usuarioActual.foto_perfil}" style="width: 100%; height: 100%; object-fit: cover;" alt="Foto de perfil">`;
    } else {
        fotoContainer.innerHTML = '<i class="bi bi-person-circle" style="font-size: 1.5rem; color: white;"></i>';
    }
}

window.abrirAdminCuenta = function() {
    if (!usuarioActual) return;
    
    document.getElementById('perfilUsuario').value = usuarioActual.usuario || '';
    document.getElementById('perfilNombre').value = usuarioActual.nombre || '';
    document.getElementById('perfilEmail').value = usuarioActual.email || '';
    document.getElementById('perfilRol').value = usuarioActual.rol === 'admin' ? 'Administrador' : 'Tecnico';
    document.getElementById('perfilTelefono').value = usuarioActual.telefono || '';
    
    if (usuarioActual.fecha_nacimiento) {
        document.getElementById('perfilFechaNacimiento').value = usuarioActual.fecha_nacimiento.split('T')[0];
    }
    
    const preview = document.getElementById('vistaPreviaPerfil');
    if (preview) {
        preview.innerHTML = '';
        if (usuarioActual.foto_perfil) {
            const img = document.createElement('img');
            img.src = usuarioActual.foto_perfil;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '50%';
            preview.appendChild(img);
        } else {
            preview.innerHTML = '<i class="bi bi-person-circle text-secondary" style="font-size: 3rem;"></i>';
        }
    }
    
    document.getElementById('perfilUsuario').readOnly = false;
    document.getElementById('perfilNombre').readOnly = true;
    document.getElementById('perfilNombre').classList.add('bg-light');
    
    document.getElementById('contrasenaActual').value = '';
    document.getElementById('nuevaContrasena').value = '';
    document.getElementById('confirmarNuevaContrasena').value = '';
    
    document.getElementById('passwordStrengthCuenta').style.width = '0%';
    document.getElementById('passwordStrengthCuenta').className = 'progress-bar';
    
    setTimeout(() => {
        configurarTogglesModalCuenta();
    }, 100);
    
    new bootstrap.Modal(document.getElementById('modalAdminCuenta')).show();
};

async function eliminarUsuario(id) {
    try {
        if (id === usuarioActual.id) {
            return { exito: false, mensaje: 'No puedes desactivar tu propia cuenta' };
        }
        
        const { error } = await db
            .from('usuarios')
            .update({ activo: false })
            .eq('id', id);
        
        if (error) throw error;
        
        return { exito: true, mensaje: 'Usuario desactivado exitosamente' };
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        return { exito: false, mensaje: 'Error al desactivar usuario' };
    }
}

async function cargarTecnicos() {
    try {
        const { data, error } = await db
            .from('usuarios')
            .select('id, nombre, usuario, rol, activo')
            .eq('activo', true)
            .order('nombre');
        
        if (error) throw error;
        
        listaTecnicos = data || [];
        actualizarSelectTecnicos();
        
        return listaTecnicos;
    } catch (error) {
        console.error('Error cargando tecnicos:', error);
        return [];
    }
}

// ========== ADMINISTRACION DE CUENTA PERSONAL ==========
document.addEventListener('DOMContentLoaded', function() {
    const formPerfil = document.getElementById('formActualizarPerfil');
    if (formPerfil) {
        formPerfil.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const btnActualizar = document.getElementById('btnActualizarPerfil');
            const originalText = btnActualizar.innerHTML;
            
            try {
                btnActualizar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Actualizando...';
                btnActualizar.disabled = true;
                
                const usuario = document.getElementById('perfilUsuario').value.trim();
                const email = document.getElementById('perfilEmail').value.trim();
                const telefono = document.getElementById('perfilTelefono').value.trim();
                const fechaNacimiento = document.getElementById('perfilFechaNacimiento').value;
                
                if (!usuario) {
                    throw new Error('El usuario es requerido');
                }
                
                const usuarioRegex = /^[a-zA-Z0-9_]{3,20}$/;
                if (!usuarioRegex.test(usuario)) {
                    throw new Error('Usuario invalido. Use solo letras, numeros y guiones bajos (3-20 caracteres)');
                }
                
                if (email) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email)) {
                        throw new Error('Correo electronico invalido');
                    }
                }
                
                if (telefono) {
                    const telefonoRegex = /^[0-9]{10}$/;
                    if (!telefonoRegex.test(telefono)) {
                        throw new Error('El telefono debe tener 10 digitos numericos');
                    }
                }
                
                if (usuario !== usuarioActual.usuario) {
                    const { data: usuarioExistente } = await db
                        .from('usuarios')
                        .select('usuario')
                        .eq('usuario', usuario)
                        .maybeSingle();
                    
                    if (usuarioExistente) {
                        throw new Error('El nombre de usuario ya esta en uso');
                    }
                }
                
                const { error } = await db
                    .from('usuarios')
                    .update({ 
                        usuario: usuario,
                        email: email || null,
                        telefono: telefono || null,
                        fecha_nacimiento: fechaNacimiento || null
                    })
                    .eq('id', usuarioActual.id);
                
                if (error) throw error;
                
                usuarioActual.usuario = usuario;
                usuarioActual.email = email;
                usuarioActual.telefono = telefono;
                usuarioActual.fecha_nacimiento = fechaNacimiento;
                localStorage.setItem('usuarioActual', JSON.stringify(usuarioActual));
                
                document.getElementById('nombreUsuario').textContent = usuarioActual.nombre;
                
                mostrarMensaje('Perfil actualizado exitosamente', 'success');
                
            } catch (error) {
                mostrarMensaje('Error: ' + error.message, 'error');
            } finally {
                btnActualizar.innerHTML = originalText;
                btnActualizar.disabled = false;
            }
        });
    }
    
    const formCambiarContrasena = document.getElementById('formCambiarContrasena');
    if (formCambiarContrasena) {
        formCambiarContrasena.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const btnCambiar = document.getElementById('btnCambiarContrasena');
            const originalText = btnCambiar.innerHTML;
            
            try {
                btnCambiar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cambiando...';
                btnCambiar.disabled = true;
                
                const contrasenaActual = document.getElementById('contrasenaActual').value;
                const nuevaContrasena = document.getElementById('nuevaContrasena').value;
                const confirmarContrasena = document.getElementById('confirmarNuevaContrasena').value;
                
                if (!contrasenaActual || !nuevaContrasena || !confirmarContrasena) {
                    throw new Error('Todos los campos son requeridos');
                }
                
                if (nuevaContrasena.length < 6) {
                    throw new Error('La nueva contrasena debe tener al menos 6 caracteres');
                }
                
                if (nuevaContrasena !== confirmarContrasena) {
                    throw new Error('Las contrasenas no coinciden');
                }
                
                const { data: usuario, error: verifyError } = await db
                    .from('usuarios')
                    .select('*')
                    .eq('id', usuarioActual.id)
                    .single();
                
                if (verifyError) throw verifyError;
                
                if (usuario.contrasena_hash !== contrasenaActual) {
                    throw new Error('La contrasena actual es incorrecta');
                }
                
                const { error } = await db
                    .from('usuarios')
                    .update({ contrasena_hash: nuevaContrasena })
                    .eq('id', usuarioActual.id);
                
                if (error) throw error;
                
                mostrarMensaje('Contrasena cambiada exitosamente', 'success');
                
                document.getElementById('contrasenaActual').value = '';
                document.getElementById('nuevaContrasena').value = '';
                document.getElementById('confirmarNuevaContrasena').value = '';
                document.getElementById('passwordStrengthCuenta').style.width = '0%';
                
            } catch (error) {
                mostrarMensaje('Error: ' + error.message, 'error');
            } finally {
                btnCambiar.innerHTML = originalText;
                btnCambiar.disabled = false;
            }
        });
    }
    
    const nuevaContrasenaInput = document.getElementById('nuevaContrasena');
    if (nuevaContrasenaInput) {
        nuevaContrasenaInput.addEventListener('input', function() {
            const password = this.value;
            const strengthBar = document.getElementById('passwordStrengthCuenta');
            let strength = 0;
            
            if (password.length >= 6) strength += 25;
            if (password.match(/[a-z]/)) strength += 25;
            if (password.match(/[A-Z]/)) strength += 25;
            if (password.match(/[0-9!@#$%^&*]/)) strength += 25;
            
            strengthBar.style.width = strength + '%';
            
            if (strength <= 25) {
                strengthBar.className = 'progress-bar bg-danger';
            } else if (strength <= 50) {
                strengthBar.className = 'progress-bar bg-warning';
            } else if (strength <= 75) {
                strengthBar.className = 'progress-bar bg-info';
            } else {
                strengthBar.className = 'progress-bar bg-success';
            }
        });
    }
    
    const inputFotoPerfil = document.getElementById('perfilFoto_input');
    if (inputFotoPerfil) {
        inputFotoPerfil.addEventListener('change', function() {
            previewFotoPerfil(this, 'vistaPreviaPerfil');
        });
    }
    
    const btnGuardarFoto = document.getElementById('btnGuardarFoto');
    if (btnGuardarFoto) {
        btnGuardarFoto.addEventListener('click', guardarFotoPerfil);
    }
    
    const btnEliminarFoto = document.getElementById('btnEliminarFoto');
    if (btnEliminarFoto) {
        btnEliminarFoto.addEventListener('click', eliminarFotoPerfil);
    }
    
    if (usuarioActual && usuarioActual.foto_perfil) {
        setTimeout(() => {
            actualizarFotoEnHeader();
        }, 500);
    }
});

function previewFotoPerfil(input, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.innerHTML = '';
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '50%';
            preview.appendChild(img);
        };
        
        reader.readAsDataURL(input.files[0]);
    }
}

async function guardarFotoPerfil() {
    const input = document.getElementById('perfilFoto_input');
    if (!input || !input.files || !input.files[0]) {
        mostrarMensaje('Selecciona una imagen primero', 'warning');
        return;
    }
    
    const file = input.files[0];
    
    if (file.size > 2 * 1024 * 1024) {
        mostrarMensaje('La imagen no debe superar los 2MB', 'error');
        return;
    }
    
    if (!file.type.match('image.*')) {
        mostrarMensaje('Solo se permiten archivos de imagen', 'error');
        return;
    }
    
    const btnGuardar = document.getElementById('btnGuardarFoto');
    const originalText = btnGuardar.innerHTML;
    
    try {
        btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        btnGuardar.disabled = true;const configuracionOpciones = {
    problemas: [
        'Impresora no enciende',
        'No hay conexion a internet',
        'Computadora lenta',
        'Software no se ejecuta',
        'Problema con correo electronico',
        'Teclado/mouse no funcionan',
        'Pantalla en blanco',
        'Sonido no funciona',
        'Error de red',
        'Virus/malware detectado'
    ],
    departamentos: [
        'Direccion',
        'Administracion',
        'Vinculacion',
        'Recursos Humanos',
        'Finanzas',
        'Mantenimiento',
        'Academico',
        'Biblioteca',
        'Laboratorios',
        'Cafeteria'
    ],
    solicitantes: [
        'Juan Perez',
        'Maria Garcia',
        'Carlos Lopez',
        'Ana Martinez',
        'Pedro Rodriguez',
        'Laura Sanchez',
        'Miguel Gonzalez',
        'Isabel Fernandez',
        'Jose Ramirez',
        'Carmen Torres'
    ]
};
        
        const reader = new FileReader();
        
        const fotoBase64 = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        
        const { error } = await db
            .from('usuarios')
            .update({ foto_perfil: fotoBase64 })
            .eq('id', usuarioActual.id);
        
        if (error) throw error;
        
        usuarioActual.foto_perfil = fotoBase64;
        localStorage.setItem('usuarioActual', JSON.stringify(usuarioActual));
        
        mostrarMensaje('Foto de perfil actualizada', 'success');
        actualizarFotoEnHeader();
        
    } catch (error) {
        mostrarMensaje('Error al guardar la foto: ' + error.message, 'error');
    } finally {
        btnGuardar.innerHTML = originalText;
        btnGuardar.disabled = false;
    }
}

async function eliminarFotoPerfil() {
    if (!confirm('¿Eliminar tu foto de perfil?')) return;
    
    try {
        const { error } = await db
            .from('usuarios')
            .update({ foto_perfil: null })
            .eq('id', usuarioActual.id);
        
        if (error) throw error;
        
        usuarioActual.foto_perfil = null;
        localStorage.setItem('usuarioActual', JSON.stringify(usuarioActual));
        
        mostrarMensaje('Foto de perfil eliminada', 'success');
        
        const preview = document.getElementById('vistaPreviaPerfil');
        if (preview) {
            preview.innerHTML = '<i class="bi bi-person-circle text-secondary" style="font-size: 3rem;"></i>';
        }
        
        document.getElementById('perfilFoto_input').value = '';
        actualizarFotoEnHeader();
        
    } catch (error) {
        mostrarMensaje('Error al eliminar la foto: ' + error.message, 'error');
    }
}

// ========== FUNCIONES DE SELECTS ==========
function actualizarSelectTecnicos() {
    const selectPrincipal = document.getElementById('tecnico');
    const selectEditar = document.getElementById('editarTecnico');
    
    const actualizarSelect = (select, valorActual = '') => {
        if (!select) return;
        
        const seleccionActual = [];
        if (select.multiple) {
            Array.from(select.selectedOptions).forEach(opt => {
                seleccionActual.push(opt.value);
            });
        }
        
        select.innerHTML = '';
        
        if (!select.multiple) {
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Seleccionar tecnico...';
            select.appendChild(defaultOption);
        }
        
        const tecnicosActivos = listaTecnicos.filter(tecnico => 
            tecnico.rol === 'tecnico' && tecnico.activo === true
        );
        
        tecnicosActivos.forEach(tecnico => {
            const option = document.createElement('option');
            option.value = tecnico.id;
            option.textContent = tecnico.nombre;
            
            if (select.multiple && seleccionActual.includes(tecnico.id.toString())) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });
        
        if (tecnicosActivos.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No hay tecnicos disponibles";
            option.disabled = true;
            option.style.fontStyle = "italic";
            select.appendChild(option);
        }
        
        if (!select.multiple) {
            if (valorActual) {
                const tecnicoExistente = tecnicosActivos.find(t => t.id.toString() === valorActual.toString());
                if (tecnicoExistente) {
                    select.value = valorActual;
                }
            }
        }
    };
    
    actualizarSelect(selectPrincipal);
    if (selectEditar) actualizarSelect(selectEditar);
}

function actualizarSelectSolicitantes() {
    const selectPrincipal = document.getElementById('solicitante');
    const selectEditar = document.getElementById('editarSolicitante');
    
    const actualizarSelect = (select, valorActual = '') => {
        if (!select) return;
        
        select.innerHTML = '<option value="">Seleccionar solicitante...</option>';
        
        listaSolicitantes.forEach(solicitante => {
            const option = document.createElement('option');
            option.value = solicitante.id;
            option.textContent = solicitante.nombre;
            option.setAttribute('data-departamento', solicitante.departamento);
            if (solicitante.id == valorActual) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    };
    
    actualizarSelect(selectPrincipal);
    actualizarSelect(selectEditar);
    
    const selectPrincipalElement = document.getElementById('solicitante');
    if (selectPrincipalElement) {
        selectPrincipalElement.removeEventListener('change', autocompletarDepartamento);
        selectPrincipalElement.addEventListener('change', autocompletarDepartamento);
    }
    
    const selectEdicionElement = document.getElementById('editarSolicitante');
    if (selectEdicionElement) {
        selectEdicionElement.removeEventListener('change', autocompletarDepartamentoEdicion);
        selectEdicionElement.addEventListener('change', autocompletarDepartamentoEdicion);
    }
}

function autocompletarDepartamento(e) {
    const solicitanteId = e.target.value;
    const ubicacionInput = document.getElementById('ubicacion');
    const departamentoSelect = document.getElementById('departamento');
    
    if (!solicitanteId || solicitanteId === "__nuevo__" || !departamentoSelect) return;
    
    const solicitante = listaSolicitantes.find(s => s.id == solicitanteId);
    if (solicitante) {
        if (solicitante.departamento) {
            departamentoSelect.value = solicitante.departamento;
        }
        
        const ubicacionDepartamento = obtenerUbicacionDepartamento(solicitante.departamento);
        
        if (ubicacionInput) {
            const ubicacionActual = ubicacionInput.value.trim();
            let ubicacionBase = ubicacionDepartamento || '';
            
            if (ubicacionActual === '' || ubicacionActual !== ubicacionBase) {
                ubicacionInput.value = ubicacionBase;
            }
        }
    }
}

function autocompletarDepartamentoEdicion(e) {
    const solicitanteId = e.target.value;
    const ubicacionInput = document.getElementById('editarUbicacion');
    const departamentoSelect = document.getElementById('editarDepartamento');
    
    if (!solicitanteId || solicitanteId === "__nuevo__" || !departamentoSelect) return;
    
    const solicitante = listaSolicitantes.find(s => s.id == solicitanteId);
    if (solicitante) {
        if (solicitante.departamento) {
            departamentoSelect.value = solicitante.departamento;
        }
        
        const ubicacionDepartamento = obtenerUbicacionDepartamento(solicitante.departamento);
        
        if (ubicacionInput) {
            const ubicacionActual = ubicacionInput.value.trim();
            let ubicacionBase = ubicacionDepartamento || '';
            
            if (ubicacionActual === '') {
                ubicacionInput.value = ubicacionBase;
            }
        }
    }
}

window.eliminarDepartamento = async function(id) {
    if (!confirm('¿Estas seguro de eliminar este departamento?')) return;
    
    try {
        const { data: solicitantes, error: checkError } = await db
            .from('solicitantes')
            .select('id')
            .eq('departamento_id', id)
            .limit(1);
        
        if (checkError) throw checkError;
        
        if (solicitantes && solicitantes.length > 0) {
            const { error } = await db
                .from('departamentos')
                .update({ activo: false })
                .eq('id', id);
            
            if (error) throw error;
            
            mostrarMensaje('Departamento desactivado (tiene solicitantes asociados)', 'warning');
        } else {
            const { error } = await db
                .from('departamentos')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            mostrarMensaje('Departamento eliminado correctamente', 'success');
        }
        
        if (typeof cargarDepartamentos === 'function') {
            await cargarDepartamentos(true);
        }
        
        actualizarListasEditable();
        
    } catch (error) {
        console.error('Error eliminando departamento:', error);
        mostrarMensaje('Error al eliminar departamento: ' + error.message, 'error');
    }
};

function actualizarSelectProblemas() {
    const selectNuevo = document.getElementById('descripcion');
    const selectEditar = document.getElementById('editarDescripcion');
    
    const actualizarSelect = (select) => {
        if (!select) return;
        const valorActual = select.value;
        select.innerHTML = '<option value="">Seleccionar problema...</option>';
        
        opcionesProblemas.forEach(problema => {
            const option = document.createElement('option');
            option.value = problema;
            option.textContent = problema;
            select.appendChild(option);
        });
        
        const optionNuevo = document.createElement('option');
        optionNuevo.value = "__nuevo__";
        optionNuevo.textContent = "Agregar nuevo problema...";
        optionNuevo.style.fontStyle = "italic";
        optionNuevo.style.backgroundColor = "#f0f8ff";
        select.appendChild(optionNuevo);
        
        if (valorActual && opcionesProblemas.includes(valorActual)) {
            select.value = valorActual;
        }
    };
    
    actualizarSelect(selectNuevo);
    actualizarSelect(selectEditar);
    
    const selectPrincipal = document.getElementById('descripcion');
    if (selectPrincipal) {
        selectPrincipal.removeEventListener('change', manejarCambioProblema);
        selectPrincipal.addEventListener('change', manejarCambioProblema);
    }
    
    const selectEdicion = document.getElementById('editarDescripcion');
    if (selectEdicion) {
        selectEdicion.removeEventListener('change', manejarCambioProblemaEdicion);
        selectEdicion.addEventListener('change', manejarCambioProblemaEdicion);
    }
}

function manejarCambioProblema(e) {
    if (e.target.value === "__nuevo__") {
        const nuevoProblema = prompt('Ingresa el nuevo problema:', '');
        if (nuevoProblema && nuevoProblema.trim()) {
            agregarNuevaOpcion('problema', nuevoProblema.trim(), true);
            setTimeout(() => {
                actualizarSelectProblemas();
                const select = document.getElementById('descripcion');
                select.value = nuevoProblema.trim();
            }, 100);
        } else {
            e.target.value = '';
        }
    }
}

function manejarCambioProblemaEdicion(e) {
    if (e.target.value === "__nuevo__") {
        const nuevoProblema = prompt('Ingresa el nuevo problema:', '');
        if (nuevoProblema && nuevoProblema.trim()) {
            agregarNuevaOpcion('problema', nuevoProblema.trim(), true);
            setTimeout(() => {
                actualizarSelectProblemas();
                const select = document.getElementById('editarDescripcion');
                select.value = nuevoProblema.trim();
            }, 100);
        } else {
            e.target.value = '';
        }
    }
}

function actualizarSelectDepartamentos() {
    const selectPrincipal = document.getElementById('departamento');
    const selectEditar = document.getElementById('editarDepartamento');
    
    const actualizarSelect = (select, nombreSelect = '') => {
        if (!select) return;
        
        const valorActual = select.value;
        select.innerHTML = '<option value="">Seleccionar departamento...</option>';
        
        if (!listaDepartamentos || listaDepartamentos.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay departamentos disponibles';
            option.disabled = true;
            select.appendChild(option);
            return;
        }
        
        listaDepartamentos.forEach(depto => {
            const option = document.createElement('option');
            option.value = depto.nombre;
            option.textContent = depto.nombre;
            option.setAttribute('data-id', depto.id);
            option.setAttribute('data-ubicacion', depto.ubicacion || '');
            select.appendChild(option);
        });
        
        if (valorActual && opcionesDepartamentos.includes(valorActual)) {
            select.value = valorActual;
        }
    };
    
    actualizarSelect(selectPrincipal, 'principal');
    actualizarSelect(selectEditar, 'edicion');
}

function agregarNuevaOpcion(tipo, valor, mostrarMensajeAlerta = true, departamentoRelacionado = '') {
    if (!valor || !valor.trim()) return false;
    
    const valorNormalizado = valor.trim();
    let agregado = false;
    
    if (validarDuplicado(tipo, valorNormalizado)) {
        if (mostrarMensajeAlerta) {
            const nombreTipo = {
                'problema': 'problema',
                'departamento': 'departamento',
                'solicitante': 'solicitante'
            };
            mostrarMensaje(`El ${nombreTipo[tipo] || tipo} "${valorNormalizado}" ya existe en la lista`, 'warning');
        }
        return false;
    }
    
    if (tipo === 'problema') {
        opcionesProblemas.unshift(valorNormalizado);
        guardarOpciones();
        agregado = true;
        if (mostrarMensajeAlerta) {
            mostrarMensaje(`Problema "${valorNormalizado}" agregado correctamente`, 'success');
        }
    } else if (tipo === 'departamento') {
        opcionesDepartamentos.unshift(valorNormalizado);
        guardarOpciones();
        agregado = true;
        if (mostrarMensajeAlerta) {
            mostrarMensaje(`Departamento "${valorNormalizado}" agregado correctamente`, 'success');
        }
    } else if (tipo === 'solicitante') {
        mostrarMensaje('Los solicitantes deben agregarse desde el modal de gestion', 'warning');
    }
    
    if (agregado) {
        if (tipo === 'problema') {
            actualizarSelectProblemas();
        } else if (tipo === 'departamento') {
            actualizarSelectDepartamentos();
        }
        
        if (typeof actualizarListasEditable === 'function') {
            actualizarListasEditable();
        }
    }
    
    return agregado;
}

window.eliminarSolicitanteDesdeModal = async function(id) {
    if (!confirm('¿Estas seguro de eliminar este solicitante?')) return;
    
    const resultado = await eliminarSolicitante(id);
    mostrarMensaje(resultado.mensaje, resultado.exito ? 'success' : 'error');
    
    if (resultado.exito) {
        actualizarListasEditable();
    }
};

// ========== FUNCION PRINCIPAL ==========
async function initApp() {
    const usuarioGuardado = localStorage.getItem('usuarioActual');
    if (!usuarioGuardado) {
        window.location.reload();
        return;
    }
    
    try {
        usuarioActual = JSON.parse(usuarioGuardado);
        if (!usuarioActual.permisos) {
            usuarioActual.permisos = obtenerPermisosPorRol(usuarioActual.rol);
        }
        
        try {
            const { data: usuarioActualizado, error } = await db
                .from('usuarios')
                .select('*')
                .eq('id', usuarioActual.id)
                .single();
            
            if (!error && usuarioActualizado) {
                usuarioActual = {
                    ...usuarioActual,
                    telefono: usuarioActualizado.telefono,
                    fecha_nacimiento: usuarioActualizado.fecha_nacimiento,
                    foto_perfil: usuarioActualizado.foto_perfil
                };
                localStorage.setItem('usuarioActual', JSON.stringify(usuarioActual));
            }
        } catch (e) {
            console.log('No se pudieron cargar datos actualizados:', e);
        }
        
        setTimeout(() => {
            actualizarFotoEnHeader();
        }, 100);
        
    } catch (error) {
        console.error('Error en initApp:', error);
        window.location.reload();
        return;
    }
    
    if (db) {
        await testConexion();
        await cargarTecnicos();
        
        await cargarDepartamentos(true);
        await cargarSolicitantes();
		
		 await cargarTecnicosFiltro();
        await cargarSolicitantesFiltro();
    }
    
    cargarOpcionesAlmacenadas();
    limpiarInterfaz();
    configurarApp();
    configurarInterfazPorRol();
    configurarTogglePassword();
    
    if (tienePermiso('gestion_usuarios')) {
        setTimeout(() => {
            cargarUsuariosParaGestion();
        }, 1000);
    }
}

// ========== EDICION DE USUARIOS ==========
window.editarUsuario = async function(id) {
    try {
        const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual') || '{}');
        if (usuarioActual.rol !== 'admin') {
            mostrarMensaje('Solo los administradores pueden editar usuarios', 'error');
            return;
        }

        const { data: usuario, error } = await db
            .from('usuarios')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        document.getElementById('editUsuarioId').value = usuario.id;
        document.getElementById('editUsuarioUsuario').value = usuario.usuario || '';
        document.getElementById('editUsuarioNombre').value = usuario.nombre || '';
        document.getElementById('editUsuarioEmail').value = usuario.email || '';
        
        if (usuario.telefono) {
            document.getElementById('editUsuarioTelefono').value = usuario.telefono;
        } else {
            document.getElementById('editUsuarioTelefono').value = '';
        }
        
        if (usuario.fecha_nacimiento) {
            const fecha = new Date(usuario.fecha_nacimiento);
            const año = fecha.getFullYear();
            const mes = String(fecha.getMonth() + 1).padStart(2, '0');
            const dia = String(fecha.getDate()).padStart(2, '0');
            document.getElementById('editUsuarioFechaNacimiento').value = `${año}-${mes}-${dia}`;
        } else {
            document.getElementById('editUsuarioFechaNacimiento').value = '';
        }
        
        document.getElementById('editUsuarioRol').value = usuario.rol || 'tecnico';
        document.getElementById('editUsuarioActivo').checked = usuario.activo === true;
        
        document.getElementById('editUsuarioNuevaContrasena').value = '';
        document.getElementById('editUsuarioConfirmarContrasena').value = '';
        document.getElementById('passwordStrengthEdit').style.width = '0%';
        document.getElementById('passwordStrengthEdit').className = 'progress-bar';
        
        if (id === usuarioActual.id) {
            document.getElementById('editUsuarioRol').disabled = true;
            document.getElementById('editUsuarioActivo').disabled = true;
            mostrarMensaje('No puedes cambiar tu propio rol o estado', 'warning');
        } else {
            document.getElementById('editUsuarioRol').disabled = false;
            document.getElementById('editUsuarioActivo').disabled = false;
        }
        
        new bootstrap.Modal(document.getElementById('modalEditarUsuario')).show();
        
    } catch (error) {
        console.error('Error cargando usuario:', error);
        mostrarMensaje('Error al cargar datos del usuario', 'error');
    }
};

window.guardarEdicionUsuario = async function() {
    try {
        const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual') || '{}');
        if (usuarioActual.rol !== 'admin') {
            mostrarMensaje('Solo los administradores pueden editar usuarios', 'error');
            return;
        }
        
        const id = document.getElementById('editUsuarioId').value;
        const usuario = document.getElementById('editUsuarioUsuario').value.trim();
        const nombre = document.getElementById('editUsuarioNombre').value.trim();
        const email = document.getElementById('editUsuarioEmail').value.trim();
        const telefono = document.getElementById('editUsuarioTelefono').value.trim();
        const fechaNacimiento = document.getElementById('editUsuarioFechaNacimiento').value;
        const rol = document.getElementById('editUsuarioRol').value;
        const activo = document.getElementById('editUsuarioActivo').checked;
        
        if (!usuario || !nombre) {
            mostrarMensaje('Usuario y nombre son requeridos', 'error');
            return;
        }
        
        const usuarioRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usuarioRegex.test(usuario)) {
            mostrarMensaje('Usuario invalido. Use solo letras, numeros y guiones bajos (3-20 caracteres)', 'error');
            return;
        }
        
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                mostrarMensaje('Correo electronico invalido', 'error');
                return;
            }
        }
        
        if (telefono && !/^[0-9]{10}$/.test(telefono)) {
            mostrarMensaje('El telefono debe tener 10 digitos numericos', 'error');
            return;
        }
        
        const { data: usuarioExistente } = await db
            .from('usuarios')
            .select('id')
            .eq('usuario', usuario)
            .neq('id', id)
            .maybeSingle();
        
        if (usuarioExistente) {
            mostrarMensaje('El nombre de usuario ya esta en uso', 'error');
            return;
        }
        
        if (email) {
            const { data: emailExistente } = await db
                .from('usuarios')
                .select('id')
                .eq('email', email)
                .neq('id', id)
                .maybeSingle();
            
            if (emailExistente) {
                mostrarMensaje('El correo electronico ya esta registrado', 'error');
                return;
            }
        }
        
        const datosActualizados = {
            usuario: usuario,
            nombre: nombre,
            email: email || null,
            telefono: telefono || null,
            fecha_nacimiento: fechaNacimiento || null,
            rol: rol,
            activo: activo
        };
        
        const nuevaContrasena = document.getElementById('editUsuarioNuevaContrasena').value;
        const confirmarContrasena = document.getElementById('editUsuarioConfirmarContrasena').value;
        
        if (nuevaContrasena || confirmarContrasena) {
            if (nuevaContrasena.length < 6) {
                mostrarMensaje('La nueva contrasena debe tener al menos 6 caracteres', 'error');
                return;
            }
            
            if (nuevaContrasena !== confirmarContrasena) {
                mostrarMensaje('Las contrasenas no coinciden', 'error');
                return;
            }
            
            datosActualizados.contrasena_hash = nuevaContrasena;
        }
        
        const btnGuardar = document.querySelector('#modalEditarUsuario .btn-primary');
        const originalText = btnGuardar.innerHTML;
        btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';
        btnGuardar.disabled = true;
        
        const { error } = await db
            .from('usuarios')
            .update(datosActualizados)
            .eq('id', id);
        
        if (error) throw error;
        
        mostrarMensaje('Usuario actualizado exitosamente', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarUsuario'));
        modal.hide();
        
        await cargarUsuariosParaGestion();
        
        if (id == usuarioActual.id) {
            const { data: usuarioActualizado } = await db
                .from('usuarios')
                .select('*')
                .eq('id', id)
                .single();
            
            if (usuarioActualizado) {
                usuarioActualizado.permisos = obtenerPermisosPorRol(usuarioActualizado.rol);
                localStorage.setItem('usuarioActual', JSON.stringify(usuarioActualizado));
                
                document.getElementById('nombreUsuario').textContent = usuarioActualizado.nombre;
                
                if (usuarioActualizado.rol !== usuarioActual.rol) {
                    mostrarMensaje('Rol cambiado. La aplicacion se recargara...', 'info');
                    setTimeout(() => window.location.reload(), 2000);
                }
            }
        }
        
        if (rol === 'tecnico' || datosActualizados.rol === 'tecnico') {
            await cargarTecnicos();
        }
        
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        mostrarMensaje('Error al actualizar usuario: ' + error.message, 'error');
    } finally {
        const btnGuardar = document.querySelector('#modalEditarUsuario .btn-primary');
        btnGuardar.innerHTML = '<i class="bi bi-save"></i> Guardar Cambios';
        btnGuardar.disabled = false;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    const toggleEditNueva = document.getElementById('togglePasswordEditNueva');
    if (toggleEditNueva) {
        toggleEditNueva.addEventListener('click', function() {
            const input = document.getElementById('editUsuarioNuevaContrasena');
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.querySelector('i').className = type === 'text' ? 'bi bi-eye-slash' : 'bi bi-eye';
        });
    }
    
    const toggleEditConfirmar = document.getElementById('togglePasswordEditConfirmar');
    if (toggleEditConfirmar) {
        toggleEditConfirmar.addEventListener('click', function() {
            const input = document.getElementById('editUsuarioConfirmarContrasena');
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.querySelector('i').className = type === 'text' ? 'bi bi-eye-slash' : 'bi bi-eye';
        });
    }
    
    const editNuevaContrasena = document.getElementById('editUsuarioNuevaContrasena');
    if (editNuevaContrasena) {
        editNuevaContrasena.addEventListener('input', function() {
            const password = this.value;
            const strengthBar = document.getElementById('passwordStrengthEdit');
            let strength = 0;
            
            if (password.length >= 6) strength += 25;
            if (password.match(/[a-z]/)) strength += 25;
            if (password.match(/[A-Z]/)) strength += 25;
            if (password.match(/[0-9!@#$%^&*]/)) strength += 25;
            
            strengthBar.style.width = strength + '%';
            
            if (strength <= 25) {
                strengthBar.className = 'progress-bar bg-danger';
            } else if (strength <= 50) {
                strengthBar.className = 'progress-bar bg-warning';
            } else if (strength <= 75) {
                strengthBar.className = 'progress-bar bg-info';
            } else {
                strengthBar.className = 'progress-bar bg-success';
            }
        });
    }
});

function limpiarInterfaz() {
    const formActividad = document.getElementById('formActividad');
    if (formActividad) {
        const newForm = formActividad.cloneNode(true);
        formActividad.parentNode.replaceChild(newForm, formActividad);
    }
    
    const filtrosHeader = document.querySelector('#filtrosUsuarioNormal .section-header h3');
    if (filtrosHeader) {
        filtrosHeader.innerHTML = '<i class="bi bi-funnel me-2 text-primary"></i> Filtros de Actividades';
    }
}

function configurarInterfazPorRol() {
    console.log('Rol actual:', usuarioActual.rol);

    const nombreUsuario = document.getElementById('nombreUsuario');
    if (nombreUsuario) nombreUsuario.textContent = usuarioActual.nombre;
    
    const btnExportarExcel = document.getElementById('btnExportarExcel');
    if (btnExportarExcel) btnExportarExcel.style.display = tienePermiso('exportar') ? '' : 'none';
    
    const panelEstadisticasElement = document.getElementById('panelEstadisticas');
    if (panelEstadisticasElement) panelEstadisticasElement.style.display = tienePermiso('estadisticas') ? '' : 'none';
    
    const btnGestionOpciones = document.getElementById('btnGestionOpciones');
    if (btnGestionOpciones) btnGestionOpciones.style.display = tienePermiso('gestion_opciones') ? '' : 'none';
    
    const btnGestionUsuarios = document.getElementById('btnGestionUsuarios');
    if (btnGestionUsuarios) {
        btnGestionUsuarios.style.display = (usuarioActual.rol === 'admin') ? '' : 'none';
    }

    const filtrosUsuarioNormal = document.getElementById('filtrosUsuarioNormal');
    const filtrosAdmin = document.getElementById('filtrosAdmin');
    
    if (usuarioActual.rol === 'admin') {
        if (filtrosUsuarioNormal) {
            filtrosUsuarioNormal.style.display = 'none';
        }
        if (filtrosAdmin) {
            filtrosAdmin.style.display = 'block';
        }
        sincronizarFiltrosAdmin();
    } else {
        if (filtrosUsuarioNormal) {
            filtrosUsuarioNormal.style.display = 'block';
        }
        if (filtrosAdmin) {
            filtrosAdmin.style.display = 'none';
        }
        configurarFiltrosNormales();
    }
}

function reiniciarFiltros() {
    const filtrosNormales = [
        { id: 'filtroFechaDesde', value: '' },
        { id: 'filtroFechaHasta', value: '' },
        { id: 'filtroPeriodo', value: 'todos' },
        { id: 'filtroEstado', value: 'todos' }
    ];
    
    filtrosNormales.forEach(filtro => {
        const elemento = document.getElementById(filtro.id);
        if (elemento) elemento.value = filtro.value;
    });
    
    const filtrosAdmin = [
        { id: 'filtroFechaDesdeAdmin', value: '' },
        { id: 'filtroFechaHastaAdmin', value: '' },
        { id: 'filtroPeriodoAdmin', value: 'todos' },
        { id: 'filtroEstadoAdmin', value: 'todos' }
    ];
    
    filtrosAdmin.forEach(filtro => {
        const elemento = document.getElementById(filtro.id);
        if (elemento) elemento.value = filtro.value;
    });
}

function configurarFiltrosNormales() {
    const filtros = [
        { id: 'filtroFechaDesde', evento: 'change' },
        { id: 'filtroFechaHasta', evento: 'change' },
        { id: 'filtroPeriodo', evento: 'change' },
        { id: 'filtroEstado', evento: 'change' },
        { id: 'filtroTecnico', evento: 'change' },
        { id: 'filtroSolicitante', evento: 'change' }
    ];
    
    filtros.forEach(({id, evento}) => {
        const elemento = document.getElementById(id);
        if (elemento) {
            const nuevoElemento = elemento.cloneNode(true);
            elemento.parentNode.replaceChild(nuevoElemento, elemento);
            nuevoElemento.addEventListener(evento, aplicarFiltros);
        }
    });
    
    const btnLimpiar = document.getElementById('btnLimpiarFiltros');
    if (btnLimpiar) {
        const nuevoBtn = btnLimpiar.cloneNode(true);
        btnLimpiar.parentNode.replaceChild(nuevoBtn, btnLimpiar);
        nuevoBtn.addEventListener('click', limpiarFiltros);
    }
}

// Función actualizada: sincronizarFiltrosAdmin
function sincronizarFiltrosAdmin() {
    const periodoAdmin = document.getElementById('filtroPeriodoAdmin');
    const estadoAdmin = document.getElementById('filtroEstadoAdmin');
    const fechaDesdeAdmin = document.getElementById('filtroFechaDesdeAdmin');
    const fechaHastaAdmin = document.getElementById('filtroFechaHastaAdmin');
    const tecnicoAdmin = document.getElementById('filtroTecnicoAdmin');
    const solicitanteAdmin = document.getElementById('filtroSolicitanteAdmin');
    const btnLimpiarAdmin = document.getElementById('btnLimpiarFiltrosAdmin');
    
    if (periodoAdmin) {
        periodoAdmin.addEventListener('change', function() {
            const periodoNormal = document.getElementById('filtroPeriodo');
            if (periodoNormal) periodoNormal.value = this.value;
            aplicarFiltros();
        });
    }
    
    if (estadoAdmin) {
        estadoAdmin.addEventListener('change', function() {
            const estadoNormal = document.getElementById('filtroEstado');
            if (estadoNormal) estadoNormal.value = this.value;
            aplicarFiltros();
        });
    }
    
    if (fechaDesdeAdmin) {
        fechaDesdeAdmin.addEventListener('change', function() {
            const fechaNormal = document.getElementById('filtroFechaDesde');
            if (fechaNormal) fechaNormal.value = this.value;
            aplicarFiltros();
        });
    }
    
    if (fechaHastaAdmin) {
        fechaHastaAdmin.addEventListener('change', function() {
            const fechaNormal = document.getElementById('filtroFechaHasta');
            if (fechaNormal) fechaNormal.value = this.value;
            aplicarFiltros();
        });
    }
    
    if (tecnicoAdmin) {
        tecnicoAdmin.addEventListener('change', function() {
            const tecnicoNormal = document.getElementById('filtroTecnico');
            if (tecnicoNormal) tecnicoNormal.value = this.value;
            aplicarFiltros();
        });
    }
    
    if (solicitanteAdmin) {
        solicitanteAdmin.addEventListener('change', function() {
            const solicitanteNormal = document.getElementById('filtroSolicitante');
            if (solicitanteNormal) solicitanteNormal.value = this.value;
            aplicarFiltros();
        });
    }
    
    if (btnLimpiarAdmin) {
        btnLimpiarAdmin.addEventListener('click', limpiarFiltros);
    }
    
    sincronizarValoresFiltrosAdmin();
}

// Función actualizada: sincronizarValoresFiltrosAdmin
function sincronizarValoresFiltrosAdmin() {
    const periodoNormal = document.getElementById('filtroPeriodo');
    const estadoNormal = document.getElementById('filtroEstado');
    const fechaDesdeNormal = document.getElementById('filtroFechaDesde');
    const fechaHastaNormal = document.getElementById('filtroFechaHasta');
    const tecnicoNormal = document.getElementById('filtroTecnico');
    const solicitanteNormal = document.getElementById('filtroSolicitante');
    
    const periodoAdmin = document.getElementById('filtroPeriodoAdmin');
    const estadoAdmin = document.getElementById('filtroEstadoAdmin');
    const fechaDesdeAdmin = document.getElementById('filtroFechaDesdeAdmin');
    const fechaHastaAdmin = document.getElementById('filtroFechaHastaAdmin');
    const tecnicoAdmin = document.getElementById('filtroTecnicoAdmin');
    const solicitanteAdmin = document.getElementById('filtroSolicitanteAdmin');
    
    if (periodoAdmin && periodoNormal) periodoAdmin.value = periodoNormal.value;
    if (estadoAdmin && estadoNormal) estadoAdmin.value = estadoNormal.value;
    if (fechaDesdeAdmin && fechaDesdeNormal) fechaDesdeAdmin.value = fechaDesdeNormal.value;
    if (fechaHastaAdmin && fechaHastaNormal) fechaHastaAdmin.value = fechaHastaNormal.value;
    if (tecnicoAdmin && tecnicoNormal) tecnicoAdmin.value = tecnicoNormal.value;
    if (solicitanteAdmin && solicitanteNormal) solicitanteAdmin.value = solicitanteNormal.value;
}


// ========== FUNCIONES DE CONFIGURACION ==========
async function testConexion() {
    try {
        const { error } = await db.from('actividades').select('count', { count: 'exact', head: true });
        if (error) throw error;
    } catch (error) {
        mostrarMensaje('Error conectando a la base de datos: ' + error.message, 'error');
    }
}

function cargarOpcionesAlmacenadas() {
    try {
        const problemasGuardados = localStorage.getItem('opcionesProblemas');
        const departamentosGuardados = localStorage.getItem('opcionesDepartamentos');
        const solicitantesGuardados = localStorage.getItem('opcionesSolicitantes');
        
        if (problemasGuardados) opcionesProblemas = JSON.parse(problemasGuardados);
        if (departamentosGuardados) opcionesDepartamentos = JSON.parse(departamentosGuardados);
        if (solicitantesGuardados) opcionesSolicitantes = JSON.parse(solicitantesGuardados);
    } catch (error) {
        console.error('Error cargando opciones almacenadas:', error);
    }
}

function guardarOpciones() {
    try {
        localStorage.setItem('opcionesProblemas', JSON.stringify(opcionesProblemas));
        localStorage.setItem('opcionesDepartamentos', JSON.stringify(opcionesDepartamentos));
        localStorage.setItem('opcionesSolicitantes', JSON.stringify(opcionesSolicitantes));
    } catch (error) {
        console.error('Error guardando opciones:', error);
    }
}

function configurarApp() {
    const loading = document.getElementById('loading');function configurarFiltrosNormales() {
    const filtros = [
        { id: 'filtroFechaDesde', evento: 'change' },
        { id: 'filtroFechaHasta', evento: 'change' },
        { id: 'filtroPeriodo', evento: 'change' },
        { id: 'filtroEstado', evento: 'change' }
    ];
    
    filtros.forEach(({id, evento}) => {
        const elemento = document.getElementById(id);
        if (elemento) {
            const nuevoElemento = elemento.cloneNode(true);
            elemento.parentNode.replaceChild(nuevoElemento, elemento);
            nuevoElemento.addEventListener(evento, aplicarFiltros);
        }
    });
    
    const btnLimpiar = document.getElementById('btnLimpiarFiltros');
    if (btnLimpiar) {
        const nuevoBtn = btnLimpiar.cloneNode(true);
        btnLimpiar.parentNode.replaceChild(nuevoBtn, btnLimpiar);
        nuevoBtn.addEventListener('click', limpiarFiltros);
    }
}

function sincronizarFiltrosAdmin() {
    const periodoAdmin = document.getElementById('filtroPeriodoAdmin');
    const estadoAdmin = document.getElementById('filtroEstadoAdmin');
    const fechaDesdeAdmin = document.getElementById('filtroFechaDesdeAdmin');
    const fechaHastaAdmin = document.getElementById('filtroFechaHastaAdmin');
    const btnLimpiarAdmin = document.getElementById('btnLimpiarFiltrosAdmin');
    
    if (periodoAdmin) {
        periodoAdmin.addEventListener('change', function() {
            const periodoNormal = document.getElementById('filtroPeriodo');
            if (periodoNormal) periodoNormal.value = this.value;
            aplicarFiltros();
        });
    }
    
    if (estadoAdmin) {
        estadoAdmin.addEventListener('change', function() {
            const estadoNormal = document.getElementById('filtroEstado');
            if (estadoNormal) estadoNormal.value = this.value;
            aplicarFiltros();
        });
    }
    
    if (fechaDesdeAdmin) {
        fechaDesdeAdmin.addEventListener('change', function() {
            const fechaNormal = document.getElementById('filtroFechaDesde');
            if (fechaNormal) fechaNormal.value = this.value;
            aplicarFiltros();
        });
    }
    
    if (fechaHastaAdmin) {
        fechaHastaAdmin.addEventListener('change', function() {
            const fechaNormal = document.getElementById('filtroFechaHasta');
            if (fechaNormal) fechaNormal.value = this.value;
            aplicarFiltros();
        });
    }
    
    if (btnLimpiarAdmin) {
        btnLimpiarAdmin.addEventListener('click', limpiarFiltros);
    }
    
    sincronizarValoresFiltrosAdmin();
}

function sincronizarValoresFiltrosAdmin() {
    const periodoNormal = document.getElementById('filtroPeriodo');
    const estadoNormal = document.getElementById('filtroEstado');
    const fechaDesdeNormal = document.getElementById('filtroFechaDesde');
    const fechaHastaNormal = document.getElementById('filtroFechaHasta');
    
    const periodoAdmin = document.getElementById('filtroPeriodoAdmin');
    const estadoAdmin = document.getElementById('filtroEstadoAdmin');
    const fechaDesdeAdmin = document.getElementById('filtroFechaDesdeAdmin');
    const fechaHastaAdmin = document.getElementById('filtroFechaHastaAdmin');
    
    if (periodoAdmin && periodoNormal) periodoAdmin.value = periodoNormal.value;
    if (estadoAdmin && estadoNormal) estadoAdmin.value = estadoNormal.value;
    if (fechaDesdeAdmin && fechaDesdeNormal) fechaDesdeAdmin.value = fechaDesdeNormal.value;
    if (fechaHastaAdmin && fechaHastaNormal) fechaHastaAdmin.value = fechaHastaNormal.value;
}
    if (loading) loading.classList.add('d-none');
    
    configurarFormulario();
    
    setTimeout(() => {
        configurarFiltros();
    }, 100);
    
    configurarModalEdicion();
    configurarModalNuevoProblema();
    configurarModalNuevoSolicitante();
    configurarBotonExportar();
    establecerFechasPorDefecto();
    
    if (document.getElementById('fechaHora')) establecerFechaHoraActual();
    
    cargarActividades();
}

function configurarTogglePassword() {
    document.querySelectorAll('button[id^="togglePassword"]').forEach(button => {
        button.removeEventListener('click', handleTogglePassword);
        button.addEventListener('click', handleTogglePassword);
    });
}

function handleTogglePassword(event) {
    const button = event.currentTarget;
    const input = button.previousElementSibling;
    
    if (input && input.tagName === 'INPUT') {
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        const icon = button.querySelector('i');
        if (type === 'text') {
            icon.className = 'bi bi-eye-slash';
        } else {
            icon.className = 'bi bi-eye';
        }
    }
}

function configurarFormulario() {
    const form = document.getElementById('formActividad');
    if (!form) return;
    
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    const newFormElement = document.getElementById('formActividad');
    
    async function handleSubmit(e) {
        e.preventDefault();
        
        const btn = document.getElementById('btnGuardar');
        if (!btn) return;
        
        const originalText = btn.innerHTML;
        
        try {
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';
            btn.disabled = true;
            
            const inputFechaHora = document.getElementById('fechaHora');
            const descripcionSelect = document.getElementById('descripcion');
            const tecnicoSelect = document.getElementById('tecnico');
            const solicitanteSelect = document.getElementById('solicitante');
            const prioridadSelect = document.getElementById('prioridad');
            const ubicacionInput = document.getElementById('ubicacion');
            const departamentoSelect = document.getElementById('departamento');
            const notasInicialesTextarea = document.getElementById('notasIniciales');
            
            if (!descripcionSelect || !tecnicoSelect || !solicitanteSelect || !prioridadSelect) {
                throw new Error('Elementos del formulario no encontrados');
            }
            
            const descripcionValor = descripcionSelect.value;
            if (descripcionValor === "__nuevo__" || !descripcionValor) {
                throw new Error('Por favor selecciona un problema de la lista');
            }
            
            let tecnicosIds = [];
            let tecnicosNombres = [];

            if (tecnicoSelect.selectedOptions) {
                tecnicosIds = Array.from(tecnicoSelect.selectedOptions).map(opt => opt.value);
                tecnicosNombres = Array.from(tecnicoSelect.selectedOptions).map(opt => opt.text);
            } else {
                tecnicosIds = tecnicoSelect.value ? [tecnicoSelect.value] : [];
                if (tecnicosIds[0]) {
                    const tecnico = listaTecnicos.find(t => t.id.toString() === tecnicosIds[0]);
                    if (tecnico) tecnicosNombres = [tecnico.nombre];
                }
            }

            if (tecnicosIds.length === 0) {
                throw new Error('Por favor selecciona al menos un tecnico');
            }

            const tecnicosTexto = tecnicosNombres.join(', ');
            
            const solicitanteId = solicitanteSelect.value;
            let solicitanteNombre = '';
            
            if (solicitanteId === "__nuevo__") {
                throw new Error('Por favor selecciona un solicitante valido o agregalo correctamente');
            } else if (solicitanteId) {
                const solicitante = listaSolicitantes.find(s => s.id == solicitanteId);
                solicitanteNombre = solicitante ? solicitante.nombre : '';
            }
            
            if (!solicitanteNombre) {
                throw new Error('Por favor selecciona un solicitante');
            }
            
            let fechaCreacion;
            if (inputFechaHora && inputFechaHora.value) {
                const fechaLocal = new Date(inputFechaHora.value);
                fechaCreacion = new Date(Date.UTC(
                    fechaLocal.getFullYear(),
                    fechaLocal.getMonth(),
                    fechaLocal.getDate(),
                    fechaLocal.getHours(),
                    fechaLocal.getMinutes(),
                    fechaLocal.getSeconds()
                )).toISOString();
            } else {
                fechaCreacion = new Date().toISOString();
            }

		const nuevaActividad = {
           descripcion: descripcionValor.trim(),
	 	   tecnico: tecnicosTexto,
		   tecnico_id: tecnicosIds[0] || null,
           tecnicos_inicio: tecnicosTexto,
           tecnicos_inicio_ids: tecnicosIds.join(','),
           tecnicos_termino: null,
           tecnicos_termino_ids: null,
		   solicitante_id: solicitanteId,
           solicitante: solicitanteNombre,
           prioridad: prioridadSelect.value,
           ubicacion: ubicacionInput?.value.trim() || '',
           departamento: departamentoSelect?.value.trim() || '',
           notas_iniciales: notasInicialesTextarea?.value.trim() || '',
           estado: 'pendiente',
		   creado_en: fechaCreacion,
           notas: '',
           creado_por: usuarioActual.id
        };
            
            if (!nuevaActividad.descripcion) {
                throw new Error('Descripcion es requerida');
            }
            
            if (nuevaActividad.departamento) {
                const departamentoNormalizado = nuevaActividad.departamento.toLowerCase();
                const existeDepartamento = opcionesDepartamentos.some(d => 
                    d.toLowerCase() === departamentoNormalizado
                );
                
                if (!existeDepartamento) {
                    agregarNuevaOpcion('departamento', nuevaActividad.departamento, false);
                }
            }
            
            const { error } = await db.from('actividades').insert([nuevaActividad]).select();
            if (error) throw error;
            
            mostrarMensaje('Actividad creada exitosamente!', 'success');
            document.getElementById('formActividad').reset();
            
            if (prioridadSelect) prioridadSelect.value = 'normal';
            if (tecnicoSelect) {
                Array.from(tecnicoSelect.options).forEach(opt => opt.selected = false);
            }
            if (solicitanteSelect) solicitanteSelect.value = '';
            if (descripcionSelect) descripcionSelect.focus();
            
            establecerFechaHoraActual();
            
            await cargarActividades();
            
        } catch (error) {
            mostrarMensaje('Error: ' + error.message, 'error');
        } finally {
            const btnActual = document.getElementById('btnGuardar');
            if (btnActual) {
                btnActual.innerHTML = originalText;
                btnActual.disabled = false;
            }
        }
    }
    
    newFormElement.addEventListener('submit', handleSubmit);
    actualizarSelectProblemas();
    actualizarSelectDepartamentos();
    actualizarSelectSolicitantes();
}

function configurarModalNuevoSolicitante() {
    const modal = document.getElementById('modalAgregarSolicitante');
    if (!modal) return;
    
    const btnGuardar = document.getElementById('btnGuardarNuevoSolicitante');
    const inputNuevo = document.getElementById('inputNuevoSolicitanteModal');
    
    if (btnGuardar) {
        btnGuardar.addEventListener('click', function() {
            const nuevoSolicitante = inputNuevo.value.trim();
            if (!nuevoSolicitante) {
                mostrarMensaje('Por favor escribe un nombre de solicitante', 'error');
                return;
            }
            
            agregarNuevaOpcion('solicitante', nuevoSolicitante, true);
            actualizarSelectSolicitantes();
            
            const modalInstance = bootstrap.Modal.getInstance(modal);
            modalInstance.hide();
            inputNuevo.value = '';
            
            setTimeout(() => {
                const selectNuevo = document.getElementById('solicitante');
                const selectEditar = document.getElementById('editarSolicitante');
                if (selectNuevo) selectNuevo.value = nuevoSolicitante;
                if (selectEditar) selectEditar.value = nuevoSolicitante;
            }, 100);
        });
    }
    
    modal.addEventListener('hidden.bs.modal', function() {
        inputNuevo.value = '';
    });
    
    inputNuevo.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnGuardar.click();
        }
    });
}

function configurarModalNuevoProblema() {
    const modal = document.getElementById('modalAgregarProblema');
    if (!modal) return;
    
    const btnGuardar = document.getElementById('btnGuardarNuevoProblema');
    const inputNuevo = document.getElementById('inputNuevoProblemaModal');
    
    if (btnGuardar) {
        btnGuardar.addEventListener('click', function() {
            const nuevoProblema = inputNuevo.value.trim();
            if (!nuevoProblema) {
                mostrarMensaje('Por favor escribe un problema', 'error');
                return;
            }
            
            agregarNuevaOpcion('problema', nuevoProblema, true);
            actualizarSelectProblemas();
            
            const modalInstance = bootstrap.Modal.getInstance(modal);
            modalInstance.hide();
            inputNuevo.value = '';
            
            setTimeout(() => {
                const selectNuevo = document.getElementById('descripcion');
                const selectEditar = document.getElementById('editarDescripcion');
                if (selectNuevo) selectNuevo.value = nuevoProblema;
                if (selectEditar) selectEditar.value = nuevoProblema;
            }, 100);
        });
    }
    
    modal.addEventListener('hidden.bs.modal', function() {
        inputNuevo.value = '';
    });
    
    inputNuevo.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnGuardar.click();
        }
    });
}

function mostrarMensaje(texto, tipo = 'info') {
    const tipos = {
        success: { class: 'alert-success', icon: 'bi-check-circle' },
        error: { class: 'alert-danger', icon: 'bi-exclamation-triangle' },
        info: { class: 'alert-info', icon: 'bi-info-circle' },
        warning: { class: 'alert-warning', icon: 'bi-exclamation-triangle' }
    };
    
    const tipoValido = tipos[tipo] ? tipo : 'info';
    
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = `alert ${tipos[tipoValido].class} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    mensajeDiv.style.zIndex = '9999';
    mensajeDiv.innerHTML = `
        <i class="bi ${tipos[tipoValido].icon} me-2"></i> ${texto}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(mensajeDiv);
    
    setTimeout(() => {
        if (mensajeDiv.parentNode) mensajeDiv.remove();
    }, 5000);
}

function validarDuplicado(tipo, valor, idIgnorar = null) {
    if (!valor) return false;
    
    valor = valor.trim().toLowerCase();
    
    if (tipo === 'problema') {
        return Array.isArray(opcionesProblemas) && 
               opcionesProblemas.some(p => p && p.toLowerCase() === valor);
    } else if (tipo === 'departamento') {
        return Array.isArray(opcionesDepartamentos) && 
               opcionesDepartamentos.some(d => d && d.toLowerCase() === valor);
    } else if (tipo === 'solicitante') {
        return Array.isArray(listaSolicitantes) && 
               listaSolicitantes.some(s => 
                   s && s.nombre && s.nombre.toLowerCase() === valor && 
                   s.activo === true && 
                   (idIgnorar ? s.id !== idIgnorar : true)
               );
    }
    return false;
}

window.editarSolicitante = function(id) {
    const solicitante = listaSolicitantes.find(s => s.id === id);
    if (!solicitante) {
        mostrarMensaje('Solicitante no encontrado', 'error');
        return;
    }
    
    document.getElementById('editSolicitanteId').value = solicitante.id;
    document.getElementById('editSolicitanteNombre').value = solicitante.nombre || '';
    document.getElementById('editSolicitantePuesto').value = solicitante.puesto || '';
    document.getElementById('editSolicitanteTelefono').value = solicitante.telefono || '';
    
    const selectDepto = document.getElementById('editSolicitanteDepartamento');
    if (selectDepto) {
        selectDepto.innerHTML = '<option value="">Seleccionar departamento...</option>';
        
        opcionesDepartamentos.forEach(departamento => {
            const option = document.createElement('option');
            option.value = departamento;
            option.textContent = departamento;
            if (solicitante.departamento === departamento) {
                option.selected = true;
            }
            selectDepto.appendChild(option);
        });
    }
    
    new bootstrap.Modal(document.getElementById('modalEditarSolicitante')).show();
};

window.guardarEdicionSolicitante = async function() {
    const id = document.getElementById('editSolicitanteId').value;
    const nombre = document.getElementById('editSolicitanteNombre').value.trim();
    const puesto = document.getElementById('editSolicitantePuesto').value.trim();
    const departamento = document.getElementById('editSolicitanteDepartamento').value;
    const telefono = document.getElementById('editSolicitanteTelefono').value.trim();
    
    if (!nombre) {
        mostrarMensaje('El nombre del solicitante es requerido', 'error');
        return;
    }
    if (!puesto) {
        mostrarMensaje('El puesto del solicitante es requerido', 'error');
        return;
    }
    if (!departamento) {
        mostrarMensaje('Debes seleccionar un departamento', 'error');
        return;
    }
    
    if (telefono) {
        const telefonoRegex = /^[0-9]{10}$/;
        if (!telefonoRegex.test(telefono)) {
            mostrarMensaje('El telefono debe tener 10 digitos numericos', 'error');
            return;
        }
    }
    
    try {
        const nombreExiste = listaSolicitantes.some(s => 
            s.id != id && s.nombre && s.nombre.toLowerCase() === nombre.toLowerCase() && s.activo === true
        );
        
        if (nombreExiste) {
            mostrarMensaje('Ya existe un solicitante activo con el nombre "' + nombre + '"', 'error');
            return;
        }
        
        const { error } = await db
            .from('solicitantes')
            .update({ 
                nombre: nombre,
                puesto: puesto,
                departamento: departamento,
                telefono: telefono || null
            })
            .eq('id', id);
        
        if (error) throw error;
        
        mostrarMensaje('Solicitante actualizado exitosamente', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modalEditarSolicitante')).hide();
        await cargarSolicitantes();
        actualizarListasEditable();
        
    } catch (error) {
        console.error('Error actualizando solicitante:', error);
        mostrarMensaje('Error al actualizar solicitante: ' + error.message, 'error');
    }
};

// ========== FUNCIONES DE FILTROS ==========
function configurarFiltros() {
    const filtros = [
        { id: 'filtroFechaDesde', evento: 'change' },
        { id: 'filtroFechaHasta', evento: 'change' },
        { id: 'filtroPeriodo', evento: 'change' },
        { id: 'filtroEstado', evento: 'change' }
    ];
    
    filtros.forEach(({id, evento}) => {
        const elemento = document.getElementById(id);
        if (elemento) {
            const nuevoElemento = elemento.cloneNode(true);
            elemento.parentNode.replaceChild(nuevoElemento, elemento);
            nuevoElemento.addEventListener(evento, aplicarFiltros);
        }
    });
    
    const btnLimpiar = document.getElementById('btnLimpiarFiltros');
    if (btnLimpiar) {
        const nuevoBtn = btnLimpiar.cloneNode(true);
        btnLimpiar.parentNode.replaceChild(nuevoBtn, btnLimpiar);
        nuevoBtn.addEventListener('click', limpiarFiltros);
    }
}

function limpiarFiltros() {
    const filtroFechaDesde = document.getElementById('filtroFechaDesde');
    const filtroFechaHasta = document.getElementById('filtroFechaHasta');
    const filtroPeriodo = document.getElementById('filtroPeriodo');
    const filtroEstado = document.getElementById('filtroEstado');
    const filtroTecnico = document.getElementById('filtroTecnico');
    const filtroSolicitante = document.getElementById('filtroSolicitante');
    
    if (filtroFechaDesde) filtroFechaDesde.value = '';
    if (filtroFechaHasta) filtroFechaHasta.value = '';
    if (filtroPeriodo) filtroPeriodo.value = 'todos';
    if (filtroEstado) filtroEstado.value = 'todos';
    if (filtroTecnico) filtroTecnico.value = 'todos';
    if (filtroSolicitante) filtroSolicitante.value = 'todos';
    
    const filtroFechaDesdeAdmin = document.getElementById('filtroFechaDesdeAdmin');
    const filtroFechaHastaAdmin = document.getElementById('filtroFechaHastaAdmin');
    const filtroPeriodoAdmin = document.getElementById('filtroPeriodoAdmin');
    const filtroEstadoAdmin = document.getElementById('filtroEstadoAdmin');
    const filtroTecnicoAdmin = document.getElementById('filtroTecnicoAdmin');
    const filtroSolicitanteAdmin = document.getElementById('filtroSolicitanteAdmin');
    
    if (filtroFechaDesdeAdmin) filtroFechaDesdeAdmin.value = '';
    if (filtroFechaHastaAdmin) filtroFechaHastaAdmin.value = '';
    if (filtroPeriodoAdmin) filtroPeriodoAdmin.value = 'todos';
    if (filtroEstadoAdmin) filtroEstadoAdmin.value = 'todos';
    if (filtroTecnicoAdmin) filtroTecnicoAdmin.value = 'todos';
    if (filtroSolicitanteAdmin) filtroSolicitanteAdmin.value = 'todos';
    
    aplicarFiltros();
}

function aplicarFiltros() {
    if (!cargandoActividades) {
        cargarActividades();
    }
}

async function cargarActividades() {
    if (cargandoActividades) return;
    cargandoActividades = true;
    
    try {
        const actividades = await obtenerActividadesFiltradas();
        mostrarActividades(actividades);
        actualizarContadores(actividades);
        actualizarInfoFiltros(actividades);
        
        if (tienePermiso('estadisticas')) {
            setTimeout(() => {
                actualizarEstadisticas();
            }, 50);
        }
    } catch (error) {
        mostrarMensaje('Error cargando actividades: ' + error.message, 'error');
    } finally {
        cargandoActividades = false;
    }
}

async function obtenerActividadesFiltradas() {
    try {
        let query = db.from('actividades').select('*');
        
        let filtroFechaDesde, filtroFechaHasta, periodo, estado, filtroTecnico, filtroSolicitante;
        
        if (usuarioActual && usuarioActual.rol === 'admin') {
            filtroFechaDesde = document.getElementById('filtroFechaDesdeAdmin')?.value;
            filtroFechaHasta = document.getElementById('filtroFechaHastaAdmin')?.value;
            periodo = document.getElementById('filtroPeriodoAdmin')?.value || 'todos';
            estado = document.getElementById('filtroEstadoAdmin')?.value || 'todos';
            filtroTecnico = document.getElementById('filtroTecnicoAdmin')?.value || 'todos';
            filtroSolicitante = document.getElementById('filtroSolicitanteAdmin')?.value || 'todos';
        } else {
            filtroFechaDesde = document.getElementById('filtroFechaDesde')?.value;
            filtroFechaHasta = document.getElementById('filtroFechaHasta')?.value;
            periodo = document.getElementById('filtroPeriodo')?.value || 'todos';
            estado = document.getElementById('filtroEstado')?.value || 'todos';
            filtroTecnico = document.getElementById('filtroTecnico')?.value || 'todos';
            filtroSolicitante = document.getElementById('filtroSolicitante')?.value || 'todos';
        }
        
        // Filtro por periodo
        if (periodo !== 'todos') {
            const { inicio, fin } = calcularPeriodo(periodo);
            if (inicio && fin) {
                const desde = new Date(inicio);
                desde.setHours(0, 0, 0, 0);
                query = query.gte('creado_en', desde.toISOString());
                
                const hasta = new Date(fin);
                hasta.setHours(23, 59, 59, 999);
                query = query.lte('creado_en', hasta.toISOString());
            }
        } else {
            if (filtroFechaDesde) {
                const desde = new Date(filtroFechaDesde);
                desde.setHours(0, 0, 0, 0);
                query = query.gte('creado_en', desde.toISOString());
            }
            if (filtroFechaHasta) {
                const hasta = new Date(filtroFechaHasta);
                hasta.setHours(23, 59, 59, 999);
                query = query.lte('creado_en', hasta.toISOString());
            }
        }
        
        // Filtro por estado
        if (estado !== 'todos') {
            query = query.eq('estado', estado);
        }
        
        // Filtro por técnico - AHORA BUSCA EN INICIO Y TERMINO
        if (filtroTecnico && filtroTecnico !== 'todos') {
            const tecnicoSeleccionado = listaTecnicos.find(t => t.id == filtroTecnico);
            if (tecnicoSeleccionado) {
                const nombreTecnico = tecnicoSeleccionado.nombre;
                // Buscar en técnicos que iniciaron O técnicos que terminaron
                query = query.or(
                    `tecnicos_inicio.ilike.%${nombreTecnico}%,` +
                    `tecnico.ilike.%${nombreTecnico}%,` +
                    `tecnicos_termino.ilike.%${nombreTecnico}%`
                );
            }
        }
        
        // Filtro por solicitante
        if (filtroSolicitante && filtroSolicitante !== 'todos') {
            query = query.eq('solicitante_id', filtroSolicitante);
        }
        
        query = query.order('creado_en', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
        
    } catch (error) {
        mostrarMensaje('Error en filtros: ' + error.message, 'error');
        return [];
    }
}

async function cargarTecnicosFiltro() {
    try {
        const { data: tecnicos, error } = await db
            .from('usuarios')
            .select('id, nombre')
            .eq('rol', 'tecnico')
            .eq('activo', true)
            .order('nombre');
        
        if (error) throw error;
        
        // Actualizar select en filtros normales
        const selectTecnico = document.getElementById('filtroTecnico');
        if (selectTecnico) {
            const valorActual = selectTecnico.value;
            selectTecnico.innerHTML = '<option value="todos">Todos los técnicos</option>';
            
            tecnicos.forEach(tecnico => {
                const option = document.createElement('option');
                option.value = tecnico.id;
                option.textContent = tecnico.nombre;
                if (valorActual == tecnico.id) option.selected = true;
                selectTecnico.appendChild(option);
            });
        }
        
        // Actualizar select en filtros de admin
        const selectTecnicoAdmin = document.getElementById('filtroTecnicoAdmin');
        if (selectTecnicoAdmin) {
            const valorActual = selectTecnicoAdmin.value;
            selectTecnicoAdmin.innerHTML = '<option value="todos">Todos los técnicos</option>';
            
            tecnicos.forEach(tecnico => {
                const option = document.createElement('option');
                option.value = tecnico.id;
                option.textContent = tecnico.nombre;
                if (valorActual == tecnico.id) option.selected = true;
                selectTecnicoAdmin.appendChild(option);
            });
        }
        
        return tecnicos;
    } catch (error) {
        console.error('Error cargando técnicos para filtro:', error);
        return [];
    }
}

// Cargar solicitantes en el filtro
async function cargarSolicitantesFiltro() {
    try {
        const { data: solicitantes, error } = await db
            .from('solicitantes')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre');
        
        if (error) throw error;
        
        // Actualizar select en filtros normales
        const selectSolicitante = document.getElementById('filtroSolicitante');
        if (selectSolicitante) {
            const valorActual = selectSolicitante.value;
            selectSolicitante.innerHTML = '<option value="todos">Todos los solicitantes</option>';
            
            solicitantes.forEach(solicitante => {
                const option = document.createElement('option');
                option.value = solicitante.id;
                option.textContent = solicitante.nombre;
                if (valorActual == solicitante.id) option.selected = true;
                selectSolicitante.appendChild(option);
            });
        }
        
        // Actualizar select en filtros de admin
        const selectSolicitanteAdmin = document.getElementById('filtroSolicitanteAdmin');
        if (selectSolicitanteAdmin) {
            const valorActual = selectSolicitanteAdmin.value;
            selectSolicitanteAdmin.innerHTML = '<option value="todos">Todos los solicitantes</option>';
            
            solicitantes.forEach(solicitante => {
                const option = document.createElement('option');
                option.value = solicitante.id;
                option.textContent = solicitante.nombre;
                if (valorActual == solicitante.id) option.selected = true;
                selectSolicitanteAdmin.appendChild(option);
            });
        }
        
        return solicitantes;
    } catch (error) {
        console.error('Error cargando solicitantes para filtro:', error);
        return [];
    }
}



function calcularPeriodo(periodo) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    switch(periodo) {
        case 'hoy': {
            const inicio = new Date(hoy);
            const fin = new Date(hoy);
            fin.setHours(23, 59, 59, 999);
            return { inicio: inicio.toISOString(), fin: fin.toISOString() };
        }
        case 'ayer': {
            const ayer = new Date(hoy);
            ayer.setDate(hoy.getDate() - 1);
            const inicio = new Date(ayer);
            inicio.setHours(0, 0, 0, 0);
            const fin = new Date(ayer);
            fin.setHours(23, 59, 59, 999);
            return { inicio: inicio.toISOString(), fin: fin.toISOString() };
        }
        case 'semana': {
            const inicio = new Date(hoy);
            const diaSemana = inicio.getDay();
            const diff = inicio.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
            inicio.setDate(diff);
            inicio.setHours(0, 0, 0, 0);
            const fin = new Date(inicio);
            fin.setDate(inicio.getDate() + 6);
            fin.setHours(23, 59, 59, 999);
            return { inicio: inicio.toISOString(), fin: fin.toISOString() };
        }
        case 'mes': {
            const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            inicio.setHours(0, 0, 0, 0);
            const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
            fin.setHours(23, 59, 59, 999);
            return { inicio: inicio.toISOString(), fin: fin.toISOString() };
        }
        case 'anterior': {
            const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
            inicio.setHours(0, 0, 0, 0);
            const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
            fin.setHours(23, 59, 59, 999);
            return { inicio: inicio.toISOString(), fin: fin.toISOString() };
        }
        default: return { inicio: '', fin: '' };
    }
}

function configurarBotonExportar() {
    const btnExportarExcel = document.getElementById('btnExportarExcel');
    if (btnExportarExcel) {
        btnExportarExcel.replaceWith(btnExportarExcel.cloneNode(true));
        const nuevoBtn = document.getElementById('btnExportarExcel');
        nuevoBtn.addEventListener('click', exportarExcel);
    }
}

function establecerFechasPorDefecto() {
    const hoy = new Date().toISOString().split('T')[0];
    const filtroFechaDesde = document.getElementById('filtroFechaDesde');
    const filtroFechaHasta = document.getElementById('filtroFechaHasta');
    
    if (filtroFechaHasta) filtroFechaHasta.max = hoy;
    if (filtroFechaDesde) filtroFechaDesde.max = hoy;
}

// ========== FUNCIONES DE VISUALIZACION ==========
function mostrarActividades(actividades) {
    const lista = document.getElementById('listaActividades');
    if (!lista) return;
    
    if (actividades.length === 0) {
        lista.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-inbox display-1 text-muted"></i>
                <h5 class="mt-3">${getMensajeSinActividades()}</h5>
            </div>
        `;
        return;
    }
    
    let html = '';
    actividades.forEach(act => {
        const fecha = new Date(act.creado_en).toLocaleString('es-MX');
        const prioridadColor = getColor(act.prioridad, 'prioridad');
        const estadoColor = getColor(act.estado, 'estado');
        
        let estadoTexto = act.estado.replace('_', ' ').toUpperCase();
        let prioridadTexto = act.prioridad.toUpperCase();
        
        // Obtener técnicos que iniciaron
        const tecnicosInicio = act.tecnicos_inicio || act.tecnico || 'No registrado';
        // Obtener técnicos que terminaron (si está completada)
        const tecnicosTermino = act.estado === 'completada' && act.tecnicos_termino 
            ? act.tecnicos_termino 
            : (act.estado === 'completada' ? act.tecnico : null);
        
        const puedeEditar = true;
        
        html += `
            <div class="card mb-3 border-start border-${estadoColor} border-3 actividad-card shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-${estadoColor} fs-6 px-3 py-2">
                                <i class="bi bi-circle-fill me-1"></i>
                                ${estadoTexto}
                            </span>
                            <span class="badge bg-${prioridadColor} fs-6 px-3 py-2">
                                <i class="bi bi-flag-fill me-1"></i>
                                ${prioridadTexto}
                            </span>
                        </div>
                        <small class="text-muted">
                            <i class="bi bi-calendar"></i> ${fecha}
                        </small>
                    </div>
                    
                    <h6 class="mb-3 fw-bold text-dark">${act.descripcion}</h6>
                    
                    <div class="d-flex flex-wrap gap-3 mb-3">
                        <span class="text-primary" title="Técnicos que iniciaron la actividad">
                            <i class="bi bi-play-circle-fill"></i> Iniciaron: ${tecnicosInicio}
                        </span>
                        ${act.estado === 'completada' && tecnicosTermino ? `
                            <span class="text-success" title="Técnicos que terminaron la actividad">
                                <i class="bi bi-check-circle-fill"></i> Terminaron: ${tecnicosTermino}
                            </span>
                        ` : ''}
                        <span class="text-secondary">
                            <i class="bi bi-person-badge"></i> Solicitante: ${act.solicitante || 'No especificado'}
                        </span>
                        ${act.ubicacion ? `
                            <span class="text-success">
                                <i class="bi bi-geo-alt"></i> Ubicación: ${act.ubicacion}
                            </span>
                        ` : ''}
                        ${act.departamento ? `
                            <span class="text-info">
                                <i class="bi bi-building"></i> Departamento: ${act.departamento}
                            </span>
                        ` : ''}
                    </div>
                    
                    ${act.notas_iniciales ? `
                        <div class="mb-3 p-3 bg-light rounded border">
                            <div class="d-flex align-items-center mb-2">
                                <i class="bi bi-chat-left-text text-muted me-2"></i>
                                <small class="text-muted fw-bold">Notas iniciales:</small>
                            </div>
                            <p class="mb-0 small">${act.notas_iniciales}</p>
                        </div>
                    ` : ''}
                    
                    ${act.completado_en ? `
                        <div class="alert alert-success py-1 px-3 d-inline-flex align-items-center">
                            <i class="bi bi-check-circle me-2"></i>
                            <small>Completado: ${new Date(act.completado_en).toLocaleString('es-MX')}</small>
                        </div>
                    ` : ''}
                    
                    ${act.notas ? `
                        <div class="mt-3 p-3 bg-light rounded border">
                            <div class="d-flex align-items-center mb-2">
                                <i class="bi bi-journal-text text-muted me-2"></i>
                                <small class="text-muted fw-bold">Notas del técnico:</small>
                            </div>
                            <p class="mb-0 small">${act.notas}</p>
                        </div>
                    ` : ''}
                    
                    <div class="mt-3 pt-3 border-top d-flex justify-content-end gap-2">
                        ${act.estado !== 'completada' ? `
                            <button class="btn btn-sm btn-success btn-action" onclick="completarActividad(${act.id})" title="Marcar como completada">
                                <i class="bi bi-check-lg"></i> Completar
                            </button>
                            ${act.estado === 'pendiente' ? `
                                <button class="btn btn-sm btn-info btn-action" onclick="marcarEnProgreso(${act.id})" title="Marcar en progreso">
                                    <i class="bi bi-play-fill"></i> En Progreso
                                </button>
                            ` : ''}
                        ` : ''}
                        
                        ${puedeEditar ? `
                            <button class="btn btn-sm btn-warning btn-action" onclick="editarActividad(${act.id})" title="Editar actividad">
                                <i class="bi bi-pencil"></i> Editar
                            </button>
                        ` : ''}
                        
                        <button class="btn btn-sm btn-outline-primary btn-action" onclick="editarNotas(${act.id})" title="Editar notas del técnico">
                            <i class="bi bi-journal-text"></i> Notas
                        </button>

                        <button class="btn btn-sm btn-outline-dark btn-action" onclick="exportarFormatoMantenimiento(${act.id})" title="Exportar formato de mantenimiento">
                            <i class="bi bi-file-earmark-text"></i> Formato
                        </button>
                        
                        ${tienePermiso('eliminar') ? `
                            <button class="btn btn-sm btn-outline-danger btn-action" onclick="eliminarActividad(${act.id})" title="Eliminar">
                                <i class="bi bi-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    lista.innerHTML = html;
}

function getMensajeSinActividades() {
    const filtroFechaDesde = document.getElementById('filtroFechaDesde')?.value;
    const filtroFechaHasta = document.getElementById('filtroFechaHasta')?.value;
    const periodo = document.getElementById('filtroPeriodo')?.value || 'todos';
    const estado = document.getElementById('filtroEstado')?.value || 'todos';
    
    if (periodo !== 'todos' || filtroFechaDesde || filtroFechaHasta || estado !== 'todos') {
        let mensaje = 'No hay actividades';
        
        if (estado !== 'todos') {
            const nombresEstado = {
                'pendiente': 'pendientes',
                'en_progreso': 'en progreso',
                'completada': 'completadas'
            };
            mensaje += ' ' + (nombresEstado[estado] || estado);
        }
        
        mensaje += ' en el periodo seleccionado';
        
        if (filtroFechaDesde && filtroFechaHasta) {
            mensaje += ' (' + filtroFechaDesde + ' al ' + filtroFechaHasta + ')';
        } else if (periodo !== 'todos') {
            const nombresPeriodo = {
                'hoy': 'hoy',
                'ayer': 'ayer',
                'semana': 'esta semana',
                'mes': 'este mes',
                'anterior': 'el mes anterior'
            };
            mensaje += ' (' + (nombresPeriodo[periodo] || periodo) + ')';
        }
        return mensaje;
    }
    return 'Comienza creando una nueva actividad usando el formulario';
}

function actualizarInfoFiltros(actividades) {
    const contadorFiltrado = document.getElementById('contadorFiltrado');
    if (contadorFiltrado) {
        contadorFiltrado.textContent = actividades.length;
        const filtroFechaDesde = document.getElementById('filtroFechaDesde')?.value;
        const filtroFechaHasta = document.getElementById('filtroFechaHasta')?.value;
        const periodo = document.getElementById('filtroPeriodo')?.value || 'todos';
        const filtroActivo = periodo !== 'todos' || filtroFechaDesde || filtroFechaHasta;
        
        if (filtroActivo) {
            contadorFiltrado.parentElement.classList.remove('bg-light', 'text-dark');
            contadorFiltrado.parentElement.classList.add('bg-primary', 'text-white');
        } else {
            contadorFiltrado.parentElement.classList.remove('bg-primary', 'text-white');
            contadorFiltrado.parentElement.classList.add('bg-light', 'text-dark');
        }
    }
}

function actualizarContadores(actividades) {
    const contadorTotal = document.getElementById('contadorTotal');
    const contadorPendientes = document.getElementById('contadorPendientes');
    const contadorCompletadas = document.getElementById('contadorCompletadas');
    
    if (contadorTotal) {
        const pendientes = actividades.filter(a => a.estado === 'pendiente').length;
        const completadas = actividades.filter(a => a.estado === 'completada').length;
        
        contadorTotal.textContent = actividades.length;
        contadorPendientes.textContent = pendientes;
        contadorCompletadas.textContent = completadas;
    }
}

function getColor(valor, tipo) {
    if (tipo === 'prioridad') {
        switch(valor) {
            case 'urgente': return 'danger';
            case 'alta': return 'warning';
            case 'normal': return 'primary';
            case 'baja': return 'success';
            default: return 'secondary';
        }
    } else {
        switch(valor) {
            case 'pendiente': return 'warning';
            case 'en_progreso': return 'info';
            case 'completada': return 'success';
            default: return 'secondary';
        }
    }
}

// ========== FUNCIONES GLOBALES ==========
window.completarActividad = async function(id) {
    try {
        const { data: actividad, error } = await db
            .from('actividades')
            .select('notas, descripcion, tecnicos_termino, tecnicos_termino_ids')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        // Mostrar modal para seleccionar técnicos que terminaron
        mostrarModalCompletarActividad(id, actividad.descripcion, actividad.tecnicos_termino);
        
    } catch (error) {
        mostrarMensaje('Error: ' + error.message, 'error');
    }
};

function mostrarModalCompletarActividad(id, descripcion, tecnicosTerminoActual) {
    let modalCompletar = document.getElementById('modalCompletarActividad');
    
    if (!modalCompletar) {
        const modalHTML = `
            <div class="modal fade" id="modalCompletarActividad" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header modal-header-gradient bg-success">
                            <h5 class="modal-title text-white">
                                <i class="bi bi-check-circle-fill me-2"></i> Completar Actividad
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted mb-3">
                                Para marcar esta actividad como completada, selecciona los técnicos que la finalizaron.
                            </p>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Descripción de la actividad:</label>
                                <div class="p-2 bg-light rounded" id="modalCompletarDescripcion"></div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">
                                    <i class="bi bi-people me-1"></i> Técnicos que terminaron la actividad:
                                </label>
                                <select id="modalCompletarTecnicos" class="form-select" multiple size="5">
                                </select>
                                <small class="text-muted">Selecciona uno o varios técnicos (Ctrl+Click para seleccionar múltiples)</small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">
                                    <i class="bi bi-journal-text me-1"></i> Notas del técnico:
                                </label>
                                <textarea id="modalCompletarNotas" class="form-control" rows="4" 
                                          placeholder="Describe las acciones realizadas, soluciones aplicadas, observaciones, etc."></textarea>
                                <small class="text-muted">Las notas son obligatorias para completar</small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-success" id="btnConfirmarCompletar">
                                <i class="bi bi-check-lg"></i> Completar Actividad
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        document.getElementById('btnConfirmarCompletar').addEventListener('click', async function() {
            const actividadId = this.getAttribute('data-actividad-id');
            const notas = document.getElementById('modalCompletarNotas').value;
            const tecnicosSelect = document.getElementById('modalCompletarTecnicos');
            const tecnicosSeleccionados = Array.from(tecnicosSelect.selectedOptions).map(opt => opt.value);
            const tecnicosNombres = Array.from(tecnicosSelect.selectedOptions).map(opt => opt.text);
            
            if (!notas || notas.trim() === '') {
                mostrarMensaje('Debes ingresar las notas del técnico', 'error');
                return;
            }
            
            if (tecnicosSeleccionados.length === 0) {
                mostrarMensaje('Debes seleccionar al menos un técnico que terminó la actividad', 'error');
                return;
            }
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCompletarActividad'));
            modal.hide();
            
            await confirmarYCompletarActividad(actividadId, notas.trim(), tecnicosSeleccionados, tecnicosNombres);
        });
        
        document.getElementById('modalCompletarActividad').addEventListener('hidden.bs.modal', function() {
            document.getElementById('modalCompletarNotas').value = '';
            document.getElementById('modalCompletarTecnicos').innerHTML = '';
            this.removeAttribute('data-actividad-id');
        });
    }
    
    // Cargar técnicos disponibles en el select
    const tecnicosSelect = document.getElementById('modalCompletarTecnicos');
    tecnicosSelect.innerHTML = '';
    
    // Obtener técnicos activos
    const tecnicosActivos = listaTecnicos.filter(tecnico => 
        tecnico.rol === 'tecnico' && tecnico.activo === true
    );
    
    if (tecnicosActivos.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No hay técnicos disponibles";
        option.disabled = true;
        tecnicosSelect.appendChild(option);
    } else {
        tecnicosActivos.forEach(tecnico => {
            const option = document.createElement('option');
            option.value = tecnico.id;
            option.textContent = tecnico.nombre;
            tecnicosSelect.appendChild(option);
        });
    }
    
    document.getElementById('modalCompletarDescripcion').textContent = descripcion;
    document.getElementById('modalCompletarNotas').value = '';
    document.getElementById('btnConfirmarCompletar').setAttribute('data-actividad-id', id);
    
    new bootstrap.Modal(document.getElementById('modalCompletarActividad')).show();
}

async function confirmarYCompletarActividad(id, notas, tecnicosIds, tecnicosNombres) {
    try {
        const ahora = new Date();
        const offset = ahora.getTimezoneOffset() * 60000;
        const fechaAjustada = new Date(ahora.getTime() - offset);
        
        const updateData = { 
            estado: 'completada', 
            completado_en: fechaAjustada.toISOString(),
            notas: notas.trim(),
            tecnicos_termino: tecnicosNombres.join(', '),
            tecnicos_termino_ids: tecnicosIds.join(',')
        };
        
        const { error } = await db.from('actividades')
            .update(updateData)
            .eq('id', id);
        
        if (error) throw error;
        
        mostrarMensaje('Actividad completada exitosamente!', 'success');
        await cargarActividades();
    } catch (error) {
        mostrarMensaje('Error: ' + error.message, 'error');
    }
}

function mostrarModalNotasParaCompletar(id, descripcion) {
    let modalNotas = document.getElementById('modalNotasParaCompletar');
    
    if (!modalNotas) {
        const modalHTML = `
            <div class="modal fade" id="modalNotasParaCompletar" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header modal-header-gradient">
                            <h5 class="modal-title">
                                <i class="bi bi-journal-text me-2"></i> Notas requeridas
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted mb-3">
                                Para marcar esta actividad como completada, es necesario agregar las notas del tecnico.
                            </p>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Descripcion de la actividad:</label>
                                <div class="p-2 bg-light rounded" id="modalNotasDescripcion"></div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Notas del tecnico:</label>
                                <textarea id="modalNotasTextarea" class="form-control" rows="4" 
                                          placeholder="Describe las acciones realizadas, soluciones aplicadas, observaciones, etc."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-success" id="btnCompletarConNotas">
                                <i class="bi bi-check-lg"></i> Completar con notas
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        document.getElementById('btnCompletarConNotas').addEventListener('click', async function() {
            const notas = document.getElementById('modalNotasTextarea').value;
            if (!notas || notas.trim() === '') {
                mostrarMensaje('Debes ingresar las notas del tecnico', 'error');
                return;
            }
            
            const actividadId = this.getAttribute('data-actividad-id');
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalNotasParaCompletar'));
            modal.hide();
            
            await confirmarYCompletarActividad(actividadId, notas);
        });
        
        document.getElementById('modalNotasParaCompletar').addEventListener('hidden.bs.modal', function() {
            document.getElementById('modalNotasTextarea').value = '';
            this.removeAttribute('data-actividad-id');
        });
    }
    
    document.getElementById('modalNotasDescripcion').textContent = descripcion;
    document.getElementById('modalNotasTextarea').value = '';
    document.getElementById('btnCompletarConNotas').setAttribute('data-actividad-id', id);
    
    new bootstrap.Modal(document.getElementById('modalNotasParaCompletar')).show();
}

window.marcarEnProgreso = async function(id) {
    try {
        const { error } = await db.from('actividades')
            .update({ estado: 'en_progreso' })
            .eq('id', id);
        
        if (error) throw error;
        mostrarMensaje('Actividad en progreso', 'info');
        await cargarActividades();
    } catch (error) {
        mostrarMensaje('Error: ' + error.message, 'error');
    }
};

window.editarNotas = async function(id) {
    try {
        const { data } = await db.from('actividades')
            .select('notas')
            .eq('id', id)
            .single();
        
        const notas = prompt('Ingresa las notas:', data?.notas || '');
        if (notas === null) return;
        
        await db.from('actividades')
            .update({ notas: notas.trim() })
            .eq('id', id);
        
        mostrarMensaje('Notas actualizadas!', 'success');
        await cargarActividades();
    } catch (error) {
        mostrarMensaje('Error: ' + error.message, 'error');
    }
};

window.eliminarActividad = async function(id) {
    if (!tienePermiso('eliminar')) {
        mostrarMensaje('No tienes permisos para eliminar actividades', 'error');
        return;
    }
    
    if (!confirm('¿Eliminar permanentemente esta actividad? Esta accion no se puede deshacer.')) return;
    
    try {
        const { error } = await db.from('actividades').delete().eq('id', id);
        if (error) throw error;
        mostrarMensaje('Actividad eliminada', 'success');
        await cargarActividades();
    } catch (error) {
        mostrarMensaje('Error: ' + error.message, 'error');
    }
};

window.exportarExcel = async function() {
    if (!tienePermiso('exportar')) {
        mostrarMensaje('No tienes permisos para exportar a Excel', 'error');
        return;
    }
    
    const periodo = document.getElementById('filtroPeriodo')?.value || 'todos';
    const filtroFechaDesde = document.getElementById('filtroFechaDesde')?.value;
    const filtroFechaHasta = document.getElementById('filtroFechaHasta')?.value;
    const filtroEstado = document.getElementById('filtroEstado')?.value || 'todos';
    
    let mensajeFiltros = '¿Exportar actividades ';
    let detallesFiltro = [];
    
    if (periodo !== 'todos') {
        const nombresPeriodo = {
            'hoy': 'de hoy',
            'ayer': 'de ayer',
            'semana': 'de esta semana',
            'mes': 'de este mes',
            'anterior': 'del mes anterior'
        };
        detallesFiltro.push(nombresPeriodo[periodo] || periodo);
    }
    
    if (filtroFechaDesde && filtroFechaHasta) {
        detallesFiltro.push('del ' + filtroFechaDesde + ' al ' + filtroFechaHasta);
    } else if (filtroFechaDesde) {
        detallesFiltro.push('desde ' + filtroFechaDesde);
    } else if (filtroFechaHasta) {
        detallesFiltro.push('hasta ' + filtroFechaHasta);
    }
    
    if (filtroEstado !== 'todos') {
        const nombresEstado = {
            'pendiente': 'pendientes',
            'en_progreso': 'en progreso',
            'completada': 'completadas'
        };
        detallesFiltro.push('con estado ' + (nombresEstado[filtroEstado] || filtroEstado));
    }
    
    if (detallesFiltro.length > 0) {
        mensajeFiltros += detallesFiltro.join(' ') + '?';
    } else {
        mensajeFiltros += 'de todo el periodo?';
    }
    
    if (!confirm(mensajeFiltros + '\n\n¿Continuar con la exportacion?')) {
        return;
    }
    
    try {
        const btnExportar = document.getElementById('btnExportarExcel');
        const originalHTML = btnExportar.innerHTML;
        
        btnExportar.innerHTML = '<i class="bi bi-hourglass-split"></i>';
        btnExportar.disabled = true;
        
        const actividades = await obtenerActividadesFiltradas();
        if (actividades.length === 0) {
            mostrarMensaje('No hay datos para exportar segun los filtros seleccionados', 'info');
            return;
        }
        
        let infoExportacion = 'Exportando ' + actividades.length + ' actividades';
        if (detallesFiltro.length > 0) {
            infoExportacion += ' (' + detallesFiltro.join(', ') + ')';
        }
        mostrarMensaje(infoExportacion, 'info');
        
        const datosExcel = actividades.map(actividad => ({
            'Descripcion': actividad.descripcion,
            'Tecnico': actividad.tecnico,
            'Solicitante': actividad.solicitante || '',
            'Estado': actividad.estado.replace('_', ' ').toUpperCase(),
            'Prioridad': actividad.prioridad.toUpperCase(),
            'Ubicacion': actividad.ubicacion || '',
            'Departamento': actividad.departamento || '',
            'Notas Iniciales': actividad.notas_iniciales || '',
            'Fecha Creacion': new Date(actividad.creado_en).toLocaleString('es-MX'),
            'Fecha Completado': actividad.completado_en 
                ? new Date(actividad.completado_en).toLocaleString('es-MX')
                : '',
            'Notas Tecnico': actividad.notas || ''
        }));
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datosExcel);
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        const borderStyle = { style: 'thin', color: { rgb: '000000' } };
        
        for(let R = range.s.r; R <= range.e.r; ++R) {
            for(let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = {c: C, r: R};
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                
                if(!ws[cell_ref]) continue;
                
                if(!ws[cell_ref].s) ws[cell_ref].s = {};
                ws[cell_ref].s.border = {
                    top: borderStyle,
                    bottom: borderStyle,
                    left: borderStyle,
                    right: borderStyle
                };
                
                if(R === range.s.r) {
                    ws[cell_ref].s.font = { bold: true };
                }
            }
        }
        
        ws['!cols'] = [
            { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
            { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
            { wch: 20 }, { wch: 20 }, { wch: 30 }
        ];
        
        const metadatosData = [
            ['INFORMACION DE LA EXPORTACION'],
            ['Fecha de exportacion:', new Date().toLocaleString('es-MX')],
            ['Periodo:', periodo !== 'todos' ? nombresPeriodo[periodo] || periodo : 'Todo el periodo'],
            ['Estado:', filtroEstado !== 'todos' ? nombresEstado[filtroEstado] || filtroEstado : 'Todos'],
            ['Rango de fechas:', filtroFechaDesde && filtroFechaHasta ? filtroFechaDesde + ' al ' + filtroFechaHasta : 'Sin filtro de fechas'],
            ['Total de actividades:', actividades.length],
            []
        ];
        const wsMetadatos = XLSX.utils.aoa_to_sheet(metadatosData);
        XLSX.utils.book_append_sheet(wb, wsMetadatos, 'Informacion');
        
        XLSX.utils.book_append_sheet(wb, ws, 'Actividades');
        const fecha = new Date().toISOString().split('T')[0];
        const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
        const nombreArchivo = 'Actividades_' + fecha + '_' + hora + '.xlsx';
        
        XLSX.writeFile(wb, nombreArchivo);
        mostrarMensaje('Archivo "' + nombreArchivo + '" descargado exitosamente', 'success');
        
    } catch (error) {
        mostrarMensaje('Error al exportar Excel: ' + error.message, 'error');
    } finally {
        const btnExportar = document.getElementById('btnExportarExcel');
        btnExportar.innerHTML = '<i class="bi bi-file-earmark-excel"></i>';
        btnExportar.disabled = false;
    }
};

function actualizarSelectDepartamentosModal() {
    const selectDepto = document.getElementById('selectDepartamentoSolicitante');
    if (!selectDepto) return;
    
    const valorActual = selectDepto.value;
    
    selectDepto.innerHTML = '';
    
    if (!listaDepartamentos || listaDepartamentos.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay departamentos disponibles';
        option.disabled = true;
        option.selected = true;
        selectDepto.appendChild(option);
        return;
    }
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Seleccionar departamento...';
    selectDepto.appendChild(defaultOption);
    
    listaDepartamentos.forEach(depto => {
        const option = document.createElement('option');
        option.value = depto.id;
        option.textContent = depto.nombre;
        
        if (depto.ubicacion) {
            option.setAttribute('data-ubicacion', depto.ubicacion);
        }
        
        if (valorActual && valorActual == depto.id) {
            option.selected = true;
        }
        
        selectDepto.appendChild(option);
    });
}

// ========== GESTION DE DEPARTAMENTOS ==========
let listaDepartamentos = [];
let departamentosCargados = false;

async function cargarDepartamentos(forzar = false) {
    if (departamentosCargados && !forzar) return listaDepartamentos;
    
    try {
        const { data, error } = await db
            .from('departamentos')
            .select('*')
            .eq('activo', true)
            .order('nombre');
        
        if (error) throw error;
        
        listaDepartamentos = Array.isArray(data) ? data : [];
        departamentosCargados = true;
        
        opcionesDepartamentos = listaDepartamentos.map(d => d.nombre);
        
        actualizarSelectDepartamentos();
        actualizarSelectDepartamentosModal();
        
        return listaDepartamentos;
    } catch (error) {
        console.error('Error cargando departamentos:', error);
        mostrarMensaje('Error al cargar departamentos', 'error');
        listaDepartamentos = [];
        return [];
    }
}

async function agregarDepartamento(nombre, ubicacion = '', creadoPor = null) {
    try {
        const { data: existente } = await db
            .from('departamentos')
            .select('id, activo, nombre, ubicacion')
            .eq('nombre', nombre)
            .maybeSingle();
        
        if (existente) {
            if (existente.activo) {
                return { 
                    exito: false, 
                    mensaje: 'El departamento "' + nombre + '" ya existe y esta activo'
                };
            } else {
                if (confirm('El departamento "' + nombre + '" existe pero esta inactivo. ¿Deseas reactivarlo?')) {
                    const { error } = await db
                        .from('departamentos')
                        .update({ 
                            activo: true, 
                            ubicacion: ubicacion || existente.ubicacion,
                            actualizado_en: new Date().toISOString()
                        })
                        .eq('id', existente.id);
                    
                    if (error) throw error;
                    
                    await cargarDepartamentos(true);
                    
                    return { exito: true, mensaje: 'Departamento reactivado correctamente' };
                } else {
                    return { exito: false, mensaje: 'Operacion cancelada' };
                }
            }
        }
        
        const nuevoDepartamento = {
            nombre: nombre,
            ubicacion: ubicacion || null,
            activo: true,
            creado_por: creadoPor || null
        };
        
        const { data, error } = await db
            .from('departamentos')
            .insert([nuevoDepartamento])
            .select()
            .single();
        
        if (error) throw error;
        
        await cargarDepartamentos(true);
        
        return { exito: true, mensaje: 'Departamento agregado correctamente', data };
    } catch (error) {
        console.error('Error agregando departamento:', error);
        return { exito: false, mensaje: 'Error al agregar departamento: ' + error.message };
    }
}

async function actualizarDepartamento(id, datosActualizados) {
    try {
        const { error } = await db
            .from('departamentos')
            .update({
                ...datosActualizados,
                actualizado_en: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;
        
        await cargarDepartamentos();
        return { exito: true, mensaje: 'Departamento actualizado correctamente' };
    } catch (error) {
        console.error('Error actualizando departamento:', error);
        return { exito: false, mensaje: 'Error al actualizar departamento' };
    }
}

async function eliminarDepartamento(id) {
    try {
        const { data: solicitantes, error: checkError } = await db
            .from('solicitantes')
            .select('id')
            .eq('departamento', id)
            .limit(1);
        
        if (checkError) throw checkError;
        
        if (solicitantes && solicitantes.length > 0) {
            const { error } = await db
                .from('departamentos')
                .update({ activo: false, actualizado_en: new Date().toISOString() })
                .eq('id', id);
            
            if (error) throw error;
            
            await cargarDepartamentos();
            return { exito: true, mensaje: 'Departamento desactivado (tiene solicitantes asociados)' };
        } else {
            const { error } = await db
                .from('departamentos')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            await cargarDepartamentos();
            return { exito: true, mensaje: 'Departamento eliminado permanentemente' };
        }
    } catch (error) {
        console.error('Error eliminando departamento:', error);
        return { exito: false, mensaje: 'Error al eliminar departamento: ' + error.message };
    }
}

function obtenerUbicacionDepartamento(nombreDepartamento) {
    const depto = listaDepartamentos.find(d => d.nombre === nombreDepartamento);
    return depto?.ubicacion || '';
}

// ========== FUNCIONES DE ESTADISTICAS ==========
let graficoDepartamentos = null;
let graficoProblemas = null;
let graficoTecnicos = null;
let graficoSolicitantes = null;

async function actualizarEstadisticas() {
    if (!tienePermiso('estadisticas')) return;
    
    try {
        const actividades = await obtenerActividadesFiltradas();
        const estadisticas = calcularEstadisticas(actividades);
        
        mostrarResumenEstadisticas(estadisticas);
        mostrarEstadisticasDepartamentos(estadisticas);
        mostrarEstadisticasProblemas(estadisticas);
        mostrarEstadisticasTecnicos(estadisticas);
        mostrarEstadisticasSolicitantes(estadisticas);
        actualizarInfoFiltroEstadisticas();
    } catch (error) {
        console.error('Error actualizando estadisticas:', error);
    }
}

function calcularEstadisticas(actividades) {
    const estadisticas = {
        total: actividades.length,
        porEstado: {},
        porDepartamento: {},
        porProblema: {},
        porTecnico: {},
        porSolicitante: {},
        porPrioridad: {},
        tiemposResolucion: [],
        fechaInicio: null,
        fechaFin: null,
        actividadesPorMes: {},
        actividadesPorDiaSemana: {}
    };
    
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    diasSemana.forEach(dia => estadisticas.actividadesPorDiaSemana[dia] = 0);
    
    actividades.forEach(act => {
        estadisticas.porEstado[act.estado] = (estadisticas.porEstado[act.estado] || 0) + 1;
        
        const depto = act.departamento || 'Sin departamento';
        if (!estadisticas.porDepartamento[depto]) {
            estadisticas.porDepartamento[depto] = { 
                total: 0, 
                pendientes: 0, 
                completados: 0, 
                enProgreso: 0,
                prioridades: { baja: 0, normal: 0, alta: 0, urgente: 0 }
            };
        }
        estadisticas.porDepartamento[depto].total++;
        estadisticas.porDepartamento[depto][act.estado === 'pendiente' ? 'pendientes' : 
                                          act.estado === 'completada' ? 'completados' : 'enProgreso']++;
        
        if (act.prioridad && estadisticas.porDepartamento[depto].prioridades[act.prioridad] !== undefined) {
            estadisticas.porDepartamento[depto].prioridades[act.prioridad]++;
        }
        
        const problema = act.descripcion;
        if (!estadisticas.porProblema[problema]) {
            estadisticas.porProblema[problema] = { 
                frecuencia: 0, 
                tiemposResolucion: [],
                estados: { pendiente: 0, en_progreso: 0, completada: 0 },
                prioridades: { baja: 0, normal: 0, alta: 0, urgente: 0 }
            };
        }
        estadisticas.porProblema[problema].frecuencia++;
        estadisticas.porProblema[problema].estados[act.estado]++;
        if (act.prioridad && estadisticas.porProblema[problema].prioridades[act.prioridad] !== undefined) {
            estadisticas.porProblema[problema].prioridades[act.prioridad]++;
        }
        
        if (act.estado === 'completada' && act.completado_en && act.creado_en) {
            const tiempoResolucion = calcularTiempoResolucion(act.creado_en, act.completado_en);
            estadisticas.porProblema[problema].tiemposResolucion.push(tiempoResolucion);
            estadisticas.tiemposResolucion.push(tiempoResolucion);
        }
        
        const tecnicosTexto = act.tecnico || 'Sin tecnico';
        const tecnicosArray = tecnicosTexto.split(',').map(t => t.trim()).filter(t => t !== '');
        
        if (tecnicosArray.length === 0) {
            tecnicosArray.push('Sin tecnico');
        }
        
        tecnicosArray.forEach(tecnicoNombre => {
            if (!estadisticas.porTecnico[tecnicoNombre]) {
                estadisticas.porTecnico[tecnicoNombre] = { 
                    total: 0, 
                    completados: 0, 
                    pendientes: 0, 
                    enProgreso: 0,
                    tiemposResolucion: [],
                    problemasAtendidos: new Set(),
                    departamentosAtendidos: new Set(),
                    prioridades: { baja: 0, normal: 0, alta: 0, urgente: 0 }
                };
            }
            
            estadisticas.porTecnico[tecnicoNombre].total++;
            estadisticas.porTecnico[tecnicoNombre][act.estado === 'pendiente' ? 'pendientes' : 
                                                act.estado === 'completada' ? 'completados' : 'enProgreso']++;
            
            if (act.prioridad && estadisticas.porTecnico[tecnicoNombre].prioridades[act.prioridad] !== undefined) {
                estadisticas.porTecnico[tecnicoNombre].prioridades[act.prioridad]++;
            }
            
            if (act.descripcion) estadisticas.porTecnico[tecnicoNombre].problemasAtendidos.add(act.descripcion);
            if (act.departamento) estadisticas.porTecnico[tecnicoNombre].departamentosAtendidos.add(act.departamento);
            
            if (act.estado === 'completada' && act.completado_en && act.creado_en) {
                const tiempoResolucion = calcularTiempoResolucion(act.creado_en, act.completado_en);
                estadisticas.porTecnico[tecnicoNombre].tiemposResolucion.push(tiempoResolucion);
            }
        });
        
        const solicitante = act.solicitante || 'Sin solicitante';
        if (!estadisticas.porSolicitante[solicitante]) {
            estadisticas.porSolicitante[solicitante] = {
                total: 0,
                completados: 0,
                pendientes: 0,
                enProgreso: 0,
                departamentos: new Set(),
                fechas: [],
                problemasReportados: new Set(),
                prioridades: { baja: 0, normal: 0, alta: 0, urgente: 0 }
            };
        }
        estadisticas.porSolicitante[solicitante].total++;
        estadisticas.porSolicitante[solicitante][act.estado === 'pendiente' ? 'pendientes' : 
                               act.estado === 'completada' ? 'completados' : 'enProgreso']++;
        
        if (act.departamento) {
            estadisticas.porSolicitante[solicitante].departamentos.add(act.departamento);
        }
        
        if (act.descripcion) estadisticas.porSolicitante[solicitante].problemasReportados.add(act.descripcion);
        estadisticas.porSolicitante[solicitante].fechas.push(new Date(act.creado_en));
        
        estadisticas.porPrioridad[act.prioridad] = (estadisticas.porPrioridad[act.prioridad] || 0) + 1;
        
        const fecha = new Date(act.creado_en);
        const mes = fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0');
        const nombreMes = fecha.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
        
        if (!estadisticas.actividadesPorMes[mes]) {
            estadisticas.actividadesPorMes[mes] = {
                nombre: nombreMes,
                total: 0,
                completados: 0,
                pendientes: 0,
                enProgreso: 0
            };
        }
        estadisticas.actividadesPorMes[mes].total++;
        estadisticas.actividadesPorMes[mes][act.estado === 'pendiente' ? 'pendientes' : 
                                           act.estado === 'completada' ? 'completados' : 'enProgreso']++;
        
        const diaSemana = diasSemana[fecha.getDay()];
        estadisticas.actividadesPorDiaSemana[diaSemana]++;
    });
    
    Object.keys(estadisticas.porTecnico).forEach(tecnico => {
        const data = estadisticas.porTecnico[tecnico];
        
        if (data.tiemposResolucion.length > 0) {
            const sumaTiempos = data.tiemposResolucion.reduce((a, b) => a + b, 0);
            data.tiempoPromedioResolucion = sumaTiempos / data.tiemposResolucion.length;
        } else {
            data.tiempoPromedioResolucion = 0;
        }
        
        data.eficiencia = data.total > 0 ? (data.completados / data.total) * 100 : 0;
        data.problemasAtendidosCount = data.problemasAtendidos.size;
        data.departamentosAtendidosCount = data.departamentosAtendidos.size;
        
        let prioridadMasComun = 'normal';
        let maxPrioridad = 0;
        Object.entries(data.prioridades).forEach(([prioridad, count]) => {
            if (count > maxPrioridad) {
                maxPrioridad = count;
                prioridadMasComun = prioridad;
            }
        });
        data.prioridadMasComun = prioridadMasComun;
    });
    
    Object.keys(estadisticas.porSolicitante).forEach(solicitante => {
        const data = estadisticas.porSolicitante[solicitante];
        
        if (data.fechas.length >= 2) {
            const fechasOrdenadas = data.fechas.sort((a, b) => a - b);
            const diffDias = (fechasOrdenadas[fechasOrdenadas.length - 1] - fechasOrdenadas[0]) / (1000 * 60 * 60 * 24);
            data.frecuenciaDias = diffDias > 0 ? (data.total / diffDias) : data.total;
            
            if (data.frecuenciaDias >= 1) data.nivelFrecuencia = 'Alta';
            else if (data.frecuenciaDias >= 0.5) data.nivelFrecuencia = 'Media';
            else data.nivelFrecuencia = 'Baja';
        } else {
            data.frecuenciaDias = data.total;
            data.nivelFrecuencia = data.total > 0 ? 'Nueva' : 'Ninguna';
        }
        
        data.departamentosCount = data.departamentos.size;
        data.problemasReportadosCount = data.problemasReportados.size;
        
        let prioridadMasComun = 'normal';
        let maxPrioridad = 0;
        Object.entries(data.prioridades).forEach(([prioridad, count]) => {
            if (count > maxPrioridad) {
                maxPrioridad = count;
                prioridadMasComun = prioridad;
            }
        });
        data.prioridadMasComun = prioridadMasComun;
        
        data.tasaResolucion = data.total > 0 ? (data.completados / data.total) * 100 : 0;
    });
    
    Object.keys(estadisticas.porProblema).forEach(problema => {
        const data = estadisticas.porProblema[problema];
        
        if (data.tiemposResolucion.length > 0) {
            const sumaTiempos = data.tiemposResolucion.reduce((a, b) => a + b, 0);
            data.tiempoPromedioResolucion = sumaTiempos / data.tiemposResolucion.length;
        } else {
            data.tiempoPromedioResolucion = 0;
        }
        
        data.tasaResolucion = data.frecuencia > 0 ? 
            (data.estados.completada / data.frecuencia) * 100 : 0;
        
        let prioridadMasComun = 'normal';
        let maxPrioridad = 0;
        Object.entries(data.prioridades).forEach(([prioridad, count]) => {
            if (count > maxPrioridad) {
                maxPrioridad = count;
                prioridadMasComun = prioridad;
            }
        });
        data.prioridadMasComun = prioridadMasComun;
    });
    
    if (estadisticas.tiemposResolucion.length > 0) {
        const sumaTiempos = estadisticas.tiemposResolucion.reduce((a, b) => a + b, 0);
        estadisticas.tiempoPromedioResolucionTotal = sumaTiempos / estadisticas.tiemposResolucion.length;
        estadisticas.tiempoMaximoResolucion = Math.max(...estadisticas.tiemposResolucion);
        estadisticas.tiempoMinimoResolucion = Math.min(...estadisticas.tiemposResolucion);
    } else {
        estadisticas.tiempoPromedioResolucionTotal = 0;
        estadisticas.tiempoMaximoResolucion = 0;
        estadisticas.tiempoMinimoResolucion = 0;
    }
    
    if (actividades.length > 0) {
        estadisticas.porcentajeCompletadas = (estadisticas.porEstado.completada || 0) / actividades.length * 100;
        estadisticas.porcentajePendientes = (estadisticas.porEstado.pendiente || 0) / actividades.length * 100;
        estadisticas.porcentajeEnProgreso = (estadisticas.porEstado.en_progreso || 0) / actividades.length * 100;
    } else {
        estadisticas.porcentajeCompletadas = 0;
        estadisticas.porcentajePendientes = 0;
        estadisticas.porcentajeEnProgreso = 0;
    }
    
    if (actividades.length > 0) {
        const fechas = actividades.map(a => new Date(a.creado_en));
        estadisticas.fechaInicio = new Date(Math.min(...fechas));
        estadisticas.fechaFin = new Date(Math.max(...fechas));
        
        const diffTiempo = estadisticas.fechaFin - estadisticas.fechaInicio;
        estadisticas.rangoDias = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24)) + 1;
    } else {
        estadisticas.fechaInicio = null;
        estadisticas.fechaFin = null;
        estadisticas.rangoDias = 0;
    }
    
    estadisticas.actividadesPorMesOrdenado = Object.entries(estadisticas.actividadesPorMes)
        .sort(([mesA], [mesB]) => mesA.localeCompare(mesB))
        .slice(-12);
    
    return estadisticas;
}

function calcularTiempoResolucion(fechaInicio, fechaFin) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    return (fin - inicio) / (1000 * 60 * 60);
}

function mostrarResumenEstadisticas(estadisticas) {
    const contenedor = document.getElementById('resumenEstadisticas');
    if (!contenedor) return;
    
    let deptoMasIncidentes = 'N/A';
    let maxIncidentes = 0;
    Object.entries(estadisticas.porDepartamento).forEach(([depto, data]) => {
        if (data.total > maxIncidentes) {
            maxIncidentes = data.total;
            deptoMasIncidentes = depto;
        }
    });
    
    let problemaMasComun = 'N/A';
    let maxFrecuencia = 0;
    Object.entries(estadisticas.porProblema).forEach(([problema, data]) => {
        if (data.frecuencia > maxFrecuencia) {
            maxFrecuencia = data.frecuencia;
            problemaMasComun = problema;
        }
    });
    
    const totalActividades = estadisticas.total || 0;
    const completadas = estadisticas.porEstado.completada || 0;
    const pendientes = estadisticas.porEstado.pendiente || 0;
    const enProgreso = estadisticas.porEstado.en_progreso || 0;
    const porcentajeCompletadas = totalActividades > 0 ? 
        Math.round((completadas / totalActividades) * 100) : 0;
    const porcentajePendientes = totalActividades > 0 ? 
        Math.round((pendientes / totalActividades) * 100) : 0;
    
    contenedor.innerHTML = `
        <div class="row">
            <div class="col-md-6 mb-3">
                <div class="card h-100 border-primary shadow-sm">
                    <div class="card-header bg-primary text-white py-2">
                        <h6 class="mb-0"><i class="bi bi-building me-2"></i>Departamento con mas incidentes</h6>
                    </div>
                    <div class="card-body text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <i class="bi bi-building display-4 text-primary mb-3"></i>
                            <h3 class="text-primary mb-2">${deptoMasIncidentes}</h3>
                            <div class="d-flex flex-column gap-2 align-items-center">
                                <span class="badge bg-primary fs-6">${maxIncidentes} incidentes</span>
                                ${totalActividades > 0 ? 
                                    `<span class="badge bg-info">${Math.round((maxIncidentes / totalActividades) * 100)}% del total</span>` 
                                    : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6 mb-3">
                <div class="card h-100 border-warning shadow-sm">
                    <div class="card-header bg-warning text-white py-2">
                        <h6 class="mb-0"><i class="bi bi-bug me-2"></i>Problema mas comun</h6>
                    </div>
                    <div class="card-body text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <i class="bi bi-bug display-4 text-warning mb-3"></i>
                            <h5 class="text-warning mb-2">${problemaMasComun}</h5>
                            <div class="d-flex flex-column gap-2 align-items-center">
                                <span class="badge bg-warning fs-6">${maxFrecuencia} ocurrencias</span>
                                ${totalActividades > 0 ? 
                                    `<span class="badge bg-info">${Math.round((maxFrecuencia / totalActividades) * 100)}% del total</span>` 
                                    : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row mt-2">
            <div class="col-12">
                <div class="card bg-light border-0">
                    <div class="card-body py-3">
                        <div class="row text-center">
                            <div class="col-3">
                                <div class="p-2"><h5 class="text-primary mb-1">${totalActividades}</h5><small class="text-muted">Total Actividades</small></div>
                            </div>
                            <div class="col-3">
                                <div class="p-2"><h5 class="text-success mb-1">${completadas}</h5><small class="text-muted">Completadas</small>
                                    ${porcentajeCompletadas > 0 ? '<br><small class="text-success">' + porcentajeCompletadas + '%</small>' : ''}
                                </div>
                            </div>
                            <div class="col-3">
                                <div class="p-2"><h5 class="text-warning mb-1">${pendientes}</h5><small class="text-muted">Pendientes</small>
                                    ${porcentajePendientes > 0 ? '<br><small class="text-warning">' + porcentajePendientes + '%</small>' : ''}
                                </div>
                            </div>
                            <div class="col-3">
                                <div class="p-2"><h5 class="text-info mb-1">${enProgreso}</h5><small class="text-muted">En Progreso</small></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function mostrarEstadisticasDepartamentos(estadisticas) {
    const tbody = document.querySelector('#tablaDepartamentos tbody');
    if (!tbody) return;
    
    const departamentosOrdenados = Object.entries(estadisticas.porDepartamento)
        .sort((a, b) => b[1].total - a[1].total);
    
    let html = '';
    departamentosOrdenados.forEach(([depto, data]) => {
        const porcentaje = estadisticas.total > 0 ? 
            Math.round((data.total / estadisticas.total) * 100) : 0;
        
        html += `
            <tr>
                <td>${depto}</td>
                <td class="text-end">${data.total}</td>
                <td class="text-end">${data.pendientes > 0 ? '<span class="badge bg-warning">' + data.pendientes + '</span>' : 0}</td>
                <td class="text-end">${data.completados > 0 ? '<span class="badge bg-success">' + data.completados + '</span>' : 0}</td>
                <td class="text-end"><span class="badge bg-info">${porcentaje}%</span></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    crearGraficoDepartamentos(departamentosOrdenados.slice(0, 10));
}

function crearGraficoDepartamentos(departamentosData) {
    const canvas = document.getElementById('chartDepartamentos');
    if (!canvas) return;
    
    canvas.innerHTML = '';
    const canvasElement = document.createElement('canvas');
    canvas.appendChild(canvasElement);
    const ctx = canvasElement.getContext('2d');
    
    if (graficoDepartamentos) {
        graficoDepartamentos.destroy();
    }
    
    const labels = departamentosData.map(([depto]) => depto.length > 15 ? depto.substring(0, 15) + '...' : depto);
    const data = departamentosData.map(([, data]) => Number(data.total) || 0);
    
    graficoDepartamentos = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: labels, 
            datasets: [{
                label: 'Incidentes por Departamento',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.raw + ' incidentes';
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    title: { display: true, text: 'Numero de Incidentes' },
                    ticks: {
                        callback: function(value) {
                            return Number(value).toFixed(0);
                        }
                    }
                },
                x: { 
                    title: { display: true, text: 'Departamentos' }
                }
            }
        }
    });
}

function mostrarEstadisticasProblemas(estadisticas) {
    const tbody = document.querySelector('#tablaProblemas tbody');
    if (!tbody) return;
    
    const problemasOrdenados = Object.entries(estadisticas.porProblema)
        .sort((a, b) => b[1].frecuencia - a[1].frecuencia);
    
    let html = '';
    problemasOrdenados.forEach(([problema, data]) => {
        const porcentaje = estadisticas.total > 0 ? 
            Math.round((data.frecuencia / estadisticas.total) * 100) : 0;
        
        html += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <span class="badge bg-danger me-2" style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
                            <i class="bi bi-bug"></i>
                        </span>
                        ${problema}
                    </div>
                </td>
                <td class="text-end"><span class="badge bg-primary">${data.frecuencia}</span></td>
                <td class="text-end">
                    <div class="progress" style="height: 20px; width: 100px; margin-left: auto;">
                        <div class="progress-bar ${porcentaje >= 30 ? 'bg-danger' : porcentaje >= 15 ? 'bg-warning' : 'bg-info'}" 
                             role="progressbar" style="width: ${porcentaje}%;" aria-valuenow="${porcentaje}">
                            ${porcentaje}%
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    crearGraficoProblemas(problemasOrdenados.slice(0, 10));
}

function mostrarEstadisticasTecnicos(estadisticas) {
    const tbody = document.querySelector('#tablaTecnicos tbody');
    if (!tbody) return;
    
    const tecnicosOrdenados = Object.entries(estadisticas.porTecnico)
        .sort((a, b) => b[1].total - a[1].total);
    
    let html = '';
    tecnicosOrdenados.forEach(([tecnico, data]) => {
        let tiempoPromedio = 'N/A';
        let eficiencia = 0;
        
        if (data.tiemposResolucion.length > 0) {
            const sumaTiempos = data.tiemposResolucion.reduce((a, b) => a + b, 0);
            tiempoPromedio = (sumaTiempos / data.tiemposResolucion.length).toFixed(1) + 'h';
            eficiencia = data.total > 0 ? Math.round((data.completados / data.total) * 100) : 0;
        }
        
        const porcentajeTotal = estadisticas.total > 0 ? 
            Math.round((data.total / estadisticas.total) * 100) : 0;
        
        html += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <span class="badge bg-primary me-2" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                            <i class="bi bi-person-gear"></i>
                        </span>
                        <div>
                            <strong>${tecnico}</strong>
                            <div class="small text-muted">
                                ${data.completados} completadas de ${data.total}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="text-end">
                    <span class="badge bg-primary fs-6">${data.total}</span>
                </td>
                <td class="text-end">${data.pendientes > 0 ? '<span class="badge bg-warning">' + data.pendientes + '</span>' : 0}</td>
                <td class="text-end">${data.enProgreso > 0 ? '<span class="badge bg-info">' + data.enProgreso + '</span>' : 0}</td>
                <td class="text-end">${data.completados > 0 ? '<span class="badge bg-success">' + data.completados + '</span>' : 0}</td>
                <td class="text-end">${tiempoPromedio}</td>
                <td class="text-end">
                    <div class="d-flex align-items-center justify-content-end gap-2">
                        <div class="progress" style="height: 20px; width: 80px;">
                            <div class="progress-bar ${eficiencia >= 80 ? 'bg-success' : eficiencia >= 60 ? 'bg-warning' : 'bg-danger'}" 
                                 role="progressbar" style="width: ${eficiencia}%;" 
                                 aria-valuenow="${eficiencia}">
                            </div>
                        </div>
                        <span class="small fw-bold">${eficiencia}%</span>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    crearGraficoTecnicos(tecnicosOrdenados.slice(0, 10));
}

function crearGraficoTecnicos(tecnicosData) {
    const canvas = document.getElementById('chartTecnicos');
    if (!canvas) return;
    
    canvas.innerHTML = '';
    const canvasElement = document.createElement('canvas');
    canvas.appendChild(canvasElement);
    const ctx = canvasElement.getContext('2d');
    
    if (graficoTecnicos) {
        graficoTecnicos.destroy();
    }
    
    const labels = tecnicosData.map(([tecnico]) => 
        tecnico.length > 15 ? tecnico.substring(0, 15) + '...' : tecnico
    );
    const totales = tecnicosData.map(([, data]) => Number(data.total) || 0);
    const completados = tecnicosData.map(([, data]) => Number(data.completados) || 0);
    
    graficoTecnicos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Asignaciones',
                    data: totales,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Completadas',
                    data: completados,
                    backgroundColor: 'rgba(75, 192, 192, 0.7)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Numero de Actividades'
                    },
                    ticks: {
                        callback: function(value) {
                            return Number(value).toFixed(0);
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Tecnicos'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.raw;
                        }
                    }
                }
            }
        }
    });
}

function mostrarEstadisticasSolicitantes(estadisticas) {
    const tbody = document.querySelector('#tablaSolicitantes tbody');
    if (!tbody) return;
    
    const solicitantesOrdenados = Object.entries(estadisticas.porSolicitante)
        .sort((a, b) => b[1].total - a[1].total);
    
    let html = '';
    solicitantesOrdenados.forEach(([solicitante, data]) => {
        let frecuencia = 'Baja';
        if (data.fechas.length >= 2) {
            const fechasOrdenadas = data.fechas.sort((a, b) => a - b);
            const diffDias = (fechasOrdenadas[fechasOrdenadas.length - 1] - fechasOrdenadas[0]) / (1000 * 60 * 60 * 24);
            const solicitudesPorDia = data.total / Math.max(diffDias, 1);
            
            if (solicitudesPorDia >= 1) frecuencia = 'Alta';
            else if (solicitudesPorDia >= 0.5) frecuencia = 'Media';
        }
        
        const porcentajeTotal = estadisticas.total > 0 ? 
            Math.round((data.total / estadisticas.total) * 100) : 0;
        
        let departamentoMostrar = 'No especificado';
        if (data.departamentos && data.departamentos.size > 0) {
            const deptosArray = Array.from(data.departamentos);
            if (deptosArray.length === 1) {
                departamentoMostrar = deptosArray[0];
            } else {
                departamentoMostrar = deptosArray[0] + ' +' + (deptosArray.length - 1);
            }
        }
        
        html += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <span class="badge bg-secondary me-2" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                            <i class="bi bi-person-badge"></i>
                        </span>
                        <div>
                            <strong>${solicitante}</strong>
                            <div class="small text-muted">
                                ${departamentoMostrar}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="text-end">
                    <span class="badge bg-primary fs-6">${data.total}</span>
                </td>
                <td class="text-end">${data.pendientes > 0 ? '<span class="badge bg-warning">' + data.pendientes + '</span>' : 0}</td>
                <td class="text-end">${data.enProgreso > 0 ? '<span class="badge bg-info">' + data.enProgreso + '</span>' : 0}</td>
                <td class="text-end">${data.completados > 0 ? '<span class="badge bg-success">' + data.completados + '</span>' : 0}</td>
                <td class="text-end">
                    <span class="badge bg-info">${departamentoMostrar}</span>
                </td>
                <td class="text-end">
                    <span class="badge ${frecuencia === 'Alta' ? 'bg-danger' : frecuencia === 'Media' ? 'bg-warning' : 'bg-secondary'}">
                        ${frecuencia}
                    </span>
                    <div class="small text-muted mt-1">${porcentajeTotal}% del total</div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    crearGraficoSolicitantes(solicitantesOrdenados.slice(0, 10));
}

function crearGraficoSolicitantes(solicitantesData) {
    const canvas = document.getElementById('chartSolicitantes');
    if (!canvas) return;
    
    canvas.innerHTML = '';
    const canvasElement = document.createElement('canvas');
    canvas.appendChild(canvasElement);
    const ctx = canvasElement.getContext('2d');
    
    if (graficoSolicitantes) {
        graficoSolicitantes.destroy();
    }
    
    const labels = solicitantesData.map(([solicitante]) => 
        solicitante.length > 15 ? solicitante.substring(0, 15) + '...' : solicitante
    );
    const totales = solicitantesData.map(([, data]) => Number(data.total) || 0);
    
    graficoSolicitantes = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: labels,
            datasets: [{
                label: 'Solicitudes por Solicitante',
                data: totales,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                    'rgba(255, 159, 64, 0.7)',
                    'rgba(201, 203, 207, 0.7)',
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(201, 203, 207, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    ticks: {
                        display: true,
                        callback: function(value) {
                            return Number(value).toFixed(0);
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        font: { size: 10 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                            return context.label + ': ' + context.raw + ' solicitudes (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
}

function crearGraficoProblemas(problemasData) {
    const canvas = document.getElementById('chartProblemas');
    if (!canvas) return;
    
    canvas.innerHTML = '';
    const canvasElement = document.createElement('canvas');
    canvas.appendChild(canvasElement);
    const ctx = canvasElement.getContext('2d');
    
    if (graficoProblemas) {
        graficoProblemas.destroy();
    }
    
    const labels = problemasData.map(([problema]) => problema.length > 20 ? problema.substring(0, 20) + '...' : problema);
    const data = problemasData.map(([, data]) => Number(data.frecuencia) || 0);
    
    graficoProblemas = new Chart(ctx, {
        type: 'doughnut',
        data: { 
            labels: labels, 
            datasets: [{
                label: 'Problemas mas Comunes',
                data: data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)',
                    'rgba(201, 203, 207, 0.7)', 'rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)', 'rgba(255, 159, 64, 1)',
                    'rgba(201, 203, 207, 1)', 'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    position: 'right', 
                    labels: { 
                        boxWidth: 12, 
                        font: { size: 10 }
                    } 
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : 0;
                            return context.label + ': ' + context.raw + ' (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
}

function actualizarInfoFiltroEstadisticas() {
    const infoElement = document.getElementById('infoFiltroEstadisticas');
    if (!infoElement) return;
    
    const periodo = document.getElementById('filtroPeriodo')?.value || 'todos';
    const filtroFechaDesde = document.getElementById('filtroFechaDesde')?.value;
    const filtroFechaHasta = document.getElementById('filtroFechaHasta')?.value;
    
    let texto = '';
    if (periodo !== 'todos') {
        const nombresPeriodo = {
            'hoy': 'Hoy', 'ayer': 'Ayer', 'semana': 'Esta semana',
            'mes': 'Este mes', 'anterior': 'Mes anterior'
        };
        texto = nombresPeriodo[periodo] || periodo;
    } else if (filtroFechaDesde && filtroFechaHasta) {
        texto = filtroFechaDesde + ' al ' + filtroFechaHasta;
    } else if (filtroFechaDesde) {
        texto = 'Desde ' + filtroFechaDesde;
    } else if (filtroFechaHasta) {
        texto = 'Hasta ' + filtroFechaHasta;
    } else {
        texto = 'Todos los periodos';
    }
    
    infoElement.textContent = texto;
}

// ========== FUNCIONES DE EDICION ==========
function configurarModalEdicion() {
    const modal = document.getElementById('modalEditarActividad');
    if (!modal) return;
    
    const btnGuardarEdicion = document.getElementById('btnGuardarEdicion');
    if (btnGuardarEdicion) btnGuardarEdicion.addEventListener('click', guardarEdicionActividad);
    
    modal.addEventListener('show.bs.modal', function() {
        actualizarSelectProblemas();
        actualizarSelectDepartamentos();
        actualizarSelectSolicitantes();
        actualizarSelectTecnicos();
    });
    
    modal.addEventListener('hidden.bs.modal', function() {
        const selectTecnicos = document.getElementById('editarTecnico');
        if (selectTecnicos) {
            Array.from(selectTecnicos.options).forEach(opt => opt.selected = false);
        }
    });
}

window.editarActividad = async function(id) {
    try {
        const { data, error } = await db.from('actividades').select('*').eq('id', id).single();
        if (error) throw error;
        
        const puedeEditar = true;
        
        if (!puedeEditar) {
            mostrarMensaje('No tienes permisos para editar esta actividad', 'error');
            return;
        }
        
        const formatearFechaParaInput = (fechaISO) => {
            if (!fechaISO) return '';
            const fecha = new Date(fechaISO);
            const offset = fecha.getTimezoneOffset() * 60000;
            const fechaLocal = new Date(fecha.getTime() - offset);
            return fechaLocal.toISOString().slice(0, 16);
        };
         
        document.getElementById('editarId').value = data.id;
        document.getElementById('editarDescripcion').value = data.descripcion;
        
        const selectTecnicos = document.getElementById('editarTecnico');
        if (selectTecnicos) {
            Array.from(selectTecnicos.options).forEach(opt => opt.selected = false);
            
            // Usar tecnicos_inicio en lugar de tecnico
            const tecnicosTexto = data.tecnicos_inicio || data.tecnico || '';
            const nombresTecnicos = tecnicosTexto.split(',').map(t => t.trim()).filter(t => t !== '');
            
            nombresTecnicos.forEach(nombreTecnico => {
                for (let opt of selectTecnicos.options) {
                    if (opt.text === nombreTecnico) {
                        opt.selected = true;
                        break;
                    }
                }
            });
        }
        
        if (data.solicitante_id) {
            document.getElementById('editarSolicitante').value = data.solicitante_id;
        } else {
            const solicitante = listaSolicitantes.find(s => s.nombre === data.solicitante);
            if (solicitante) {
                document.getElementById('editarSolicitante').value = solicitante.id;
            } else {
                document.getElementById('editarSolicitante').value = data.solicitante || '';
            }
        }
        
        document.getElementById('editarPrioridad').value = data.prioridad;
        document.getElementById('editarEstado').value = data.estado;
        document.getElementById('editarUbicacion').value = data.ubicacion || '';
        document.getElementById('editarDepartamento').value = data.departamento || '';
        document.getElementById('editarCreadoEn').value = formatearFechaParaInput(data.creado_en);
        document.getElementById('editarCompletadoEn').value = formatearFechaParaInput(data.completado_en);
        document.getElementById('editarNotasIniciales').value = data.notas_iniciales || '';
        document.getElementById('editarNotas').value = data.notas || '';
        
        setTimeout(() => {
            const selectSolicitante = document.getElementById('editarSolicitante');
            if (selectSolicitante) {
                if (data.solicitante_id) {
                    selectSolicitante.value = data.solicitante_id;
                }
                const event = new Event('change', { bubbles: true });
                selectSolicitante.dispatchEvent(event);
            }
            
            const selectProblema = document.getElementById('editarDescripcion');
            if (selectProblema && data.descripcion) {
                selectProblema.value = data.descripcion;
            }
            
            const selectDepto = document.getElementById('editarDepartamento');
            if (selectDepto && data.departamento) {
                selectDepto.value = data.departamento;
            }
            
            const selectTecnicos = document.getElementById('editarTecnico');
            if (selectTecnicos) {
                const tecnicosTexto = data.tecnicos_inicio || data.tecnico || '';
                const nombresTecnicos = tecnicosTexto.split(',').map(t => t.trim()).filter(t => t !== '');
                
                nombresTecnicos.forEach(nombreTecnico => {
                    for (let opt of selectTecnicos.options) {
                        if (opt.text === nombreTecnico) {
                            opt.selected = true;
                            break;
                        }
                    }
                });
            }
        }, 100);
        
        new bootstrap.Modal(document.getElementById('modalEditarActividad')).show();
        
    } catch (error) {
        mostrarMensaje('Error al cargar actividad: ' + error.message, 'error');
    }
};

async function guardarEdicionActividad() {
    const id = document.getElementById('editarId').value;
    
    const btnGuardar = document.getElementById('btnGuardarEdicion');
    const originalText = btnGuardar.innerHTML;
    
    try {
        btnGuardar.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';
        btnGuardar.disabled = true;
        
        const tecnicoSelect = document.getElementById('editarTecnico');
        let tecnicosIdsEdit = [];
        let tecnicosNombresEdit = [];

        if (tecnicoSelect.selectedOptions) {
            tecnicosIdsEdit = Array.from(tecnicoSelect.selectedOptions).map(opt => opt.value);
            tecnicosNombresEdit = Array.from(tecnicoSelect.selectedOptions).map(opt => opt.text);
        } else {
            tecnicosIdsEdit = tecnicoSelect.value ? [tecnicoSelect.value] : [];
            if (tecnicosIdsEdit[0]) {
                const tecnico = listaTecnicos.find(t => t.id.toString() === tecnicosIdsEdit[0]);
                if (tecnico) tecnicosNombresEdit = [tecnico.nombre];
            }
        }

        if (tecnicosIdsEdit.length === 0) {
            throw new Error('Por favor selecciona al menos un técnico');
        }

        const tecnicosTexto = tecnicosNombresEdit.join(', ');
        
        const solicitanteSelect = document.getElementById('editarSolicitante');
        let solicitanteId = solicitanteSelect.value;
        let solicitanteNombre = '';
        
        if (solicitanteId === "__nuevo__") {
            throw new Error('Por favor selecciona un solicitante válido');
        } else if (solicitanteId) {
            const solicitante = listaSolicitantes.find(s => s.id == solicitanteId);
            solicitanteNombre = solicitante ? solicitante.nombre : '';
        }
        
        if (!solicitanteNombre) {
            throw new Error('Por favor selecciona un solicitante');
        }
        
        const actividadEditada = {
            descripcion: document.getElementById('editarDescripcion').value.trim(),
            tecnico: tecnicosTexto,
            tecnico_id: tecnicosIdsEdit[0] || null,
            tecnicos_inicio: tecnicosTexto,
            tecnicos_inicio_ids: tecnicosIdsEdit.join(','),
            solicitante_id: solicitanteId,
            solicitante: solicitanteNombre,
            prioridad: document.getElementById('editarPrioridad').value,
            estado: document.getElementById('editarEstado').value,
            ubicacion: document.getElementById('editarUbicacion').value.trim(),
            departamento: document.getElementById('editarDepartamento').value.trim() || '',
            notas_iniciales: document.getElementById('editarNotasIniciales').value.trim() || '',
            notas: document.getElementById('editarNotas').value.trim()
        };
        
        const fechaCreacion = document.getElementById('editarCreadoEn').value;
        if (fechaCreacion) {
            const fecha = new Date(fechaCreacion);
            const offset = fecha.getTimezoneOffset() * 60000;
            const fechaAjustada = new Date(fecha.getTime() - offset);
            actividadEditada.creado_en = fechaAjustada.toISOString();
        }
        
        const completadoEn = document.getElementById('editarCompletadoEn').value;
        if (completadoEn) {
            const fecha = new Date(completadoEn);
            const offset = fecha.getTimezoneOffset() * 60000;
            const fechaAjustada = new Date(fecha.getTime() - offset);
            actividadEditada.completado_en = fechaAjustada.toISOString();
        } else if (actividadEditada.estado === 'completada') {
            const ahora = new Date();
            const offset = ahora.getTimezoneOffset() * 60000;
            const fechaAjustada = new Date(ahora.getTime() - offset);
            actividadEditada.completado_en = fechaAjustada.toISOString();
        } else {
            actividadEditada.completado_en = null;
        }
        
        if (!actividadEditada.descripcion || !actividadEditada.creado_en) {
            throw new Error('Descripción y fecha de creación son requeridos');
        }
        
        const { error } = await db.from('actividades').update(actividadEditada).eq('id', id);
        if (error) throw error;
        
        mostrarMensaje('Actividad actualizada exitosamente!', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarActividad'));
        modal.hide();
        
        await cargarActividades();
        
    } catch (error) {
        mostrarMensaje('Error: ' + error.message, 'error');
    } finally {
        btnGuardar.innerHTML = originalText;
        btnGuardar.disabled = false;
    }
}

window.eliminarActividadDesdeModal = function() {
    const id = document.getElementById('editarId').value;
    if (!id) return;
    
    if (!tienePermiso('eliminar')) {
        mostrarMensaje('No tienes permisos para eliminar actividades', 'error');
        return;
    }
    
    if (confirm('¿Eliminar permanentemente esta actividad? Esta accion no se puede deshacer.')) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarActividad'));
        modal.hide();
        eliminarActividad(id);
    }
};

// ========== FUNCIONES PARA FECHA/HORA PERSONALIZABLE ==========

window.verDetallesUsuario = async function(id) {
    try {
        const { data: user, error } = await db
            .from('usuarios')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        let fechaNacimiento = 'No registrada';
        if (user.fecha_nacimiento) {
            if (typeof user.fecha_nacimiento === 'string' && user.fecha_nacimiento.includes('-')) {
                const [año, mes, dia] = user.fecha_nacimiento.split('T')[0].split('-');
                const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                fechaNacimiento = parseInt(dia) + ' de ' + meses[parseInt(mes)-1] + ' de ' + año;
            } else {
                const fecha = new Date(user.fecha_nacimiento + 'T12:00:00');
                fechaNacimiento = fecha.toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
        }
        
        const fechaCreacion = user.creado_en 
            ? new Date(user.creado_en).toLocaleString('es-MX')
            : 'Desconocida';
        
        const ultimoLogin = user.ultimo_login 
            ? new Date(user.ultimo_login).toLocaleString('es-MX')
            : 'Nunca ha iniciado sesion';
        
        let telefonoFormateado = 'No registrado';
        if (user.telefono) {
            telefonoFormateado = user.telefono.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
        }
        
        const modalHtml = `
            <div class="modal fade" id="modalDetallesUsuario" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header modal-header-gradient">
                            <h5 class="modal-title">
                                <i class="bi bi-person-badge me-2"></i>
                                Detalles del Usuario
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-4">
                                <div class="rounded-circle bg-light mx-auto d-flex align-items-center justify-content-center" 
                                     style="width: 100px; height: 100px; overflow: hidden; border: 3px solid ${user.rol === 'admin' ? '#dc3545' : '#0d6efd'};">
                                    ${user.foto_perfil ? 
                                        `<img src="${user.foto_perfil}" style="width: 100%; height: 100%; object-fit: cover;">` : 
                                        `<i class="bi bi-person-circle" style="font-size: 4rem; color: ${user.rol === 'admin' ? '#dc3545' : '#0d6efd'};"></i>`
                                    }
                                </div>
                                <h5 class="mt-3 mb-1">${user.nombre}</h5>
                                <span class="badge ${user.rol === 'admin' ? 'bg-danger' : 'bg-primary'}">
                                    @${user.usuario}
                                </span>
                            </div>
                            
                            <table class="table table-sm">
                                <tr>
                                    <th style="width: 40%"><i class="bi bi-envelope me-2"></i>Email:</th>
                                    <td>${user.email || '<span class="text-muted">No registrado</span>'}</td>
                                </tr>
                                <tr>
                                    <th><i class="bi bi-phone me-2"></i>Telefono:</th>
                                    <td>${telefonoFormateado}</td>
                                </tr>
                                <tr>
                                    <th><i class="bi bi-calendar3 me-2"></i>Fecha Nac.:</th>
                                    <td>${fechaNacimiento}</td>
                                </tr>
                                <tr>
                                    <th><i class="bi bi-shield-check me-2"></i>Rol:</th>
                                    <td><span class="badge ${user.rol === 'admin' ? 'bg-danger' : 'bg-primary'}">${user.rol.toUpperCase()}</span></td>
                                </tr>
                                <tr>
                                    <th><i class="bi bi-circle me-2"></i>Estado:</th>
                                    <td><span class="badge ${user.activo ? 'bg-success' : 'bg-secondary'}">${user.activo ? 'ACTIVO' : 'INACTIVO'}</span></td>
                                </tr>
                                <tr>
                                    <th><i class="bi bi-calendar-plus me-2"></i>Fecha Creacion:</th>
                                    <td><small>${fechaCreacion}</small></td>
                                </tr>
                                <tr>
                                    <th><i class="bi bi-clock-history me-2"></i>Ultimo Acceso:</th>
                                    <td><small>${ultimoLogin}</small></td>
                                </tr>
                            </table>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const modalAnterior = document.getElementById('modalDetallesUsuario');
        if (modalAnterior) modalAnterior.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = new bootstrap.Modal(document.getElementById('modalDetallesUsuario'));
        modal.show();
        
        document.getElementById('modalDetallesUsuario').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
        
    } catch (error) {
        console.error('Error cargando detalles:', error);
        mostrarMensaje('Error al cargar detalles del usuario', 'error');
    }
};

// ========== EXPORTAR USUARIOS ==========
window.exportarUsuarios = async function() {
    if (!tienePermiso('gestion_usuarios')) {
        mostrarMensaje('No tienes permisos para exportar usuarios', 'error');
        return;
    }
    
    if (!confirm('¿Exportar la lista de usuarios a Excel?\n\nSe exportaran todos los usuarios del sistema (sin incluir contrasenas).')) {
        return;
    }
    
    const btnExportar = document.getElementById('btnExportarUsuarios');
    const originalHTML = btnExportar.innerHTML;
    
    try {
        btnExportar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Exportando...';
        btnExportar.disabled = true;
        
        const { data: usuarios, error } = await db
            .from('usuarios')
            .select('*')
            .order('nombre', { ascending: true });
        
        if (error) throw error;
        
        if (!usuarios || usuarios.length === 0) {
            mostrarMensaje('No hay usuarios para exportar', 'info');
            return;
        }
        
        const datosExcel = usuarios.map(user => {
            let fechaNacimiento = '';
            if (user.fecha_nacimiento) {
                const fecha = new Date(user.fecha_nacimiento + 'T12:00:00');
                fechaNacimiento = fecha.toLocaleDateString('es-MX');
            }
            
            const ultimoLogin = user.ultimo_login 
                ? new Date(user.ultimo_login).toLocaleString('es-MX')
                : 'Nunca';
            
            let telefono = user.telefono || '';
            if (telefono) {
                telefono = telefono.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
            }
            
            return {
                'Nombre Completo': user.nombre || '',
                'Email': user.email || '',
                'Telefono': telefono,
                'Rol': user.rol === 'admin' ? 'Administrador' : 'Tecnico',
                'Estado': user.activo ? 'Activo' : 'Inactivo',
                'Fecha de Nacimiento': fechaNacimiento,
                'Ultimo Acceso': ultimoLogin,
                'Fecha de Creacion': user.creado_en ? new Date(user.creado_en).toLocaleString('es-MX') : ''
            };
        });
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datosExcel);
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        const borderStyle = { style: 'thin', color: { rgb: '000000' } };
        
        for(let R = range.s.r; R <= range.e.r; ++R) {
            for(let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = {c: C, r: R};
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                
                if(!ws[cell_ref]) continue;
                
                if(!ws[cell_ref].s) ws[cell_ref].s = {};
                ws[cell_ref].s.border = {
                    top: borderStyle,
                    bottom: borderStyle,
                    left: borderStyle,
                    right: borderStyle
                };
                
                if(R === range.s.r) {
                    ws[cell_ref].s.font = { bold: true, color: { rgb: "FFFFFF" } };
                    ws[cell_ref].s.fill = { fgColor: { rgb: "4472C4" } };
                }
            }
        }
        
        ws['!cols'] = [
            { wch: 30 },
            { wch: 35 },
            { wch: 15 },
            { wch: 15 },
            { wch: 10 },
            { wch: 15 },
            { wch: 22 },
            { wch: 22 }
        ];
        
        const resumenData = [
            ['REPORTE DE USUARIOS DEL SISTEMA'],
            ['Fecha de exportacion:', new Date().toLocaleString('es-MX')],
            ['Total de usuarios:', usuarios.length],
            ['Administradores:', usuarios.filter(u => u.rol === 'admin').length],
            ['Tecnicos:', usuarios.filter(u => u.rol === 'tecnico').length],
            ['Activos:', usuarios.filter(u => u.activo).length],
            ['Inactivos:', usuarios.filter(u => !u.activo).length],
            []
        ];
        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
        
        XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
        
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, 'Usuarios_Sistema_' + fecha + '.xlsx');
        
        mostrarMensaje(usuarios.length + ' usuarios exportados correctamente', 'success');
        
    } catch (error) {
        console.error('Error exportando usuarios:', error);
        mostrarMensaje('Error al exportar: ' + error.message, 'error');
    } finally {
        btnExportar.innerHTML = originalHTML;
        btnExportar.disabled = false;
    }
};

// ========== FUNCIONES PARA FECHA/HORA PERSONALIZABLE ==========
window.establecerFechaHoraActual = function() {
    const inputFechaHora = document.getElementById('fechaHora');
    if (!inputFechaHora) return;
    
    const ahora = new Date();
    const year = ahora.getFullYear();
    const month = String(ahora.getMonth() + 1).padStart(2, '0');
    const day = String(ahora.getDate()).padStart(2, '0');
    const hours = String(ahora.getHours()).padStart(2, '0');
    const minutes = String(ahora.getMinutes()).padStart(2, '0');
    
    inputFechaHora.value = year + '-' + month + '-' + day + 'T' + hours + ':' + minutes;
};

window.cambiarEstadoUsuario = async function(id, nuevoEstado) {
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    const confirmText = nuevoEstado 
        ? '¿Activar este usuario? Podra acceder al sistema.'
        : '¿Desactivar este usuario? No podra acceder al sistema.';
    
    if (!confirm(confirmText)) return;

    try {
        const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual') || '{}');
        if (usuarioActual.rol !== 'admin') {
            alert('Solo los administradores pueden gestionar usuarios');
            return;
        }

        const { error } = await db
            .from('usuarios')
            .update({ activo: nuevoEstado })
            .eq('id', id);

        if (error) throw error;

        const mensaje = nuevoEstado 
            ? 'Usuario activado exitosamente'
            : 'Usuario desactivado exitosamente';
        
        alert(mensaje);
        
        await cargarUsuariosParaGestion();
        
        if (!nuevoEstado && typeof cargarTecnicos === 'function') {
            await cargarTecnicos();
        }

    } catch (error) {
        console.error('Error cambiando estado:', error);
        alert('Error: ' + error.message);
    }
};

window.confirmarEliminarUsuario = async function(id) {
    if (!confirm('¿Eliminar permanentemente este usuario? Esta accion no se puede deshacer.')) {
        return;
    }
    
    try {
        const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual') || '{}');
        if (usuarioActual.rol !== 'admin') {
            alert('Solo los administradores pueden eliminar usuarios');
            return;
        }

        if (id === usuarioActual.id) {
            alert('No puedes eliminar tu propia cuenta');
            return;
        }

        const { data: actividades, error: actividadesError } = await db
            .from('actividades')
            .select('id, estado')
            .eq('tecnico_id', id);

        if (actividadesError) throw actividadesError;

        if (actividades && actividades.length > 0) {
            const actividadesPendientes = actividades.filter(a => 
                a.estado === 'pendiente' || a.estado === 'en_progreso'
            );
            
            const actividadesCompletadas = actividades.filter(a => 
                a.estado === 'completada'
            );

            let mensajeError = 'No se puede eliminar el usuario porque tiene:\n';
            
            if (actividadesPendientes.length > 0) {
                mensajeError += '- ' + actividadesPendientes.length + ' actividad(es) pendiente(s) o en progreso\n';
            }
            
            if (actividadesCompletadas.length > 0) {
                mensajeError += '- ' + actividadesCompletadas.length + ' actividad(es) completada(s)\n';
            }
            
            mensajeError += '\nDebe completar estas actividades primero.';
            
            alert(mensajeError);
            return;
        }

        const { error } = await db
            .from('usuarios')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('Usuario eliminado exitosamente');
        
        await cargarUsuariosParaGestion();
        
        if (typeof cargarTecnicos === 'function') {
            await cargarTecnicos();
        }

    } catch (error) {
        console.error('Error eliminando usuario:', error);
        alert('Error: ' + error.message);
    }
};

function actualizarBadgeUsuariosPendientes(usuarios) {
    if (!usuarios || !Array.isArray(usuarios)) return;
    
    const usuariosPendientes = usuarios.filter(u => !u.activo && u.rol === 'tecnico');
    const badge = document.getElementById('badgeUsuariosPendientes');
    
    if (badge) {
        if (usuariosPendientes.length > 0) {
            badge.textContent = usuariosPendientes.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
    
    return usuariosPendientes.length;
}

window.abrirModalCrearUsuario = function() {
    const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual') || '{}');
    if (usuarioActual.rol !== 'admin') {
        alert('Solo los administradores pueden crear usuarios');
        return;
    }
    
    const form = document.getElementById('formCrearUsuario');
    if (form) form.reset();
    
    const strengthBar = document.getElementById('passwordStrength_input');
    if (strengthBar) strengthBar.style.width = '0%';
    
    const rolSelect = document.getElementById('nuevoRol_input');
    if (rolSelect) rolSelect.value = 'tecnico';
    
    const activoCheck = document.getElementById('usuarioActivo_input');
    if (activoCheck) activoCheck.checked = true;
    
    const modal = new bootstrap.Modal(document.getElementById('modalCrearUsuario'));
    modal.show();
};

// ========== CREAR NUEVO USUARIO ==========
window.crearNuevoUsuario = async function() {
    try {
        const usuarioActual = JSON.parse(localStorage.getItem('usuarioActual') || '{}');
        if (usuarioActual.rol !== 'admin') {
            mostrarMensaje('Solo los administradores pueden crear usuarios', 'error');
            return;
        }
        
        const usuario = document.getElementById('nuevoUsuario_input')?.value?.trim();
        const nombre = document.getElementById('nuevoNombre_input')?.value?.trim();
        const email = document.getElementById('nuevoEmail_input')?.value?.trim();
        const telefono = document.getElementById('nuevoTelefono_input')?.value?.trim();
        const fechaNacimiento = document.getElementById('nuevoFechaNacimiento_input')?.value;
        const fotoInput = document.getElementById('nuevoFotoPerfil_input');
        const contrasena = document.getElementById('nuevaContrasena_input')?.value;
        const confirmarContrasena = document.getElementById('confirmarContrasena_input')?.value;
        const rol = document.getElementById('nuevoRol_input')?.value;
        const activo = document.getElementById('usuarioActivo_input')?.checked;
        
        if (!usuario || !nombre || !contrasena) {
            let mensajeError = 'Campos requeridos faltantes:';
            if (!usuario) mensajeError += ' Usuario';
            if (!nombre) mensajeError += ' Nombre';
            if (!contrasena) mensajeError += ' Contrasena';
            
            mostrarMensaje(mensajeError, 'error');
            return;
        }
        
        let fotoBase64 = null;
        if (fotoInput && fotoInput.files && fotoInput.files[0]) {
            const file = fotoInput.files[0];
            
            if (file.size > 2 * 1024 * 1024) {
                mostrarMensaje('La imagen no debe superar los 2MB', 'error');
                return;
            }
            
            if (!file.type.match('image.*')) {
                mostrarMensaje('Solo se permiten archivos de imagen', 'error');
                return;
            }
            
            fotoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        }
        
        const usuarioData = {
            usuario: usuario,
            nombre: nombre,
            contrasena_hash: contrasena,
            email: email || null,
            telefono: telefono || null,
            fecha_nacimiento: fechaNacimiento || null,
            foto_perfil: fotoBase64,
            rol: rol,
            activo: activo
        };
        
        const { error } = await db
            .from('usuarios')
            .insert([usuarioData]);
        
        if (error) throw error;
        
        mostrarMensaje('Usuario "' + nombre + '" creado exitosamente', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalCrearUsuario'));
        modal.hide();
        
        document.getElementById('formCrearUsuario').reset();
        document.getElementById('vistaPreviaFoto').innerHTML = '<i class="bi bi-person-circle text-secondary" style="font-size: 2.5rem;"></i>';
        
        await cargarUsuariosParaGestion();
        
        if (rol === 'tecnico' && typeof cargarTecnicos === 'function') {
            await cargarTecnicos();
        }
        
    } catch (error) {
        console.error('Error creando usuario:', error);
        mostrarMensaje('Error al crear usuario: ' + error.message, 'error');
    }
};

// ========== GESTION DE SOLICITANTES EN BASE DE DATOS ==========
let listaSolicitantes = [];

async function cargarSolicitantes() {
    try {
        const { data, error } = await db
            .from('solicitantes')
            .select(`
                *,
                departamentos:departamento_id (
                    nombre,
                    ubicacion
                )
            `)
            .eq('activo', true)
            .order('nombre');
        
        if (error) throw error;
        
        if (!Array.isArray(listaSolicitantes)) {
            listaSolicitantes = [];
        }
        
        listaSolicitantes = Array.isArray(data) ? data.map(s => ({
            ...s,
            departamento: s.departamentos?.nombre || s.departamento || '',
            ubicacionDepartamento: s.departamentos?.ubicacion || ''
        })) : [];
        
        opcionesSolicitantes = listaSolicitantes.map(s => s.nombre);
        
        actualizarSelectSolicitantes();
        return listaSolicitantes;
    } catch (error) {
        console.error('Error cargando solicitantes:', error);
        mostrarMensaje('Error al cargar solicitantes', 'error');
        listaSolicitantes = listaSolicitantes || [];
        return [];
    }
}

async function agregarSolicitante(nombre, puesto, departamentoId, telefono = null, creadoPor = null) {
    try {
        if (validarDuplicado('solicitante', nombre)) {
            return { exito: false, mensaje: 'El solicitante "' + nombre + '" ya existe' };
        }
        
        const depto = listaDepartamentos.find(d => d.id == departamentoId);
        const nombreDepartamento = depto ? depto.nombre : '';
        
        let creadoPorValue = null;
        if (creadoPor) {
            creadoPorValue = parseInt(creadoPor);
            if (isNaN(creadoPorValue)) creadoPorValue = null;
        }
        
        if (!creadoPorValue) {
            const usuarioStr = localStorage.getItem('usuarioActual');
            if (usuarioStr) {
                try {
                    const usuario = JSON.parse(usuarioStr);
                    creadoPorValue = parseInt(usuario.id);
                } catch (e) {
                    console.error('Error parseando usuario:', e);
                }
            }
        }
        
        const nuevoSolicitante = {
            nombre: nombre,
            puesto: puesto,
            departamento_id: parseInt(departamentoId),
            departamento: nombreDepartamento,
            telefono: telefono || null,
            activo: true,
            creado_por: creadoPorValue
        };
        
        const { data, error } = await db
            .from('solicitantes')
            .insert([nuevoSolicitante])
            .select()
            .single();
        
        if (error) throw error;
        
        await cargarSolicitantes();
        
        return { exito: true, mensaje: 'Solicitante agregado correctamente', data };
    } catch (error) {
        console.error('Error agregando solicitante:', error);
        return { exito: false, mensaje: 'Error al agregar solicitante: ' + error.message };
    }
}

async function eliminarSolicitante(id) {
    try {
        const { data: actividades, error: checkError } = await db
            .from('actividades')
            .select('id')
            .eq('solicitante_id', id)
            .limit(1);
        
        if (checkError) throw checkError;
        
        if (actividades && actividades.length > 0) {
            const { error } = await db
                .from('solicitantes')
                .update({ activo: false })
                .eq('id', id);
            
            if (error) throw error;
            
            await cargarSolicitantes();
            return { exito: true, mensaje: 'Solicitante desactivado (tiene actividades asociadas)' };
        } else {
            const { error } = await db
                .from('solicitantes')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            await cargarSolicitantes();
            return { exito: true, mensaje: 'Solicitante eliminado permanentemente' };
        }
    } catch (error) {
        console.error('Error eliminando solicitante:', error);
        return { exito: false, mensaje: 'Error al eliminar solicitante: ' + error.message };
    }
}

async function actualizarDepartamentoSolicitante(id, nuevoDepartamento) {
    try {
        const { error } = await db
            .from('solicitantes')
            .update({ departamento: nuevoDepartamento })
            .eq('id', id);
        
        if (error) throw error;
        
        await cargarSolicitantes();
        return { exito: true, mensaje: 'Departamento actualizado correctamente' };
    } catch (error) {
        console.error('Error actualizando departamento:', error);
        return { exito: false, mensaje: 'Error al actualizar departamento' };
    }
}

// ========== EXPORTAR FORMATO DE MANTENIMIENTO ==========
window.exportarFormatoMantenimiento = async function(id) {
    try {
        const btnExportar = document.getElementById('btnExportarFormato-' + id);
        if (btnExportar) {
            btnExportar.innerHTML = '<i class="bi bi-hourglass-split"></i>';
            btnExportar.disabled = true;
        }
        
        const { data: actividad, error } = await db
            .from('actividades')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        const fechaCreacion = new Date(actividad.creado_en);
        const fechaFormateada = fechaCreacion.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        const estaCompletada = actividad.estado === 'completada';
        const hallazgo = actividad.notas && actividad.notas.trim() 
            ? actividad.notas.trim() 
            : 'Sin notas del tecnico registradas';
            
        const escudoBase64 = '';

        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        @page { size: letter; margin: 0; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f0f0; }
        .page {
            background: white;
            width: 215.9mm;
            height: 279.4mm;
            display: block;
            margin: 0 auto;
            padding: 15mm;
            box-sizing: border-box;
            position: relative;
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { border: 1px solid black; padding: 5px; font-size: 10pt; vertical-align: top; }
        
        .header-box { height: 60px; }
        .checkbox-table { width: 250px; float: right; margin-top: 10px; }
        .main-content { margin-top: 120px; }
        .recuadro-vacio { border: 1px solid black; min-height: 35px; margin-bottom: 15px; padding: 5px; display: flex; align-items: center; }
        .descripcion-box { border: 1px solid black; min-height: 400px; padding: 10px; }

        .verificacion-table { width: 100%; margin-top: 10px; }
        .verificacion-table th { text-align: center; font-weight: bold; }
        .col-larga { height: 500px; }
        .atendido-col { text-align: center; width: 45px; font-weight: bold; font-size: 14pt; }
        
        .footer-firmas { width: 100%; margin-top: 20px; }
        .footer-firmas td { height: 35px; vertical-align: middle; }

        .no-print { 
            position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 1000;
            background: white; padding: 10px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.5);
            text-align: center;
        }
        
        .mensaje-impresion {
            background-color: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 10px 15px;
            margin-bottom: 15px;
            font-size: 14px;
            border-radius: 4px;
        }

        @media print {
            body { background: none; }
            .page { margin: 0; border: none; box-shadow: none; }
            .no-print { display: none; }
            .mensaje-impresion { display: none; }
            .page-break { page-break-after: always; }
        }
    </style>
</head>
<body>
    <div class="no-print">
        <div class="mensaje-impresion">
            <strong><i class="bi bi-printer"></i> Se imprimiran DOS formatos de mantenimiento</strong><br>
            <small>Al imprimir, obtendras dos copias: La solicitud y otra para la entrega.</small>
        </div>
        <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;">Imprimir Formato</button>
        <button onclick="window.close()" style="padding: 10px 20px; cursor: pointer;">Cerrar</button>
    </div>

    <div class="page">
        <table>
            <tr> 
                <td style="width: 50%; font-weight: bold; text-align: center;">Solicitud-Orden de Trabajo de Mantenimientos y/o Servicios</td>
                <td style="width: 25%;"></td>
                <td rowspan="2" style="width: 25%; text-align: center;">
                    <img src="${escudoBase64 || 'itver.png'}" style="width: 60px;"><br>
                    <span style="font-size: 8pt;">Instituto Tecnologico de Veracruz</span>
                </td>
            </tr>
            <tr>
                <td style="font-size: 8pt;">
                    Docto No Controlado Hace Referencia a la norma ISO 9001: 2015<br>
                    6.1, 7.1, 7.2, 7.4, 7.5.1, 8.1<br>
                    Referencia a la Norma ISO 14001: 2015 4.1, 6.1, 8.1, 8.2
                </td>
                <td></td>
            </tr>
        </table>

        <table class="checkbox-table">
            <tr><td>Recursos Materiales y Servicios</td><td style="width: 30px;"></td></tr>
            <tr><td>Mantenimiento de Equipo</td><td style="width: 30px;"></td></tr>
            <tr><td>Centro de Computo</td><td style="width: 30px; text-align: center;">X</td></tr>
        </table>

        <div class="main-content">
            <div style="font-weight: bold; margin-bottom: 5px;">Area Solicitante:</div>
            <div class="recuadro-vacio">${actividad.departamento || ''}</div>

            <div style="font-weight: bold; margin-bottom: 5px;">Nombre y Firma Solicitante:</div>
            <div class="recuadro-vacio">${actividad.solicitante || ''}</div>

            <div style="font-weight: bold; margin-bottom: 5px;">Fecha de Elaboracion:</div>
            <div class="recuadro-vacio">${fechaFormateada}</div>

            <div style="font-weight: bold; margin-top: 10px; margin-bottom: 5px;">Descripcion del servicio solicitado o falla a reparar:</div>
            <div class="descripcion-box">${actividad.descripcion || ''}</div>
            <div style="font-size: 9pt; margin-top: 5px;">C.c.p. Area Solicitante.</div>
        </div>
    </div>

    <div class="page-break"></div>

    <div class="page">
        <table>
            <tr>
                <td style="width: 20%; text-align: center;">
                    <img src="${escudoBase64 || 'itver.png'}" style="width: 55px;">
                </td>
                <td style="text-align: center; font-weight: bold; vertical-align: middle;">
                    INSTITUTO TECNOLOGICO DE VERACRUZ<br>
                    MANTENIMIENTO LISTA DE VERIFICACION
                </td>
            </tr>
        </table>

        <table style="margin-top: 10px;">
            <tr><td style="width: 45%;">Centro de Computo</td><td>Miguel Angel Perez Cabada</td></tr>
            <tr><td>Subdireccion de Planeacion y Vinculacion</td><td>Jesus Javier Saucedo Cisneros</td></tr>
        </table>

        <div style="text-align: right; font-size: 10pt; margin-top: 15px; margin-bottom: 5px;">
            <strong>Fecha: ${fechaFormateada}</strong>
        </div>

        <table class="verificacion-table">
            <thead>
                <tr>
                    <th rowspan="2" style="width: 25%;">Espacio Revisado</th>
                    <th rowspan="2" style="width: 55%;">Hallazgo</th>
                    <th colspan="2" style="width: 20%;">Atendido</th>
                </tr>
                <tr>
                    <th style="font-size: 8pt;">SI</th>
                    <th style="font-size: 8pt;">NO</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="col-larga"><strong>${actividad.departamento || 'DEPARTAMENTO MECATRONICA'}</strong></td>
                    <td class="col-larga">${hallazgo}</td>
                    <td class="atendido-col col-larga">${estaCompletada ? 'X' : ''}</td>
                    <td class="atendido-col col-larga">${!estaCompletada ? '' : ''}</td>
                </tr>
            </tbody>
        </table>

        <div style="font-size: 9pt; font-weight: bold; margin-top: 5px;">Realizo</div>
        <table class="footer-firmas">
            <tr>
                <td style="width: 45%;">Centro de Computo Realizo</td>
                <td>RODRIGO A. LOPEZ C.</td>
            </tr>
            <tr>
                <td>Vo.Bo. Recibio</td>
                <td>${actividad.solicitante || 'Miguel Gonzalez'}</td>
            </tr>
        </table>
    </div>
</body>
</html>`;

        const ventana = window.open('', '_blank');
        ventana.document.write(html);
        ventana.document.close();
        
        if (btnExportar) {
            btnExportar.innerHTML = '<i class="bi bi-file-earmark-text"></i> Formato';
            btnExportar.disabled = false;
        }

    } catch (error) {
        console.error('Error:', error);
        if (btnExportar) {
            btnExportar.innerHTML = '<i class="bi bi-file-earmark-text"></i> Formato';
            btnExportar.disabled = false;
        }
    }
};

// ========== EXPORTAR ESTADISTICAS ==========
window.exportarEstadisticas = async function() {
    if (!tienePermiso('exportar')) {
        mostrarMensaje('No tienes permisos para exportar estadisticas', 'error');
        return;
    }
    
    const periodo = document.getElementById('filtroPeriodo')?.value || 'todos';
    const filtroFechaDesde = document.getElementById('filtroFechaDesde')?.value;
    const filtroFechaHasta = document.getElementById('filtroFechaHasta')?.value;
    const filtroEstado = document.getElementById('filtroEstado')?.value || 'todos';
    
    let mensajeFiltros = '¿Exportar estadisticas basadas en ';
    let detallesFiltro = [];
    
    const nombresPeriodo = {
        'hoy': 'hoy',
        'ayer': 'ayer',
        'semana': 'esta semana',
        'mes': 'este mes',
        'anterior': 'el mes anterior'
    };
    
    if (periodo !== 'todos') {
        detallesFiltro.push('el periodo: ' + (nombresPeriodo[periodo] || periodo));
    }
    
    if (filtroFechaDesde && filtroFechaHasta) {
        detallesFiltro.push('el rango de fechas: ' + filtroFechaDesde + ' al ' + filtroFechaHasta);
    } else if (filtroFechaDesde) {
        detallesFiltro.push('fecha desde: ' + filtroFechaDesde);
    } else if (filtroFechaHasta) {
        detallesFiltro.push('fecha hasta: ' + filtroFechaHasta);
    }
    
    if (filtroEstado !== 'todos') {
        const nombresEstado = {
            'pendiente': 'pendientes',
            'en_progreso': 'en progreso',
            'completada': 'completadas'
        };
        detallesFiltro.push('estado: ' + (nombresEstado[filtroEstado] || filtroEstado));
    }
    
    if (detallesFiltro.length > 0) {
        mensajeFiltros += detallesFiltro.join(', ') + '?';
    } else {
        mensajeFiltros += 'todos los datos disponibles?';
    }
    
    if (!confirm(mensajeFiltros + '\n\n¿Continuar con la exportacion?')) {
        return;
    }

    const btnExportar = document.getElementById('btnExportarEstadisticas');
    
    try {
        if (btnExportar) {
            btnExportar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generando...';
            btnExportar.disabled = true;
        }

        const actividades = await obtenerActividadesFiltradas();
        
        if (actividades.length === 0) {
            mostrarMensaje('No hay datos para exportar segun los filtros seleccionados', 'info');
            return;
        }
        
        let infoExportacion = 'Exportando estadisticas de ' + actividades.length + ' actividades';
        if (detallesFiltro.length > 0) {
            infoExportacion += ' (' + detallesFiltro.join(', ') + ')';
        }
        mostrarMensaje(infoExportacion, 'info');
        
        const estadisticas = calcularEstadisticas(actividades);
        const wb = XLSX.utils.book_new();

        const styleHeader = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4472C4" } } };
        const styleBorder = { style: 'thin', color: { rgb: '000000' } };

        const metadatosData = [
            ['INFORMACION DE LA EXPORTACION DE ESTADISTICAS'],
            ['Fecha de exportacion:', new Date().toLocaleString('es-MX')],
            ['Periodo analizado:', periodo !== 'todos' ? nombresPeriodo[periodo] || periodo : 'Todo el periodo'],
            ['Rango de fechas:', filtroFechaDesde && filtroFechaHasta ? filtroFechaDesde + ' al ' + filtroFechaHasta : 'Sin filtro de fechas'],
            ['Estado filtrado:', filtroEstado !== 'todos' ? (nombresEstado[filtroEstado] || filtroEstado) : 'Todos los estados'],
            ['Total de actividades analizadas:', actividades.length],
            []
        ];
        const wsMetadatos = XLSX.utils.aoa_to_sheet(metadatosData);
        XLSX.utils.book_append_sheet(wb, wsMetadatos, 'Informacion');

        const resumenData = [
            ['REPORTE EJECUTIVO DE ACTIVIDADES'],
            ['Generado el:', new Date().toLocaleString()],
            [],
            ['METRICA', 'VALOR'],
            ['Total de Actividades', estadisticas.total],
            ['Completadas', estadisticas.porEstado.completada || 0],
            ['Pendientes', estadisticas.porEstado.pendiente || 0],
            ['En Progreso', estadisticas.porEstado.en_progreso || 0],
            ['% Eficiencia Total', (estadisticas.porcentajeCompletadas || 0).toFixed(2) + '%'],
            [],
            ['TIEMPOS DE RESPUESTA'],
            ['Promedio de Resolucion', (estadisticas.tiempoPromedioResolucionTotal || 0).toFixed(2) + ' horas'],
            ['Tiempo Maximo', (estadisticas.tiempoMaximoResolucion || 0).toFixed(2) + ' horas'],
            ['Rango de Dias analizados', estadisticas.rangoDias || 0]
        ];
        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

        const deptoHeader = [['DEPARTAMENTO', 'TOTAL', 'PEND.', 'PROG.', 'COMP.', '% CARGA']];
        const deptoBody = Object.entries(estadisticas.porDepartamento)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([nombre, d]) => [
                nombre, d.total, d.pendientes || 0, d.enProgreso || 0, d.completados || 0,
                ((d.total / estadisticas.total) * 100).toFixed(2) + '%'
            ]);
        const wsDeptos = XLSX.utils.aoa_to_sheet([...deptoHeader, ...deptoBody]);
        XLSX.utils.book_append_sheet(wb, wsDeptos, 'Departamentos');

        const probHeader = [['PROBLEMA', 'FRECUENCIA', 'COMPLETADOS', 'TASA EXITO', 'T. PROMEDIO']];
        const probBody = Object.entries(estadisticas.porProblema)
            .sort((a, b) => b[1].frecuencia - a[1].frecuencia)
            .map(([nombre, d]) => [
                nombre, d.frecuencia, d.estados.completada || 0,
                (d.tasaResolucion || 0).toFixed(2) + '%',
                (d.tiempoPromedioResolucion || 0).toFixed(2) + ' h'
            ]);
        const wsProbs = XLSX.utils.aoa_to_sheet([...probHeader, ...probBody]);
        XLSX.utils.book_append_sheet(wb, wsProbs, 'Problemas');

        const tecHeader = [['TECNICO', 'TOTAL', 'COMP.', 'EFICIENCIA', 'T. PROM', 'DEPTOS ATENDIDOS']];
        const tecBody = Object.entries(estadisticas.porTecnico)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([nombre, d]) => [
                nombre, d.total, d.completados || 0,
                (d.eficiencia || 0).toFixed(2) + '%',
                (d.tiempoPromedioResolucion || 0).toFixed(2) + ' h',
                d.departamentosAtendidosCount || 0
            ]);
        const wsTecnicos = XLSX.utils.aoa_to_sheet([...tecHeader, ...tecBody]);
        XLSX.utils.book_append_sheet(wb, wsTecnicos, 'Tecnicos');

        const solHeader = [['SOLICITANTE', 'TOTAL', 'COMPLETADAS', 'TASA RESOLUCION', 'PRIORIDAD MAS COMUN']];
        const solBody = Object.entries(estadisticas.porSolicitante)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([nombre, d]) => [
                nombre, d.total, d.completados || 0,
                (d.tasaResolucion || 0).toFixed(2) + '%',
                d.prioridadMasComun || 'N/A'
            ]);
        const wsSols = XLSX.utils.aoa_to_sheet([...solHeader, ...solBody]);
        XLSX.utils.book_append_sheet(wb, wsSols, 'Solicitantes');

        const sheets = {
            'Informacion': [40, 30],
            'Resumen': [30, 20],
            'Departamentos': [25, 10, 10, 10, 10, 12],
            'Problemas': [35, 12, 15, 12, 15],
            'Tecnicos': [25, 10, 10, 12, 10, 18],
            'Solicitantes': [25, 10, 15, 18, 20]
        };

        Object.keys(sheets).forEach(name => {
            const ws = wb.Sheets[name];
            if (ws) {
                ws['!cols'] = sheets[name].map(w => ({ wch: w }));
            }
        });

        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
        XLSX.writeFile(wb, 'Reporte_Estadistico_' + timestamp + '.xlsx');
        
        mostrarMensaje('Reporte generado correctamente', 'success');

    } catch (error) {
        console.error('Error en exportacion:', error);
        mostrarMensaje('Error al exportar: ' + error.message, 'error');
    } finally {
        if (btnExportar) {
            btnExportar.innerHTML = '<i class="bi bi-file-earmark-excel"></i> Exportar Estadisticas';
            btnExportar.disabled = false;
        }
    }
};

window.abrirAdminCuenta = function() {
    if (!usuarioActual) return;
    
    document.getElementById('perfilUsuario').value = usuarioActual.usuario || '';
    document.getElementById('perfilNombre').value = usuarioActual.nombre || '';
    document.getElementById('perfilEmail').value = usuarioActual.email || '';
    document.getElementById('perfilRol').value = usuarioActual.rol === 'admin' ? 'Administrador' : 'Tecnico';
    document.getElementById('perfilTelefono').value = usuarioActual.telefono || '';
    
    if (usuarioActual.fecha_nacimiento) {
        let fechaValor = usuarioActual.fecha_nacimiento;
        if (fechaValor.includes('T')) {
            fechaValor = fechaValor.split('T')[0];
        }
        document.getElementById('perfilFechaNacimiento').value = fechaValor;
    } else {
        document.getElementById('perfilFechaNacimiento').value = '';
    }
    
    const vistaPrevia = document.getElementById('vistaPreviaPerfil');
    if (vistaPrevia) {
        vistaPrevia.innerHTML = '';
        if (usuarioActual.foto_perfil) {
            const img = document.createElement('img');
            img.src = usuarioActual.foto_perfil;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '50%';
            vistaPrevia.appendChild(img);
        } else {
            vistaPrevia.innerHTML = '<i class="bi bi-person-circle text-secondary" style="font-size: 3rem;"></i>';
        }
    }
    
    document.getElementById('perfilUsuario').readOnly = false;
    document.getElementById('perfilNombre').readOnly = true;
    document.getElementById('perfilNombre').classList.add('bg-light');
    
    document.getElementById('contrasenaActual').value = '';
    document.getElementById('nuevaContrasena').value = '';
    document.getElementById('confirmarNuevaContrasena').value = '';
    
    document.getElementById('passwordStrengthCuenta').style.width = '0%';
    document.getElementById('passwordStrengthCuenta').className = 'progress-bar';
    
    const fotoInput = document.getElementById('perfilFoto_input');
    if (fotoInput) fotoInput.value = '';
    
    setTimeout(() => {
        configurarTogglesModalCuenta();
    }, 100);
    
    new bootstrap.Modal(document.getElementById('modalAdminCuenta')).show();
};

function configurarTogglesModalCuenta() {
    const toggleButtons = [
        'togglePasswordActual',
        'togglePasswordNuevaCuenta',
        'togglePasswordConfirmarCuenta'
    ];
    
    toggleButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                const input = this.previousElementSibling;
                if (input && input.tagName === 'INPUT') {
                    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                    input.setAttribute('type', type);
                    
                    const icon = this.querySelector('i');
                    if (icon) {
                        icon.className = type === 'text' ? 'bi bi-eye-slash' : 'bi bi-eye';
                    }
                }
            });
        }
    });
    
    const nuevaContrasenaInput = document.getElementById('nuevaContrasena');
    if (nuevaContrasenaInput) {
        const newInput = nuevaContrasenaInput.cloneNode(true);
        nuevaContrasenaInput.parentNode.replaceChild(newInput, nuevaContrasenaInput);
        
        newInput.addEventListener('input', function() {
            const password = this.value;
            const strengthBar = document.getElementById('passwordStrengthCuenta');
            let strength = 0;
            
            if (password.length >= 6) strength += 25;
            if (password.match(/[a-z]/)) strength += 25;
            if (password.match(/[A-Z]/)) strength += 25;
            if (password.match(/[0-9!@#$%^&*]/)) strength += 25;
            
            strengthBar.style.width = strength + '%';
            
            if (strength <= 25) {
                strengthBar.className = 'progress-bar bg-danger';
            } else if (strength <= 50) {
                strengthBar.className = 'progress-bar bg-warning';
            } else if (strength <= 75) {
                strengthBar.className = 'progress-bar bg-info';
            } else {
                strengthBar.className = 'progress-bar bg-success';
            }
        });
    }
}

function obtenerTextoFiltros() {
    const periodo = document.getElementById('filtroPeriodo')?.value || 'todos';
    const filtroFechaDesde = document.getElementById('filtroFechaDesde')?.value;
    const filtroFechaHasta = document.getElementById('filtroFechaHasta')?.value;
    const filtroEstado = document.getElementById('filtroEstado')?.value || 'todos';
    
    let textoFiltros = [];
    
    const nombresPeriodo = {
        'hoy': 'Hoy',
        'ayer': 'Ayer',
        'semana': 'Esta semana',
        'mes': 'Este mes',
        'anterior': 'Mes anterior'
    };
    
    if (periodo !== 'todos') {
        textoFiltros.push('Periodo: ' + (nombresPeriodo[periodo] || periodo));
    }
    
    if (filtroFechaDesde && filtroFechaHasta) {
        textoFiltros.push('Rango: ' + filtroFechaDesde + ' al ' + filtroFechaHasta);
    } else if (filtroFechaDesde) {
        textoFiltros.push('Desde: ' + filtroFechaDesde);
    } else if (filtroFechaHasta) {
        textoFiltros.push('Hasta: ' + filtroFechaHasta);
    }
    
    if (filtroEstado !== 'todos') {
        const nombresEstado = {
            'pendiente': 'Pendientes',
            'en_progreso': 'En progreso',
            'completada': 'Completadas'
        };
        textoFiltros.push('Estado: ' + (nombresEstado[filtroEstado] || filtroEstado));
    }
    
    return textoFiltros.length > 0 ? textoFiltros.join(' · ') : 'Todos los datos';
}

window.cargarUsuariosParaGestion = cargarUsuariosParaGestion;
window.initApp = initApp;
