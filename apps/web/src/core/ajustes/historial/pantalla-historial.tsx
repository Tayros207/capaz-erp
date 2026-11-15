import { useState } from 'react';
import { useLoaderData } from 'react-router';
import type { EventoDeAuditoria, Respuesta } from '@capaz/shared';
import type { PaginaDeHistorial as Pagina } from './cargador.ts';
import { llamar } from '../../../shared/api/herramientas.ts';
import { formatearFechaHora } from '../../../shared/formato/fechas.ts';
import { Boton } from '../../../shared/ui/boton.tsx';
import { Campo } from '../../../shared/ui/campo.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { argumentosDeListado, detalleDeEvento, RESULTADOS, textoDeAccion, type FiltrosDeHistorial } from './logica.ts';

const COLUMNAS: Array<Columna<EventoDeAuditoria>> = [
  { id: 'cuando', titulo: 'Cuándo', celda: (e) => formatearFechaHora(e.creadoEn), valorDeOrden: (e) => e.creadoEn },
  { id: 'accion', titulo: 'Qué pasó', principal: true, celda: (e) => textoDeAccion(e.herramienta) },
  { id: 'resultado', titulo: 'Resultado', celda: (e) => <Insignia tono={RESULTADOS[e.resultado].tono}>{RESULTADOS[e.resultado].texto}</Insignia> },
  { id: 'detalle', titulo: 'Detalle', celda: (e) => detalleDeEvento(e) || '—' },
];

export function PantallaHistorial() {
  const inicial = useLoaderData() as Respuesta<Pagina>;
  const [filtros, setFiltros] = useState<FiltrosDeHistorial>({ herramienta: '', resultado: '' });
  const [pagina, setPagina] = useState<Respuesta<Pagina>>(inicial);
  const [extra, setExtra] = useState<EventoDeAuditoria[]>([]);
  const [siguiente, setSiguiente] = useState<string | null | undefined>();
  const [cargando, setCargando] = useState(false);

  const encabezado = <EncabezadoDePagina titulo="Historial" migas={[{ texto: 'Ajustes' }, { texto: 'Historial' }]} />;
  if (!pagina.ok || !('datos' in pagina)) {
    const mensaje = 'error' in pagina ? pagina.error.mensaje : 'No se pudo cargar el historial.';
    return (
      <div className="flex flex-col gap-4">
        {encabezado}
        <EstadoVacio titulo="No pudimos cargar el historial" descripcion={mensaje} icono="caja" accion={<Boton onClick={() => void buscar(filtros)}>Reintentar</Boton>} />
      </div>
    );
  }
  const filas = [...pagina.datos.items, ...extra];
  const cursor = siguiente === undefined ? pagina.datos.siguiente : siguiente;

  async function buscar(nuevos: FiltrosDeHistorial) {
    setCargando(true);
    const r = await llamar('auditoria_listar', argumentosDeListado(nuevos));
    setPagina(r);
    setExtra([]);
    setSiguiente(undefined);
    setCargando(false);
  }

  async function cargarMas(c: string) {
    setCargando(true);
    const r = await llamar('auditoria_listar', argumentosDeListado(filtros, c));
    if (r.ok && 'datos' in r) {
      setExtra((e) => [...e, ...r.datos.items]);
      setSiguiente(r.datos.siguiente);
    }
    setCargando(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {encabezado}
      <form
        className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void buscar(filtros);
        }}
      >
        <Campo etiqueta="Acción (nombre de la herramienta)" value={filtros.herramienta} onChange={(e) => setFiltros({ ...filtros, herramienta: e.target.value })} placeholder="empresa_actualizar_configuracion" />
        <CampoSelect etiqueta="Resultado" value={filtros.resultado} onChange={(e) => setFiltros({ ...filtros, resultado: e.target.value as FiltrosDeHistorial['resultado'] })}>
          <option value="">Todos</option>
          <option value="ok">Hecho</option>
          <option value="pendiente_confirmacion">Esperó confirmación</option>
          <option value="rechazada">Rechazada</option>
        </CampoSelect>
        <Boton type="submit" variante="primario" cargando={cargando}>Filtrar</Boton>
      </form>
      <Lista
        etiqueta="Historial de acciones"
        columnas={COLUMNAS}
        filas={filas}
        clave={(e) => e.id}
        vacio={<EstadoVacio titulo="Sin movimientos" descripcion="Aquí aparecerá lo que se haga en tu empresa: quién, qué y cuándo." icono="carpeta" />}
      />
      {filas.length > 0 ? <CargarMas cursor={cursor} cargando={cargando} onCargar={(c) => void cargarMas(c)} resumen={`Mostrando ${filas.length}`} /> : null}
    </div>
  );
}
