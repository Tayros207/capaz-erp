// Interfaz del reconocedor de voz: la pantalla solo conoce esto; otro proveedor se cambia sin tocarla.

export type EstadoDeReconocedor = 'sin_contexto_seguro' | 'no_disponible' | 'listo' | 'escuchando' | 'error';

export type ReconocedorDeVoz = {
  estado: EstadoDeReconocedor;
  texto: string;
  aviso: string | null;
  iniciar: () => void;
  detener: () => void;
  limpiar: () => void;
};
