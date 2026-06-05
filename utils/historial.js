import { supabase } from '../lib/supabase'

/**
 * Registra un movimiento en historial_movimientos.
 * No lanza errores — falla silenciosamente en consola para no
 * interrumpir el flujo principal, pero siempre deja evidencia.
 */
export async function registrarMovimiento({
  tipo_movimiento,
  descripcion,
  monto = null,
  cliente_id = null,
  prestamo_id = null,
  pago_id = null,
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('historial_movimientos').insert([{
      usuario_id: user.id,
      tipo_movimiento,
      descripcion,
      monto,
      cliente_id,
      prestamo_id,
      pago_id,
    }])

    if (error) {
      console.error('[historial] Error al registrar movimiento:', error.message)
    }
  } catch (err) {
    console.error('[historial] Excepción al registrar movimiento:', err)
  }
}
