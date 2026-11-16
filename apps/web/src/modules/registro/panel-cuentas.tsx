import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatearSoles, type CuentaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { MenuDeAcciones, type AccionDeMenu } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { archivarCuenta, listarCuentas, marcarCuentaPrincipal } from './api.ts';
import { resolverAccion } from './acciones.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { ETIQUETA_DE_CUENTA } from './logica.ts';
import { HojaDeCuenta } from './hoja-cuenta.tsx';

function AccionesDeCuenta({ c, alEditar }: { c: CuentaDto; alEditar: (c: CuentaDto) => void }) {
  const archivada = c.archivadoEn !== null;
  const acciones: AccionDeMenu[] = [
    { etiqueta: 'Marcar como principal', deshabilitada: c.esPrincipal || archivada, onSeleccionar: () => void resolverAccion(marcarCuentaPrincipal(c.id), 'Cuenta principal actualizada.') },
    { etiqueta: 'Archivar', peligro: true, deshabilitada: c.esPrincipal || archivada, onSeleccionar: () => void resolverAccion(archivarCuenta(c.id), 'Cuenta archivada.') },
  ];
  return (
    <span className="inline-flex items-center gap-1">
      {archivada ? null : <Boton variante="fantasma" onClick={() => alEditar(c)}>Editar</Boton>}
      {archivada ? null : <MenuDeAcciones etiqueta={`Más acciones de ${c.nombre}`} acciones={acciones} />}
    </span>
  );
}

/** Cuentas del negocio: lista con saldo, alta y edición en hoja, marcar principal y archivar. */
export function PanelDeCuentas({ puedeConfigurar }: { puedeConfigurar: boolean }) {
  const consulta = useQuery({ queryKey: [...CLAVE_REGISTRO, 'cuentas', 'todas'], queryFn: async () => datosOError(await listarCuentas(true)) });
  const [hoja, setHoja] = useState<{ cuenta: CuentaDto | null } | null>(null);

  const columnas: Array<Columna<CuentaDto>> = [
    {
      id: 'nombre', titulo: 'Cuenta', principal: true,
      celda: (c) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {c.nombre}
          {c.esPrincipal ? <Insignia tono="info">Principal</Insignia> : null}
          {c.archivadoEn ? <Insignia tono="neutro">Archivada</Insignia> : null}
        </span>
      ),
    },
    { id: 'tipo', titulo: 'Tipo', celda: (c) => ETIQUETA_DE_CUENTA[c.tipo] },
    { id: 'saldo', titulo: 'Saldo', alinear: 'derecha', celda: (c) => <span className="font-medium tabular-nums">{formatearSoles(c.saldoCentimos)}</span> },
    ...(puedeConfigurar ? [{ id: 'acciones', titulo: 'Acciones', alinear: 'derecha' as const, celda: (c: CuentaDto) => <AccionesDeCuenta c={c} alEditar={(x) => setHoja({ cuenta: x })} /> }] : []),
  ];

  if (consulta.isPending) return <div aria-busy="true" aria-label="Cargando cuentas" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>;
  if (consulta.isError) return <EstadoVacio titulo="No pudimos cargar las cuentas" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />;
  return (
    <div className="flex flex-col gap-3">
      {puedeConfigurar ? <div className="flex justify-end"><Boton variante="primario" icono="mas" onClick={() => setHoja({ cuenta: null })}>Nueva cuenta</Boton></div> : null}
      <Lista etiqueta="Cuentas" columnas={columnas} filas={consulta.data.items} clave={(c) => c.id} vacio={<EstadoVacio titulo="Todavía no hay cuentas" descripcion="Crea una caja, un banco o una billetera." icono="caja" />} />
      <HojaDeCuenta abierto={hoja !== null} cuenta={hoja?.cuenta ?? null} alCerrar={() => setHoja(null)} />
    </div>
  );
}
