import emoji from 'node-emoji';

/**
 * Mapeamento customizado adicional para códigos específicos do sistema.
 * Estes códigos são convertidos automaticamente antes de usar o node-emoji.
 */
const CUSTOM_EMOJI_ALIASES: Record<string, string> = {
  // Mapeamentos customizados que não existem no node-emoji padrão
  emoji_like: ':thumbsup:',
  emoji_unlike: ':thumbsdown:',
  emoji_thumbsup: ':thumbsup:',
  emoji_thumbsdown: ':thumbsdown:',
  emoji_check: ':white_check_mark:',
  emoji_cross: ':x:',
  emoji_warning: ':warning:',
  emoji_info: ':information_source:',
  emoji_question: ':question:',
  emoji_star: ':star:',
  emoji_heart: ':heart:',
  emoji_ok: ':white_check_mark:',
  emoji_ok_hand: ':ok_hand:',
  emoji_check_mark: ':white_check_mark:',
  emoji_cross_mark: ':x:',
  emoji_x: ':x:',
  emoji_camera: ':camera:',
  emoji_image: ':frame_with_picture:',
  emoji_document: ':page_facing_up:',
  emoji_clipboard: ':clipboard:',
  emoji_file: ':file_folder:',
  emoji_folder: ':file_folder:',
  emoji_food: ':fork_and_knife:',
  emoji_apple: ':apple:',
  emoji_bread: ':bread:',
  emoji_fish: ':fish:',
  emoji_meat: ':meat_on_bone:',
  emoji_soap: ':soap:',
  emoji_water: ':droplet:',
  emoji_clean: ':sparkles:',
  emoji_shower: ':shower:',
  emoji_hot: ':fire:',
  emoji_cold: ':ice:',
  emoji_thermometer: ':thermometer:',
  emoji_location: ':round_pushpin:',
  emoji_map: ':world_map:',
  emoji_building: ':office:',
  emoji_clock: ':clock1:',
  emoji_calendar: ':calendar:',
  emoji_time: ':alarm_clock:',
  emoji_person: ':bust_in_silhouette:',
  emoji_people: ':busts_in_silhouette:',
  emoji_worker: ':construction_worker:',
  emoji_alert: ':rotating_light:',
  emoji_bell: ':bell:',
  emoji_siren: ':rotating_light:',
  emoji_success: ':white_check_mark:',
  emoji_error: ':x:',
  emoji_warning_yellow: ':warning:',
  // Setas
  emoji_arrow_up: ':arrow_up:',
  emoji_arrow_down: ':arrow_down:',
  emoji_arrow_left: ':arrow_left:',
  emoji_arrow_right: ':arrow_right:',
  emoji_arrow_yellow: ':large_yellow_circle:',
  emoji_arrow_green: ':large_green_circle:',
  emoji_arrow_red: ':red_circle:',
  emoji_arrow_blue: ':large_blue_circle:',
  // Números
  emoji_0: ':zero:',
  emoji_1: ':one:',
  emoji_2: ':two:',
  emoji_3: ':three:',
  emoji_4: ':four:',
  emoji_5: ':five:',
  emoji_6: ':six:',
  emoji_7: ':seven:',
  emoji_8: ':eight:',
  emoji_9: ':nine:',
};

/**
 * Converte um código customizado para formato node-emoji (:nome:)
 * ou retorna o código original se não encontrar mapeamento.
 */
function convertCustomCodeToEmojiName(code: string): string {
  // Se já está no formato :nome:, retorna como está
  if (code.startsWith(':') && code.endsWith(':')) {
    return code;
  }
  
  // Verifica se é um código customizado
  if (CUSTOM_EMOJI_ALIASES[code]) {
    return CUSTOM_EMOJI_ALIASES[code];
  }
  
  // Tenta converter automaticamente: emoji_like -> :like:
  // Remove o prefixo "emoji_" e tenta usar diretamente
  if (code.startsWith('emoji_')) {
    const emojiName = code.replace('emoji_', '');
    // Tenta alguns padrões comuns
    const patterns = [
      `:${emojiName}:`,
      `:${emojiName.replace(/_/g, '_')}:`,
      `:${emojiName.replace(/_/g, '-')}:`,
    ];
    
    // Verifica se algum padrão existe no node-emoji
    for (const pattern of patterns) {
      if (emoji.hasEmoji(pattern)) {
        return pattern;
      }
    }
  }
  
  // Se não encontrou, tenta usar o código diretamente como nome de emoji
  const directName = `:${code.replace(/^emoji_/, '').replace(/_/g, '_')}:`;
  if (emoji.hasEmoji(directName)) {
    return directName;
  }
  
  return code;
}

/**
 * Verifica se uma string já é um emoji Unicode.
 * Emojis Unicode geralmente têm códigos entre U+1F300 e U+1F9FF, ou são caracteres especiais.
 */
function isUnicodeEmoji(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  
  const trimmed = text.trim();
  
  // Se começa com "emoji_", não é um emoji Unicode, é um código
  if (trimmed.startsWith('emoji_')) return false;
  
  // Regex simplificada para detectar emojis Unicode
  // Cobre a maioria dos emojis comuns
  const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2B50}-\u{2B55}\u{3030}-\u{303F}\u{3297}-\u{3299}\u{FE00}-\u{FE0F}]+$/u;
  
  // Verifica se o texto é apenas emojis (sem letras ou números)
  const textWithoutSpaces = trimmed.replace(/\s/g, '');
  
  // Se tem mais de 10 caracteres, provavelmente não é apenas emoji
  if (textWithoutSpaces.length > 10) return false;
  
  // Verifica se contém apenas emojis ou se é muito curto (provavelmente emoji)
  return emojiRegex.test(textWithoutSpaces) || (textWithoutSpaces.length <= 3 && !/[a-zA-Z0-9]/.test(textWithoutSpaces));
}

