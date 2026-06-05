-- ============================================================
--  PrestApp — Schema SQL para Supabase
--  Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
--  TABLA: clientes
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nombre                TEXT NOT NULL,
  telefono              TEXT NOT NULL,
  domicilio             TEXT,
  referencia1_nombre    TEXT,
  referencia1_telefono  TEXT,
  referencia2_nombre    TEXT,
  referencia2_telefono  TEXT,
  fecha_registro        TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  TABLA: prestamos
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prestamos (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cliente_id          UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  monto_prestado      NUMERIC(12,2) NOT NULL,
  ganancia_pactada    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_a_recuperar   NUMERIC(12,2) NOT NULL,
  num_quincenas       INTEGER NOT NULL DEFAULT 1,
  monto_quincenal     NUMERIC(12,2) NOT NULL,
  fecha_inicio        DATE NOT NULL,
  tipo_penalizacion   TEXT DEFAULT 'ninguna' CHECK (tipo_penalizacion IN ('ninguna','porcentaje','fijo')),
  valor_penalizacion  NUMERIC(10,2) DEFAULT 0,
  estatus             TEXT DEFAULT 'activo' CHECK (estatus IN ('activo','liquidado','vencido','cancelado')),
  fecha_creacion      TIMESTAMPTZ DEFAULT NOW(),
  notas               TEXT
);

-- ─────────────────────────────────────────
--  TABLA: pagos_programados
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos_programados (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prestamo_id         UUID REFERENCES prestamos(id) ON DELETE CASCADE NOT NULL,
  numero_pago         INTEGER NOT NULL,
  fecha_recordatorio  DATE NOT NULL,
  fecha_vencimiento   DATE NOT NULL,
  monto_programado    NUMERIC(12,2) NOT NULL,
  monto_pagado        NUMERIC(12,2) DEFAULT 0,
  saldo_restante      NUMERIC(12,2),
  fecha_pago          DATE,
  pagado              BOOLEAN DEFAULT FALSE,
  estatus             TEXT DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','pagado','parcial','vencido')),
  notas               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_programados ENABLE ROW LEVEL SECURITY;

-- Policies: each user only sees their own data
CREATE POLICY "Users see own clientes" ON clientes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own prestamos" ON prestamos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own pagos" ON pagos_programados
  FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────
--  INDEXES for performance
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prestamos_cliente ON prestamos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_prestamo ON pagos_programados(prestamo_id);
CREATE INDEX IF NOT EXISTS idx_pagos_vencimiento ON pagos_programados(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_pagos_estatus ON pagos_programados(estatus);
CREATE INDEX IF NOT EXISTS idx_clientes_user ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_user ON prestamos(user_id);
