import type { CategoriaDto, CuentaDto } from '@capaz/shared';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { Icono } from '../../shared/ui/icono.tsx';
import { ETIQUETA_DE_CUENTA, ETIQUETA_DE_MEDIO, type MedioDePago } from './logica.ts';

export type DatosDeMas = { fecha: string; cuentaId: string; medioDePago: MedioDePago; categoriaId: string; descripcion: string };
type Errores = Partial<Record<'fecha' | 'cuentaId' | 'descripcion', string>>;

type Props = {
  abierto: boolean;
  alAlternar: (abierto: boolean) => void;
  /** «Hoy · Caja · Efectivo»: lo que quedó por defecto, visible sin abrir. */
  resumen: string;
  valores: DatosDeMas;
  alCambiar: (c: Partial<DatosDeMas>) => void;
  cuentas: readonly CuentaDto[];
  categorias: readonly CategoriaDto[];
  pregunta: string;
  hoy: string;
  errores: Errores;
};

/** «Más datos»: lo que casi nunca se toca (fecha, cuenta, medio, categoría, nota, plazo), plegado y con su resumen en una línea. */
export function MasDatos({ abierto, alAlternar, resumen, valores, alCambiar, cuentas, categorias, pregunta, hoy, errores }: Props) {
  return (
    <details data-campo="mas-datos" open={abierto} onToggle={(e) => alAlternar(e.currentTarget.open)} className="group rounded-control border border-borde">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-texto">Más datos</span>
          <span className="truncate text-sm text-texto-suave">{resumen}</span>
        </span>
        <Icono nombre="flecha-abajo" className="shrink-0 text-texto-suave transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-borde p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div data-campo="fecha"><Campo etiqueta="Fecha" type="date" max={hoy} value={valores.fecha} onChange={(e) => alCambiar({ fecha: e.target.value })} error={errores.fecha} /></div>
          <div data-campo="cuentaId">
              <CampoSelect etiqueta="Cuenta" value={valores.cuentaId} onChange={(e) => alCambiar({ cuentaId: e.target.value })} error={errores.cuentaId}>
                {cuentas.filter((c) => c.archivadoEn === null || c.id === valores.cuentaId).map((c) => <option key={c.id} value={c.id}>{c.nombre} · {ETIQUETA_DE_CUENTA[c.tipo]}</option>)}
              </CampoSelect>
          </div>
          <CampoSelect etiqueta="Medio de pago" value={valores.medioDePago} onChange={(e) => alCambiar({ medioDePago: e.target.value as MedioDePago })}>
              {Object.entries(ETIQUETA_DE_MEDIO).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
          </CampoSelect>
          <CampoSelect etiqueta={pregunta} value={valores.categoriaId} onChange={(e) => alCambiar({ categoriaId: e.target.value })}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </CampoSelect>
        </div>
        <div data-campo="descripcion"><CampoTextarea etiqueta="Nota (opcional)" placeholder="Ej: pedido de noviembre, entrega el viernes" filas={2} maxLength={500} value={valores.descripcion} onChange={(e) => alCambiar({ descripcion: e.target.value })} error={errores.descripcion} /></div>
      </div>
    </details>
  );
}
