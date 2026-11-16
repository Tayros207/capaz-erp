import { useState } from 'react';
import type { Centimos, CuentaDto, DeudaDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { abonarDeuda } from './api.ts';
import { resolverAccion } from './acciones.ts';
import { abonoInicial, argumentosDeAbono, diaEnZona, ETIQUETA_DE_CUENTA, ETIQUETA_DE_MEDIO, validarAbono, type ErroresDeAbono, type FormularioDeAbono, type MedioDePago } from './logica.ts';

type Props = { abierto: boolean; deuda: DeudaDto; cuentas: readonly CuentaDto[]; alCerrar: () => void };

function Contenido({ deuda, cuentas, alCerrar }: Omit<Props, 'abierto'>) {
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [form, setForm] = useState<FormularioDeAbono>(() => abonoInicial(deuda.saldoCentimos as Centimos, hoy, cuentas));
  const [errores, setErrores] = useState<ErroresDeAbono>({});
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<FormularioDeAbono>) => setForm((f) => ({ ...f, ...c }));

  async function guardar() {
    const e = validarAbono(form, deuda.saldoCentimos, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    const r = await abonarDeuda(argumentosDeAbono(deuda.id, form));
    setGuardando(false);
    if (await resolverAccion(r, 'Abono registrado.')) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <CampoMonto autoFocus etiqueta="Monto del abono" valor={form.monto} alCambiar={(monto) => cambiar({ monto })} error={errores.monto} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha" type="date" max={hoy} value={form.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} error={errores.fecha} />
        <CampoSelect etiqueta="Cuenta" value={form.cuentaId} onChange={(e) => cambiar({ cuentaId: e.target.value })}>
          {cuentas.filter((c) => c.archivadoEn === null).map((c) => <option key={c.id} value={c.id}>{c.nombre} · {ETIQUETA_DE_CUENTA[c.tipo]}</option>)}
        </CampoSelect>
        <CampoSelect etiqueta="Medio de pago" value={form.medioDePago} onChange={(e) => cambiar({ medioDePago: e.target.value as MedioDePago })}>
          {Object.entries(ETIQUETA_DE_MEDIO).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </CampoSelect>
      </div>
      <CampoTextarea etiqueta="Descripción (opcional)" filas={2} maxLength={500} value={form.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} error={errores.descripcion} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Registrar abono</Boton>
      </div>
    </form>
  );
}

/** Abono de una deuda: el monto viene con el saldo completo y se puede bajar. */
export function HojaDeAbono({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={`Abono a ${resto.deuda.codigo}`}>
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
