import { mostrarDecimal } from '../logica-taller.ts';
import { fijarTrabajo } from './api-cuadro.ts';
import { CampoAlSalir } from './campo-al-salir.tsx';
import { cambioDeTrabajo, type CampoDeTrabajo } from './logica-cuadro-filas.ts';
import { Seccion } from './seccion.tsx';
import type { ContextoDelCuadro } from './use-cuadro.ts';

/** Datos del trabajo: producto, cantidad, pieza, tintas y caras. Cada campo se guarda al salir de él. */
export function PanelTrabajo({ id, vista, aplicar, editable }: ContextoDelCuadro) {
  const t = vista.trabajo;
  const campo = (c: CampoDeTrabajo, etiqueta: string, valor: string, extra: { decimal?: boolean; maxLength?: number; ayuda?: string } = {}) => (
    <CampoAlSalir
      etiqueta={etiqueta}
      valor={valor}
      deshabilitado={!editable}
      {...extra}
      alConfirmar={async (texto) => {
        const cambio = cambioDeTrabajo(vista, id, c, texto);
        if (cambio === null) return null;
        if ('error' in cambio) return cambio.error;
        return (await aplicar(fijarTrabajo(cambio.args))) ? null : 'No se guardó.';
      }}
    />
  );
  return (
    <Seccion titulo="Datos del trabajo">
      {campo('producto', 'Producto', t.producto, { maxLength: 120 })}
      {campo('descripcion', 'Descripción', t.descripcion ?? '', { maxLength: 600 })}
      {campo('cantidad', 'Cantidad', mostrarDecimal(t.cantidad), { decimal: true, ayuda: 'La cantidad a cotizar (100, 1.000 o 5.000 marcan la columna base).' })}
      <div className="grid grid-cols-2 gap-3">
        {campo('anchoCm', 'Ancho de la pieza (cm)', t.pieza ? mostrarDecimal(t.pieza.anchoCm) : '', { decimal: true })}
        {campo('altoCm', 'Alto de la pieza (cm)', t.pieza ? mostrarDecimal(t.pieza.altoCm) : '', { decimal: true })}
        {campo('tintas', 'Tintas', String(t.tintas), { decimal: true })}
        {campo('caras', 'Caras', String(t.caras), { decimal: true })}
      </div>
      {t.cliente ? <p className="text-sm text-texto-suave">Cliente: {t.cliente}</p> : null}
    </Seccion>
  );
}
