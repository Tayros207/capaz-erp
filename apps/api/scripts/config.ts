// Configuración de los SCRIPTS de base de datos (preparar-base y migrar). Es el otro único lugar,
// junto a `src/infra/config`, que lee variables de entorno (regla 2). Aquí viven las credenciales
// que el servidor nunca recibe: el superusuario local y el dueño de la base (regla 16).
//
// Se ejecutan con Node 24 directamente (`node scripts/migrar.ts`): por eso los imports llevan `.ts`.

export type Rol = 'capaz_owner' | 'capaz_auth' | 'capaz_app' | 'capaz_sistema';
export const ROLES: readonly Rol[] = ['capaz_owner', 'capaz_auth', 'capaz_app', 'capaz_sistema'];

export type Credencial = { usuario: string; contrasena: string };

function cargarEnv(): void {
  try {
    process.loadEnvFile(new URL('../../../.env', import.meta.url));
  } catch {
    // Sin .env: se usan las variables del entorno.
  }
}

export function variable(nombre: string): string {
  cargarEnv();
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta ${nombre} en .env (ver .env.example).`);
  return valor;
}

/** Usuario y contraseña de una URL de conexión. Falla si la contraseña no es simple (se inyecta en SQL de roles). */
export function credencialDe(url: string, esperado?: Rol): Credencial {
  const u = new URL(url);
  const usuario = decodeURIComponent(u.username);
  const contrasena = decodeURIComponent(u.password);
  if (esperado && usuario !== esperado) throw new Error(`La URL de ${esperado} usa el usuario «${usuario}».`);
  if (!/^[A-Za-z0-9_-]{12,}$/.test(contrasena)) {
    throw new Error(`La contraseña de ${usuario} debe ser alfanumérica simple y de 12 caracteres o más.`);
  }
  return { usuario, contrasena };
}

/** La misma URL apuntando a otra base (por ejemplo `capaz_test`). */
export function conBase(url: string, base: string): string {
  const u = new URL(url);
  u.pathname = `/${base}`;
  return u.toString();
}

export function baseDe(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

/** URL del dueño (`capaz_owner`), con la que corren las migraciones. */
export const urlDelDueno = (): string => variable('DATABASE_URL_OWNER');

/** URL del superusuario del contenedor local; solo la usa `preparar-base`. */
export const urlDeAdmin = (): string => variable('DATABASE_URL_ADMIN');

/** Credenciales de los cuatro roles, tomadas de las cuatro URL: una sola fuente de verdad. */
export function credencialesDeRoles(): Record<Rol, Credencial> {
  return {
    capaz_owner: credencialDe(variable('DATABASE_URL_OWNER'), 'capaz_owner'),
    capaz_auth: credencialDe(variable('DATABASE_URL_AUTH'), 'capaz_auth'),
    capaz_app: credencialDe(variable('DATABASE_URL_APP'), 'capaz_app'),
    capaz_sistema: credencialDe(variable('DATABASE_URL_SISTEMA'), 'capaz_sistema'),
  };
}
