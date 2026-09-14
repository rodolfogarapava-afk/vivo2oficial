const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "di", "del"]);

/**
 * Padroniza nomes no estilo "Juarez de Sousa Jardim":
 * primeira letra de cada palavra maiúscula, conectivos em minúsculo.
 */
export function formatClientName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
