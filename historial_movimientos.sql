-- ============================================================
--  PrestApp — Historial de Movimientos
--  Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ─────────────────────────────────────────
--  TABLA: historial_movimientos
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historial_movimientos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cliente_id        UUID REFERENCES clientes(id)   ON DELETE SET NULL,
  prestamo_id       UUID REFERENCES prestamos(id)  ON DELETE SET NULL,
  pago_id           UUID REFERENCES pagos_programados(id) ON DELETE SET NULL,
  tipo_movimiento   TEXT NOT NULL CHECK (tipo_movimiento IN (
    'CREACION_CLIENTE',
    'ACTUALIZACION_CLIENTE',
    'ELIMINACION_CLIENTE',
    'CREACION_PRESTAMO',
    'EDICION_PRESTAMO',
    'ELIMINACION_PRESTAMO',
    'PAGO_COMPLETO',
    'PAGO_PARCIAL'
  )),
  descripcion       TEXT,
  monto             NUMERIC(12,2),
  fecha_movimiento  TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE historial_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own historial" ON historial_movimientos
  FOR ALL USING (auth.uid() = usuario_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_historial_usuario    ON historial_movimientos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_historial_cliente    ON historial_movimientos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_historial_prestamo   ON historial_movimientos(prestamo_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha      ON historial_movimientos(fecha_movimiento DESC);
CREATE INDEX IF NOT EXISTS idx_historial_tipo       ON historial_movimientos(tipo_movimiento);
