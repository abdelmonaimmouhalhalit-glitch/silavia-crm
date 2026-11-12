import { describe, expect, it } from 'vitest'
import {
  analyzeCsvText,
  detectDelimiter,
  notionRowsToLeads,
  parseAmount,
  parseBoolean,
  parseCsv,
  parseNotionCsv,
} from './csv'
import { todayISO } from './dates'

describe('parseCsv', () => {
  it('découpe des lignes simples', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('gère les guillemets, virgules et retours à la ligne dans les champs', () => {
    const csv = 'Name,Address\n"Dupont, Jean","12 rue de la Paix\n75002 Paris"'
    expect(parseCsv(csv)).toEqual([
      ['Name', 'Address'],
      ['Dupont, Jean', '12 rue de la Paix\n75002 Paris'],
    ])
  })

  it('gère les guillemets échappés', () => {
    const csv = 'Name,Job\n"Le ""Grand"" Paul",CEO'
    expect(parseCsv(csv)).toEqual([
      ['Name', 'Job'],
      ['Le "Grand" Paul', 'CEO'],
    ])
  })

  it('gère CRLF, BOM et lignes vides finales', () => {
    const csv = '\uFEFFName,Job\r\nAlice,CTO\r\n\r\n'
    expect(parseCsv(csv)).toEqual([
      ['Name', 'Job'],
      ['Alice', 'CTO'],
    ])
  })

  it('conserve les champs vides', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']])
  })
})

describe('parseBoolean', () => {
  it('reconnaît les valeurs vraies de Notion', () => {
    for (const value of ['Yes', 'yes', 'true', 'TRUE', 'oui', '1', 'Vrai', ' ✓ ']) {
      expect(parseBoolean(value)).toBe(true)
    }
  })

  it('considère tout le reste comme faux', () => {
    for (const value of ['No', 'false', 'non', '0', '', undefined, 'nope']) {
      expect(parseBoolean(value)).toBe(false)
    }
  })
})

describe('parseAmount', () => {
  it('interprète les formats français et anglais', () => {
    expect(parseAmount('1 250,50 €')).toBe(1250.5)
    expect(parseAmount('1250.5')).toBe(1250.5)
    expect(parseAmount('1.250,00 €')).toBe(1250)
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
  })
})

