import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { CasillaDePagoFijo } from './casilla-de-pago-fijo.tsx';
import { buscarContactos, crearDeuda } from './api.ts';
import { resolverAccion } from './acciones.ts';
import {
  argumentosDeDeudaNueva, deudaNuevaEnBlanco, diaEnZona, ETIQUETA_DE_CONTACTO_DE_DEUDA, TITULO_DE_DEUDA_NUEVA, validarDeudaNueva,
  type ErroresDeDeudaNueva, type FormularioDeDeudaNueva, type TipoDeDeuda,
} from './logica.ts';

type Props = { abierto: boolean; tipo: TipoDeDeuda; alCerrar: () => void };

function Contenido({ tipo, alCerrar }: Omit<Props, 'abierto'>) {
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [form, setForm] = useState<FormularioDeDeudaNueva>(deudaNuevaEnBlanco);
  const [errores, setErrores] = useState<ErroresDeDeudaNueva>({});
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<FormularioDeDeudaNueva>) => setForm((f) => ({ ...f, ...c }));

  async function guardar() {
    const e = validarDeudaNueva(form, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    const r = await crearDeuda(argumentosDeDeudaNueva(tipo, form));
    setGuardando(false);
    if (await resolverAccion(r, 'Deuda anotada.')) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <SelectorDeRegistro
        etiqueta={ETIQUETA_DE_CONTACTO_DE_DEUDA[tipo]}
        valor={form.contacto}
        alCambiar={(contacto) => cambiar({ contacto })}
        buscar={buscarContactos}
        textoSinResultados="Ningún cliente o proveedor se parece a eso"
        error={errores.contacto}
      />
      <Campo etiqueta="Concepto" maxLength={200} value={form.concepto} onChange={(e) => cambiar({ concepto: e.target.value })} error={errores.concepto} />
      <CampoMonto etiqueta="Total" valor={form.total} alCambiar={(total) => cambiar({ total })} error={errores.total} />
      <Campo etiqueta="Vence (opcional)" type="date" min={hoy} value={form.venceEn} onChange={(e) => cambiar({ venceEn: e.target.value })} error={errores.venceEn} />
      {tipo === 'por_pagar' ? <CasillaDePagoFijo marcado={form.fijo} alCambiar={(fijo) => cambiar({ fijo })} /> : null}
      <CampoTextarea etiqueta="Notas (opcional)" filas={2} maxLength={2000} value={form.notas} onChange={(e) => cambiar({ notas: e.target.value })} error={errores.notas} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Anotar deuda</Boton>
      </div>
    </form>
  );
}

/** Anota una deuda a mano, sin pedido de por medio: contacto, concepto, total y vencimiento opcional. */
export function HojaDeDeudaNueva({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={TITULO_DE_DEUDA_NUEVA[resto.tipo]}>
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
