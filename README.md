ITV Support - Sistema de Gestión de Actividades de Soporte Técnico

Un sistema web completo para administrar, dar seguimiento y generar reportes de las actividades de soporte técnico del Centro de Cómputo del Instituto Tecnológico de Veracruz.


 Características Principales

Control de Acceso y Roles:

Administrador: Gestión total de usuarios (activación, cambio de rol, creación y eliminación), edición completa de datos y panel integral de estadísticas.

Técnico: Registro de actividades, actualización de avances, notas de servicio y completado de tareas.

Gestión de Actividades de Soporte:

Registro detallado con asignación múltiple de técnicos (al inicio y término del servicio).

Control de estado de atención (Pendiente, En Progreso, Completada) y prioridades (Baja, Normal, Alta, Urgente).

Filtros dinámicos por período, fecha, técnico, solicitante y estado.

Módulo de Estadísticas y Analítica:

Gráficos interactivos de rendimiento por área, problemas más comunes, asignación de técnicos y métricas por solicitante.

Exportación de Reportes y Documentos:

Descarga de datos generales y estadísticos en formato Excel (.xlsx).

Generación del formato de impresión oficial de la Solicitud-Orden de Trabajo y Lista de Verificación de Mantenimiento.

 Tecnologías Utilizadas

Frontend: HTML5, CSS3, JavaScript (ES6+)

UI Framework & Iconos: Bootstrap 5.3, Bootstrap Icons

Gráficos: Chart.js 3.9

Procesamiento de Excel: SheetJS (xlsx)

Base de Datos & Backend: Supabase (PostgreSQL)

 Estructura del Proyecto

.
├── index.html       # Estructura principal, formularios, paneles y modales
├── app.js           # Lógica del sistema, conexión a Supabase y manejo del DOM
├── style.css        # Estilos personalizados, diseño adaptativo y temas
├── schema.sql       # Script de creación de la base de datos en PostgreSQL/Supabase
├── itver.png        # Escudo oficial del Instituto Tecnológico de Veracruz
└── kmstools.png     # Logotipo del sistema


 Configuración de la Base de Datos

Ingresa a tu panel de Supabase y navega al SQL Editor.

Ejecuta las sentencias del archivo schema.sql para crear las tablas necesarias:

departamentos

usuarios

solicitantes

actividades

 Instalación y Uso Local

Clona el repositorio en tu equipo:

git clone https://github.com/ALeo097/sistema-soporte-tecnico.git
cd sistema-soporte-tecnico


Abre el archivo app.js y coloca tus llaves de conexión a Supabase:

const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
const SUPABASE_KEY = 'tu-anon-key';


Abre el archivo index.html en tu navegador o mediante una extensión de servidor local como Live Server en VS Code.

 Credenciales por Defecto (Pruebas)

Al ejecutar el script schema.sql, se crean las siguientes cuentas iniciales:

Administrador:

Usuario: admin

Contraseña: admin123

Técnico:

Usuario: tecnico1

Contraseña: tecnico123
