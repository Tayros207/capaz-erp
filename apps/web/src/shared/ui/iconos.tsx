import {
  Box, Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Folder, House, Info, Menu, Moon, Plus, Search, Sun, TriangleAlert, User, X,
  type LucideIcon,
} from 'lucide-react';

// Iconos de la interfaz: Lucide (ISC), con los nombres propios de Capaz. Los módulos usan estos nombres
// y no importan Lucide directamente, así el set se puede cambiar en un solo archivo.
export const ICONOS = {
  inicio: House,
  cerrar: X,
  mas: Plus,
  buscar: Search,
  menu: Menu,
  check: Check,
  'flecha-abajo': ChevronDown,
  'flecha-derecha': ChevronRight,
  aviso: TriangleAlert,
  error: CircleAlert,
  info: Info,
  exito: CircleCheck,
  usuario: User,
  carpeta: Folder,
  sol: Sun,
  luna: Moon,
  caja: Box,
} satisfies Record<string, LucideIcon>;

export type NombreDeIcono = keyof typeof ICONOS;
