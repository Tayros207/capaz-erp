import { useMemo, useState, type ReactNode } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoPrecio } from '../../shared/ui/campo-precio.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
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
  const enrutador = useMemo(
    () =>
      createMemoryRouter(
        [{ path: '*', element: <NavegacionDeSeccion etiqueta="Secciones de ejemplo" secciones={[
          { a: '/', texto: 'Resumen', fin: true },
          { a: '/caja', texto: 'Caja del día' },
          { a: '/deudas', texto: 'Cuentas por cobrar' },
          { a: '/gastos', texto: 'Gastos' },
          { a: '/reportes', texto: 'Reportes' },
          { a: '/ajustes', texto: 'Ajustes del módulo' },
        ]} /> }],
        { initialEntries: ['/caja'] },
      ),
    [],
  );
  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-sm text-texto-suave">Enrutador propio del ejemplo; a 390 px la fila se desplaza en horizontal.</p>
      <RouterProvider router={enrutador} />
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

/** Piezas nuevas de la ola 2 (K1a) en todos sus estados. K1b agrega el selector de registro y el tablero. */
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
      <Seccion titulo="Retardo de búsqueda">
        <Retardo />
      </Seccion>
    </div>
  );
}
