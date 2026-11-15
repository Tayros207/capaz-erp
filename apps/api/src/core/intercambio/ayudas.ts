import type { Ayuda } from '@capaz/shared';

const ERRORES_DE_ARCHIVO = 'El archivo debe tener una fila de encabezado con al menos la columna «nombre».';

export const AYUDAS: Record<'exportar' | 'previsualizar' | 'aplicar', Ayuda> = {
  exportar: {
    titulo: 'Exportar a CSV',
    paraQueSirve: 'Te entrega tus clientes o tus productos en un archivo CSV que abre cualquier hoja de cálculo (hasta 5 000 filas).',
    cuandoUsarla: 'Cuando quieres una copia, revisar datos en una hoja o llevarlos a otro sistema.',
    campos: [
      { nombre: 'entidad', queSeAnota: 'clientes o productos.', ejemplo: 'clientes' },
      { nombre: 'separador', queSeAnota: 'Coma o punto y coma (por defecto, coma).', ejemplo: ';' },
      { nombre: 'incluirArchivados', queSeAnota: 'Si quieres también los archivados (por defecto, no).', ejemplo: 'false' },
    ],
    ejemploTecleado: 'exportar mis clientes a CSV',
    ejemploHablado: 'descarga mis productos en un archivo',
    erroresComunes: ['Necesitas el permiso para exportar y el de ver esa lista.', 'Si tienes más de 5 000 filas, el archivo trae las primeras 5 000 y lo avisa.'],
    relacionadas: ['importar_csv_previsualizar'],
  },
  previsualizar: {
    titulo: 'Revisar un archivo CSV antes de importar',
    paraQueSirve: 'Lee tu archivo fila por fila y te dice cuántas filas se crearían, cuáles ya existen y cuáles tienen errores. No guarda nada.',
    cuandoUsarla: 'Antes de importar, para corregir el archivo sin riesgo.',
    campos: [
      { nombre: 'entidad', queSeAnota: 'clientes o productos.', ejemplo: 'clientes' },
      { nombre: 'contenido', queSeAnota: 'El texto del archivo CSV (hasta 1 000 filas).', ejemplo: 'nombre,telefono\nAna Ruiz,999111222' },
      { nombre: 'separador', queSeAnota: 'Coma o punto y coma; si no lo indicas se detecta.', ejemplo: ';' },
    ],
    ejemploTecleado: 'revisar este archivo de clientes antes de importarlo',
    ejemploHablado: 'revisa mi archivo de productos sin guardar nada',
    erroresComunes: [ERRORES_DE_ARCHIVO, 'Cada error indica su fila (la 1 es el encabezado) y el motivo.'],
    relacionadas: ['importar_csv_aplicar', 'exportar_csv'],
  },
  aplicar: {
    titulo: 'Importar un archivo CSV',
    paraQueSirve: 'Crea los clientes o productos válidos del archivo. Omite los que ya existen y deja un registro de lo importado.',
    cuandoUsarla: 'Cuando ya revisaste el archivo y quieres cargar los datos. Se confirma desde la pantalla.',
    campos: [
      { nombre: 'entidad', queSeAnota: 'clientes o productos.', ejemplo: 'productos' },
      { nombre: 'contenido', queSeAnota: 'El texto del archivo CSV (hasta 1 000 filas).', ejemplo: 'nombre,precio\nTarjetas x100,25' },
      { nombre: 'separador', queSeAnota: 'Coma o punto y coma; si no lo indicas se detecta.', ejemplo: ',' },
    ],
    ejemploTecleado: 'importar este archivo de clientes',
    ejemploHablado: 'carga el archivo de productos que revisamos',
    erroresComunes: [ERRORES_DE_ARCHIVO, 'Repetir el mismo archivo no duplica nada: lo que ya existe se omite.', 'Necesitas el permiso para importar y el de editar esa lista.'],
    relacionadas: ['importar_csv_previsualizar', 'exportar_csv'],
  },
};
