/**
 * Helpers de texte : normalisation (casse + accents) utilisée par la recherche
 * et par la détection des colonnes CSV.
 */

export function normalizeText(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Normalisation « compacte » : uniquement des lettres et des chiffres. */
export function compactText(value: string | null | undefined): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '')
}
