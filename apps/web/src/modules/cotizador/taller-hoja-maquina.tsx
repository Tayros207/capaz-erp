import { useState } from 'react';
import type { MaquinaDelTallerDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { crearMaquina, editarMaquina } from './api-taller.ts';
import {
  ETAPA_VACIA, MAQUINA_VACIA, MAXIMO_DE_ETAPAS, argumentosDeCreacionDeMaquina, argumentosDeEdicionDeMaquina, formularioDeMaquina, validarMaquina,
  type ErroresDeMaquina, type EtapaEnFormulario, type FormularioDeMaquina,
} from './logica-taller.ts';
import { guardarEnTaller } from './taller-guardar.ts';
import { PieDeHoja } from './taller-hoja-pie.tsx';

type Props = { abierto: boolean; maquina: MaquinaDelTallerDto | null; alCerrar: () => void };

function Etapas({ etapas, error, alCambiar }: { etapas: EtapaEnFormulario[]; error?: string; alCambiar: (e: EtapaEnFormulario[]) => void }) {
  const cambiar = (i: number, parte: Partial<EtapaEnFormulario>) => alCambiar(etapas.map((e, j) => (j === i ? { ...e, ...parte } : e)));
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-texto">Etapas con merma</legend>
      <p className="text-sm text-texto-suave">Cada etapa pierde hojas de arranque y un porcentaje del tiraje.</p>
      {etapas.map((e, i) => (
        <div key={i} className="grid grid-cols-2 gap-3 rounded-control border border-borde p-3">
          <div className="col-span-2"><Campo etiqueta={`Etapa ${i + 1}: nombre`} maxLength={60} value={e.nombre} onChange={(ev) => cambiar(i, { nombre: ev.target.value })} /></div>
          <Campo etiqueta="Merma (%)" inputMode="decimal" value={e.mermaPct} onChange={(ev) => cambiar(i, { mermaPct: ev.target.value })} />
          <Campo etiqueta="Arranque (hojas)" inputMode="numeric" value={e.arranque} onChange={(ev) => cambiar(i, { arranque: ev.target.value })} />
          <div className="col-span-2 flex justify-end"><Boton variante="fantasma" onClick={() => alCambiar(etapas.filter((_, j) => j !== i))}>Quitar etapa</Boton></div>
        </div>
      ))}
      {error ? <p role="alert" className="text-sm font-medium text-peligro">{error}</p> : null}
      {etapas.length < MAXIMO_DE_ETAPAS ? <div><Boton icono="mas" onClick={() => alCambiar([...etapas, ETAPA_VACIA])}>Agregar etapa</Boton></div> : null}
    </fieldset>
  );
}

function Medidas({ f, errores, poner }: { f: FormularioDeMaquina; errores: ErroresDeMaquina; poner: <K extends keyof FormularioDeMaquina>(k: K, v: FormularioDeMaquina[K]) => void }) {
  const m = (k: 'formatoMaxAnchoCm' | 'formatoMaxAltoCm' | 'pinzaCm' | 'sangradoCm' | 'calleCm', etiqueta: string) => (
    <Campo etiqueta={etiqueta} inputMode="decimal" autoComplete="off" value={f[k]} error={errores[k]} onChange={(e) => poner(k, e.target.value)} />
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {m('formatoMaxAnchoCm', 'Ancho máximo (cm)')}
      {m('formatoMaxAltoCm', 'Alto máximo (cm)')}
      {m('pinzaCm', 'Pinza (cm)')}
      {m('sangradoCm', 'Sangrado (cm)')}
      {m('calleCm', 'Calle (cm)')}
    </div>
  );
}

function Contenido({ maquina, alCerrar }: { maquina: MaquinaDelTallerDto | null; alCerrar: () => void }) {
  const [f, setF] = useState<FormularioDeMaquina>(() => (maquina ? formularioDeMaquina(maquina) : MAQUINA_VACIA));
  const [errores, setErrores] = useState<ErroresDeMaquina>({});
  const [guardando, setGuardando] = useState(false);
  const poner = <K extends keyof FormularioDeMaquina>(k: K, v: FormularioDeMaquina[K]) => setF((a) => ({ ...a, [k]: v }));

  async function guardar() {
    const cerrar = await guardarEnTaller(
      { formulario: f, original: maquina, validar: validarMaquina, alErrores: setErrores, armarCreacion: argumentosDeCreacionDeMaquina, armarEdicion: argumentosDeEdicionDeMaquina, crear: crearMaquina, editar: editarMaquina, mensajes: { creado: 'Máquina creada.', editado: 'Máquina actualizada.' } },
      () => setGuardando(true),
      () => setGuardando(false),
    );
    if (cerrar) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void guardar(); }}>
      <Campo etiqueta="Nombre" autoFocus maxLength={60} value={f.nombre} error={errores.nombre} onChange={(e) => poner('nombre', e.target.value)} />
      <Medidas f={f} errores={errores} poner={poner} />
      <Etapas etapas={f.etapas} error={errores.etapas} alCambiar={(e) => poner('etapas', e)} />
      <PieDeHoja alCerrar={alCerrar} guardando={guardando} etiqueta={maquina ? 'Guardar cambios' : 'Crear máquina'} />
    </form>
  );
}

/** Alta o edición de una máquina con su formato máximo, medidas de trabajo y etapas de merma. */
export function HojaDeMaquina({ abierto, maquina, alCerrar }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={maquina ? 'Editar máquina' : 'Nueva máquina'}>
      {abierto ? <Contenido key={maquina?.id ?? 'nueva'} maquina={maquina} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
