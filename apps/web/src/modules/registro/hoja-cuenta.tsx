import { useState } from 'react';
import type { CuentaDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { crearCuenta, editarCuenta } from './api.ts';
import { resolverAccion } from './acciones.ts';
import {
  argumentosDeCuentaEditada, argumentosDeCuentaNueva, cuentaEnBlanco, ETIQUETA_DE_CUENTA, formularioDeCuenta, validarCuenta, type ErroresDeCuenta, type FormularioDeCuenta,
} from './logica.ts';

type Props = { abierto: boolean; /** Sin cuenta, se crea una nueva. */ cuenta: CuentaDto | null; alCerrar: () => void };

function Contenido({ cuenta, alCerrar }: { cuenta: CuentaDto | null; alCerrar: () => void }) {
  const [form, setForm] = useState<FormularioDeCuenta>(() => (cuenta ? formularioDeCuenta(cuenta) : cuentaEnBlanco()));
  const [errores, setErrores] = useState<ErroresDeCuenta>({});
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<FormularioDeCuenta>) => setForm((f) => ({ ...f, ...c }));

  async function guardar() {
    const e = validarCuenta(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    const r = cuenta ? await editarCuenta(argumentosDeCuentaEditada(cuenta.id, form)) : await crearCuenta(argumentosDeCuentaNueva(form));
    setGuardando(false);
    if (await resolverAccion(r, cuenta ? 'Cuenta actualizada.' : 'Cuenta creada.')) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <Campo etiqueta="Nombre" autoFocus maxLength={80} value={form.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} error={errores.nombre} />
      <CampoSelect etiqueta="Tipo" value={form.tipo} onChange={(e) => cambiar({ tipo: e.target.value as FormularioDeCuenta['tipo'] })}>
        {Object.entries(ETIQUETA_DE_CUENTA).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
      </CampoSelect>
      {cuenta ? null : (
        <CampoMonto etiqueta="Saldo inicial (opcional)" valor={form.saldoInicial} alCambiar={(saldoInicial) => cambiar({ saldoInicial })} error={errores.saldoInicial} />
      )}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>{cuenta ? 'Guardar cambios' : 'Crear cuenta'}</Boton>
      </div>
    </form>
  );
}

/** Alta o edición de una cuenta; el saldo inicial solo se fija al crearla. */
export function HojaDeCuenta({ abierto, cuenta, alCerrar }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={cuenta ? 'Editar cuenta' : 'Nueva cuenta'}>
      {abierto ? <Contenido key={cuenta?.id ?? 'nueva'} cuenta={cuenta} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
