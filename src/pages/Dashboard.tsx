import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import LeadDialog from '../components/LeadDialog'
import LeadTable from '../components/LeadTable'
import StatsPanel from '../components/StatsPanel'
import { analyzeCsvText, type ImportReport } from '../lib/csv'
import { todayISO, type Period } from '../lib/dates'
import { LEADS_TABLE, supabase } from '../lib/supabase'
import { filterLeads, PERIODS } from '../lib/stats'
import type { BooleanField, Lead, LeadInput } from '../lib/types'

type Feedback = { type: 'success' | 'error'; message: string }

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('all')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [pendingImport, setPendingImport] = useState<{
    fileName: string
    leads: LeadInput[]
    ignored: number
    report: ImportReport
  } | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase
      .from(LEADS_TABLE)
      .select('*')
      .order('last', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      setLoadError('Impossible de charger vos leads. Vérifiez votre connexion puis réessayez.')
      setLeads([])
    } else {
      setLeads((data ?? []) as Lead[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadLeads()
  }, [loadLeads])

  const filteredLeads = useMemo(() => filterLeads(leads, { period, search }), [leads, period, search])

  /** Mise à jour optimiste d'une case à cocher : `last` passe à la date du jour. */
  const handleToggle = async (lead: Lead, field: BooleanField) => {
    const nextValue = !lead[field]
    const today = todayISO()
    const previousValue = lead[field]
    const previousLast = lead.last

    setLeads((current) =>
      current.map((item) => (item.id === lead.id ? { ...item, [field]: nextValue, last: today } : item)),
    )

    const { error } = await supabase
      .from(LEADS_TABLE)
      .update({ [field]: nextValue, last: today })
      .eq('id', lead.id)

    if (error) {
      // Retour arrière : on restaure la valeur et la date précédentes.
      setLeads((current) =>
        current.map((item) =>
          item.id === lead.id ? { ...item, [field]: previousValue, last: previousLast } : item,
        ),
      )
      setFeedback({
        type: 'error',
        message: "La modification n'a pas pu être enregistrée. Vérifiez votre connexion puis réessayez.",
      })
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/connexion', { replace: true })
  }

  const openCreate = () => {
    setEditingLead(null)
    setDialogOpen(true)
  }

  const openEdit = (lead: Lead) => {
    setEditingLead(lead)
    setDialogOpen(true)
  }

  const handleDialogDone = (message: string) => {
    setDialogOpen(false)
    setEditingLead(null)
    setFeedback({ type: 'success', message })
    void loadLeads()
  }

  /**
   * Import CSV en deux temps :
   * 1. analyse automatique du fichier (séparateur, en-têtes, colonnes) ;
   * 2. présentation du résultat — rien n'est écrit tant que l'utilisateur n'a pas confirmé.
   */
  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const result = analyzeCsvText(text)

      if (!result.ok) {
        setFeedback({ type: 'error', message: result.error })
        return
      }

      setPendingImport({
        fileName: file.name,
        leads: result.leads,
        ignored: result.ignored,
        report: result.report,
      })
    } catch {
      setFeedback({
        type: 'error',
        message: "Le fichier n'a pas pu être lu. Vérifiez qu'il s'agit bien d'un fichier CSV.",
      })
    }
  }

  const cancelImport = () => {
    setPendingImport(null)
    setImporting(false)
  }

  const confirmImport = async () => {
    if (!pendingImport || !user) return

    setImporting(true)
    const payload = pendingImport.leads.map((lead) => ({ ...lead, user_id: user.id }))
    const { error } = await supabase.from(LEADS_TABLE).insert(payload)
    setImporting(false)

    if (error) {
      setFeedback({ type: 'error', message: "L'import a échoué. Aucune donnée n'a été enregistrée." })
      return
    }

    const details = [
      `${payload.length} lead(s) importé(s)`,
      `séparateur ${pendingImport.report.delimiterLabel}`,
      pendingImport.ignored > 0 ? `${pendingImport.ignored} ligne(s) ignorée(s)` : null,
    ].filter(Boolean)

    setPendingImport(null)
    setFeedback({ type: 'success', message: `${details.join(' · ')}.` })
    await loadLeads()
  }

  const emptyMessage =
    leads.length === 0
      ? "Aucun lead pour l'instant. Ajoutez votre premier lead ou importez un export CSV Notion."
      : search.trim() !== ''
        ? 'Aucun lead ne correspond à votre recherche.'
        : 'Aucun lead sur cette période.'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              S
            </span>
            <span>Silavia</span>
          </div>
          <div className="header-right">
            <span className="user-email" title={user?.email ?? ''}>
              {user?.email}
            </span>
            <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard">
        <section className="panel leads-panel card" aria-labelledby="leads-title">
          <div className="panel-head">
            <div>
              <h1 id="leads-title">Leads</h1>
              <p className="muted">
                {filteredLeads.length} lead{filteredLeads.length > 1 ? 's' : ''} affiché
                {filteredLeads.length > 1 ? 's' : ''} sur {leads.length}.
              </p>
            </div>
            <div className="toolbar-actions">
              <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
                Importer un CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleImport}
                hidden
              />
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                Ajouter un lead
              </button>
            </div>
          </div>

          <div className="toolbar">
            <div className="search-field">
              <label className="sr-only" htmlFor="lead-search">
                Rechercher un lead
              </label>
              <input
                id="lead-search"
                type="search"
                placeholder="Rechercher (nom, poste, société, téléphone, adresse)…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="tabs" role="group" aria-label="Filtrer par période">
              {PERIODS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`tab${period === value ? ' is-active' : ''}`}
                  aria-pressed={period === value}
                  onClick={() => setPeriod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loadError ? (
            <p className="alert alert-error" role="alert">
              {loadError}
            </p>
          ) : null}

          <LeadTable
            leads={filteredLeads}
            loading={loading}
            emptyMessage={emptyMessage}
            onToggle={handleToggle}
            onOpenLead={openEdit}
          />
        </section>

        <aside className="panel stats-panel card" aria-labelledby="performance-title">
          <StatsPanel leads={filteredLeads} />
        </aside>
      </main>

      <LeadDialog
        open={dialogOpen}
        lead={editingLead}
        userId={user?.id ?? ''}
        onClose={() => {
          setDialogOpen(false)
          setEditingLead(null)
        }}
        onDone={handleDialogDone}
        onError={(message) => setFeedback({ type: 'error', message })}
      />

      {pendingImport ? (
        <div className="dialog-overlay">
          <div className="dialog card" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <header className="dialog-header">
              <h2 id="import-title">Import CSV — analyse automatique</h2>
              <button type="button" className="icon-button" onClick={cancelImport} aria-label="Fermer la fenêtre">
                ✕
              </button>
            </header>
            <p className="muted">
              {pendingImport.fileName} · {pendingImport.report.dataRows} ligne(s) de données · séparateur{' '}
              {pendingImport.report.delimiterLabel} · en-têtes ligne {pendingImport.report.headerRowNumber}
            </p>

            <h3 className="import-subtitle">Colonnes reconnues</h3>
            <ul className="import-columns">
              {pendingImport.report.fields.map((field) => (
                <li key={field.field}>
                  <span className="import-field">{field.label}</span>
                  <span className="import-header">← {field.header}</span>
                  <span
                    className={`badge badge-${field.confidence >= 100 ? 'high' : field.confidence >= 60 ? 'mid' : 'low'}`}
                  >
                    {field.reason === 'entete' ? 'en-tête' : field.reason === 'partiel' ? 'approchant' : 'déduit'}
                  </span>
                </li>
              ))}
            </ul>

            {pendingImport.report.ignoredHeaders.length > 0 ? (
              <p className="muted">Colonnes ignorées : {pendingImport.report.ignoredHeaders.join(', ')}</p>
            ) : null}

            {pendingImport.report.warnings.length > 0 ? (
              <ul className="import-warnings">
                {pendingImport.report.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            <p className="muted">
              Aperçu : {pendingImport.leads.slice(0, 3).map((lead) => lead.nom).join(', ')}
              {pendingImport.leads.length > 3 ? '…' : ''}
            </p>

            <div className="dialog-actions">
              <span className="spacer" />
              <button type="button" className="btn" onClick={cancelImport} disabled={importing}>
                Annuler
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmImport} disabled={importing}>
                {importing
                  ? 'Import…'
                  : `Importer ${pendingImport.leads.length} lead${pendingImport.leads.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div className={`toast toast-${feedback.type}`} role="status" aria-live="polite">
          <span>{feedback.message}</span>
          <button type="button" className="icon-button" onClick={() => setFeedback(null)} aria-label="Fermer le message">
            ✕
          </button>
        </div>
      ) : null}
    </div>
  )
}
