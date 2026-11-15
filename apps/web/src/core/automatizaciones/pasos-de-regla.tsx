import type { ReactNode } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { FilasDeArgumentos } from './filas-de-argumentos.tsx';
import {
  AYUDA_DE_MODO, ETIQUETA_DE_MODO, ETIQUETA_DE_OPERADOR, ETIQUETA_DE_TIPO_DE_DISPARADOR, OPERADORES, eventosConocidos, herramientasParaAcciones, titularDeHerramienta,
  type ErroresDeRegla, type FilaDeAccion, type FilaDeCondicion, type FormularioDeRegla, type TipoDeDisparador,
} from './logica.ts';
import { MODOS_DE_REGLA, type ModoDeRegla, type OperadorDeCondicion } from '@capaz/shared';

type Paso<K extends keyof FormularioDeRegla> = { form: FormularioDeRegla; errores: ErroresDeRegla; poner: (parte: Pick<FormularioDeRegla, K>) => void };

const EVENTOS = eventosConocidos();
const HERRAMIENTAS = herramientasParaAcciones();

export function Tarjeta({ numero, titulo, ayuda, children }: { numero: number; titulo: string; ayuda: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`paso-${numero}`} className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4">
      <div>
        <h2 id={`paso-${numero}`} className="font-titulo text-base font-semibold">{numero === 0 ? titulo : `Paso ${numero} · ${titulo}`}</h2>
        <p className="text-sm text-texto-suave">{ayuda}</p>
      </div>
      {children}
    </section>
  );
}

export function PasoDisparador({ form, errores, poner }: Paso<'tipo' | 'evento' | 'fuente' | 'dias'>) {
  return (
    <Tarjeta numero={1} titulo="¿Cuándo se activa?" ayuda="Elige qué dispara la regla.">
      <CampoSelect etiqueta="Disparador" value={form.tipo} onChange={(e) => poner({ tipo: e.target.value as TipoDeDisparador, evento: '', fuente: form.fuente, dias: form.dias })}>
        {(Object.keys(ETIQUETA_DE_TIPO_DE_DISPARADOR) as TipoDeDisparador[]).map((t) => <option key={t} value={t}>{ETIQUETA_DE_TIPO_DE_DISPARADOR[t]}</option>)}
      </CampoSelect>
      {form.tipo === 'evento' ? (
        <CampoSelect etiqueta="Evento" value={form.evento} error={errores.disparador} onChange={(e) => poner({ ...form, evento: e.target.value })}>
          <option value="">Elige un evento…</option>
          {EVENTOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </CampoSelect>
      ) : null}
      {form.tipo === 'webhook' ? <Campo etiqueta="Nombre del webhook de entrada" ayuda="El nombre del evento que envía el otro sistema." value={form.evento} error={errores.disparador} autoComplete="off" onChange={(e) => poner({ ...form, evento: e.target.value })} /> : null}
      {form.tipo === 'tiempo' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Fuente de tiempo" ayuda="Por ejemplo core.prueba_de_modulo_vence." value={form.fuente} error={errores.disparador} autoComplete="off" onChange={(e) => poner({ ...form, fuente: e.target.value })} />
          <Campo etiqueta="Días de diferencia" type="number" inputMode="numeric" ayuda="Positivo: después de la fecha. Negativo: antes." value={form.dias} onChange={(e) => poner({ ...form, dias: e.target.value })} />
        </div>
      ) : null}
      {form.tipo === 'manual' ? <p className="text-sm text-texto-suave">Esta regla solo corre cuando tú la ejecutas.</p> : null}
    </Tarjeta>
  );
}

