-- ============================================================
--  Migración: Agregar periodicidad a préstamos
--  Ejecutar en: Supabase Dashboard > SQL Editor
--  Fecha: 2026-06-06
-- ============================================================

-- 1. Agregar columna periodicidad a la tabla prestamos
--    Default 'quincenal' para mantener compatibilidad con préstamos existentes
ALTER TABLE prestamos
  ADD COLUMN IF NOT EXISTS periodicidad TEXT
    NOT NULL DEFAULT 'quincenal'
    CHECK (periodicidad IN ('quincenal', 'mensual'));

-- 2. Los préstamos existentes quedan automáticamente como 'quincenal'
--    gracias al DEFAULT — no se modifica ningún dato histórico.

-- Verificar el resultado:
-- SELECT id, monto_prestado, num_quincenas, periodicidad, estatus
-- FROM prestamos
-- ORDER BY fecha_creacion DESC
-- LIMIT 20;
