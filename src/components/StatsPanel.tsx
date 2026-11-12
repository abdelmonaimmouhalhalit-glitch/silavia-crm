import { formatCurrencyEUR } from '../lib/dates'
import { computeStats, type LeadStats } from '../lib/stats'
import type { Lead } from '../lib/types'

const RATE_ROWS: { key: keyof LeadStats; label: string; hint: string }[] = [
  { key: 'outreachRate', label: 'Outreach Rate', hint: 'Outreach ÷ total' },
  { key: 'responseRate', label: 'Response Rate', hint: 'Réponses ÷ outreach' },
  { key: 'bookRate', label: 'Book Rate', hint: 'RDV pris ÷ réponses' },
  { key: 'showRate', label: 'Show Rate', hint: 'RDV tenus ÷ RDV pris' },
  { key: 'pitchRate', label: 'Pitch Rate', hint: 'Pitch ÷ RDV tenus' },
  { key: 'closeRate', label: 'Close Rate', hint: 'Closing ÷ pitch' },
  { key: 'conversionRate', label: 'Conversion Rate', hint: 'Closing ÷ outreach' },
]

const percentFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const numberFormatter = new Intl.NumberFormat('fr-FR')

export function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return `${percentFormatter.format(safe)} %`
}

export default function StatsPanel({ leads }: { leads: Lead[] }) {
  const stats = computeStats(leads)

  return (
    <section className="stats" aria-labelledby="performance-title">
      <header className="stats-header">
        <h2 id="performance-title">Performance</h2>
        <p className="muted">Calculée sur les leads de la période et de la recherche actives.</p>
      </header>

      <ul className="rates">
        {RATE_ROWS.map(({ key, label, hint }) => {
          const value = Number(stats[key])
          const width = Math.min(100, Math.max(0, value))
          return (
            <li key={key} className="rate">
              <div className="rate-head">
                <span className="rate-label">{label}</span>
                <span className="rate-value">{formatPercent(value)}</span>
              </div>
              <div
                className="progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(value)}
                aria-valuetext={formatPercent(value)}
                aria-label={label}
              >
                <span className="progress-fill" style={{ width: `${width}%` }} />
              </div>
              <span className="rate-hint">{hint}</span>
            </li>
          )
        })}
      </ul>

      <dl className="totals">
        <div>
          <dt>Total leads</dt>
          <dd>{numberFormatter.format(stats.total)}</dd>
        </div>
        <div>
          <dt>Réponses</dt>
          <dd>{numberFormatter.format(stats.reponse)}</dd>
        </div>
        <div>
          <dt>Clients closés</dt>
          <dd>{numberFormatter.format(stats.close)}</dd>
        </div>
        <div>
          <dt>Commission totale</dt>
          <dd>{formatCurrencyEUR(stats.commission)}</dd>
        </div>
      </dl>
    </section>
  )
}
