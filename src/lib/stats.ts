import { isInPeriod, type Period } from './dates'
import { normalizeText } from './text'
import type { BooleanField, Lead } from './types'

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'year', label: 'Cette année' },
]

export const BOOLEAN_FIELDS: { field: BooleanField; label: string }[] = [
  { field: 'outreach', label: 'Outreach' },
  { field: 'reponse', label: 'Réponse' },
  { field: 'rdv', label: 'RDV pris' },
  { field: 'present', label: 'RDV tenu' },
  { field: 'pitch', label: 'Pitch' },
  { field: 'close', label: 'Closing' },
]

export type LeadStats = {
  total: number
  outreach: number
  reponse: number
  rdv: number
  present: number
  pitch: number
  close: number
  commission: number
  outreachRate: number
  responseRate: number
  bookRate: number
  showRate: number
  pitchRate: number
  closeRate: number
  conversionRate: number
}

/**
 * Pourcentage arrondi à une décimale. Toute division par zéro (ou valeur
 * invalide) renvoie 0.
 */
export function percent(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0
  if (denominator <= 0) return 0
  const raw = (numerator / denominator) * 100
  if (!Number.isFinite(raw)) return 0
  return Math.round(raw * 10) / 10
}

/** Calcule les compteurs et les taux de performance sur un ensemble de leads. */
export function computeStats(leads: Lead[]): LeadStats {
  const totals = {
    total: leads.length,
    outreach: 0,
    reponse: 0,
    rdv: 0,
    present: 0,
    pitch: 0,
    close: 0,
    commission: 0,
  }

  for (const lead of leads) {
    if (lead.outreach) totals.outreach += 1
    if (lead.reponse) totals.reponse += 1
    if (lead.rdv) totals.rdv += 1
    if (lead.present) totals.present += 1
    if (lead.pitch) totals.pitch += 1
    if (lead.close) totals.close += 1
    const commission = Number(lead.commission)
    if (Number.isFinite(commission)) totals.commission += commission
  }

  return {
    ...totals,
    outreachRate: percent(totals.outreach, totals.total),
    responseRate: percent(totals.reponse, totals.outreach),
    bookRate: percent(totals.rdv, totals.reponse),
    showRate: percent(totals.present, totals.rdv),
    pitchRate: percent(totals.pitch, totals.present),
    closeRate: percent(totals.close, totals.pitch),
    conversionRate: percent(totals.close, totals.outreach),
  }
}

/** Trie les leads par dernière action décroissante. */
export function sortByLastDesc(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const lastA = a.last ?? ''
    const lastB = b.last ?? ''
    if (lastA === lastB) return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    return lastB.localeCompare(lastA)
  })
}

const SEARCHABLE_FIELDS: (keyof Lead)[] = ['nom', 'poste', 'societe', 'tel', 'adresse']

/** Filtre par période (colonne `last`) puis par recherche plein texte. */
export function filterLeads(
  leads: Lead[],
  options: { period: Period; search?: string; now?: Date },
): Lead[] {
  const { period, search = '', now = new Date() } = options
  const needle = normalizeText(search)
  const filtered = leads.filter((lead) => {
    if (!isInPeriod(lead.last, period, now)) return false
    if (!needle) return true
    return SEARCHABLE_FIELDS.some((field) => normalizeText(lead[field] as string | null).includes(needle))
  })
  return sortByLastDesc(filtered)
}
