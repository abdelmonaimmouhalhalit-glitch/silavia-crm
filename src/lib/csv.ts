import { parseNotionDate, todayISO } from './dates'
import { compactText, normalizeText } from './text'
import type { LeadInput } from './types'

/* =============================================================================
   Champs métier et libellés
   ============================================================================= */

export type CsvField =
  | 'nom'
  | 'poste'
  | 'societe'
  | 'lien'
  | 'tel'
  | 'adresse'
  | 'commission'
  | 'last'
  | 'outreach'
  | 'reponse'
  | 'rdv'
  | 'present'
  | 'pitch'
  | 'close'

export const FIELD_LABELS: Record<CsvField, string> = {
  nom: 'Nom',
  poste: 'Poste',
  societe: 'Société',
  lien: 'LinkedIn/Email',
  tel: 'Téléphone',
  adresse: 'Adresse',
  commission: 'Commission',
  last: 'Dernière action',
  outreach: 'Outreach',
  reponse: 'Réponse',
  rdv: 'RDV pris',
  present: 'RDV tenu',
  pitch: 'Pitch',
  close: 'Closing',
}

/** Ordre utilisé pour l'affichage et pour départager les heuristiques. */
const FIELD_ORDER: CsvField[] = [
  'nom',
  'poste',
  'societe',
  'lien',
  'tel',
  'adresse',
  'commission',
  'last',
  'outreach',
  'reponse',
  'rdv',
  'present',
  'pitch',
  'close',
]

/* =============================================================================
   Détection automatique du séparateur
   ============================================================================= */

export type CsvDelimiter = ',' | ';' | '\t' | '|'

const DELIMITERS: CsvDelimiter[] = [',', ';', '\t', '|']

export const DELIMITER_LABELS: Record<CsvDelimiter, string> = {
  ',': 'virgule ( , )',
  ';': 'point-virgule ( ; )',
  '\t': 'tabulation',
  '|': 'barre verticale ( | )',
}

function mode(values: number[]): number {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best = 0
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value > best)) {
      best = value
      bestCount = count
    }
  }
  return best
}

/**
 * Analyse les premières lignes pour choisir le séparateur le plus probable :
 * on retient celui qui produit le plus de colonnes de façon *cohérente*
 * d'une ligne à l'autre (`,` `;` tabulation `|`).
 */
export function detectDelimiter(text: string): CsvDelimiter {
  let best: CsvDelimiter = ','
  let bestScore = 0

  for (const delimiter of DELIMITERS) {
    const rows = parseCsvRows(text, delimiter).slice(0, 25)
    if (rows.length === 0) continue
    const counts = rows.map((row) => row.length)
    const columns = mode(counts)
    if (columns < 2) continue
    const consistency = counts.filter((count) => count === columns).length / counts.length
    // On privilégie un grand nombre de colonnes, mais seulement si la structure est stable.
    const score = (columns - 1) * consistency * consistency
    if (score > bestScore) {
      bestScore = score
      best = delimiter
    }
  }

  return best
}

/* =============================================================================
   Parser CSV (RFC 4180)
   ============================================================================= */

function parseCsvRows(text: string, delimiter: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === delimiter) {
      endField()
      continue
    }
    if (char === '\r') {
      if (source[i + 1] === '\n') i += 1
      endRow()
      continue
    }
    if (char === '\n') {
      endRow()
      continue
    }
    field += char
  }

  endField()
  rows.push(row)

  // On ignore les lignes totalement vides (fin de fichier, lignes blanches…).
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

/** Parse un CSV ; le séparateur est détecté automatiquement si non fourni. */
export function parseCsv(text: string, delimiter?: CsvDelimiter): string[][] {
  return parseCsvRows(text, delimiter ?? detectDelimiter(text))
}

/* =============================================================================
   Valeurs : booléens, montants, e-mails, téléphones, dates
   ============================================================================= */

const TRUE_VALUES = new Set(['yes', 'true', 'oui', '1', 'vrai', 'x', 'y', 'ok', '✓', '✔', 'v'])
const FALSE_VALUES = new Set(['no', 'false', 'non', '0', 'faux', '', '-', '✗', '✘'])

/** Interprète une case à cocher (`Yes`, `true`, `oui`, `1`, `✓`…). */
export function parseBoolean(value: string | null | undefined): boolean {
  if (!value) return false
  return TRUE_VALUES.has(normalizeText(value))
}

