// Interfaz del reconocedor de voz: la pantalla solo conoce esto; otro proveedor se cambia sin tocarla.

/**
 * `escuchando` = el micrófono está abierto (en vivo con Web Speech, o grabando con la vía de audio). `transcribiendo` = solo la vía de
 * audio: ya se dejó de grabar y el servidor está pasando el audio a texto.
 */
export type EstadoDeReconocedor = 'sin_contexto_seguro' | 'no_disponible' | 'listo' | 'escuchando' | 'transcribiendo' | 'error';

/** `navegador` = Web Speech (Chrome, Edge, Safari); `audio` = se graba y lo transcribe el servidor (Firefox y otros). */
export type ViaDeVoz = 'navegador' | 'audio';

export type ReconocedorDeVoz = {
  estado: EstadoDeReconocedor;
  texto: string;
  aviso: string | null;
  iniciar: () => void;
  detener: () => void;
  limpiar: () => void;
  /** Cambia lo que se le dice a la persona («Escuchando…» o «Grabando…»). Sin ella, como Web Speech. */
  via?: ViaDeVoz;
};