export function PasoCondiciones({ form, errores, poner }: Paso<'condiciones'>) {
  const cambiar = (i: number, parte: Partial<FilaDeCondicion>) => poner({ condiciones: form.condiciones.map((c, j) => (j === i ? { ...c, ...parte } : c)) });
  return (
    <Tarjeta numero={2} titulo="¿Con qué condiciones?" ayuda="Opcional. La regla solo sigue si se cumplen todas. Usa rutas como datos.total.">
      {form.condiciones.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[1fr_11rem_1fr_auto]">
          <Campo etiqueta="Dato" placeholder="datos.total" autoComplete="off" value={c.campo} onChange={(e) => cambiar(i, { campo: e.target.value })} />
          <Boton className="sm:order-last" variante="fantasma" icono="cerrar" aria-label={`Quitar la condición ${i + 1}`} onClick={() => poner({ condiciones: form.condiciones.filter((_, j) => j !== i) })} />
          <CampoSelect etiqueta="Operador" value={c.op} onChange={(e) => cambiar(i, { op: e.target.value as OperadorDeCondicion, valor: e.target.value === 'existe' ? 'si' : c.valor })}>
            {OPERADORES.map((o) => <option key={o} value={o}>{ETIQUETA_DE_OPERADOR[o]}</option>)}
          </CampoSelect>
          <div className="col-span-2 sm:col-span-1">
            {c.op === 'existe' ? (
              <CampoSelect etiqueta="Debe" value={c.valor} onChange={(e) => cambiar(i, { valor: e.target.value })}>
                <option value="si">Existir</option>
                <option value="no">No existir</option>
              </CampoSelect>
            ) : (
              <Campo etiqueta="Valor" autoComplete="off" value={c.valor} onChange={(e) => cambiar(i, { valor: e.target.value })} />
            )}
          </div>
        </div>
      ))}
      {errores.condiciones ? <p role="alert" className="text-sm font-medium text-peligro">{errores.condiciones}</p> : null}
      <div><Boton icono="mas" onClick={() => poner({ condiciones: [...form.condiciones, { campo: '', op: 'igual', valor: '' }] })}>Agregar condición</Boton></div>
    </Tarjeta>
  );
}

export function PasoAcciones({ form, errores, poner }: Paso<'acciones'>) {
  const cambiar = (i: number, parte: Partial<FilaDeAccion>) => poner({ acciones: form.acciones.map((a, j) => (j === i ? { ...a, ...parte } : a)) });
  return (
    <Tarjeta numero={3} titulo="¿Qué hace?" ayuda="Cada acción es una herramienta del sistema. En los textos puedes usar {{datos.nombre}} para poner un dato del disparo.">
      {form.acciones.map((a, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-control border border-borde p-3">
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <CampoSelect etiqueta={`Acción ${i + 1}`} value={a.herramienta} onChange={(e) => cambiar(i, { herramienta: e.target.value })}>
              <option value="">Elige una herramienta…</option>
              {HERRAMIENTAS.map((h) => <option key={h} value={h}>{titularDeHerramienta(h)} ({h})</option>)}
            </CampoSelect>
            <Boton variante="fantasma" icono="cerrar" aria-label={`Quitar la acción ${i + 1}`} disabled={form.acciones.length === 1} onClick={() => poner({ acciones: form.acciones.filter((_, j) => j !== i) })} />
          </div>
          <FilasDeArgumentos nombreDelCampo="Argumento" filas={a.args} alCambiar={(args) => cambiar(i, { args })} etiquetaDeAgregar="Agregar argumento" />
        </div>
      ))}
      {errores.acciones ? <p role="alert" className="text-sm font-medium text-peligro">{errores.acciones}</p> : null}
      <div><Boton icono="mas" disabled={form.acciones.length >= 10} onClick={() => poner({ acciones: [...form.acciones, { herramienta: '', args: [] }] })}>Agregar acción</Boton></div>
    </Tarjeta>
  );
}

export function PasoModo({ form, errores, poner }: Paso<'modo' | 'limiteDiario'>) {
  return (
    <Tarjeta numero={4} titulo="¿Con qué control?" ayuda="Decide cuánta libertad tiene la regla.">
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoSelect etiqueta="Modo" value={form.modo} onChange={(e) => poner({ modo: e.target.value as ModoDeRegla, limiteDiario: form.limiteDiario })}>
          {MODOS_DE_REGLA.map((m) => <option key={m} value={m}>{ETIQUETA_DE_MODO[m]}</option>)}
        </CampoSelect>
        <Campo etiqueta="Límite de ejecuciones por día" type="number" inputMode="numeric" value={form.limiteDiario} error={errores.limite} onChange={(e) => poner({ modo: form.modo, limiteDiario: e.target.value })} />
      </div>
      <p className={form.modo === 'automatico' ? 'rounded-control border border-aviso/40 bg-aviso/15 px-3 py-2 text-sm font-medium' : 'text-sm text-texto-suave'} role={form.modo === 'automatico' ? 'alert' : undefined}>
        {AYUDA_DE_MODO[form.modo]}
      </p>
      {form.modo === 'automatico' ? <p className="text-sm text-texto-suave">Una regla en automático se guarda apagada: encenderla pide una confirmación aparte.</p> : null}
    </Tarjeta>
  );
}