function isBooleanCell(value: string): boolean {
  const normalized = normalizeText(value)
  return TRUE_VALUES.has(normalized) || (FALSE_VALUES.has(normalized) && normalized !== '')
}

/** Convertit « 1 250,50 € » ou « 1250.5 » en nombre. */
export function parseAmount(value: string | null | undefined): number {
  if (!value) return 0
  const cleaned = value.replace(/[^\d,.-]/g, '')
  if (!cleaned) return 0
  const normalized =
    cleaned.includes(',') && cleaned.includes('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const EMAIL_OR_URL = /(@|https?:\/\/|www\.|linkedin\.|\.com\/|\.fr\/)/i
const PHONE_LOOKING = /^[+()\d\s.\-/]{6,}$/

const isPhoneCell = (value: string): boolean =>
  PHONE_LOOKING.test(value) && (value.match(/\d/g) ?? []).length >= 6

const isNumberCell = (value: string): boolean =>
  /^-?\d{1,3}([ .]\d{3})*([.,]\d+)?\s*(€|\$|eur)?$/i.test(value.trim())

/** Détection stricte de date (on évite que `new Date('42')` produise une fausse date). */
const looksLikeDate = (value: string): boolean => {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return true
  if (/^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(trimmed)) return true
  if (/^[A-Za-zÀ-ÿ]+\s+\d{1,2},?\s+\d{4}$/.test(trimmed)) return true
  if (/^\d{1,2}\s+[A-Za-zÀ-ÿ]+\.?\s+\d{4}$/.test(trimmed)) return true
  return false
}

const emptyToNull = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/* =============================================================================
   Correspondance des colonnes
   ============================================================================= */

/**
 * Alias connus, normalisés (minuscules, sans accents ni ponctuation).
 * `compactText` transforme « Company Name » en « companyname »,
 * « Email/LinkedIn » en « emaillinkedin », etc.
 */
const ALIASES: Record<CsvField, string[]> = {
  nom: ['name', 'nom', 'fullname', 'nomcomplet', 'nomeprenom', 'prospect', 'lead', 'contact'],
  poste: [
    'job',
    'poste',
    'jobtitle',
    'titre',
    'fonction',
    'role',
    'metier',
    'position',
    'intitule',
    'intituleposte',
  ],
  societe: [
    'companyname',
    'company',
    'societe',
    'entreprise',
    'organisation',
    'organization',
    'boite',
    'cabinet',
    'structure',
  ],
  lien: [
    'emaillinkedin',
    'emailetlinkedin',
    'emailoulinkedin',
    'linkedinemail',
    'linkedin',
    'linkedinurl',
    'email',
    'mail',
    'courriel',
    'lien',
    'link',
    'url',
    'profil',
    'profile',
    'siteweb',
  ],
  tel: ['phone', 'telephone', 'tel', 'phonenumber', 'numerodetelephone', 'mobile', 'portable', 'gsm', 'fixe'],
  adresse: ['address', 'adresse', 'adressepostale', 'localisation', 'location', 'ville', 'city', 'pays', 'country'],
  commission: ['commission', 'commissioneuros', 'commissiontotale', 'montant', 'ca', 'chiffreaffaires', 'revenue'],
  last: [
    'last',
    'lastaction',
    'lastcontact',
    'derniereaction',
    'derniereactiondate',
    'derniereinteraction',
    'derniercontact',
    'date',
    'dateaction',
  ],
  outreach: ['outreach', 'premiercontact', 'contacte', 'contactinitial', 'prisecontact'],
  reponse: ['response', 'reponse', 'reponserecue', 'reponseclient', 'answer', 'retour'],
  rdv: ['book', 'booked', 'bookedmeeting', 'booking', 'rdv', 'rdvpris', 'rendezvous', 'meeting'],
  present: ['show', 'showup', 'showed', 'rdvtenu', 'present', 'attended', 'rendezvoustenus'],
  pitch: ['pitch', 'pitchdone', 'pitchrealise', 'presentation', 'demo', 'demonstration'],
  close: ['close', 'closed', 'closing', 'signe', 'conclu', 'won', 'gagne', 'client'],
}

export type MatchReason = 'entete' | 'partiel' | 'contenu' | 'aucun'

type FieldMatch = { field: CsvField; confidence: number; reason: MatchReason }

const ALIAS_ENTRIES = FIELD_ORDER.map((field) => [field, ALIASES[field]] as [CsvField, string[]])

/** Tente de reconnaître un en-tête de colonne (exact, puis approchant). */
function matchHeader(header: string): FieldMatch | null {
  const compact = compactText(header)
  if (!compact) return null

  for (const [field, aliases] of ALIAS_ENTRIES) {
    if (aliases.includes(compact)) return { field, confidence: 100, reason: 'entete' }
  }

  const tokens = normalizeText(header)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

  for (const [field, aliases] of ALIAS_ENTRIES) {
    for (const alias of aliases) {
      // « Company Name » -> tokens [company, name] : on ne teste que des mots entiers
      // pour éviter que « prénom » contienne « nom ».
      if (alias.length >= 3 && tokens.includes(alias)) return { field, confidence: 70, reason: 'partiel' }
      if (alias.length >= 5 && compact.startsWith(alias)) return { field, confidence: 60, reason: 'partiel' }
    }
  }

  return null
}

type ColumnStats = {
  values: number
  emailOrUrl: number
  phone: number
  date: number
  number: number
  boolean: number
  text: number
}

function analyseColumn(values: string[]): ColumnStats {
  const stats: ColumnStats = { values: 0, emailOrUrl: 0, phone: 0, date: 0, number: 0, boolean: 0, text: 0 }
  for (const raw of values) {
    const value = raw.trim()
    if (!value) continue
    stats.values += 1
    if (EMAIL_OR_URL.test(value) && !value.includes(' ')) stats.emailOrUrl += 1
    if (isPhoneCell(value)) stats.phone += 1
    if (looksLikeDate(value)) stats.date += 1
    if (isNumberCell(value)) stats.number += 1
    if (isBooleanCell(value)) stats.boolean += 1
    if (/[A-Za-zÀ-ÿ]{2,}/.test(value)) stats.text += 1
  }
  return stats
}

const ratio = (part: number, total: number): number => (total === 0 ? 0 : part / total)

/**
 * Devine un champ à partir du *contenu* de la colonne (utilisé seulement
 * quand aucun en-tête ne permet de la reconnaître).
 */
function inferFromContent(stats: ColumnStats, assigned: Set<CsvField>): FieldMatch | null {
  if (stats.values === 0) return null

  if (!assigned.has('lien') && ratio(stats.emailOrUrl, stats.values) >= 0.7) {
    return { field: 'lien', confidence: 65, reason: 'contenu' }
  }
  if (!assigned.has('tel') && ratio(stats.phone, stats.values) >= 0.7) {
    return { field: 'tel', confidence: 65, reason: 'contenu' }
  }
  if (!assigned.has('last') && ratio(stats.date, stats.values) >= 0.7) {
    return { field: 'last', confidence: 65, reason: 'contenu' }
  }
  if (!assigned.has('commission') && ratio(stats.number, stats.values) >= 0.8) {
    return { field: 'commission', confidence: 40, reason: 'contenu' }
  }
  if (
    !assigned.has('nom') &&
    ratio(stats.text, stats.values) >= 0.8 &&
    ratio(stats.number + stats.date, stats.values) < 0.3
  ) {
    return { field: 'nom', confidence: 35, reason: 'contenu' }
  }
  return null
}

/* =============================================================================
   Rapport d'import
   ============================================================================= */

export type ImportReport = {
  /** Séparateur détecté. */
  delimiter: CsvDelimiter
  delimiterLabel: string
  /** Numéro (1-based) de la ligne d'en-têtes détectée. */
  headerRowNumber: number
  /** Index (0-based) de cette ligne dans le fichier filtré. */
  headerRowIndex: number
  /** Colonnes reconnues, dans l'ordre des champs Silavia. */
  fields: { field: CsvField; label: string; header: string; confidence: number; reason: MatchReason }[]
  /** En-têtes du fichier non utilisés. */
  ignoredHeaders: string[]
  /** Nombre de lignes de données détectées. */
  dataRows: number
  warnings: string[]
}

export type CsvImportResult =
  | { ok: true; leads: LeadInput[]; ignored: number; report: ImportReport }
  | { ok: false; error: string; report?: ImportReport }

const emptyReport = (): ImportReport => ({
  delimiter: ',',
  delimiterLabel: DELIMITER_LABELS[','],
  headerRowNumber: 1,
  headerRowIndex: 0,
  fields: [],
  ignoredHeaders: [],
  dataRows: 0,
  warnings: [],
})

/* =============================================================================
   Pipeline d'analyse
   ============================================================================= */

/** Trouve la ligne d'en-têtes : celle qui ressemble le plus à des titres de colonnes. */
function findHeaderRow(rows: string[][]): number {
  let bestIndex = 0
  let bestScore = Number.NEGATIVE_INFINITY

  for (let index = 0; index < Math.min(rows.length, 12); index += 1) {
    const cells = rows[index].map((cell) => cell.trim()).filter(Boolean)
    if (cells.length < 2) continue

    const recognised = cells.filter((cell) => matchHeader(cell) !== null).length
    const textCells = cells.filter((cell) => /[A-Za-zÀ-ÿ]{2,}/.test(cell)).length
    const score = recognised * 10 + (textCells / cells.length) * 3 - index * 0.5

    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }

  return bestIndex
}

function mapColumns(rows: string[][], headerIndex: number): {
  mapping: Partial<Record<CsvField, number>>
  fields: ImportReport['fields']
  ignoredHeaders: string[]
} {
  const headers = rows[headerIndex].map((header) => header.trim())
  const mapping: Partial<Record<CsvField, number>> = {}
  const usedColumns = new Set<number>()
  const fields: ImportReport['fields'] = []

  // 1. Correspondance par en-tête (exacte puis approchante).
  headers.forEach((header, index) => {
    if (!header) return
    const match = matchHeader(header)
    if (!match) return
    const existing = mapping[match.field]
    if (typeof existing === 'number') {
      // Champ déjà pris : on garde la colonne dont l'en-tête est le plus fiable.
      const existingConfidence = fields.find((item) => item.field === match.field)?.confidence ?? 0
      if (match.confidence <= existingConfidence) return
      usedColumns.delete(existing)
      fields.splice(fields.findIndex((item) => item.field === match.field), 1)
    }
    mapping[match.field] = index
    usedColumns.add(index)
    fields.push({
      field: match.field,
      label: FIELD_LABELS[match.field],
      header,
      confidence: match.confidence,
      reason: match.reason,
    })
  })

  // 2. Déduction par le contenu pour les champs encore manquants.
  const dataRows = rows.slice(headerIndex + 1)
  headers.forEach((header, index) => {
    if (usedColumns.has(index)) return
    if (dataRows.every((row) => !row[index]?.trim())) return

    const assigned = new Set(Object.keys(mapping) as CsvField[])
    const values = dataRows.slice(0, 50).map((row) => row[index] ?? '')
    const inference = inferFromContent(analyseColumn(values), assigned)
    if (!inference) return

    mapping[inference.field] = index
    usedColumns.add(index)
    fields.push({
      field: inference.field,
      label: FIELD_LABELS[inference.field],
      header: header || `Colonne ${index + 1}`,
      confidence: inference.confidence,
      reason: inference.reason,
    })
  })

  const ignoredHeaders = headers.filter((header, index) => header !== '' && !usedColumns.has(index))

  // Ordre stable : ordre des champs Silavia.
  fields.sort((a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field))

  return { mapping, fields, ignoredHeaders }
}

function buildLeads(
  rows: string[][],
  headerIndex: number,
  mapping: Partial<Record<CsvField, number>>,
): { leads: LeadInput[]; ignored: number; dateFallbacks: number } {
  const leads: LeadInput[] = []
  let ignored = 0
  let dateFallbacks = 0

  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some((cell) => cell.trim() !== '')) continue

    const cell = (field: CsvField): string => {
      const index = mapping[field]
      return typeof index === 'number' && index < row.length ? (row[index] ?? '').trim() : ''
    }

    const nom = cell('nom')
    if (!nom) {
      ignored += 1
      continue
    }

    const lastRaw = cell('last')
    let last = todayISO()
    if (lastRaw) {
      const parsed = parseNotionDate(lastRaw)
      if (parsed) last = parsed
      else dateFallbacks += 1
    }

    leads.push({
      nom,
      poste: emptyToNull(cell('poste')),
      societe: emptyToNull(cell('societe')),
      lien: emptyToNull(cell('lien')),
      tel: emptyToNull(cell('tel')),
      adresse: emptyToNull(cell('adresse')),
      commission: parseAmount(cell('commission')),
      last,
      outreach: parseBoolean(cell('outreach')),
      reponse: parseBoolean(cell('reponse')),
      rdv: parseBoolean(cell('rdv')),
      present: parseBoolean(cell('present')),
      pitch: parseBoolean(cell('pitch')),
      close: parseBoolean(cell('close')),
    })
  }

  return { leads, ignored, dateFallbacks }
}

