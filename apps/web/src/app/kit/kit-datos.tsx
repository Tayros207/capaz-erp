import { useMemo, useState, type ReactNode } from 'react';
import { formatearFecha } from '../../shared/formato/fechas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { Insignia, type TonoDeInsignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { BarraDeBusqueda } from '../../shared/ui/datos/barra-de-busqueda.tsx';
import { BarraDeEstado } from '../../shared/ui/datos/barra-de-estado.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Ficha } from '../../shared/ui/datos/ficha.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { ordenarSegunColumna, type Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { loteDesde, type Orden } from '../../shared/ui/datos/logica-lista.ts';
import { MenuDeAcciones } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { Pestanas } from '../../shared/ui/datos/pestanas.tsx';
import { useFicha } from '../../shared/ui/datos/use-ficha.ts';

type Fila = { id: string; codigo: string; cliente: string; estado: 'Borrador' | 'Confirmado' | 'Entregado'; total: number; fecha: string };

const CLIENTES = ['Imprenta Andina', 'Gráfica del Sur', 'Textiles Rímac', 'Panadería La Esquina', 'Ferretería Norte', 'Estudio Pacífico'];
const ESTADOS: Fila['estado'][] = ['Borrador', 'Confirmado', 'Entregado'];
const TONOS: Record<Fila['estado'], TonoDeInsignia> = { Borrador: 'neutro', Confirmado: 'info', Entregado: 'exito' };

/** 200 filas de ejemplo, siempre las mismas. */
const FILAS: Fila[] = Array.from({ length: 200 }, (_, i) => ({
  id: `ej-${i + 1}`,
  codigo: `EJ-${String(i + 1).padStart(4, '0')}`,
  cliente: CLIENTES[(i * 7) % CLIENTES.length]!,
  estado: ESTADOS[(i * 5) % ESTADOS.length]!,
  total: ((i * 7919) % 90000) + 1500,
  fecha: new Date(Date.UTC(2026, 0, 1 + ((i * 3) % 300), 12)).toISOString(),
}));

const COLUMNAS: Array<Columna<Fila>> = [
  { id: 'codigo', titulo: 'Código', principal: true, celda: (f) => f.codigo, valorDeOrden: (f) => f.codigo },
  { id: 'cliente', titulo: 'Cliente', celda: (f) => f.cliente, valorDeOrden: (f) => f.cliente },
  { id: 'estado', titulo: 'Estado', celda: (f) => <Insignia tono={TONOS[f.estado]}>{f.estado}</Insignia>, valorDeOrden: (f) => f.estado },
  { id: 'fecha', titulo: 'Fecha', celda: (f) => formatearFecha(f.fecha), valorDeOrden: (f) => f.fecha },
  { id: 'total', titulo: 'Total', alinear: 'derecha', celda: (f) => formatearSoles(f.total), valorDeOrden: (f) => f.total },
];

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 border-b border-borde pb-1 font-titulo text-xl font-semibold">
        {titulo} <Insignia tono="info">Ejemplo</Insignia>
      </h2>
      {children}
    </section>
  );
}

function ListaDeEjemplo() {
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<Orden>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [acumulado, setAcumulado] = useState(() => loteDesde(FILAS, null, 25));
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<string | null>(null);

  const texto = busqueda.trim().toLowerCase();
  const coinciden = useMemo(
    () => ordenarSegunColumna(FILAS.filter((f) => !texto || `${f.codigo} ${f.cliente}`.toLowerCase().includes(texto)), COLUMNAS, orden),
    [texto, orden],
  );
  // Al cambiar búsqueda u orden se vuelve al primer lote.
  const [clave, setClave] = useState('');
  const nueva = `${texto}|${orden?.columna}|${orden?.direccion}`;
  if (clave !== nueva) {
    setClave(nueva);
    setCursor(null);
    setAcumulado(loteDesde(coinciden, null, 25));
  }
  const siguiente = cursor ?? acumulado.siguiente;
  const cargar = (c: string) => {
    const lote = loteDesde(coinciden, c, 25);
    setCursor(null);
    setAcumulado({ items: [...acumulado.items, ...lote.items], siguiente: lote.siguiente });
  };

  return (
    <>
      <BarraDeBusqueda valor={busqueda} onCambio={setBusqueda} etiqueta="Buscar en la lista de ejemplo" placeholder="Buscar por código o cliente…" />
      <p className="text-sm text-texto-suave" role="status">
        {seleccion.size} seleccionadas{abierta ? ` · última abierta: ${abierta}` : ''}
      </p>
      <Lista
        etiqueta="Documentos de ejemplo"
        columnas={COLUMNAS}
        filas={acumulado.items}
        clave={(f) => f.id}
        orden={orden}
        onOrden={setOrden}
        seleccion={seleccion}
        onSeleccion={setSeleccion}
        onAbrir={(f) => setAbierta(f.codigo)}
        vacio={<p className="p-6 text-center text-texto-suave">Ninguna fila coincide con la búsqueda.</p>}
      />
      <CargarMas cursor={siguiente} onCargar={cargar} resumen={`Mostrando ${acumulado.items.length} de ${coinciden.length}`} />
    </>
  );
}

