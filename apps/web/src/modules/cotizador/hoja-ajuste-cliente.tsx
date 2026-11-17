import { useState } from 'react';
import type { AjusteDeClienteDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro, type Opcion } from '../../shared/ui/selector-de-registro.tsx';
import { resolverAccion } from './acciones.ts';
import { buscarClientes, fijarAjuste } from './api.ts';
import { argumentosDeAjuste, validarAjusteDeCliente } from './logica.ts';

type Props = { abierto: boolean; ajuste: AjusteDeClienteDto | null; alCerrar: () => void };

function Contenido({ ajuste, alCerrar }: { ajuste: AjusteDeClienteDto | null; alCerrar: () => void }) {
  const [cliente, setCliente] = useState<Opcion | null>(ajuste ? { id: ajuste.clienteId, nombre: ajuste.clienteNombre } : null);
  const [porcentaje, setPorcentaje] = useState(ajuste?.porcentaje ?? '');
  const [nota, setNota] = useState(ajuste?.nota ?? '');
  const [errores, setErrores] = useState<{ cliente?: string; porcentaje?: string }>({});
  const [guardando, setGuardando] = useState(false);

  async function buscar(texto: string) {
    const { items } = datosOError(await buscarClientes(texto));
    return items.map((c) => ({ id: c.id, nombre: c.nombre }));
  }
  async function guardar() {
    const e = validarAjusteDeCliente(cliente?.id ?? null, porcentaje);
    setErrores(e);
    if (e.cliente || e.porcentaje || !cliente) return;
    setGuardando(true);
    const ok = await resolverAccion(fijarAjuste(argumentosDeAjuste(cliente.id, porcentaje, nota)), 'Ajuste guardado.');
    setGuardando(false);
    if (ok) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void guardar(); }}>
      {ajuste ? (
        <p className="font-medium text-texto">{ajuste.clienteNombre}</p>
      ) : (
        <SelectorDeRegistro etiqueta="Cliente" valor={cliente} alCambiar={setCliente} buscar={buscar} error={errores.cliente} textoSinResultados="Ningún cliente se parece a eso" />
      )}
      <Campo etiqueta="Porcentaje" inputMode="decimal" value={porcentaje} error={errores.porcentaje} ayuda="Negativo es descuento (-5); positivo es recargo (10). Vacío o 0 lo quita." onChange={(e) => setPorcentaje(e.target.value)} />
      <Campo etiqueta="Nota (opcional)" maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>Guardar ajuste</Boton>
      </div>
    </form>
  );
}

/** Alta o cambio del precio especial de un cliente. */
export function HojaDeAjusteDeCliente({ abierto, ajuste, alCerrar }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={ajuste ? 'Cambiar precio por cliente' : 'Nuevo precio por cliente'}>
      {abierto ? <Contenido key={ajuste?.clienteId ?? 'nuevo'} ajuste={ajuste} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
