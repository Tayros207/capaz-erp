import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, conEmpresaDePruebas, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import type { DatabaseService } from '../../infra/database/database.service.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import type { CatalogoDeModulos } from '../modulos/catalogo.js';
import { listarSucursales } from './repositories/sucursales.repository.js';

// `EmpresasService.asegurar` deja la sucursal principal (fase 7, paso 3). Sin módulos por defecto: solo se prueba la sucursal.

let pool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
let servicio: () => EmpresasService;

beforeAll(() => {
  pool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(pool);
  const db = { conEmpresa } as unknown as DatabaseService;
  const catalogo = { porDefecto: () => [] } as unknown as CatalogoDeModulos;
  servicio = () => new EmpresasService(db, catalogo);
});
afterAll(() => pool.end());

describe('EmpresasService.asegurar', () => {
  it('una empresa nueva queda con su sucursal principal, también si se repite o si la llama otra instancia', async () => {
    const E = empresaDePrueba();
    await servicio().asegurar(E, 'u1');
    await servicio().asegurar(E, 'u1');
    const lista = await conEmpresa({ empresaId: E, usuarioId: 'u1' }, (tx) => listarSucursales(tx, { empresaId: E, usuarioId: 'u1' }));
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ codigo: 'PRI', nombre: 'Principal', esPrincipal: true });
  });

  it('dos llamadas simultáneas no duplican ni fallan', async () => {
    const E = empresaDePrueba();
    await Promise.all([servicio().asegurar(E, 'u1'), servicio().asegurar(E, 'u1')]);
    const lista = await conEmpresa({ empresaId: E, usuarioId: 'u1' }, (tx) => listarSucursales(tx, { empresaId: E, usuarioId: 'u1' }));
    expect(lista).toHaveLength(1);
  });
});