function FichaDeEjemplo() {
  const { estado, enviar } = useFicha();
  const [nombre, setNombre] = useState('Imprenta Andina');
  const [borrador, setBorrador] = useState(nombre);
  return (
    <Ficha
      estado={estado}
      onEditar={() => {
        setBorrador(nombre);
        enviar('editar');
      }}
      onGuardar={() => {
        enviar('guardar');
        setTimeout(() => {
          setNombre(borrador);
          enviar('guardado');
          notificar('Ficha de ejemplo guardada', 'exito');
        }, 800);
      }}
      onDescartar={() => enviar('descartar')}
      secciones={[
        {
          id: 'general',
          titulo: 'Datos generales',
          lectura: (
            <dl className="grid gap-1 sm:grid-cols-[10rem_1fr]">
              <dt className="text-texto-suave">Cliente</dt>
              <dd>{nombre}</dd>
              <dt className="text-texto-suave">Condición</dt>
              <dd>Crédito a 30 días</dd>
            </dl>
          ),
          edicion: (
            <Campo
              etiqueta="Cliente"
              value={borrador}
              error={borrador.trim() ? undefined : 'Escribe el nombre del cliente.'}
              onChange={(e) => {
                setBorrador(e.target.value);
                enviar('cambio');
              }}
            />
          ),
        },
      ]}
    />
  );
}

function PestanasDeEjemplo() {
  const [activa, setActiva] = useState('resumen');
  return (
    <Pestanas
      etiqueta="Secciones de ejemplo"
      activa={activa}
      onCambio={setActiva}
      pestanas={[
        { id: 'resumen', etiqueta: 'Resumen', contenido: <p>Contenido de la pestaña Resumen.</p> },
        { id: 'lineas', etiqueta: 'Líneas', contenido: <p>Contenido de la pestaña Líneas.</p> },
        { id: 'cerrada', etiqueta: 'Cerrada', deshabilitada: true, contenido: null },
        { id: 'historial', etiqueta: 'Historial', contenido: <p>Contenido de la pestaña Historial.</p> },
      ]}
    />
  );
}

/** Piezas de datos de la fase 6a-2, con datos marcados «Ejemplo». Las revisa una persona a 390 y 1280 px. */
export function KitDatos() {
  const [paso, setPaso] = useState(1);
  return (
    <div className="flex flex-col gap-10">
      <h2 className="font-titulo text-3xl font-semibold">Kit de datos</h2>
      <Seccion titulo="EncabezadoDePagina y MenuDeAcciones">
        <EncabezadoDePagina
          titulo="Pedidos"
          migas={[{ texto: 'Inicio', a: '/' }, { texto: 'Ventas', a: '/kit' }, { texto: 'Pedidos' }]}
          accionPrincipal={<Boton variante="primario" icono="mas">Nuevo pedido</Boton>}
          accionesSecundarias={
            <MenuDeAcciones
              etiqueta="Más acciones"
              acciones={[
                { etiqueta: 'Exportar', onSeleccionar: () => notificar('Exportar (ejemplo)', 'info') },
                { etiqueta: 'Duplicar', onSeleccionar: () => notificar('Duplicar (ejemplo)', 'info') },
                { etiqueta: 'No disponible', onSeleccionar: () => {}, deshabilitada: true },
                { etiqueta: 'Archivar', onSeleccionar: () => notificar('Archivar (ejemplo)', 'aviso'), peligro: true },
              ]}
            />
          }
        />
      </Seccion>
      <Seccion titulo="BarraDeEstado">
        <BarraDeEstado pasos={['Borrador', 'Confirmado', 'Entregado']} actual={paso} />
        <div className="flex gap-2">
          <Boton disabled={paso === 0} onClick={() => setPaso(paso - 1)}>Paso anterior</Boton>
          <Boton disabled={paso === 2} onClick={() => setPaso(paso + 1)}>Paso siguiente</Boton>
        </div>
      </Seccion>
      <Seccion titulo="Lista, BarraDeBusqueda y CargarMas (200 filas)">
        <ListaDeEjemplo />
      </Seccion>
      <Seccion titulo="Lista sin filas">
        <Lista etiqueta="Vacía" columnas={COLUMNAS} filas={[]} clave={(f) => f.id} />
      </Seccion>
      <Seccion titulo="Ficha (lectura y edición)">
        <FichaDeEjemplo />
      </Seccion>
      <Seccion titulo="Pestanas">
        <PestanasDeEjemplo />
      </Seccion>
    </div>
  );
}
