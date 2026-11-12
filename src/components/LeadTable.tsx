import { formatCurrencyEUR, formatDateFR } from '../lib/dates'
import { BOOLEAN_FIELDS } from '../lib/stats'
import type { BooleanField, Lead } from '../lib/types'

type LeadTableProps = {
  leads: Lead[]
  loading?: boolean
  emptyMessage: string
  onToggle: (lead: Lead, field: BooleanField) => void
  onOpenLead: (lead: Lead) => void
}

/** Construit une URL sûre (http/https/mailto uniquement) pour la colonne lien. */
export function externalHref(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '#'
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return trimmed
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(trimmed)) return `mailto:${trimmed}`
  return `https://${trimmed.replace(/^\/+/, '')}`
}

/** Vrai si le lien pointe vers LinkedIn (affichage « LinkedIn »). */
export function isLinkedIn(value: string): boolean {
  return /linkedin/i.test(value)
}

export default function LeadTable({ leads, loading = false, emptyMessage, onToggle, onOpenLead }: LeadTableProps) {
  if (loading) {
    return (
      <div className="table-state" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>Chargement de vos leads…</p>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="table-state" role="status">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <table className="leads-table">
        <caption className="sr-only">
          Liste des leads : coordonnées, étapes de prospection, commission et date de dernière action.
        </caption>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Poste</th>
            <th scope="col">Société</th>
            <th scope="col">LinkedIn/Email</th>
            <th scope="col">Téléphone</th>
            <th scope="col">Adresse</th>
            {BOOLEAN_FIELDS.map(({ field, label }) => (
              <th key={field} scope="col" className="col-check">
                {label}
              </th>
            ))}
            <th scope="col" className="col-num">
              Commission
            </th>
            <th scope="col" className="col-date">
              Dernière action
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <th scope="row" className="col-name">
                <button type="button" className="link-button" onClick={() => onOpenLead(lead)} title="Modifier ce lead">
                  {lead.nom}
                </button>
              </th>
              <td>{lead.poste ?? '—'}</td>
              <td>{lead.societe ?? '—'}</td>
              <td className="col-link">
                {lead.lien ? (
                  <a href={externalHref(lead.lien)} target="_blank" rel="noopener noreferrer">
                    {isLinkedIn(lead.lien) ? 'LinkedIn' : lead.lien}
                  </a>
                ) : (
                  '—'
                )}
              </td>
              <td>{lead.tel ?? '—'}</td>
              <td>{lead.adresse ?? '—'}</td>
              {BOOLEAN_FIELDS.map(({ field, label }) => {
                const inputId = `lead-${lead.id}-${field}`
                return (
                  <td key={field} className="col-check">
                    <input
                      type="checkbox"
                      id={inputId}
                      checked={Boolean(lead[field])}
                      onChange={() => onToggle(lead, field)}
                      aria-labelledby={`${inputId}-label`}
                    />
                    <label id={`${inputId}-label`} className="sr-only" htmlFor={inputId}>
                      {`${label} pour ${lead.nom}`}
                    </label>
                  </td>
                )
              })}
              <td className="col-num">{formatCurrencyEUR(Number(lead.commission) || 0)}</td>
              <td className="col-date">{formatDateFR(lead.last)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
