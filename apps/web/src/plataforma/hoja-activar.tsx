import { createElement, useState } from 'react';
import { Check } from 'lucide-react';
import { Boton } from '../shared/ui/boton.tsx';
import { Campo } from '../shared/ui/campo.tsx';
import { HojaInferior } from '../shared/ui/hoja-inferior.tsx';
import { activarModulo } from './api.ts';
import { unir } from '../shared/ui/unir.ts';
import { iconoDeModulo } from './iconos-de-modulo.ts';
import { mensajeDeRechazo, nombreDeModulo, parsearDiasDePrueba } from './logica.ts';

type Props = { abierto: boolean; empresa: string; conocidos: string[]; /** Módulos que la empresa ya tiene (activos, en prueba o suspendidos): no se pueden elegir de nuevo. */ yaTiene?: string[]; alCerrar: () => void; alCambiar: () => void };

const PRUEBAS = [{ d: '7', t: '7 días' }, { d: '15', t: '15 días' }, { d: '30', t: '30 días' }, { d: '', t: 'Sin prueba' }] as const;

function Contenido({ empresa, conocidos, yaTiene = [], alCerrar, alCambiar }: Omit<Props, 'abierto'>) {
  const [modulo, setModulo] = useState('');
  const [dias, setDias] = useState('15');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<{ modulo?: string; dias?: string }>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    const d = parsearDiasDePrueba(dias);
    const e = { modulo: modulo.trim() ? undefined : 'Elige un módulo.', dias: 'error' in d ? d.error : undefined };
    setErrores(e);
    if (e.modulo || e.dias) return;
    setOcupado(true);
    setAviso(undefined);
    const r = await activarModulo({
      empresa,
      modulo: modulo.trim(),
      ...('dias' in d && d.dias ? { pruebaDias: d.dias } : {}),
      ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
    });
    setOcupado(false);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      alCambiar();
      alCerrar();
    } else if ('error' in r) setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <fieldset disabled={ocupado} className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Módulo a activar" aria-invalid={errores.modulo ? true : undefined} className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto">Módulo</span>
          <div className="grid max-h-60 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {conocidos.map((c) => {
              const tiene = yaTiene.includes(c);
              const elegido = modulo === c;
              return (
                <label
                  key={c}
                  className={unir(
                    'relative flex min-h-12 cursor-pointer items-center gap-3 rounded-control border px-3 py-2 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foco',
                    elegido ? 'border-accion bg-accion/[0.07]' : 'border-borde bg-superficie hover:border-borde-fuerte',
                    tiene && 'cursor-not-allowed opacity-50 hover:border-borde',
                  )}
                >
                  <input type="radio" name="modulo" value={c} checked={elegido} disabled={tiene} onChange={() => setModulo(c)} className="sr-only" />
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-control bg-superficie-alta text-texto-suave">
                    {createElement(iconoDeModulo(c), { className: 'size-4', strokeWidth: 1.75 })}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-sm font-semibold text-texto">{nombreDeModulo(c)}</span>
                    <span className="text-xs text-texto-suave"><span className="font-mono">{c}</span>{tiene ? ' · ya lo tiene' : ''}</span>
                  </span>
                  {elegido ? <Check aria-hidden className="size-4 shrink-0 text-accion" strokeWidth={2.25} /> : null}
                </label>
              );
            })}
          </div>
          {errores.modulo ? <p role="alert" className="text-sm font-medium text-peligro">{errores.modulo}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-texto" id="rotulo-prueba">Prueba</span>
          <div role="group" aria-labelledby="rotulo-prueba" className="flex flex-wrap gap-1.5">
            {PRUEBAS.map((o) => (
              <button
                key={o.t}
                type="button"
                aria-pressed={dias === o.d}
                onClick={() => setDias(o.d)}
                className={unir('inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium transition-colors', dias === o.d ? 'border-texto bg-texto text-texto-inverso' : 'border-borde bg-superficie text-texto-suave hover:border-borde-fuerte hover:text-texto')}
              >
                {o.t}
              </button>
            ))}
          </div>
          <Campo etiqueta="Otros días de prueba" inputMode="numeric" value={dias} error={errores.dias} ayuda="De 1 a 365. Vacío: queda activo, sin prueba." onChange={(e) => setDias(e.target.value)} />
        </div>
        <Campo etiqueta="Motivo (opcional)" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {modulo ? (
          <p role="status" className="rounded-control bg-superficie-alta px-3 py-2 text-sm text-texto-suave">
            Se activará <strong className="text-texto">{nombreDeModulo(modulo)}</strong> <span className="font-mono text-xs">({modulo})</span>{' '}
            {dias.trim() === '' ? 'como módulo activo, sin período de prueba.' : `con ${dias} ${dias === '1' ? 'día' : 'días'} de prueba.`}
          </p>
        ) : null}
      </fieldset>
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado}>Activar módulo</Boton>
      </div>
    </form>
  );
}

export function HojaActivar({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo="Activar un módulo">
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
