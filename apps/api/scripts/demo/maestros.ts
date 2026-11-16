import { csvDeContactos, csvDeProductos, generarProductos } from './datos.ts';
import { seccion, contar, type Ctx } from './contexto.ts';

/** Sucursales, productos y clientes/proveedores (por el importador CSV oficial) y carga de listas. */
export async function sembrarMaestros(c: Ctx): Promise<void> {
  await seccion(c, 'sucursales', async () => {
    const existentes = await c.s.todos('sucursales_listar');
    for (const suc of c.sec.sucursales) {
      if (existentes.some((e: any) => e.codigo === suc.codigo)) continue;
      await c.s.herramienta('sucursal_crear', { codigo: suc.codigo, nombre: suc.nombre, direccion: suc.direccion });
    }
  });
  if ((await contar(c, 'core.productos')) < 5) {
    await seccion(c, 'productos', async () => {
      const lote = generarProductos(c.sec, c.az);
      await c.s.herramienta('importar_csv_aplicar', { entidad: 'productos', contenido: csvDeProductos(lote), separador: ';' });
    });
  }
  if ((await contar(c, 'core.clientes')) < 5) {
    await seccion(c, 'clientes y proveedores', async () => {
      const { csv } = csvDeContactos(c.sec, c.az);
      await c.s.herramienta('importar_csv_aplicar', { entidad: 'clientes', contenido: csv, separador: ';' });
    });
  }
  c.sucursales = await c.s.todos('sucursales_listar');
  c.productos = await c.s.todos('productos_listar');
  const contactos = await c.s.todos('clientes_listar');
  c.clientes = contactos.filter((x: any) => x.tipo !== 'proveedor');
  c.proveedores = contactos.filter((x: any) => x.tipo !== 'cliente');
}
