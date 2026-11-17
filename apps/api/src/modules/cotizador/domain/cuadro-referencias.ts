// Los tres precios de referencia (100 / 1.000 / 5.000) que salen de un cuadro: salen del mismo motor que pinta las columnas, así
// que incluyen lo escrito a mano y los ítems. Dinero en céntimos fuera del motor.
import { importeACentimos } from './adaptador-de-dinero.js';
import { correcto, fallo, type Resultado } from './motor/base/resultado.js';
import { sincronizarFilas } from './motor/costeo/cuadro.js';
import { referenciasDelCuadro } from './motor/costeo/cuadro-directo.js';
import { validarReferencias } from './motor/escala/validar-referencias.js';
import type { ConfiguracionEmpresa, Cuadro } from './cuadro-tipos.js';

export type ReferenciasDeCuadro = {
  p100Centimos: number;
  p1000Centimos: number;
  p5000Centimos: number;
  /** B bloquea (el total debe crecer); A avisa (el unitario debería bajar). */
  validacion: { bloqueos: string[]; avisos: string[] };
  margenes: { cantidad: string; margenPct: string | null; semaforo: 'verde' | 'ambar' | 'rojo' | null }[];
};

function mensajeDeGeneracion(codigo: string, mensaje: string, faltantes: string[]): string {
  if (codigo === 'cantidad_invalida') return 'Fija la cantidad del trabajo antes de generar las referencias.';
  if (codigo === 'imposicion_requerida' || codigo === 'papel_pendiente') {
    const falta = faltantes.length > 0 ? ` (falta: ${faltantes.join(', ')})` : '';
    return `Hay filas que escalan por pliego: completa el papel y la imposición${falta}.`;
  }
  return mensaje;
}

export function generarReferenciasDeCuadro(cuadro: Cuadro, config: ConfiguracionEmpresa): Resultado<ReferenciasDeCuadro, 'conflicto'> {
  const g = referenciasDelCuadro(cuadro, config);
  if (!g.ok) return fallo('conflicto', mensajeDeGeneracion(g.error.codigo, g.error.mensaje, sincronizarFilas(cuadro).faltantes));
  const validacion = validarReferencias({ p100: g.valor.p100, p1000: g.valor.p1000, p5000: g.valor.p5000 });
  return correcto({
    p100Centimos: importeACentimos(g.valor.p100),
    p1000Centimos: importeACentimos(g.valor.p1000),
    p5000Centimos: importeACentimos(g.valor.p5000),
    validacion: { bloqueos: validacion.bloqueos.map((h) => h.mensaje), avisos: validacion.avisos.map((h) => h.mensaje) },
    margenes: g.valor.calculos.map((c) => ({ cantidad: c.cantidad, margenPct: c.calculo.margenPct, semaforo: c.calculo.semaforo })),
  });
}