function finalize(
  rows: string[][],
  delimiter: CsvDelimiter,
  headerIndex: number,
): CsvImportResult {
  const report = emptyReport()
  report.delimiter = delimiter
  report.delimiterLabel = DELIMITER_LABELS[delimiter]
  report.headerRowIndex = headerIndex
  report.headerRowNumber = headerIndex + 1

  if (rows.length === 0) {
    return { ok: false, error: 'Le fichier CSV est vide.', report }
  }

  const { mapping, fields, ignoredHeaders } = mapColumns(rows, headerIndex)
  report.fields = fields
  report.ignoredHeaders = ignoredHeaders
  report.dataRows = rows.slice(headerIndex + 1).length

  if (typeof mapping.nom !== 'number') {
    const found = rows[headerIndex].map((header) => header.trim()).filter(Boolean).join(', ')
    return {
      ok: false,
      error:
        "Impossible d'identifier la colonne des noms : aucune colonne « Name » (ou équivalent) détectée. " +
        `Colonnes trouvées : ${found || 'aucune'}.`,
      report,
    }
  }

  if (!report.dataRows) {
    return { ok: false, error: 'Aucune ligne de données sous les en-têtes.', report }
  }

  const { leads, ignored, dateFallbacks } = buildLeads(rows, headerIndex, mapping)

  if (typeof mapping.last !== 'number') {
    report.warnings.push(
      'Aucune colonne de date reconnue : « Dernière action » prendra la date du jour pour tous les leads.',
    )
  }
  if (dateFallbacks > 0) {
    report.warnings.push(
      `${dateFallbacks} date(s) illisible(s) remplacée(s) par la date du jour.`,
    )
  }
  const booleanFields: CsvField[] = ['outreach', 'reponse', 'rdv', 'present', 'pitch', 'close']
  if (!booleanFields.some((field) => typeof mapping[field] === 'number')) {
    report.warnings.push(
      "Aucune colonne d'étapes (Outreach, Réponse, RDV…) reconnue : toutes les cases resteront décochées.",
    )
  }
  if (ignoredHeaders.length > 0) {
    report.warnings.push(`${ignoredHeaders.length} colonne(s) non reconnue(s) ignorée(s).`)
  }
  if (ignored > 0) {
    report.warnings.push(`${ignored} ligne(s) sans nom ignorée(s).`)
  }

  if (leads.length === 0) {
    return { ok: false, error: 'Aucune ligne exploitable : la colonne des noms est vide partout.', report }
  }

  return { ok: true, leads, ignored, report }
}

/**
 * Analyse automatique d'un texte CSV :
 * détecte le séparateur, la ligne d'en-têtes, les colonnes (par en-tête puis par
 * contenu), normalise les valeurs et renvoie un rapport détaillé de ce qui a été
 * compris — sans rien écrire en base.
 */
export function analyzeCsvText(text: string): CsvImportResult {
  if (!text.trim()) return { ok: false, error: 'Le fichier CSV est vide.' }
  const delimiter = detectDelimiter(text)
  const rows = parseCsvRows(text, delimiter)
  if (rows.length === 0) return { ok: false, error: 'Le fichier CSV est vide.' }
  return finalize(rows, delimiter, findHeaderRow(rows))
}

/** Analyse des lignes déjà découpées (l'en-tête est détecté automatiquement). */
export function notionRowsToLeads(rows: string[][]): CsvImportResult {
  const cleaned = rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
  if (cleaned.length === 0) return { ok: false, error: 'Le fichier CSV est vide.' }
  return finalize(cleaned, ',', findHeaderRow(cleaned))
}

/** Raccourci historique : analyse complète d'un export Notion. */
export function parseNotionCsv(text: string): CsvImportResult {
  return analyzeCsvText(text)
}