/**
 * Renderiza emojis em um texto de forma automática usando node-emoji.
 * 
 * Esta função:
 * 1. Se o texto já for um emoji Unicode, retorna como está
 * 2. Se o texto for um código customizado (ex: "emoji_like"), converte automaticamente
 * 3. Se o texto estiver no formato :nome: (node-emoji), converte automaticamente
 * 4. Se o texto contiver códigos, substitui todos eles automaticamente
 * 5. Usa node-emoji para mapeamento automático de milhares de emojis
 * 
 * @param text - Texto que pode conter emojis Unicode, códigos customizados ou nomes :nome:
 * @returns Texto com emojis renderizados
 * 
 * @example
 * renderEmoji('emoji_like') // '👍'
 * renderEmoji('👍') // '👍'
 * renderEmoji('Gostei emoji_like') // 'Gostei 👍'
 * renderEmoji(':thumbsup:') // '👍'
 * renderEmoji('emoji_arrow_yellow') // '🟡'
 * renderEmoji(':heart: :star:') // '❤️ ⭐'
 */
export function renderEmoji(text: string | null | undefined): string {
  if (!text) return '';
  
  const trimmed = text.trim();
  
  // Se já é um emoji Unicode, retorna como está
  if (isUnicodeEmoji(trimmed) && trimmed.length <= 3) {
    return trimmed;
  }
  
  // Primeiro, converte códigos customizados para formato node-emoji
  let processedText = trimmed;
  
  // Substitui códigos customizados (emoji_xxx) no texto
  Object.entries(CUSTOM_EMOJI_ALIASES).forEach(([code, emojiName]) => {
    const regex = new RegExp(`\\b${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    processedText = processedText.replace(regex, emojiName);
  });
  
  // Se o texto inteiro é um código customizado, converte diretamente
  if (CUSTOM_EMOJI_ALIASES[trimmed]) {
    processedText = CUSTOM_EMOJI_ALIASES[trimmed];
  } else if (trimmed.startsWith('emoji_')) {
    // Tenta conversão automática para códigos não mapeados
    const converted = convertCustomCodeToEmojiName(trimmed);
    if (converted !== trimmed) {
      processedText = converted;
    }
  }
  
  // Usa node-emoji para renderizar automaticamente
  // node-emoji já suporta formato :nome: e converte automaticamente
  let result = emoji.emojify(processedText);
  
  // Se node-emoji não conseguiu converter e o texto original não mudou,
  // tenta converter códigos que ainda não foram processados
  if (result === processedText && processedText.includes('emoji_')) {
    // Tenta converter códigos restantes automaticamente
    const autoConverted = convertCustomCodeToEmojiName(processedText);
    if (autoConverted !== processedText) {
      result = emoji.emojify(autoConverted);
    }
  }
  
  return result;
}

/**
 * Obtém o emoji correspondente a um código, ou retorna o código original se não encontrar.
 * Útil para renderizar emojis em componentes React.
 * 
 * @param code - Código do emoji (ex: "emoji_like") ou emoji Unicode
 * @returns Emoji renderizado ou o código original
 */
export function getEmoji(code: string | null | undefined): string {
  if (!code) return '';
  return renderEmoji(code);
}

/**
 * Adiciona um novo mapeamento de emoji dinamicamente.
 * Útil para adicionar emojis customizados em tempo de execução.
 * 
 * @param code - Código do emoji (ex: "emoji_custom")
 * @param emojiName - Nome do emoji no formato node-emoji (ex: ":custom:") ou emoji Unicode
 */
export function addEmojiMapping(code: string, emojiName: string): void {
  // Se já está no formato :nome:, usa diretamente
  if (emojiName.startsWith(':') && emojiName.endsWith(':')) {
    CUSTOM_EMOJI_ALIASES[code] = emojiName;
  } else {
    // Se é um emoji Unicode, tenta encontrar o nome correspondente
    // ou usa o emoji diretamente (mas node-emoji não suporta isso diretamente)
    CUSTOM_EMOJI_ALIASES[code] = emojiName;
  }
}

/**
 * Obtém todos os códigos de emoji customizados disponíveis.
 * 
 * @returns Array com todos os códigos customizados mapeados
 */
export function getAvailableEmojiCodes(): string[] {
  return Object.keys(CUSTOM_EMOJI_ALIASES);
}

/**
 * Obtém todos os nomes de emoji disponíveis no node-emoji.
 * Útil para listar emojis disponíveis.
 * 
 * @returns Array com todos os nomes de emoji no formato :nome:
 */
export function getAvailableEmojiNames(): string[] {
  return Object.keys(emoji.emoji);
}

/**
 * Busca emojis por nome ou palavra-chave.
 * 
 * @param searchTerm - Termo de busca (ex: "thumbs", "heart", "arrow")
 * @returns Array de nomes de emoji que correspondem à busca
 */
export function searchEmojis(searchTerm: string): string[] {
  if (!searchTerm) return [];
  
  const term = searchTerm.toLowerCase();
  const allEmojis = getAvailableEmojiNames();
  
  return allEmojis.filter((name) => {
    const nameWithoutColons = name.replace(/:/g, '').toLowerCase();
    return nameWithoutColons.includes(term);
  });
}

