import { createServer } from 'node:net';
import { Module, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../app.module.js';
import { configurarApp } from '../configurar-app.js';
import { crearLogger } from '../infra/logger/logger.js';
import { esLocal } from './base-de-pruebas.js';

// Servidor real (Nest + Express + Better Auth) en un puerto libre y contra la base LOCAL
// `capaz_test`, para pruebas de integración por HTTP real con cookies (no son e2e de navegador).

async function puertoLibre(): Promise<number> {
  return new Promise((resolver, rechazar) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolver(port));
    });
    s.on('error', rechazar);
  });
}

export type AppDePruebas = {
  url: string;
  origen: string;
  cerrar: () => Promise<void>;
  /** Cliente HTTP con jar de cookies, uno por «navegador». */
  cliente: () => ClienteHttp;
};

export type ClienteHttp = {
  get: (ruta: string) => Promise<{ estado: number; cuerpo: any }>;
  post: (ruta: string, cuerpo?: unknown) => Promise<{ estado: number; cuerpo: any }>;
};

export async function levantarApp(opciones: { alta?: 'abierta' | 'plataforma'; intentos?: number; controladores?: Type[] } = {}): Promise<AppDePruebas> {
  try {
    process.loadEnvFile(new URL('../../../../.env', import.meta.url));
  } catch {
    // sin .env
  }
  const puerto = await puertoLibre();
  for (const nombre of ['DATABASE_URL_APP', 'DATABASE_URL_AUTH', 'DATABASE_URL_SISTEMA']) {
    const v = process.env[nombre];
    if (!v) continue;
    const u = new URL(v);
    if (!esLocal(v)) throw new Error(`${nombre} no es local: las pruebas solo corren contra capaz_test.`);
    u.pathname = '/capaz_test';
    process.env[nombre] = u.toString();
  }
  process.env.NODE_ENV = process.env.DEBUG_PRUEBAS ? 'development' : 'test';
  process.env.BETTER_AUTH_URL = `http://127.0.0.1:${puerto}`;
  process.env.ORIGENES_PERMITIDOS = `http://127.0.0.1:${puerto}`;
  process.env.ALTA_DE_EMPRESAS = opciones.alta ?? 'abierta';
  process.env.INTENTOS_DE_ACCESO = String(opciones.intentos ?? 1000);

  // Con `controladores`, se envuelve la aplicación real para probar guardas con rutas de prueba.
  @Module({ imports: [AppModule], controllers: opciones.controladores ?? [] })
  class Envoltura {}
  const app = await NestFactory.create<NestExpressApplication>(opciones.controladores ? Envoltura : AppModule, { bodyParser: false, logger: false });
  configurarApp(app, crearLogger(process.env.DEBUG_PRUEBAS ? 'production' : 'test'));
  await app.listen(puerto, '127.0.0.1');
  const url = `http://127.0.0.1:${puerto}`;

  return {
    url,
    origen: url,
    cerrar: () => app.close(),
    cliente: () => {
      const cookies = new Map<string, string>();
      const guardar = (res: Response) => {
        for (const c of res.headers.getSetCookie()) {
          const [par] = c.split(';');
          const [k, ...v] = par!.split('=');
          cookies.set(k!, v.join('='));
        }
      };
      const pedir = async (metodo: string, ruta: string, cuerpo?: unknown) => {
        const res = await fetch(url + ruta, {
          method: metodo,
          headers: {
            origin: url,
            ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
            cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          },
          body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
        });
        guardar(res);
        return { estado: res.status, cuerpo: await res.json().catch(() => null) };
      };
      return { get: (r) => pedir('GET', r), post: (r, c) => pedir('POST', r, c) };
    },
  };
}
