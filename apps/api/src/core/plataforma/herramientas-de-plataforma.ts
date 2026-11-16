import { Inject, Injectable, type OnApplicationBootstrap, type OnModuleInit } from '@nestjs/common';
import { CONTRATOS_DE_PLATAFORMA, rechazo } from '@capaz/shared';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { AUTH, type Auth } from '../auth/auth.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import type { HerramientaRegistrada } from '../herramientas/tipos.js';
import { CatalogoDeModulos } from '../modulos/catalogo.js';
import { herramientaDeContrasena } from './herramienta-de-contrasena.js';
import { herramientasDeCatalogo } from './herramientas-de-catalogo.js';
import { herramientasDeCuenta } from './herramientas-de-cuenta.js';
import { herramientasDeEmpresas } from './herramientas-de-empresas.js';
import { herramientasDeModulos } from './herramientas-de-modulos.js';
import { herramientasDePlanes, herramientasDeSolicitudes } from './herramientas-de-planes.js';
import { RegistroDePlataforma } from './registro-de-plataforma.js';
import type { HerramientaDePlataformaRegistrada } from './tipos.js';

/**
 * Registra las herramientas de la consola en su registro propio y las valida al arrancar (si fallan,
 * el servidor no arranca). Además deja en el registro de empresas una puerta CERRADA con el mismo
 * nombre de cada una: ese registro exige una herramienta por cada contrato de `CONTRATOS_DE_PLATAFORMA`
 * y la de plataforma nunca debe poder correr por `/api/v1/herramientas` (siempre `sin_permiso`).
 */
@Injectable()
export class HerramientasDePlataforma implements OnModuleInit, OnApplicationBootstrap {
  constructor(
    @Inject(RegistroDePlataforma) private readonly registro: RegistroDePlataforma,
    @Inject(RegistroDeHerramientas) private readonly registroDeEmpresas: RegistroDeHerramientas,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CatalogoDeModulos) private readonly catalogo: CatalogoDeModulos,
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  onModuleInit(): void {
    const herramientas: HerramientaDePlataformaRegistrada[] = [
      ...herramientasDeEmpresas({ auth: this.db.auth, catalogo: this.catalogo }),
      ...herramientasDeModulos(),
      ...herramientasDeCuenta(this.db.auth),
      ...herramientasDeCatalogo(this.catalogo),
      ...herramientasDePlanes(),
      ...herramientasDeSolicitudes(),
      herramientaDeContrasena({ auth: this.auth, pool: this.db.auth, origenes: this.config.ORIGENES_PERMITIDOS }),
    ];
    this.registro.agregar(herramientas);
    this.registroDeEmpresas.agregar(herramientas.map(puertaCerrada));
  }

  onApplicationBootstrap(): void {
    this.registro.validar();
  }
}

function puertaCerrada(h: HerramientaDePlataformaRegistrada): HerramientaRegistrada {
  const contrato = CONTRATOS_DE_PLATAFORMA[h.nombre as keyof typeof CONTRATOS_DE_PLATAFORMA];
  return {
    nombre: h.nombre,
    modulo: 'core',
    permiso: null,
    criticidad: 'lectura',
    idempotente: false,
    mueveDinero: false,
    ayuda: h.ayuda,
    entrada: contrato.entrada,
    salida: contrato.salida,
    resumir: null,
    auditar: null,
    ejecutar: async () => rechazo('sin_permiso', 'Esta operación es solo de la consola de plataforma.'),
  };
}
