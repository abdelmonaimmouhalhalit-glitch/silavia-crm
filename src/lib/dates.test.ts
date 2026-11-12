import { describe, expect, it } from 'vitest'
import {
  formatCurrencyEUR,
  formatDateFR,
  isInPeriod,
  parseNotionDate,
  periodStartISO,
  startOfWeekMonday,
} from './dates'

describe('parseNotionDate', () => {
  it('convertit le format Notion « October 15, 2026 »', () => {
    expect(parseNotionDate('October 15, 2026')).toBe('2026-10-15')
    expect(parseNotionDate('Oct 5, 2026')).toBe('2026-10-05')
    expect(parseNotionDate('January 1, 2027')).toBe('2027-01-01')
  })

  it('accepte les dates ISO et le jour avant le mois', () => {
    expect(parseNotionDate('2026-10-15')).toBe('2026-10-15')
    expect(parseNotionDate('2026-10-15T09:30:00.000Z')).toBe('2026-10-15')
    expect(parseNotionDate('15 October 2026')).toBe('2026-10-15')
    expect(parseNotionDate('15/10/2026')).toBe('2026-10-15')
    expect(parseNotionDate('15 octobre 2026')).toBe('2026-10-15')
  })

  it('retourne null pour une valeur vide ou invalide', () => {
    expect(parseNotionDate('')).toBeNull()
    expect(parseNotionDate('   ')).toBeNull()
    expect(parseNotionDate('pas une date')).toBeNull()
    expect(parseNotionDate('2026-13-45')).toBeNull()
  })
})

describe('périodes', () => {
  const wednesday = new Date(2026, 10, 11) // mercredi 11 novembre 2026

  it('la semaine commence le lundi', () => {
    expect(startOfWeekMonday(wednesday).getDay()).toBe(1)
    expect(periodStartISO('week', wednesday)).toBe('2026-11-09')
    expect(periodStartISO('month', wednesday)).toBe('2026-11-01')
    expect(periodStartISO('year', wednesday)).toBe('2026-01-01')
    expect(periodStartISO('all', wednesday)).toBeNull()
  })

  it('isInPeriod filtre correctement', () => {
    expect(isInPeriod('2026-11-09', 'week', wednesday)).toBe(true)
    expect(isInPeriod('2026-11-08', 'week', wednesday)).toBe(false)
    expect(isInPeriod('2026-11-01', 'month', wednesday)).toBe(true)
    expect(isInPeriod('2026-10-31', 'month', wednesday)).toBe(false)
    expect(isInPeriod('2026-01-01', 'year', wednesday)).toBe(true)
    expect(isInPeriod('2025-12-31', 'year', wednesday)).toBe(false)
    expect(isInPeriod(null, 'all', wednesday)).toBe(true)
    expect(isInPeriod(null, 'year', wednesday)).toBe(false)
  })
})

describe('formatage', () => {
  it('formate les dates en jj/mm/aaaa', () => {
    expect(formatDateFR('2026-10-15')).toBe('15/10/2026')
    expect(formatDateFR(null)).toBe('—')
  })

  it('formate les montants en euros au format français', () => {
    // Espace insécable étroite utilisée par Intl : on normalise avant comparaison.
    const normalized = (value: number) => formatCurrencyEUR(value).replace(/\s/g, ' ')
    expect(normalized(1250)).toBe('1 250 €')
    expect(normalized(0)).toBe('0 €')
    expect(normalized(1234.5)).toBe('1 234,5 €')
  })
})
