import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { todayISO } from '../lib/dates'
import { LEADS_TABLE, supabase } from '../lib/supabase'
import { BOOLEAN_FIELDS } from '../lib/stats'
import type { Lead, LeadInput } from '../lib/types'

type LeadDialogProps = {
  open: boolean
  lead: Lead | null
  userId: string
  onClose: () => void
  onDone: (message: string) => void
  onError: (message: string) => void
}

type FormState = {
  nom: string
  poste: string
  societe: string
  lien: string
  tel: string
  adresse: string
  commission: string
  last: string
  outreach: boolean
  reponse: boolean
  rdv: boolean
  present: boolean
  pitch: boolean
  close: boolean
}

function toFormState(lead: Lead | null): FormState {
  return {
    nom: lead?.nom ?? '',
    poste: lead?.poste ?? '',
    societe: lead?.societe ?? '',
    lien: lead?.lien ?? '',
    tel: lead?.tel ?? '',
    adresse: lead?.adresse ?? '',
    commission: lead ? String(Number(lead.commission) || 0) : '0',
    last: lead?.last ?? todayISO(),
    outreach: Boolean(lead?.outreach),
    reponse: Boolean(lead?.reponse),
    rdv: Boolean(lead?.rdv),
    present: Boolean(lead?.present),
    pitch: Boolean(lead?.pitch),
    close: Boolean(lead?.close),
  }
}

const emptyToNull = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseCommission(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function LeadDialog({ open, lead, userId, onClose, onDone, onError }: LeadDialogProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(lead))
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const titleId = useId()
  const descId = useId()

  // Réinitialise le formulaire à chaque ouverture.
  useEffect(() => {
    if (!open) return
    setForm(toFormState(lead))
    setFormError(null)
    setSaving(false)
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [open, lead])

  // Fermeture au clavier (Échap).
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.nom.trim()) {
      setFormError('Le nom est obligatoire.')
      return
    }

    const payload: LeadInput = {
      nom: form.nom.trim(),
      poste: emptyToNull(form.poste),
      societe: emptyToNull(form.societe),
      lien: emptyToNull(form.lien),
      tel: emptyToNull(form.tel),
      adresse: emptyToNull(form.adresse),
      commission: parseCommission(form.commission),
      last: form.last || todayISO(),
      outreach: form.outreach,
      reponse: form.reponse,
      rdv: form.rdv,
      present: form.present,
      pitch: form.pitch,
      close: form.close,
    }

    setFormError(null)
    setSaving(true)

    const { error } = lead
      ? await supabase.from(LEADS_TABLE).update(payload).eq('id', lead.id)
      : await supabase.from(LEADS_TABLE).insert({ ...payload, user_id: userId })

    setSaving(false)

    if (error) {
      onError("L'enregistrement a échoué. Vérifiez votre connexion puis réessayez.")
      return
    }

    onDone(lead ? 'Lead mis à jour.' : 'Lead ajouté.')
  }

  const handleDelete = async () => {
    if (!lead) return
    const confirmed = window.confirm(`Supprimer définitivement « ${lead.nom} » ?`)
    if (!confirmed) return

    setSaving(true)
    const { error } = await supabase.from(LEADS_TABLE).delete().eq('id', lead.id)
    setSaving(false)

    if (error) {
      onError('La suppression a échoué. Merci de réessayer.')
      return
    }
    onDone('Lead supprimé.')
  }

  return (
    <div className="dialog-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog card" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
        <header className="dialog-header">
          <h2 id={titleId}>{lead ? 'Modifier le lead' : 'Ajouter un lead'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer la fenêtre">
            ✕
          </button>
        </header>
        <p id={descId} className="muted">
          Les champs marqués d’un astérisque sont obligatoires.
        </p>

        <form className="form" onSubmit={handleSubmit} noValidate>
          {formError ? (
            <p className="alert alert-error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="field">
            <label htmlFor="lead-nom">Nom *</label>
            <input
              id="lead-nom"
              ref={firstFieldRef}
              value={form.nom}
              onChange={(event) => set('nom', event.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="lead-poste">Poste</label>
              <input id="lead-poste" value={form.poste} onChange={(event) => set('poste', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="lead-societe">Société</label>
              <input id="lead-societe" value={form.societe} onChange={(event) => set('societe', event.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="lead-lien">LinkedIn / Email</label>
            <input
              id="lead-lien"
              value={form.lien}
              onChange={(event) => set('lien', event.target.value)}
              placeholder="https://linkedin.com/in/…"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="lead-tel">Téléphone</label>
              <input id="lead-tel" type="tel" value={form.tel} onChange={(event) => set('tel', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="lead-commission">Commission (€)</label>
              <input
                id="lead-commission"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.commission}
                onChange={(event) => set('commission', event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="lead-adresse">Adresse</label>
            <input id="lead-adresse" value={form.adresse} onChange={(event) => set('adresse', event.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="lead-last">Dernière action</label>
            <input
              id="lead-last"
              type="date"
              value={form.last}
              onChange={(event) => set('last', event.target.value)}
            />
          </div>

          <fieldset className="field checks">
            <legend>Étapes de prospection</legend>
            {BOOLEAN_FIELDS.map(({ field, label }) => (
              <label key={field} className="check-label" htmlFor={`lead-${field}`}>
                <input
                  id={`lead-${field}`}
                  type="checkbox"
                  checked={form[field]}
                  onChange={(event) => set(field, event.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>

          <div className="dialog-actions">
            {lead ? (
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                Supprimer
              </button>
            ) : null}
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