describe('notionRowsToLeads', () => {
  const rows = [
    [
      'Name',
      'Job',
      'Company Name',
      'Email/LinkedIn',
      'Phone',
      'Address',
      'Commission',
      'Last',
      'Outreach',
      'Response',
      'Book',
      'Show',
      'Pitch',
      'Close',
    ],
    [
      'Marie Curie',
      'CTO',
      'Radium SA',
      'https://linkedin.com/in/marie',
      '0601020304',
      '1 rue Pierre et Marie Curie, Paris',
      '1 200,50 €',
      'October 15, 2026',
      'Yes',
      'oui',
      'Yes',
      'No',
      '1',
      'true',
    ],
    ['Jean Martin', '', '', '', '', '', '', '2026-03-02', 'No', 'No', 'No', 'No', 'No', 'No'],
    ['', 'Sans nom', '', '', '', '', '', '', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ]

  it('détecte les colonnes sans tenir compte de la casse et convertit les valeurs', () => {
    const result = notionRowsToLeads(rows)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.leads).toHaveLength(2)
    expect(result.ignored).toBe(1)

    const [marie, jean] = result.leads
    expect(marie).toEqual({
      nom: 'Marie Curie',
      poste: 'CTO',
      societe: 'Radium SA',
      lien: 'https://linkedin.com/in/marie',
      tel: '0601020304',
      adresse: '1 rue Pierre et Marie Curie, Paris',
      commission: 1200.5,
      last: '2026-10-15',
      outreach: true,
      reponse: true,
      rdv: true,
      present: false,
      pitch: true,
      close: true,
    })

    expect(jean.last).toBe('2026-03-02')
    expect(jean.poste).toBeNull()
    expect(jean.close).toBe(false)
  })

  it('accepte les en-têtes en minuscules et accentués', () => {
    const result = notionRowsToLeads([
      ['nom', 'poste', 'société', 'téléphone', 'adresse', 'commission', 'dernière action', 'réponse', 'close'],
      ['Alice', 'CEO', 'Exemple', '0102030405', 'Lyon', '500', '15 octobre 2026', 'Oui', 'Oui'],
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.leads[0]).toMatchObject({
      nom: 'Alice',
      poste: 'CEO',
      societe: 'Exemple',
      tel: '0102030405',
      adresse: 'Lyon',
      commission: 500,
      last: '2026-10-15',
      reponse: true,
      close: true,
    })
  })

  it('échoue clairement quand aucune colonne de nom ne peut être identifiée', () => {
    const result = notionRowsToLeads([
      ['Col A', 'Col B'],
      ['42', '7'],
      ['99', '3'],
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('Name')
  })

  it('échoue sur un fichier vide', () => {
    const result = notionRowsToLeads([])
    expect(result.ok).toBe(false)
  })

  it('parseNotionCsv enchaîne lecture et conversion', () => {
    const csv = [
      'Name,Company Name,Last,Close',
      '"Durand, Paul",Acme,"December 1, 2026",Yes',
    ].join('\n')

    const result = parseNotionCsv(csv)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.leads[0]).toMatchObject({
      nom: 'Durand, Paul',
      societe: 'Acme',
      last: '2026-12-01',
      close: true,
    })
  })
})

describe('analyse automatique et adaptation du fichier', () => {
  it('détecte le séparateur (virgule, point-virgule, tabulation)', () => {
    expect(detectDelimiter('Name,Job,Company\nAlice,CTO,Acme')).toBe(',')
    expect(detectDelimiter('Nom;Société;Téléphone\nAlice;Acme;0601020304')).toBe(';')
    expect(detectDelimiter('Nom\tSociété\tTéléphone\nAlice\tAcme\t0601020304')).toBe('\t')
  })

  it('adapte un export français séparé par des points-virgules', () => {
    const csv = [
      'Nom;Société;Téléphone;Dernière action;Closing',
      '"Durand; Paul";Acme;0601020304;15/10/2026;Oui',
    ].join('\n')

    const result = analyzeCsvText(csv)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.report.delimiter).toBe(';')
    expect(result.leads[0]).toMatchObject({
      nom: 'Durand; Paul',
      societe: 'Acme',
      tel: '0601020304',
      last: '2026-10-15',
      close: true,
    })
  })

  it('trouve la ligne d’en-têtes malgré une ligne de préambule', () => {
    const csv = ['Export Notion — Silavia', '', 'Name,Job,Company Name', 'Marie Curie,CTO,Radium'].join('\n')

    const result = analyzeCsvText(csv)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.report.headerRowNumber).toBe(2)
    expect(result.leads).toHaveLength(1)
    expect(result.leads[0]).toMatchObject({ nom: 'Marie Curie', poste: 'CTO', societe: 'Radium' })
    // Aucune colonne de date : avertissement explicite.
    expect(result.report.warnings.some((warning) => warning.includes('date'))).toBe(true)
  })

  it('déduit les colonnes à partir du contenu quand les en-têtes sont inconnus', () => {
    const csv = ['Col1,Col2', 'Marie Curie,marie@exemple.fr', 'Jean Martin,jean@exemple.fr'].join('\n')

    const result = analyzeCsvText(csv)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.report.fields.map((field) => field.field)).toEqual(['nom', 'lien'])
    expect(result.report.fields.every((field) => field.reason === 'contenu')).toBe(true)
    expect(result.leads[1]).toMatchObject({ nom: 'Jean Martin', lien: 'jean@exemple.fr' })
  })

  it('signale les dates illisibles et retombe sur la date du jour', () => {
    const result = analyzeCsvText('Name,Last\nAlice,pas une date')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.leads[0].last).toBe(todayISO())
    expect(result.report.warnings.some((warning) => warning.includes('illisible'))).toBe(true)
  })

  it('compte les lignes sans nom et les colonnes inutilisées', () => {
    const result = analyzeCsvText('Name,Inutile\n,abc\nAlice,xyz')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.leads).toHaveLength(1)
    expect(result.ignored).toBe(1)
    expect(result.report.ignoredHeaders).toContain('Inutile')
  })
})
