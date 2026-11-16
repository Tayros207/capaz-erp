import { Insignia } from '../../shared/ui/insignia.tsx';
import {
  BarraDeImpresion,
  BloqueDeDatos,
  HojaImprimible,
  LineaDeFirma,
  TablaImprimible,
  VistaPreviaDeHoja,
} from '../../shared/impresion/hoja-imprimible.tsx';
import { filasDeTotales, totalesConIgv } from '../../shared/impresion/logica-impresion.ts';

const EMPRESA = {
  razonSocial: 'Gráfica Andina de Ejemplo S.A.C.',
  ruc: '20000000001',
  direccionFiscal: 'Jr. Ficticio 123, Lima',
  telefono: '999 000 111',
  correo: 'ventas@ejemplo.pe',
  pieDeDocumento: 'Precios válidos por 7 días. Gracias por su preferencia.',
  logoDataUrl: null,
};

const FILAS = [
  { descripcion: 'Polo estampado, talla M', cantidad: 50, precio: 1500, importe: 75000 },
  { descripcion: 'Banner 2 x 1 m con ojales', cantidad: 2, precio: 4500, importe: 9000 },
  { descripcion: 'Tarjetas de presentación (millar)', cantidad: 1, precio: 6000, importe: 6000 },
];

const COLUMNAS = [
  { clave: 'descripcion', titulo: 'Descripción' },
  { clave: 'cantidad', titulo: 'Cant.', formato: 'numero' },
  { clave: 'precio', titulo: 'P. unitario', formato: 'soles' },
  { clave: 'importe', titulo: 'Importe', formato: 'soles' },
] as const;

/** Base de impresión (T1): hoja A4, tabla, bloques de datos y firma. Probar con Imprimir / Guardar como PDF. */
export function KitImpresion() {
  const subtotal = FILAS.reduce((s, f) => s + f.importe, 0);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 border-b border-borde pb-1 font-titulo text-xl font-semibold">
        Base de impresión <Insignia tono="info">T1</Insignia>
      </h2>
      <BarraDeImpresion onVolver={() => window.scrollTo({ top: 0, behavior: 'smooth' })} etiquetaVolver="Volver arriba" />
      <VistaPreviaDeHoja>
        <HojaImprimible titulo="Proforma N.º P-0001" empresa={EMPRESA}>
          <BloqueDeDatos
            titulo="Datos del cliente"
            pares={[
              { etiqueta: 'Cliente', valor: 'Cliente de Ejemplo E.I.R.L.' },
              { etiqueta: 'RUC', valor: '20000000002' },
              { etiqueta: 'Fecha', valor: '16/11/2026' },
              { etiqueta: 'Válida hasta', valor: '23/11/2026' },
            ]}
          />
          <TablaImprimible
            etiqueta="Detalle de la proforma"
            columnas={[...COLUMNAS]}
            filas={FILAS}
            totales={filasDeTotales(totalesConIgv(subtotal))}
          />
          <LineaDeFirma etiqueta="Recibí conforme" detalle="Nombre y DNI" />
        </HojaImprimible>
      </VistaPreviaDeHoja>
    </section>
  );
}
