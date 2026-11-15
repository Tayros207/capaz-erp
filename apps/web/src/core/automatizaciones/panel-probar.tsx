import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { EjecucionDeRegla, Regla } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { ejecutarRegla, probarRegla } from './api.ts';
import { CLAVE_EJECUCIONES } from './claves.ts';
import { FilasDeArgumentos } from './filas-de-argumentos.tsx';
import { ETIQUETA_DE_MODO, objetoDeArgumentos, type FilaDeArgumento } from './logica.ts';

type Prueba = Extract<Awaited<ReturnType<typeof probarRegla>>, { ok: true }> extends { datos: infer D } ? D : never;

/** «¿Qué haría?»: prueba la regla guardada con datos de ejemplo; no cambia nada salvo una ejecución simulada. */
export function PanelProbar({ regla, sinGuardar, puedeGestionar }: { regla: Regla; sinGuardar: boolean; puedeGestionar: boolean }) {
  const consultas = useQueryClient();
  const [datos, setDatos] = useState<FilaDeArgumento[]>([]);
  const [resultado, setResultado] = useState<Prueba | null>(null);
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  async function correr(real: boolean) {
    const d = objetoDeArgumentos(datos);
    if (!d.ok) return setAviso(d.error);
    if (real && !(await confirmar('Ejecutar la regla', `«${regla.nombre}» se ejecutará ahora con estos datos y quedará registrada.`, { textoConfirmar: 'Ejecutar ahora' }))) return;
    setOcupado(true);
    setAviso(undefined);
    if (real) {
      const r = await ejecutarRegla(regla.id, d.datos);
      if (r.ok && 'datos' in r) notificar(`Ejecución terminada: ${(r.datos as EjecucionDeRegla).resultado.replaceAll('_', ' ')}.`, 'exito');
      else if ('error' in r) setAviso(r.error.mensaje);
    } else {
      const r = await probarRegla(regla.id, d.datos);
      if (r.ok && 'datos' in r) setResultado(r.datos);
      else if ('error' in r) setAviso(r.error.mensaje);
    }
    setOcupado(false);
    await consultas.invalidateQueries({ queryKey: CLAVE_EJECUCIONES });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-texto-suave">Escribe datos de ejemplo (lo que traería el evento o la fila de la fuente) y mira qué haría la regla. Los datos van bajo «datos»: por ejemplo, «total» se lee como datos.total.</p>
      {sinGuardar ? <p role="alert" className="rounded-control border border-aviso/40 bg-aviso/15 px-3 py-2 text-sm font-medium">Tienes cambios sin guardar: la prueba usa la última versión guardada.</p> : null}
      <FilasDeArgumentos nombreDelCampo="Dato de ejemplo" filas={datos} alCambiar={setDatos} etiquetaDeAgregar="Agregar dato" />
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" cargando={ocupado} onClick={() => void correr(false)}>¿Qué haría?</Boton>
        {puedeGestionar && regla.activa && regla.disparador.tipo === 'manual' ? <Boton disabled={ocupado} onClick={() => void correr(true)}>Ejecutar ahora</Boton> : null}
      </div>
      {resultado ? (
        <section aria-live="polite" className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
          <p className="font-medium">{resultado.resumen}</p>
          <div className="flex flex-wrap gap-2">
            <Insignia tono={resultado.coincide ? 'exito' : 'neutro'}>{resultado.coincide ? 'Coincide' : 'No coincide'}</Insignia>
            <Insignia tono="info">{ETIQUETA_DE_MODO[resultado.modo]}</Insignia>
            {resultado.limiteAlcanzado ? <Insignia tono="aviso">Límite diario alcanzado</Insignia> : null}
          </div>
          <ol className="flex flex-col gap-2">
            {resultado.acciones.map((a, i) => (
              <li key={i} className="rounded-control border border-borde p-3 text-sm">
                <p className="font-semibold">{i + 1}. {a.herramienta}</p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-texto-suave">{JSON.stringify(a.args, null, 2)}</pre>
                {a.problemas.length ? <ul className="mt-1 list-disc pl-5 text-peligro">{a.problemas.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="mt-1 text-exito">Sin problemas.</p>}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
