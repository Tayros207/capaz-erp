import { useState } from 'react';
import type { ArticuloDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { ajustarExistencia } from './api.ts';
import { argumentosDeAjuste, existenciaEn, textoDeCantidad, textoDeDiferencia, validarAjuste, type ErroresDeAjuste, type FormularioDeAjuste } from './logica.ts';
import { resolverAccion, useSucursales } from './use-inventario.ts';

type Props = { abierto: boolean; articulo: ArticuloDto; alCerrar: () => void };

function Contenido({ articulo, alCerrar }: Omit<Props, 'abierto'>) {
  const sucursales = useSucursales();
  const [form, setForm] = useState<FormularioDeAjuste>({ sucursalId: '', contada: null, motivo: '' });
  const [errores, setErrores] = useState<ErroresDeAjuste>({});
  const [enviando, setEnviando] = useState(false);
  const sucursalId = form.sucursalId || sucursales.data?.[0]?.id || '';
  const actual = existenciaEn(articulo, sucursalId);
  const cambiar = (c: Partial<FormularioDeAjuste>) => setForm((f) => ({ ...f, ...c }));
  const diferencia = textoDeDiferencia(actual, form.contada, articulo.unidad);

  async function enviar() {
    const completo = { ...form, sucursalId };
    const e = validarAjuste(completo, actual);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setEnviando(true);
    // Primer paso: el servidor devuelve el resumen; la persona lo confirma en el diálogo (segundo paso).
    const hecho = await resolverAccion(ajustarExistencia(argumentosDeAjuste(articulo.id, completo)), 'Existencia ajustada.');
    setEnviando(false);
    if (hecho) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <p className="text-sm text-texto-suave">Fija lo que hay según un conteo físico. La diferencia queda en el historial como ajuste y no se borra.</p>
      <CampoSelect etiqueta="Sucursal" value={sucursalId} onChange={(e) => cambiar({ sucursalId: e.target.value })} error={errores.sucursalId}>
        {(sucursales.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.codigo}</option>)}
      </CampoSelect>
      <CampoCantidad
        autoFocus
        etiqueta="Existencia contada"
        unidad={articulo.unidad}
        valor={form.contada}
        alCambiar={(contada) => cambiar({ contada })}
        error={errores.contada}
        ayuda={actual !== null ? `Registrado ahora: ${textoDeCantidad(actual, articulo.unidad)}.` : undefined}
      />
      {diferencia ? <p role="status" className="text-sm font-medium text-aviso">{diferencia}</p> : null}
      <CampoTextarea etiqueta="Motivo del ajuste" filas={3} maxLength={300} value={form.motivo} onChange={(e) => cambiar({ motivo: e.target.value })} error={errores.motivo} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton type="submit" variante="primario" cargando={enviando}>Continuar</Boton>
      </div>
    </form>
  );
}

/** Ajuste a lo contado (crítica): se pide aquí y se confirma en un segundo paso con el resumen del servidor. */
export function HojaDeAjuste({ abierto, articulo, alCerrar }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={`Ajustar ${articulo.nombre}`}>
      {abierto ? <Contenido articulo={articulo} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
