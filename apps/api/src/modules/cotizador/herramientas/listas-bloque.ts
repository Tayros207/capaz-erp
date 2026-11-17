import { exito } from '@capaz/shared';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion, ContextoDeEmpresa } from '../../../infra/database/con-empresa.js';
import { palabrasDeBusqueda, planearAjusteEnBloque, resumenDeBloque, type ListaParaAjustar, type PlanDeBloque } from '../domain/ajuste-en-bloque.js';
import { asegurarConfiguracion } from '../repositories/configuracion.repository.js';
import { guardarPreciosDeListas, listasActivasConPalabras } from '../repositories/listas.repository.js';
import { rechazoDe } from './comun.js';

// «Cambiar en bloque»: sube o baja un porcentaje los precios de varias listas a la vez. Todo o nada, en una transacción.

async function planear(tx: Transaccion, ctx: ContextoDeEmpresa, busqueda: string, porcentaje: string, confirmar: boolean, bloquear: boolean): Promise<PlanDeBloque> {
  const filas = await listasActivasConPalabras(tx, ctx, palabrasDeBusqueda(busqueda), bloquear);
  const listas: ListaParaAjustar[] = filas.map((f) => ({ id: f.id, nombre: f.nombre, p100Centimos: f.p100Centimos, p1000Centimos: f.p1000Centimos, p5000Centimos: f.p5000Centimos, precioMinimoCentimos: f.precioMinimoCentimos, aConfirmado: f.aConfirmado }));
  return planearAjusteEnBloque(listas, porcentaje.replace(/^\+/, ''), confirmar);
}

export const listasPrecioAjustarEnBloque = definirHerramienta('listas_precio_ajustar_en_bloque', {
  modulo: 'cotizador',
  permiso: 'cotizador:configurar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Subir o bajar precios en bloque',
    paraQueSirve: 'Sube o baja un porcentaje los precios (100, 1.000, 5.000 y el mínimo) de varias listas a la vez: todas las activas o solo las cuyo nombre contiene ciertas palabras. Antes de aplicar muestra cuántas cambian y ejemplos. Si alguna dejara de crecer el total con la cantidad, no se cambia nada.',
    cuandoUsarla: 'Cuando sube el papel o cualquier costo y hay que mover la lista completa, o una familia de productos, de una vez. Las cotizaciones ya emitidas no cambian.',
    campos: [
      { nombre: 'busqueda', queSeAnota: 'Palabras del nombre, sin importar tildes ni orden; vacío = todas las listas activas.', ejemplo: 'couché' },
      { nombre: 'porcentaje', queSeAnota: 'Cuánto sube (positivo) o baja (negativo), de -90 a 300, distinto de 0, hasta 2 decimales.', ejemplo: '8' },
      { nombre: 'confirmarUnitarioNoBaja', queSeAnota: 'true si aceptas que el unitario no baje al subir la cantidad en alguna lista.', ejemplo: 'false' },
    ],
    ejemploTecleado: 'subir 8 % las listas con couché',
    ejemploHablado: 'sube ocho por ciento los productos de couché',
    erroresComunes: ['Ninguna lista activa coincide con la búsqueda.', 'Con ese porcentaje una lista dejaría de crecer con la cantidad: no se cambia nada.', 'El unitario no baja en alguna lista: confirma para guardarlo igual.', 'El porcentaje va de -90 a 300 y no puede ser 0.'],
    relacionadas: ['listas_precio_listar', 'lista_precio_editar'],
  },
  auditar: (a, d) => ({ entidadTipo: 'lista_precio', resumen: { porcentaje: a.porcentaje, ...(d && { cambiadas: d.cambiadas }) } }),
  async resumir(args, ctx, tx) {
    const p = await planear(tx, ctx, args.busqueda, args.porcentaje, args.confirmarUnitarioNoBaja, false);
    if (!p.ok) return rechazoDe(p);
    const huella = hashCanonico({ porcentaje: args.porcentaje, cambios: p.cambios.map((c) => [c.id, c.despues]) });
    return { ok: true, resumen: { resumen: resumenDeBloque(p.cambios, args.busqueda, args.porcentaje), huella } };
  },
  async ejecutar(args, ctx, tx) {
    await asegurarConfiguracion(tx, ctx);
    const p = await planear(tx, ctx, args.busqueda, args.porcentaje, args.confirmarUnitarioNoBaja, true);
    if (!p.ok) return rechazoDe(p);
    await guardarPreciosDeListas(tx, ctx, p.cambios.map((c) => ({ id: c.id, ...c.despues, aConfirmado: c.aConfirmado })));
    return exito({ cambiadas: p.cambios.length, porcentaje: args.porcentaje });
  },
});
