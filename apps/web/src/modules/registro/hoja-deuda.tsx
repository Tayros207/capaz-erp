import { useState } from 'react';
import type { DeudaDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { editarDeuda } from './api.ts';
import { resolverAccion } from './acciones.ts';
import { argumentosDeEdicionDeDeuda, formularioDeDeuda, validarDeuda, type ErroresDeDeuda, type FormularioDeDeuda } from './logica.ts';

type Props = { abierto: boolean; deuda: DeudaDto; alCerrar: () => void };

function Contenido({ deuda, alCerrar }: Omit<Props, 'abierto'>) {
  const [form, setForm] = useState<FormularioDeDeuda>(() => formularioDeDeuda(deuda));
  const [errores, setErrores] = useState<ErroresDeDeuda>({});
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<FormularioDeDeuda>) => setForm((f) => ({ ...f, ...c }));

  async function guardar() {
    const e = validarDeuda(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    const args = argumentosDeEdicionDeDeuda(deuda.id, form, deuda);
    if (!args) {
      notificar('No cambiaste ningún dato.', 'info');
      return;
    }
    setGuardando(true);
    const r = await editarDeuda(args);
    setGuardando(false);
    if (await resolverAccion(r, 'Deuda actualizada.')) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <Campo etiqueta="Concepto" maxLength={200} value={form.concepto} onChange={(e) => cambiar({ concepto: e.target.value })} error={errores.concepto} />
      <Campo etiqueta="Vence (opcional)" type="date" value={form.venceEn} onChange={(e) => cambiar({ venceEn: e.target.value })} error={errores.venceEn} />
      <CampoTextarea etiqueta="Notas (opcional)" filas={3} maxLength={2000} value={form.notas} onChange={(e) => cambiar({ notas: e.target.value })} error={errores.notas} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Guardar cambios</Boton>
      </div>
    </form>
  );
}

/** Edición de una deuda abierta: concepto, vencimiento y notas (el monto no se edita). */
export function HojaDeDeuda({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={`Editar ${resto.deuda.codigo}`}>
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
