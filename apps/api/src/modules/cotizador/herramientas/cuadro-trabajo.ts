import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { aplicarImposicion, aplicarTrabajo, type DatosDeImposicion } from '../domain/cuadro-comandos-trabajo.js';
import { rechazarCuadro, type RechazoDeCuadro } from '../domain/cuadro-tipos.js';
import { verFormato, verMaquina, type EtapaGuardada, type FormatoDePliego, type Maquina } from '../repositories/taller.repository.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { MODULO } from './comun.js';
import { auditarCuadro, editarCuadro, ID_DE_COTIZACION } from './cuadro-comun.js';

// El trabajo (qué se imprime) y la imposición (cómo se corta y se imprime el papel). El motor recalcula el papel y las planchas.

export const cuadroFijarTrabajo = definirHerramienta('cuadro_fijar_trabajo', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Datos del trabajo',
    paraQueSirve: 'Anota el producto, su descripción, la cantidad, las medidas de la pieza, las tintas y las caras. Con las tintas y las caras se ponen las planchas; con la cantidad y las medidas se calcula el papel.',
    cuandoUsarla: 'Al empezar y cada vez que cambie algo del trabajo. Se puede anotar un dato a la vez.',
    campos: [
      ID_DE_COTIZACION,
      { nombre: 'producto', queSeAnota: 'Qué se imprime.', ejemplo: 'Volantes A5' },
      { nombre: 'descripcion', queSeAnota: 'Detalle que verá el cliente: papel, acabados, tamaño.', ejemplo: 'Couché 150 g, 4/4 tintas' },
      { nombre: 'cantidad', queSeAnota: 'Cuántas piezas, como texto con punto decimal. Con 100, 1000 o 5000 es la columna base del cuadro.', ejemplo: '2500' },
      { nombre: 'pieza', queSeAnota: 'Ancho y alto de la pieza terminada en cm: anchoCm y altoCm.', ejemplo: '{ "anchoCm": "14.8", "altoCm": "21" }' },
      { nombre: 'tintas', queSeAnota: 'Tintas por cara (4 es full color).', ejemplo: '4' },
      { nombre: 'caras', queSeAnota: 'Caras impresas: 1 o 2.', ejemplo: '2' },
    ],
    ejemploTecleado: 'volantes A5, 2500, 4 tintas por 2 caras',
    ejemploHablado: 'volantes A5, dos mil quinientos, cuatro por cuatro',
    erroresComunes: ['Escribir la cantidad con coma o con separador de miles: va con punto, sin separadores.', 'Confundir tintas con planchas: las planchas son tintas por caras.', 'Cambiar la cantidad y olvidar revisar las filas que dependen de ella; el sistema avisa cuáles.'],
    relacionadas: ['cuadro_fijar_imposicion', 'cuadro_linea_agregar', 'cuadro_calcular'],
  },
  auditar: auditarCuadro,
  ejecutar: (args, ctx, tx) => editarCuadro(tx, ctx, args.id, (cuadro) => aplicarTrabajo(cuadro, args)),
});

const dimensiones = (ancho: string, alto: string) => ({ anchoCm: ancho, altoCm: alto });

