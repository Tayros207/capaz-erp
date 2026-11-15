import { MAX_FILAS_IMPORTAR, rechazo, type EntidadDeIntercambio, type FilaConMotivo } from '@capaz/shared';
import type { ContextoDeEmpresa, Transaccion } from '../../infra/database/con-empresa.js';
import { filaDeCliente, filaDeProducto, mapearColumnas, type ClaveDeFila } from './columnas.js';
import { leerCsv, type Separador } from './csv.js';
import { existentesDe } from './repositorio.js';

/** Lo que haría una importación: filas nuevas por crear, duplicadas por omitir y filas con error. Sin escribir nada. */
export type Plan = {
  entidad: EntidadDeIntercambio;
  separador: Separador;
  total: number;
  columnasIgnoradas: string[];
  errores: FilaConMotivo[];
  duplicadas: FilaConMotivo[];
  nuevas: { fila: number; args: Record<string, unknown> }[];
};

export type ResultadoDePlan = { ok: true; plan: Plan } | ReturnType<typeof rechazo>;

const motivoDeDuplicado = (entidad: EntidadDeIntercambio, razon: 'nombre' | 'documento' | 'codigo', enArchivo: boolean) => {
  const que = { nombre: 'el mismo nombre', documento: 'el mismo documento', codigo: 'el mismo código' }[razon];
  const dedonde = enArchivo ? 'otra fila anterior del archivo' : entidad === 'clientes' ? 'un cliente ya registrado' : 'un producto ya registrado';
  return `Tiene ${que} que ${dedonde}: se omite.`;
};

/** Lee el archivo, valida cada fila con el dominio de S3 y separa nuevas, duplicadas y erróneas. Solo lee la base. */
export async function planificar(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  entrada: { entidad: EntidadDeIntercambio; contenido: string; separador?: Separador },
): Promise<ResultadoDePlan> {
  const { entidad } = entrada;
  const lectura = leerCsv(entrada.contenido, { separador: entrada.separador ?? 'auto', maxFilas: MAX_FILAS_IMPORTAR });
  if (!lectura.ok) return rechazo('argumentos_invalidos', lectura.motivo);
  const [encabezado, ...datos] = lectura.filas;
  if (!encabezado) return rechazo('argumentos_invalidos', 'El archivo no tiene encabezado.');
  const columnas = mapearColumnas(entidad, encabezado.celdas);
  if ('error' in columnas) return rechazo('argumentos_invalidos', columnas.error);
  if (datos.length === 0) return rechazo('argumentos_invalidos', 'El archivo solo tiene el encabezado: no hay filas que importar.');

  const errores: FilaConMotivo[] = [];
  const validas: { fila: number; args: Record<string, unknown>; clave: ClaveDeFila }[] = [];
  for (const f of datos) {
    if (f.celdas.length > encabezado.celdas.length) {
      errores.push({ fila: f.numero, motivo: 'Tiene más columnas que el encabezado.' });
      continue;
    }
    const r = entidad === 'clientes' ? filaDeCliente(f.celdas, columnas.indices) : filaDeProducto(f.celdas, columnas.indices);
    if (r.ok) validas.push({ fila: f.numero, args: r.valor.args as Record<string, unknown>, clave: r.valor.clave });
    else errores.push({ fila: f.numero, motivo: r.motivo });
  }

  const existentes = await existentesDe(tx, ctx, entidad, validas.map((v) => v.clave));
  const vistos = { nombres: new Set<string>(), documentos: new Set<string>(), codigos: new Set<string>() };
  const duplicadas: FilaConMotivo[] = [];
  const nuevas: Plan['nuevas'] = [];
  for (const v of validas) {
    const { nombre, documento, codigo } = v.clave;
    const razon = (en: typeof vistos): 'nombre' | 'documento' | 'codigo' | null =>
      en.nombres.has(nombre) ? 'nombre' : documento && en.documentos.has(documento) ? 'documento' : codigo && en.codigos.has(codigo) ? 'codigo' : null;
    const previa = razon(existentes);
    const repetida = previa ? null : razon(vistos);
    if (previa || repetida) {
      duplicadas.push({ fila: v.fila, motivo: motivoDeDuplicado(entidad, (previa ?? repetida)!, repetida !== null) });
      continue;
    }
    vistos.nombres.add(nombre);
    if (documento) vistos.documentos.add(documento);
    if (codigo) vistos.codigos.add(codigo);
    nuevas.push({ fila: v.fila, args: v.args });
  }
  errores.sort((a, b) => a.fila - b.fila);
  return { ok: true, plan: { entidad, separador: lectura.separador, total: datos.length, columnasIgnoradas: columnas.ignoradas, errores, duplicadas, nuevas } };
}
