import type { AjusteDeClienteDto, ConfiguracionDeCotizadorDto, ListaDePrecioDto } from '@capaz/shared';
import { CONDICIONES_VACIAS } from '@capaz/shared';
import { hoyEnZona, type HoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { estaPorRevisar } from '../domain/lista.js';
import type { AjusteDeCliente } from '../repositories/ajustes.repository.js';
import type { Configuracion } from '../repositories/configuracion.repository.js';
import type { ListaDePrecio } from '../repositories/listas.repository.js';

// Fila → DTO. `porRevisar` se calcula con el día de la empresa (`hoyDeLaEmpresa`).

const iso = (f: Date | null): string | null => (f ? f.toISOString() : null);

export const aListaDto = (f: ListaDePrecio, hoy: HoyDeLaEmpresa): ListaDePrecioDto => ({
  id: f.id,
  productoId: f.productoId,
  nombre: f.nombre,
  unidad: f.unidad,
  p100Centimos: f.p100Centimos,
  p1000Centimos: f.p1000Centimos,
  p5000Centimos: f.p5000Centimos,
  modoIntermedio: f.modoIntermedio as ListaDePrecioDto['modoIntermedio'],
  precioMinimoCentimos: f.precioMinimoCentimos,
  aConfirmado: f.aConfirmado,
  preciosFijadosEn: f.preciosFijadosEn.toISOString(),
  porRevisar: estaPorRevisar(hoyEnZona(hoy.zona, f.preciosFijadosEn).dia, hoy.dia),
  archivadoEn: iso(f.archivadoEn),
  creadoEn: f.creadoEn.toISOString(),
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const aConfiguracionDto = (f: Configuracion): ConfiguracionDeCotizadorDto => ({
  utilidadPct: f.utilidadPct,
  utilidadBase: f.utilidadBase as ConfiguracionDeCotizadorDto['utilidadBase'],
  umbralVerdePct: f.umbralVerdePct,
  umbralMinimoPct: f.umbralMinimoPct,
  redondeoComercial: f.redondeoComercial as ConfiguracionDeCotizadorDto['redondeoComercial'],
  igvPorcentaje: f.igvPorcentaje,
  condiciones: { ...CONDICIONES_VACIAS, ...(f.condiciones as Partial<ConfiguracionDeCotizadorDto['condiciones']>) },
  mensajeWhatsapp: f.mensajeWhatsapp,
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const aAjusteDto = (f: AjusteDeCliente, clienteNombre: string): AjusteDeClienteDto => ({
  clienteId: f.clienteId,
  clienteNombre,
  porcentaje: f.porcentaje,
  nota: f.nota,
  actualizadoEn: f.actualizadoEn.toISOString(),
});
