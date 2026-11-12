import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import { useAuth } from '../auth/AuthProvider'
import { LoadingScreen } from '../auth/RequireAuth'
import { validatePassword, validatePasswordConfirmation } from '../lib/validation'

export default function Reset() {
  const { user, loading, updatePassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return <LoadingScreen message="Vérification du lien de réinitialisation…" />
  }

  // Le lien de récupération ouvre une session temporaire. Sans session,
  // le lien est invalide, expiré ou a déjà été utilisé.
  if (!user) {
    return (
      <AuthCard
        title="Lien invalide ou expiré"
        subtitle="Ce lien de réinitialisation n’est plus valable."
        footer={
          <p>
            <Link to="/connexion">Retour à la connexion</Link>
          </p>
        }
      >
        <p className="muted">
          Pour des raisons de sécurité, les liens de réinitialisation sont temporaires et à usage unique. Demandez-en
          un nouveau.
        </p>
        <Link className="btn btn-primary btn-block" to="/mot-de-passe-oublie">
          Demander un nouveau lien
        </Link>
      </AuthCard>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError =
      validatePassword(password) ?? validatePasswordConfirmation(password, confirmation)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSubmitting(true)
    const { error: authError } = await updatePassword(password)
    setSubmitting(false)

    if (authError) {
      setError(authError)
      return
    }

    setSuccess('Votre mot de passe a été mis à jour. Vous pouvez continuer à utiliser votre espace.')
    setPassword('')
    setConfirmation('')
  }

  return (
    <AuthCard
      title="Nouveau mot de passe"
      subtitle={`Compte : ${user.email ?? ''}`}
      footer={
        <p>
          <Link to="/tableau">Aller à mon espace</Link>
        </p>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        {error ? (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="alert alert-success" role="status">
            {success}
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="reset-password">Nouveau mot de passe</label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            aria-describedby="reset-password-help"
          />
          <small id="reset-password-help" className="muted">
            8 caractères minimum.
          </small>
        </div>

        <div className="field">
          <label htmlFor="reset-confirmation">Confirmer le mot de passe</label>
          <input
            id="reset-confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            minLength={8}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </button>
      </form>
    </AuthCard>
  )
}
