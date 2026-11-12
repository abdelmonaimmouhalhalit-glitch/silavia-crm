/**
 * Manipulation des dates.
 * Toutes les dates « métier » (colonne `last` de la table leads) sont stockées
 * en ISO `YYYY-MM-DD` (type `date` Postgres) et comparées comme des chaînes,
 * ce qui évite tout décalage de fuseau horaire.
 */

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  janvier: 1,
  february: 2,
  feb: 2,
  fevrier: 2,
  march: 3,
  mar: 3,
  mars: 3,
  april: 4,
  apr: 4,
  avril: 4,
  may: 5,
  mai: 5,
  june: 6,
  jun: 6,
  juin: 6,
  july: 7,
  jul: 7,
  juillet: 7,
  august: 8,
  aug: 8,
  aout: 8,
  september: 9,
  sep: 9,
  sept: 9,
  septembre: 9,
  october: 10,
  oct: 10,
  octobre: 10,
  november: 11,
  nov: 11,
  novembre: 11,
  december: 12,
  dec: 12,
  decembre: 12,
}

const pad2 = (value: number): string => `${value}`.padStart(2, '0')

const stripAccents = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Construit une date ISO `YYYY-MM-DD` en rejetant les valeurs impossibles. */
function buildISO(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (year < 1900 || year > 2999) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null
  }
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function monthNumber(name: string): number | null {
  const key = stripAccents(name).toLowerCase().replace(/\./g, '').trim()
  return MONTHS[key] ?? null
}

/** Date du jour (ou de la date fournie) au format ISO `YYYY-MM-DD`, en heure locale. */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Date du jour au format ISO `YYYY-MM-DD`. */
export function todayISO(now: Date = new Date()): string {
  return toISODate(now)
}

/**
 * Convertit les formats rencontrés dans un export Notion vers `YYYY-MM-DD`.
 * Gère : `2026-10-15`, `2026-10-15T09:30:00Z`, `October 15, 2026`,
 * `15 October 2026`, `15 oct. 2026`, `15/10/2026`.
 * Retourne `null` si la valeur n'est pas reconnue.
 */
export function parseNotionDate(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = input.trim()
  if (!raw) return null

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return buildISO(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))
  }

  const cleaned = stripAccents(raw)
    .replace(/,/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // "October 15, 2026" / "Oct 15 2026" / "Oct 15th, 2026"
  const monthFirst = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/)
  if (monthFirst) {
    const month = monthNumber(monthFirst[1])
    if (month) return buildISO(Number(monthFirst[3]), month, Number(monthFirst[2]))
  }

  // "15 October 2026"
  const dayFirst = cleaned.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/)
  if (dayFirst) {
    const month = monthNumber(dayFirst[2])
    if (month) return buildISO(Number(dayFirst[3]), month, Number(dayFirst[1]))
  }

  // "15/10/2026" (format français : jour puis mois)
  const slashed = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashed) {
    return buildISO(Number(slashed[3]), Number(slashed[2]), Number(slashed[1]))
  }

  // Dernier recours : interprétation native du navigateur.
  const fallback = new Date(raw)
  if (!Number.isNaN(fallback.getTime())) return toISODate(fallback)

  return null
}

/** Lundi de la semaine contenant `now` (à 00:00 heure locale). */
export function startOfWeekMonday(now: Date = new Date()): Date {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = date.getDay() // 0 = dimanche
  const diff = (day + 6) % 7 // lundi = 0
  date.setDate(date.getDate() - diff)
  return date
}

export function startOfMonth(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export function startOfYear(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), 0, 1)
}

export type Period = 'all' | 'week' | 'month' | 'year'

/** Première date (incluse) d'une période, ou `null` pour « Tous ». */
export function periodStartISO(period: Period, now: Date = new Date()): string | null {
  switch (period) {
    case 'week':
      return toISODate(startOfWeekMonday(now))
    case 'month':
      return toISODate(startOfMonth(now))
    case 'year':
      return toISODate(startOfYear(now))
    case 'all':
    default:
      return null
  }
}

/** Indique si une date ISO tombe dans la période demandée. */
export function isInPeriod(
  isoDate: string | null | undefined,
  period: Period,
  now: Date = new Date(),
): boolean {
  const start = periodStartISO(period, now)
  if (start === null) return true
  if (!isoDate) return false
  const day = isoDate.slice(0, 10)
  return day >= start && day <= toISODate(now)
}

/** Formate une date ISO en `jj/mm/aaaa` (ou « — » si absente). */
export function formatDateFR(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'
  const match = isoDate.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return isoDate
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** Formate un nombre en euros au format français : `1 250 €`. */
export function formatCurrencyEUR(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return euroFormatter.format(safe)
}