/** Una máquina del taller activa, o el rechazo que explica por qué no sirve. */
async function maquinaActiva(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<Maquina | RechazoDeCuadro> {
  const m = await verMaquina(tx, ctx, id);
  if (!m) return rechazarCuadro('no_encontrado', 'No existe esa máquina.');
  return m.archivadoEn ? rechazarCuadro('conflicto', `La máquina «${m.nombre}» está archivada.`) : m;
}

async function pliegoActivo(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, tipo: 'madre' | 'maquina'): Promise<FormatoDePliego | RechazoDeCuadro> {
  const f = await verFormato(tx, ctx, id);
  if (!f) return rechazarCuadro('no_encontrado', 'No existe ese formato de pliego.');
  if (f.archivadoEn) return rechazarCuadro('conflicto', `El formato «${f.nombre}» está archivado.`);
  if (f.tipo !== tipo) return rechazarCuadro('argumentos_invalidos', `El formato «${f.nombre}» es de tipo ${f.tipo}: aquí va un pliego ${tipo === 'madre' ? 'madre (el que se compra)' : 'de máquina (al que se corta)'}.`);
  return f;
}

const esRechazo = (x: unknown): x is RechazoDeCuadro => typeof x === 'object' && x !== null && 'ok' in x && (x as { ok: unknown }).ok === false;

export const cuadroFijarImposicion = definirHerramienta('cuadro_fijar_imposicion', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Papel e imposición',
    paraQueSirve: 'Anota cómo se corta y se imprime el papel. Elegir una máquina del taller copia su pinza, sangrado, calle, formato máximo y mermas; el pliego madre (el que se compra) y el de máquina (al que se corta) se eligen del taller o se escriben. El sistema calcula cuántas piezas caben, cuántos pliegos hacen falta y llena la cantidad de la fila de papel y la de planchas.',
    cuandoUsarla: 'Después de fijar el trabajo. Se puede anotar un dato a la vez; el papel se calcula cuando ya están todos.',
    campos: [
      ID_DE_COTIZACION,
      { nombre: 'maquinaId', queSeAnota: 'Una máquina del taller (copia sus valores).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000031' },
      { nombre: 'pliegoMadreId', queSeAnota: 'Un formato madre del taller.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000032' },
      { nombre: 'pliegoMaquinaId', queSeAnota: 'Un formato de máquina del taller.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000033' },
      { nombre: 'pliegoMadre', queSeAnota: 'Medidas del pliego madre a mano, en cm.', ejemplo: '{ "anchoCm": "70", "altoCm": "100" }' },
      { nombre: 'pliegoMaquina', queSeAnota: 'Medidas del pliego de máquina a mano, en cm.', ejemplo: '{ "anchoCm": "35", "altoCm": "50" }' },
      { nombre: 'sangradoCm / calleCm / pinzaCm', queSeAnota: 'Sangrado, calle y pinza en cm, como texto.', ejemplo: '"0.3", "0.3", "2"' },
      { nombre: 'formatoMaximo', queSeAnota: 'Tamaño máximo de pliego de la máquina; null lo quita.', ejemplo: '{ "anchoCm": "36", "altoCm": "52" }' },
      { nombre: 'etapas', queSeAnota: 'Mermas por etapa en orden de proceso: nombre, mermaPct y arranque (hojas fijas).', ejemplo: '[{ "nombre": "Tiraje", "mermaPct": "3", "arranque": "40" }]' },
      { nombre: 'filaDePapel', queSeAnota: 'Qué fila es el papel para que el motor la llene con los pliegos madre; null la deja manual.', ejemplo: '{ "texto": "papel" }' },
    ],
    ejemploTecleado: 'máquina Offset 36 × 52, pliego madre 70 × 100, pliego de máquina 35 × 50',
    ejemploHablado: 'usa la offset de treinta y seis por cincuenta y dos, madre setenta por cien',
    erroresComunes: ['Confundir el pliego madre (se compra, el papel se cobra por él) con el de máquina (al que se corta).', 'Un pliego de máquina más grande que el formato máximo de la máquina.', 'Indicar el pliego por id y por medidas a la vez.'],
    relacionadas: ['cuadro_fijar_trabajo', 'cuadro_linea_agregar', 'maquinas_listar', 'formatos_pliego_listar'],
  },
  auditar: auditarCuadro,
  ejecutar: (args, ctx, tx) =>
    editarCuadro(tx, ctx, args.id, async (cuadro) => {
      const datos: DatosDeImposicion = { ...args };
      if (args.maquinaId) {
        const m = await maquinaActiva(tx, ctx, args.maquinaId);
        if (esRechazo(m)) return m;
        datos.maquina = {
          formatoMaximo: dimensiones(m.formatoMaxAnchoCm, m.formatoMaxAltoCm),
          pinzaCm: m.pinzaCm, sangradoCm: m.sangradoCm, calleCm: m.calleCm,
          etapas: (m.etapas as EtapaGuardada[]).map((e) => ({ nombre: e.nombre, mermaPct: e.mermaPct, arranque: e.arranque })),
        };
      }
      for (const [idDe, tipo, llave] of [['pliegoMadreId', 'madre', 'pliegoMadre'], ['pliegoMaquinaId', 'maquina', 'pliegoMaquina']] as const) {
        const id = args[idDe];
        if (!id) continue;
        const f = await pliegoActivo(tx, ctx, id, tipo);
        if (esRechazo(f)) return f;
        datos[llave] = dimensiones(f.anchoCm, f.altoCm);
      }
      return aplicarImposicion(cuadro, datos);
    }),
});
