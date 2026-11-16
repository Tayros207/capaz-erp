import { useState } from 'react';
import type { Aviso, CuentaDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { transferirEntreCuentas } from './api.ts';
import { refrescarRegistro } from './acciones.ts';
import {
  argumentosDeTransferencia, cuentasDeDestino, cuentasVivas, diaEnZona, ETIQUETA_DE_CUENTA, invertirTransferencia, mensajeDeRechazo, siguienteTransferencia,
  transferenciaInicial, validarTransferencia, type ErroresDeTransferencia, type FormularioDeTransferencia,
} from './logica.ts';

type Props = { abierto: boolean; cuentas: readonly CuentaDto[]; alCerrar: () => void };

function Contenido({ cuentas, alCerrar }: Omit<Props, 'abierto'>) {
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [form, setForm] = useState<FormularioDeTransferencia>(() => transferenciaInicial(hoy, cuentas));
  const [errores, setErrores] = useState<ErroresDeTransferencia>({});
  const [fallo, setFallo] = useState<string | undefined>();
  const [hecho, setHecho] = useState<{ avisos: Aviso[] } | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const cambiar = (c: Partial<FormularioDeTransferencia>) => setForm((f) => ({ ...f, ...c }));

  function cambiarOrigen(origenId: string) {
    // Si el nuevo origen es el destino actual, el destino pasa a la primera otra cuenta.
    const destinoId = form.destinoId === origenId ? (cuentasDeDestino(cuentas, origenId)[0]?.id ?? '') : form.destinoId;
    cambiar({ origenId, destinoId });
  }

  async function guardar() {
    const e = validarTransferencia(form, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setFallo(undefined);
    const r = await transferirEntreCuentas(argumentosDeTransferencia(form));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      await refrescarRegistro();
      setHecho({ avisos: r.avisos });
      setForm(siguienteTransferencia(form));
      setVuelta((v) => v + 1);
    } else if ('error' in r) {
      setHecho(undefined);
      setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    }
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      {hecho ? (
        <div role="status" className="flex flex-col gap-1 text-sm font-medium">
          <p className="text-exito">Transferencia registrada</p>
          {hecho.avisos.map((a) => <p key={a.codigo} className="text-aviso">{a.mensaje}</p>)}
        </div>
      ) : null}
      <CampoMonto key={vuelta} autoFocus etiqueta="Monto" valor={form.monto} alCambiar={(monto) => cambiar({ monto })} error={errores.monto} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoSelect etiqueta="Sale de" value={form.origenId} onChange={(e) => cambiarOrigen(e.target.value)} error={errores.origenId}>
          {cuentasVivas(cuentas).map((c) => <option key={c.id} value={c.id}>{c.nombre} · {ETIQUETA_DE_CUENTA[c.tipo]}</option>)}
        </CampoSelect>
        <CampoSelect etiqueta="Llega a" value={form.destinoId} onChange={(e) => cambiar({ destinoId: e.target.value })} error={errores.destinoId}>
          {cuentasDeDestino(cuentas, form.origenId).map((c) => <option key={c.id} value={c.id}>{c.nombre} · {ETIQUETA_DE_CUENTA[c.tipo]}</option>)}
        </CampoSelect>
      </div>
      <div className="flex justify-start">
        <Boton variante="fantasma" onClick={() => setForm(invertirTransferencia(form))}>Invertir origen y destino</Boton>
      </div>
      <Campo etiqueta="Fecha" type="date" max={hoy} value={form.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} error={errores.fecha} />
      <CampoTextarea etiqueta="Nota (opcional)" filas={2} maxLength={500} value={form.nota} onChange={(e) => cambiar({ nota: e.target.value })} error={errores.nota} />
      {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Transferir</Boton>
      </div>
    </form>
  );
}

/** Pasa dinero de una cuenta a otra (caja → banco). No cuenta como ingreso ni como egreso del negocio. */
export function HojaDeTransferencia({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo="Transferir entre cuentas">
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
