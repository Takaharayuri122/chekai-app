import { Platform, type TextStyle } from 'react-native';

/**
 * Ajuste do texto dos campos de entrada por plataforma.
 * iOS: `lineHeight: 0` alinha a fonte Inter no campo (comportamento já aprovado).
 * Android: `lineHeight: 0` corta o texto (fica invisível) e encolhe o campo — usar os ajustes nativos.
 */
export const AJUSTE_TEXTO_INPUT: TextStyle =
  Platform.OS === 'ios'
    ? { lineHeight: 0 }
    : { includeFontPadding: false, textAlignVertical: 'center', minHeight: 52 };
