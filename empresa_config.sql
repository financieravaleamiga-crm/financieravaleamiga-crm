-- ============================================================
--  PrestApp — Configuración de empresa y datos bancarios
--  Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ─────────────────────────────────────────
--  TABLA: empresa_config
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresa_config (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nombre_empresa    TEXT DEFAULT '',
  nombre_comercial  TEXT DEFAULT '',
  telefono          TEXT DEFAULT '',
  correo            TEXT DEFAULT '',
  direccion         TEXT DEFAULT '',
  ciudad            TEXT DEFAULT '',
  estado            TEXT DEFAULT '',
  observaciones     TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
--  TABLA: datos_bancarios
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datos_bancarios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  banco           TEXT DEFAULT '',
  titular         TEXT DEFAULT '',
  num_cuenta      TEXT DEFAULT '',
  clabe           TEXT DEFAULT '',
  tarjeta         TEXT DEFAULT '',
  observaciones   TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE empresa_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE datos_bancarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own empresa_config" ON empresa_config
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own datos_bancarios" ON datos_bancarios
  FOR ALL USING (auth.uid() = user_id);

-- Actualización automática de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_empresa_config_updated_at
  BEFORE UPDATE ON empresa_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_datos_bancarios_updated_at
  BEFORE UPDATE ON datos_bancarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_empresa_config_user  ON empresa_config(user_id);
CREATE INDEX IF NOT EXISTS idx_datos_bancarios_user ON datos_bancarios(user_id);

-- ─────────────────────────────────────────
--  NOTA: También agregar tipos al historial
-- ─────────────────────────────────────────
-- Si el CHECK constraint de historial_movimientos lo impide,
-- ejecutar esto para agregar los nuevos tipos de movimiento:
--
-- ALTER TABLE historial_movimientos
--   DROP CONSTRAINT historial_movimientos_tipo_movimiento_check;
-- ALTER TABLE historial_movimientos
--   ADD CONSTRAINT historial_movimientos_tipo_movimiento_check
--   CHECK (tipo_movimiento IN (
--     'CREACION_CLIENTE','ACTUALIZACION_CLIENTE','ELIMINACION_CLIENTE',
--     'CREACION_PRESTAMO','EDICION_PRESTAMO','ELIMINACION_PRESTAMO',
--     'PAGO_COMPLETO','PAGO_PARCIAL','PAGO_DESDE_PRESTAMO',
--     'PENALIZACION_APLICADA','POSTERGACION','PAGO_REDITO',
--     'LIQUIDACION_CREDITO'
--   ));
