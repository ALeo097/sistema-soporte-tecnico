-- ====================================================
-- SCRIPT DE CREACIÓN DE BASE DE DATOS - ITV SUPPORT
-- ====================================================

-- 1. Tabla de Departamentos
CREATE TABLE departamentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    ubicacion VARCHAR(150),
    activo BOOLEAN DEFAULT TRUE,
    creado_por INTEGER,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE
);

-- 2. Tabla de Usuarios (Administradores y Técnicos)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    contrasena_hash VARCHAR(255) NOT NULL,
    email VARCHAR(150) UNIQUE,
    telefono VARCHAR(15),
    fecha_nacimiento DATE,
    foto_perfil TEXT,
    rol VARCHAR(20) NOT NULL DEFAULT 'tecnico', -- 'admin' o 'tecnico'
    activo BOOLEAN DEFAULT FALSE,
    ultimo_login TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Solicitantes
CREATE TABLE solicitantes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    puesto VARCHAR(100) NOT NULL,
    departamento_id INTEGER REFERENCES departamentos(id) ON DELETE SET NULL,
    departamento VARCHAR(100),
    telefono VARCHAR(15),
    activo BOOLEAN DEFAULT TRUE,
    creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de Actividades de Soporte Técnico
CREATE TABLE actividades (
    id SERIAL PRIMARY KEY,
    descripcion TEXT NOT NULL,
    tecnico VARCHAR(255) NOT NULL,
    tecnico_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    tecnicos_inicio TEXT,
    tecnicos_inicio_ids TEXT,
    tecnicos_termino TEXT,
    tecnicos_termino_ids TEXT,
    solicitante_id INTEGER REFERENCES solicitantes(id) ON DELETE SET NULL,
    solicitante VARCHAR(150) NOT NULL,
    prioridad VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'baja', 'normal', 'alta', 'urgente'
    ubicacion VARCHAR(150),
    departamento VARCHAR(100),
    notas_iniciales TEXT,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'en_progreso', 'completada'
    notas TEXT,
    completado_en TIMESTAMP WITH TIME ZONE,
    creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================
-- DATOS INICIALES RECOMENDADOS PARA PRUEBAS
-- ====================================================

-- Insertar un usuario Administrador de pruebas (Contraseña de ejemplo: 'admin123')
INSERT INTO usuarios (usuario, nombre, contrasena_hash, email, rol, activo) 
VALUES ('admin', 'Administrador de Pruebas', 'admin123', 'admin@itver.edu.mx', 'admin', TRUE);

-- Insertar un Técnico de pruebas (Contraseña de ejemplo: 'tecnico123')
INSERT INTO usuarios (usuario, nombre, contrasena_hash, email, rol, activo) 
VALUES ('tecnico1', 'Técnico de Soporte', 'tecnico123', 'tecnico@itver.edu.mx', 'tecnico', TRUE);

-- Insertar departamentos iniciales basados en tu app.js
INSERT INTO departamentos (nombre, ubicacion) VALUES 
('Centro de Cómputo', 'Edificio O'),
('Dirección', 'Edificio Principal'),
('Administración', 'Edificio Administrativo'),
('Recursos Humanos', 'Edificio Administrativo'),
('Académico', 'Edificio de Aulas');

-- Insertar un solicitante de prueba vinculado al primer departamento
INSERT INTO solicitantes (nombre, puesto, departamento_id, departamento, telefono) 
VALUES ('Juan Pérez', 'Profesor Titular', 1, 'Centro de Cómputo', '2291234567');