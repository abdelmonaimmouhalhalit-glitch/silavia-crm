import { describe, expect, it } from 'vitest'
import { computeStats, filterLeads, percent, sortByLastDesc } from './stats'
import type { Lead } from './types'

const makeLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  user_id: 'user-1',
  created_at: '2026-01-01T00:00:00.000Z',
  nom: 'Lead test',
  poste: null,
  societe: null,
  lien: null,
  tel: null,
  adresse: null,
  commission: 0,
  last: '2026-11-10',
  outreach: false,
  reponse: false,
  rdv: false,
  present: false,
  pitch: false,
  close: false,
  ...overrides,
})

describe('percent', () => {
  it('retourne 0 quand le dénominateur est zéro (pas de division par zéro)', () => {
    expect(percent(5, 0)).toBe(0)
    expect(percent(0, 0)).toBe(0)
    expect(percent(-3, 0)).toBe(0)
  })

  it('arrondit à une décimale', () => {
    expect(percent(1, 3)).toBe(33.3)
    expect(percent(2, 3)).toBe(66.7)
    expect(percent(1, 1)).toBe(100)
    expect(percent(0, 10)).toBe(0)
  })

  it('ignore les valeurs non finies', () => {
    expect(percent(Number.NaN, 10)).toBe(0)
    expect(percent(1, Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('computeStats', () => {
  it('retourne des zéros sur une liste vide', () => {
    const stats = computeStats([])
    expect(stats).toMatchObject({
      total: 0,
      outreach: 0,
      reponse: 0,
      rdv: 0,
      present: 0,
      pitch: 0,
      close: 0,
      commission: 0,
      outreachRate: 0,
      responseRate: 0,
      bookRate: 0,
      showRate: 0,
      pitchRate: 0,
      closeRate: 0,
      conversionRate: 0,
    })
  })

  it('calcule le tunnel complet et les taux de conversion', () => {
    const leads: Lead[] = [
      // 10 leads, 8 outreach, 4 réponses, 2 RDV pris, 2 RDV tenus, 2 pitchs, 1 closing
      ...Array.from({ length: 8 }, (_, index) =>
        makeLead({
          outreach: true,
          reponse: index < 4,
          rdv: index < 2,
          present: index < 2,
          pitch: index < 2,
          close: index < 1,
          commission: index < 1 ? 1000 : index < 2 ? 500 : 0,
        }),
      ),
      makeLead({}),
      makeLead({}),
    ]

    const stats = computeStats(leads)

    expect(stats.total).toBe(10)
    expect(stats.outreach).toBe(8)
    expect(stats.reponse).toBe(4)
    expect(stats.rdv).toBe(2)
    expect(stats.present).toBe(2)
    expect(stats.pitch).toBe(2)
    expect(stats.close).toBe(1)

    expect(stats.outreachRate).toBe(80) // 8 / 10
    expect(stats.responseRate).toBe(50) // 4 / 8
    expect(stats.bookRate).toBe(50) // 2 / 4
    expect(stats.showRate).toBe(100) // 2 / 2
    expect(stats.pitchRate).toBe(100) // 2 / 2
    expect(stats.closeRate).toBe(50) // 1 / 2
    expect(stats.conversionRate).toBe(12.5) // 1 / 8

    expect(stats.commission).toBe(1500)
  })

  it('ignore les commissions non numériques', () => {
    const stats = computeStats([
      makeLead({ commission: 250 }),
      makeLead({ commission: Number.NaN }),
      makeLead({ commission: 125.5 }),
    ])
    expect(stats.commission).toBe(375.5)
  })
})

describe('sortByLastDesc', () => {
  it('trie par dernière action décroissante sans muter la source', () => {
    const leads = [
      makeLead({ id: 'a', last: '2026-01-10' }),
      makeLead({ id: 'c', last: '2026-03-02' }),
      makeLead({ id: 'b', last: '2026-02-01' }),
    ]
    const sorted = sortByLastDesc(leads)
    expect(sorted.map((lead) => lead.id)).toEqual(['c', 'b', 'a'])
    expect(leads.map((lead) => lead.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('filterLeads', () => {
  // Mercredi 11 novembre 2026 : la semaine commence le lundi 9 novembre 2026.
  const now = new Date(2026, 10, 11)

  const leads = [
    makeLead({ id: 'today', last: '2026-11-11', nom: 'Alice Martin', societe: 'Société Générale' }),
    makeLead({ id: 'monday', last: '2026-11-09', nom: 'Bob Durand', tel: '06 12 34 56 78' }),
    makeLead({ id: 'lastWeek', last: '2026-11-08', nom: 'Chloé Petit', poste: 'CTO' }),
    makeLead({ id: 'thisMonth', last: '2026-11-02', nom: 'David Roux', adresse: '12 rue de Paris' }),
    makeLead({ id: 'lastMonth', last: '2026-10-31', nom: 'Emma Blanc' }),
    makeLead({ id: 'thisYear', last: '2026-02-14', nom: 'Farid Benali' }),
    makeLead({ id: 'lastYear', last: '2025-12-31', nom: 'Gaëlle Moreau' }),
  ]

  const ids = (period: 'all' | 'week' | 'month' | 'year') =>
    filterLeads(leads, { period, now }).map((lead) => lead.id)

  it('« Tous » conserve les leads de toutes les dates', () => {
    expect(ids('all')).toHaveLength(7)
  })

  it('« Cette semaine » démarre le lundi', () => {
    expect(ids('week')).toEqual(['today', 'monday'])
  })

  it('« Ce mois » démarre le 1er du mois', () => {
    expect(ids('month')).toEqual(['today', 'monday', 'lastWeek', 'thisMonth'])
  })

  it('« Cette année » démarre le 1er janvier', () => {
    expect(ids('year')).toHaveLength(6)
    expect(ids('year')).not.toContain('lastYear')
  })

  it('recherche sans tenir compte des accents, de la casse ni du champ', () => {
    expect(filterLeads(leads, { period: 'all', search: 'societe generale', now }).map((l) => l.id)).toEqual([
      'today',
    ])
    expect(filterLeads(leads, { period: 'all', search: 'chloé', now }).map((l) => l.id)).toEqual(['lastWeek'])
    expect(filterLeads(leads, { period: 'all', search: 'CTO', now }).map((l) => l.id)).toEqual(['lastWeek'])
    expect(filterLeads(leads, { period: 'all', search: '12 34', now }).map((l) => l.id)).toEqual(['monday'])
    expect(filterLeads(leads, { period: 'all', search: 'rue de paris', now }).map((l) => l.id)).toEqual([
      'thisMonth',
    ])
  })

  it('combine période et recherche', () => {
    expect(filterLeads(leads, { period: 'week', search: 'bob', now }).map((l) => l.id)).toEqual(['monday'])
    expect(filterLeads(leads, { period: 'week', search: 'emma', now })).toEqual([])
  })
})
