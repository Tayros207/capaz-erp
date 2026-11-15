export type Rol = 'capaz_owner' | 'capaz_auth' | 'capaz_app' | 'capaz_sistema';
export declare const ROLES: readonly Rol[];
export type Credencial = {
    usuario: string;
    contrasena: string;
};
export declare function variable(nombre: string): string;
export declare function credencialDe(url: string, esperado?: Rol): Credencial;
export declare function conBase(url: string, base: string): string;
export declare function baseDe(url: string): string;
export declare const urlDelDueno: () => string;
export declare const urlDeAdmin: () => string;
export declare function credencialesDeRoles(): Record<Rol, Credencial>;
