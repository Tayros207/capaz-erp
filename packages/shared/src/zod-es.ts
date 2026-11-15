import { z } from 'zod';

// Mensajes de validación en español para toda la aplicación (API y web comparten esta instancia de
// Zod). Se importa una sola vez, al cargar `@capaz/shared`.
z.config(z.locales.es());
