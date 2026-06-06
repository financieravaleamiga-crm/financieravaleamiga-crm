import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Users, Plus, Phone, MapPin, Search, X, Pencil, Trash2 } from 'lucide-react'

const EMPTY_FORM = {
  nombre: '', telefono: '', domicilio: '',
  referencia1_nombre: '', referencia1_telefono: '',
  referencia2_nombre: '', referencia2_telefono: '',
}

const FORM_FIELDS = [
  { label: 'Nombre completo *', key: 'nombre', type: 'text', required: true },
  { label: 'Teléfono *', key: 'telefono', type: 'tel', required: true },
  { label: 'Domicilio', key: 'domicilio', type: 'text', required: false },
  { label: 'Referencia 1 – Nombre', key: 'referencia1_nombre', type: 'text', required: false },
  { label: 'Referencia 1 – Teléfono', key: 'referencia1_telefono', type: 'tel', required: false },
  { label: 'Referencia 2 – Nombre', key: 'referencia2_nombre', type: 'text', required: false },
  { label: 'Referencia 2 – Teléfono', key: 'referencia2_telefono', type: 'tel', required: false },
]

export default function ClientesPage() {
  const { clientes, fetchClientes, createCliente, updateCliente, deleteCliente, loading } = useAppStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchClientes() }, [])

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.telefono?.includes(search)
  )

  const openNew = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  const openEdit = (cliente) => {
    setEditingId(cliente.id)
    setForm({
      nombre: cliente.nombre || '',
      telefono: cliente.telefono || '',
      domicilio: cliente.domicilio || '',
      referencia1_nombre: cliente.referencia1_nombre || '',
      referencia1_telefono: cliente.referencia1_telefono || '',
      referencia2_nombre: cliente.referencia2_nombre || '',
      referencia2_telefono: cliente.referencia2_telefono || '',
    })
    setError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (editingId) {
        await updateCliente(editingId, form)
      } else {
        await createCliente(form)
      }
      closeForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await deleteCliente(confirmDelete.id)
      setConfirmDelete(null)
    } catch (err) {
      alert('Error al eliminar: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-600 pt-12 pb-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={22} className="text-white" />
            <h1 className="text-white font-black text-xl">Clientes</h1>
          </div>
          <button
            onClick={openNew}
            className="bg-white text-brand-600 rounded-xl px-3 py-1.5 flex items-center gap-1 text-sm font-bold shadow"
          >
            <Plus size={16} />
            Nuevo
          </button>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none shadow"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-2">
        <p className="text-xs text-gray-500 font-medium">{filtered.length} clientes</p>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin clientes registrados</p>
          </div>
        ) : (
          filtered.map(cliente => (
            <div key={cliente.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-800 truncate">{cliente.nombre}</p>
                  <div className="flex items-center gap-1 mt-0.5 text-gray-500">
                    <Phone size={12} />
                    <span className="text-xs">{cliente.telefono}</span>
                  </div>
                  {cliente.domicilio && (
                    <div className="flex items-center gap-1 mt-0.5 text-gray-400">
                      <MapPin size={12} />
                      <span className="text-xs truncate">{cliente.domicilio}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`https://wa.me/52${cliente.telefono?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-500 text-white rounded-xl px-3 py-1.5 text-xs font-bold"
                  >
                    WA
                  </a>
                  <button
                    onClick={() => openEdit(cliente)}
                    className="bg-gray-100 text-gray-600 rounded-xl p-1.5"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(cliente)}
                    className="bg-red-50 text-red-500 rounded-xl p-1.5"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Nuevo / Editar Cliente */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 pb-3 shrink-0">
              <h2 className="text-lg font-black text-gray-800">
                {editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <form id="form-cliente" onSubmit={handleSubmit} className="overflow-y-auto px-5 pb-3 space-y-3 flex-1">
              {FORM_FIELDS.map(({ label, key, type, required }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    required={required}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              ))}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2">
                  {error}
                </div>
              )}
            </form>

            <div className="shrink-0 px-5 pt-3 pb-6 border-t border-gray-100 bg-white">
              <button
                type="submit"
                form="form-cliente"
                disabled={saving}
                className="w-full bg-brand-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-60"
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Guardar Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación eliminar */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-black text-gray-800 mb-1">¿Eliminar cliente?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Se eliminará <span className="font-semibold text-gray-700">{confirmDelete.nombre}</span>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
