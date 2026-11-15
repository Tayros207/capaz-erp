import { useEffect, useState } from 'react'
import { healthResponseSchema, type HealthResponse } from '@capaz/shared'

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; salud: HealthResponse }
  | { tipo: 'error' }

const ETIQUETA_BASE: Record<HealthResponse['database'], string> = {
  up: 'Conectada',
  down: 'Sin conexión',
  'not-configured': 'Sin configurar',
}

export function Inicio() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })

  useEffect(() => {
    const control = new AbortController()
    fetch('/api/health', { signal: control.signal })
      .then((r) => r.json())
      .then((json) => setEstado({ tipo: 'listo', salud: healthResponseSchema.parse(json) }))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setEstado({ tipo: 'error' })
      })
    return () => control.abort()
  }, [])

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-3 rounded-full bg-cian" />
          <span className="size-3 rounded-full bg-magenta" />
          <span className="size-3 rounded-full bg-amarillo" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Capaz ERP</h1>
        <p className="text-tinta-suave">
          Gestión modular para la industria gráfica y publicitaria. Estructura base en construcción.
        </p>
      </header>

      <section className="border border-linea bg-white/60 p-4" aria-live="polite">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-tinta-suave">
          Estado del sistema
        </h2>
        {estado.tipo === 'cargando' && <p>Comprobando…</p>}
        {estado.tipo === 'error' && (
          <p className="text-magenta">No se pudo contactar con la API. ¿Está encendida?</p>
        )}
        {estado.tipo === 'listo' && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="text-tinta-suave">API</dt>
            <dd className="text-ok">En línea</dd>
            <dt className="text-tinta-suave">Base de datos</dt>
            <dd className={estado.salud.database === 'up' ? 'text-ok' : 'text-magenta'}>
              {ETIQUETA_BASE[estado.salud.database]}
            </dd>
          </dl>
        )}
      </section>
    </main>
  )
}
