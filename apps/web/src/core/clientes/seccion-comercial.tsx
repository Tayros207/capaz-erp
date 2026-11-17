import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Centimos, ClienteComercialDto } from '@capaz/shared';
import { centimosSchema, formatearSoles, MONEDAS } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { guardarComercial, verComercial } from './api-ampliados.ts';
import { datosOError } from './api.ts';
import { CLAVE_CLIENTES } from './claves.ts';
import { errorDePlazo } from './logica-ampliados.ts';

const PREFIJO_MONEDA: Record<string, string> = { PEN: 'Soles', USD: 'Dólares', EUR: 'Euros' };

type Formulario = {
  condicionPagoDias: string;
  limite: Centimos | null;
  moneda: ClienteComercialDto['moneda'];
  vendedorId: string;
  segmento: string;
  sitioWeb: string;
  agenteRetencion: boolean;
  sujetoDetraccion: boolean;
  banco: string;
  cuentaBancaria: string;
  cci: string;
  notasComerciales: string;
};

const desde = (c: ClienteComercialDto): Formulario => ({
  condicionPagoDias: String(c.condicionPagoDias),
  limite: c.limiteCreditoCentimos === null ? null : centimosSchema.parse(c.limiteCreditoCentimos),
  moneda: c.moneda,
  vendedorId: c.vendedorId ?? '',
  segmento: c.segmento ?? '',
  sitioWeb: c.sitioWeb ?? '',
  agenteRetencion: c.agenteRetencion,
  sujetoDetraccion: c.sujetoDetraccion,
  banco: c.banco ?? '',
  cuentaBancaria: c.cuentaBancaria ?? '',
  cci: c.cci ?? '',
  notasComerciales: c.notasComerciales ?? '',
});

const vacioANulo = (t: string) => (t.trim() === '' ? null : t.trim());

function Formulario({ inicial, alGuardar, alCancelar }: { inicial: ClienteComercialDto; alGuardar: (f: Formulario) => Promise<void>; alCancelar: () => void }) {
  const [f, setF] = useState(() => desde(inicial));
  const [ocupado, setOcupado] = useState(false);
  const cambiar = (c: Partial<Formulario>) => setF((x) => ({ ...x, ...c }));
  const errorPlazo = errorDePlazo(f.condicionPagoDias);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (errorPlazo) return;
        setOcupado(true);
        await alGuardar(f);
        setOcupado(false);
      }}
    >
      <Campo etiqueta="Plazo de pago (días)" inputMode="numeric" value={f.condicionPagoDias} error={errorPlazo} ayuda="0 es al contado." onChange={(e) => cambiar({ condicionPagoDias: e.target.value })} />
      <CampoMonto etiqueta="Límite de crédito" valor={f.limite} alCambiar={(limite) => cambiar({ limite })} ayuda="Vacío si no tiene límite." />
      <CampoSelect etiqueta="Moneda" value={f.moneda} onChange={(e) => cambiar({ moneda: e.target.value as Formulario['moneda'] })}>
        {MONEDAS.map((m) => (
          <option key={m} value={m}>{PREFIJO_MONEDA[m]} ({m})</option>
        ))}
      </CampoSelect>
      <Campo etiqueta="Segmento" value={f.segmento} onChange={(e) => cambiar({ segmento: e.target.value })} />
      <Campo etiqueta="Vendedor asignado" value={f.vendedorId} onChange={(e) => cambiar({ vendedorId: e.target.value })} />
      <Campo etiqueta="Sitio web" value={f.sitioWeb} onChange={(e) => cambiar({ sitioWeb: e.target.value })} />
      <Campo etiqueta="Banco" value={f.banco} onChange={(e) => cambiar({ banco: e.target.value })} />
      <Campo etiqueta="Cuenta bancaria" inputMode="numeric" value={f.cuentaBancaria} onChange={(e) => cambiar({ cuentaBancaria: e.target.value })} />
      <Campo etiqueta="CCI" inputMode="numeric" value={f.cci} onChange={(e) => cambiar({ cci: e.target.value })} />
      <div className="flex flex-col gap-2 justify-center">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.agenteRetencion} onChange={(e) => cambiar({ agenteRetencion: e.target.checked })} /> Agente de retención</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.sujetoDetraccion} onChange={(e) => cambiar({ sujetoDetraccion: e.target.checked })} /> Sujeto a detracción</label>
      </div>
      <div className="sm:col-span-2">
        <Campo etiqueta="Notas comerciales" value={f.notasComerciales} onChange={(e) => cambiar({ notasComerciales: e.target.value })} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Boton type="submit" variante="primario" cargando={ocupado}>Guardar</Boton>
        <Boton onClick={alCancelar}>Cancelar</Boton>
      </div>
    </form>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}

