import { useState, type ReactNode } from 'react';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoPrecio } from '../../shared/ui/campo-precio.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { SelectorDeRegistro, type Opcion } from '../../shared/ui/selector-de-registro.tsx';
import { Tablero } from '../../shared/ui/tablero.tsx';
import { NavegacionDeSeccion } from '../../shared/ui/navegacion-de-seccion.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 border-b border-borde pb-1 font-titulo text-xl font-semibold">
        {titulo} <Insignia tono="info">Ola 2</Insignia>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Textareas() {
  const [texto, setTexto] = useState('');
  return (
    <>
      <CampoTextarea etiqueta="Notas" value={texto} onChange={(e) => setTexto(e.target.value)} ayuda="Visibles solo para tu equipo." />
      <CampoTextarea etiqueta="Notas con error" defaultValue="x" error="Escribe al menos 10 caracteres." filas={3} />
      <CampoTextarea etiqueta="Notas desactivadas" defaultValue="No editable" disabled filas={2} />
    </>
  );
}

function Cantidades() {
  const [cantidad, setCantidad] = useState<number | null>(12500);
  const [vacia, setVacia] = useState<number | null>(null);
  const [precio, setPrecio] = useState<number | null>(12505);
  const [precioVacio, setPrecioVacio] = useState<number | null>(null);
  return (
    <>
      <CampoCantidad etiqueta="Cantidad con unidad" valor={cantidad} alCambiar={setCantidad} unidad="m" ayuda={`Milésimas: ${cantidad ?? 'vacío'} · ${cantidad === null ? '' : formatearCantidad(cantidad, 'm')}`} />
      <CampoCantidad etiqueta="Cantidad vacía" valor={vacia} alCambiar={setVacia} placeholder="0" />
      <CampoCantidad etiqueta="Cantidad con error" valor={3000} alCambiar={() => undefined} error="No hay stock suficiente." unidad="un" />
      <CampoPrecio etiqueta="Precio unitario" valor={precio} alCambiar={setPrecio} ayuda={`Milésimas: ${precio ?? 'vacío'} · S/ ${precio === null ? '' : milesimasATexto(precio)}`} />
      <CampoPrecio etiqueta="Precio vacío" valor={precioVacio} alCambiar={setPrecioVacio} />
      <CampoPrecio etiqueta="Precio desactivado" valor={1500} alCambiar={() => undefined} disabled />
    </>
  );
}

function Navegacion() {
  // Usa el enrutador de la propia aplicación: un enrutador anidado rompe la página. Los enlaces son rutas reales.
  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-sm text-texto-suave">Ejemplo con rutas reales de la aplicación; a 390 px la fila se desplaza en horizontal.</p>
      <NavegacionDeSeccion
        etiqueta="Secciones de ejemplo"
        secciones={[
          { a: '/kit', texto: 'Esta página', fin: true },
          { a: '/inicio', texto: 'Inicio' },
          { a: '/clientes', texto: 'Clientes' },
          { a: '/productos', texto: 'Productos' },
          { a: '/bandeja', texto: 'Bandeja' },
          { a: '/ajustes/empresa', texto: 'Ajustes de la empresa' },
        ]}
      />
    </div>
  );
}

function Cifras() {
  return (
    <div className="flex flex-col gap-4 sm:col-span-2">
      <GrupoDeCifras etiqueta="Resumen del mes">
        <Cifra etiqueta="Ingresos" valor="S/ 12,450.00" tono="exito" ayuda="Frente al mes anterior" />
        <Cifra etiqueta="Deudas vencidas" valor="S/ 3,200.50" tono="peligro" />
        <Cifra etiqueta="Por vencer" valor="5" tono="aviso" ayuda="En los próximos 7 días" />
        <Cifra etiqueta="Clientes activos" valor="38" />
      </GrupoDeCifras>
      <GrupoDeCifras etiqueta="Valor largo">
        <Cifra etiqueta="Total acumulado del ejercicio" valor="S/ 1,234,567.89" />
        <Cifra etiqueta="Sin valor" valor="—" />
      </GrupoDeCifras>
    </div>
  );
}

