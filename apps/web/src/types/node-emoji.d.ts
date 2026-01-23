declare module 'node-emoji' {
  interface Emoji {
    emojify(text: string, onMissing?: (name: string) => string, format?: (code: string, name: string) => string): string;
    hasEmoji(name: string): boolean;
    emoji: Record<string, string>;
    get(name: string): string;
    random(): string;
    search(searchTerm: string): string[];
    unemojify(text: string): string;
    replace(text: string, callback: (emoji: string, name: string) => string): string;
  }

  const emoji: Emoji;
  export default emoji;
  export { emoji };
}
