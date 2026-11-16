// Cliente HTTP de la demostración: inicia sesión con Better Auth y llama a las herramientas por la
// puerta real (`POST /api/v1/herramientas/:nombre`), de modo que se aplican permisos, auditoría y RLS.

export class ErrorDeHerramienta extends Error {
  herramienta: string;
  codigo: string;
  constructor(herramienta: string, codigo: string, mensaje: string) {
    super(`${herramienta}: ${codigo}${mensaje ? ` · ${mensaje}` : ''}`);
    this.herramienta = herramienta;
    this.codigo = codigo;
  }
}

type Cuerpo = Record<string, unknown>;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Sesion {
  private readonly jar = new Map<string, string>();
  readonly api: string;
  readonly origen: string;
  /** Se llama antes de cada intento de acceso (la siembra suelta el límite de intentos de la base local). */
  private readonly antesDeAcceso: (() => Promise<void>) | undefined;
  constructor(api: string, origen: string, antesDeAcceso?: () => Promise<void>) {
    this.api = api;
    this.origen = origen;
    this.antesDeAcceso = antesDeAcceso;
  }

  private cookie(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private async enviar(ruta: string, metodo: 'GET' | 'POST', cuerpo?: Cuerpo, cabeceras: Record<string, string> = {}, intento = 0): Promise<{ estado: number; json: any }> {
    if (ruta.startsWith('/api/auth/sign-')) await this.antesDeAcceso?.();
    const r = await fetch(this.api + ruta, {
      method: metodo,
      headers: { 'content-type': 'application/json', origin: this.origen, cookie: this.cookie(), ...cabeceras },
      ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
    });
    for (const c of r.headers.getSetCookie()) {
      const [kv = ''] = c.split(';');
      const i = kv.indexOf('=');
      this.jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
    if (r.status === 429 && intento < 6) {
      const espera = Number(r.headers.get('x-retry-after') ?? '') || 10;
      await dormir((espera + 1) * 1000);
      return this.enviar(ruta, metodo, cuerpo, cabeceras, intento + 1);
    }
    const texto = await r.text();
    let json: any = null;
    try {
      json = JSON.parse(texto);
    } catch {
      json = { texto };
    }
    return { estado: r.status, json };
  }

  /** Crea la cuenta si no existe y entra. La cuenta es global (regla 19). */
  async entrar(nombre: string, correo: string, clave: string): Promise<void> {
    let r = await this.enviar('/api/auth/sign-in/email', 'POST', { email: correo, password: clave });
    if (r.estado !== 200) {
      await this.enviar('/api/auth/sign-up/email', 'POST', { name: nombre, email: correo, password: clave });
      r = await this.enviar('/api/auth/sign-in/email', 'POST', { email: correo, password: clave });
    }
    if (r.estado !== 200) throw new Error(`No se pudo iniciar sesión con ${correo}: ${r.estado} ${JSON.stringify(r.json).slice(0, 200)}`);
  }

  auth(ruta: string, cuerpo: Cuerpo) {
    return this.enviar(`/api/auth${ruta}`, 'POST', cuerpo);
  }

  async yo(): Promise<any> {
    const r = await this.enviar('/api/v1/yo', 'GET');
    return r.json?.datos;
  }

  async crearEmpresa(nombre: string): Promise<string> {
    const r = await this.enviar('/api/v1/empresas', 'POST', { nombre });
    if (!r.json?.ok) throw new ErrorDeHerramienta('empresas', r.json?.error?.codigo ?? String(r.estado), r.json?.error?.mensaje ?? '');
    return r.json.datos.id as string;
  }

  async activarEmpresa(id: string): Promise<void> {
    const r = await this.auth('/organization/set-active', { organizationId: id });
    if (r.estado !== 200) throw new Error(`No se pudo activar la empresa ${id}: ${r.estado}`);
  }

  /** Llama a una herramienta; si pide confirmación (herramienta crítica) la confirma con el token recibido. */
  async herramienta<T = any>(nombre: string, args: Cuerpo = {}): Promise<T> {
    const ruta = `/api/v1/herramientas/${nombre}`;
    let r = await this.enviar(ruta, 'POST', { args });
    if (!r.json?.ok && r.json?.requiereConfirmacion) {
      r = await this.enviar(ruta, 'POST', { args, confirmacion: r.json.requiereConfirmacion.token });
    }
    if (!r.json?.ok) throw new ErrorDeHerramienta(nombre, r.json?.error?.codigo ?? String(r.estado), r.json?.error?.mensaje ?? JSON.stringify(r.json).slice(0, 200));
    return r.json.datos as T;
  }

  /** Recorre todas las páginas de una herramienta `*_listar` (las que no paginan responden de una vez). */
  async todos<T = any>(nombre: string, args: Cuerpo = {}): Promise<T[]> {
    const filas: T[] = [];
    let cursor: string | undefined;
    do {
      let p: { items: T[]; siguiente: string | null };
      try {
        p = await this.herramienta<{ items: T[]; siguiente: string | null }>(nombre, { ...args, limite: 100, ...(cursor ? { cursor } : {}) });
      } catch (e) {
        if (!(e instanceof ErrorDeHerramienta) || e.codigo !== 'argumentos_invalidos' || !e.message.includes('limite')) throw e;
        return (await this.herramienta<{ items: T[] }>(nombre, args)).items;
      }
      filas.push(...p.items);
      cursor = p.siguiente ?? undefined;
    } while (cursor);
    return filas;
  }
}