function Retardo() {
  const [texto, setTexto] = useState('');
  const retrasado = useRetardo(texto, 300);
  return <Campo etiqueta="Escribe para probar useRetardo (300 ms)" value={texto} onChange={(e) => setTexto(e.target.value)} ayuda={`Valor retrasado: «${retrasado}»`} />;
}

const PERSONAS: Opcion[] = [
  { id: '1', nombre: 'Ana Quispe', detalle: 'RUC 10456789012' },
  { id: '2', nombre: 'Imprenta Andina', detalle: 'Lima' },
  { id: '3', nombre: 'Bruno Salas' },
  { id: '4', nombre: 'Carla Rojas', detalle: 'Cusco' },
];
const buscarEn = (lista: Opcion[], ms = 200) => (t: string) =>
  new Promise<Opcion[]>((ok) => setTimeout(() => ok(lista.filter((o) => o.nombre.toLowerCase().includes(t.toLowerCase()))), ms));
const buscarFalla = () => new Promise<Opcion[]>((_, no) => setTimeout(() => no(new Error('x')), 200));

function Selectores() {
  const [a, setA] = useState<Opcion | null>(null);
  const [b, setB] = useState<Opcion | null>(PERSONAS[0]!);
  const [c, setC] = useState<Opcion | null>(null);
  const [creado, setCreado] = useState('');
  return (
    <>
      <SelectorDeRegistro etiqueta="Cliente" valor={a} alCambiar={setA} buscar={buscarEn(PERSONAS)} ayuda="Escribe parte del nombre; usa flechas y Enter." />
      <SelectorDeRegistro etiqueta="Cliente con valor" valor={b} alCambiar={setB} buscar={buscarEn(PERSONAS)} />
      <SelectorDeRegistro etiqueta="Cliente con error" valor={null} alCambiar={() => undefined} buscar={buscarEn(PERSONAS)} error="Elige un cliente." />
      <SelectorDeRegistro etiqueta="Búsqueda que falla" valor={null} alCambiar={() => undefined} buscar={buscarFalla} />
      <SelectorDeRegistro etiqueta="Con creación" valor={c} alCambiar={setC} buscar={buscarEn(PERSONAS)} alCrear={setCreado} textoCrear="Crear cliente" textoSinResultados="Nadie con ese nombre" ayuda={creado ? `Se pidió crear «${creado}»` : undefined} />
    </>
  );
}

type Tarea = { id: string; texto: string };
const COLUMNAS = [
  { id: 'nuevo', titulo: 'Nuevo', resumen: 'S/ 1,200.00', filas: [{ id: 't1', texto: 'Cotizar banner' }, { id: 't2', texto: 'Llamar a Ana Quispe' }] },
  { id: 'proceso', titulo: 'En proceso', resumen: 'S/ 800.00', filas: [{ id: 't3', texto: 'Impresión de tarjetas' }] },
  { id: 'listo', titulo: 'Listo', filas: [] as Tarea[] },
];

function Tableros() {
  return (
    <div className="flex flex-col gap-6 sm:col-span-2">
      <Tablero etiqueta="Tablero de ejemplo" columnas={COLUMNAS} clave={(f: Tarea) => f.id} tarjeta={(f) => <p className="text-texto">{f.texto}</p>} vacio="Nada por aquí todavía" />
      <Tablero etiqueta="Tablero vacío" columnas={[{ id: 'a', titulo: 'Sin datos', filas: [] as Tarea[] }]} clave={(f: Tarea) => f.id} tarjeta={(f) => f.texto} />
    </div>
  );
}

/** Piezas nuevas de la ola 2 (K1a y K1b) en todos sus estados. */
export function KitOla2() {
  return (
    <div className="flex flex-col gap-10">
      <Seccion titulo="Campo de texto largo">
        <Textareas />
      </Seccion>
      <Seccion titulo="Cantidad y precio en milésimas">
        <Cantidades />
      </Seccion>
      <Seccion titulo="Navegación de sección">
        <Navegacion />
      </Seccion>
      <Seccion titulo="Cifras">
        <Cifras />
      </Seccion>
      <Seccion titulo="Selector de registro">
        <Selectores />
      </Seccion>
      <Seccion titulo="Tablero">
        <Tableros />
      </Seccion>
      <Seccion titulo="Retardo de búsqueda">
        <Retardo />
      </Seccion>
    </div>
  );
}