/** Condiciones comerciales y datos bancarios del cliente o proveedor. */
export function SeccionComercial({ clienteId, puedeEditar }: { clienteId: string; puedeEditar: boolean }) {
  const consultas = useQueryClient();
  const clave = [...CLAVE_CLIENTES, 'comercial', clienteId];
  const consulta = useQuery({ queryKey: clave, queryFn: async () => datosOError(await verComercial(clienteId)) });
  const [editando, setEditando] = useState(false);
  if (consulta.isPending) return <Esqueleto className="h-24" />;
  if (consulta.isError) return <p role="alert" className="text-sm text-peligro">{consulta.error.message}</p>;
  const c = consulta.data;

  async function guardar(f: Formulario) {
    const r = await guardarComercial({
      clienteId,
      condicionPagoDias: Number(f.condicionPagoDias),
      limiteCreditoCentimos: f.limite,
      moneda: f.moneda,
      vendedorId: vacioANulo(f.vendedorId),
      segmento: vacioANulo(f.segmento),
      sitioWeb: vacioANulo(f.sitioWeb),
      agenteRetencion: f.agenteRetencion,
      sujetoDetraccion: f.sujetoDetraccion,
      banco: vacioANulo(f.banco),
      cuentaBancaria: vacioANulo(f.cuentaBancaria),
      cci: vacioANulo(f.cci),
      notasComerciales: vacioANulo(f.notasComerciales),
    });
    if (r.ok && 'datos' in r) {
      notificar('Condiciones guardadas.', 'exito');
      setEditando(false);
      await consultas.invalidateQueries({ queryKey: clave });
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }

  if (editando) return <Formulario inicial={c} alGuardar={guardar} alCancelar={() => setEditando(false)} />;
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato etiqueta="Plazo de pago" valor={c.condicionPagoDias === 0 ? 'Al contado' : `${c.condicionPagoDias} días`} />
        <Dato etiqueta="Límite de crédito" valor={c.limiteCreditoCentimos === null ? '' : formatearSoles(c.limiteCreditoCentimos)} />
        <Dato etiqueta="Moneda" valor={PREFIJO_MONEDA[c.moneda] ?? c.moneda} />
        <Dato etiqueta="Segmento" valor={c.segmento ?? ''} />
        <Dato etiqueta="Vendedor asignado" valor={c.vendedorId ?? ''} />
        <Dato etiqueta="Sitio web" valor={c.sitioWeb ?? ''} />
        <Dato etiqueta="Banco" valor={[c.banco, c.cuentaBancaria].filter(Boolean).join(' · ')} />
        <Dato etiqueta="CCI" valor={c.cci ?? ''} />
        <Dato etiqueta="Retención y detracción" valor={[c.agenteRetencion ? 'Agente de retención' : '', c.sujetoDetraccion ? 'Sujeto a detracción' : ''].filter(Boolean).join(' · ')} />
        <Dato etiqueta="Notas comerciales" valor={c.notasComerciales ?? ''} />
      </dl>
      {puedeEditar ? <div><Boton onClick={() => setEditando(true)}>Editar condiciones</Boton></div> : null}
    </div>
  );
}
