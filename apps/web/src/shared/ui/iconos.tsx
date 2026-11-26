import {
  ArrowLeft, ArrowUp, Box, Check, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Cpu, Folder, Globe, HandCoins, History, House, Info, Menu, MessageCircle, Mic, Moon, Pencil, Plus,
  Search, Sparkles, Square, SquarePen, Star, Sun, Trash2, TriangleAlert, User, X,
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
  cobro: HandCoins,
  internet: Globe,
  conversacion: MessageCircle,
  // Asistente
  asistente: Sparkles,
  microfono: Mic,
  enviar: ArrowUp,
  detener: Square,
  historial: History,
  nueva: SquarePen,
  atras: ArrowLeft,
  favorita: Star,
  borrar: Trash2,
  editar: Pencil,
  modelo: Cpu,
} satisfies Record<string, LucideIcon>;

export type NombreDeIcono = keyof typeof ICONOS;
