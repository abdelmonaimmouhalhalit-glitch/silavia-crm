import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import { useAuth } from '../auth/AuthProvider'
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../lib/validation'

export default function Signup() {
  const { user, loading, signUp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to="/tableau" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError =
      validateEmail(email) ?? validatePassword(password) ?? validatePasswordConfirmation(password, confirmation)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setSubmitting(true)
    const { error: authError, needsConfirmation } = await signUp(email, password)
    setSubmitting(false)

    if (authError) {
      setError(authError)
      return
    }

    if (needsConfirmation) {
      setSuccess(
        'Compte créé. Un email de confirmation vient de vous être envoyé : cliquez sur le lien qu’il contient pour activer votre accès.',
      )
      return
    }

    navigate('/tableau', { replace: true })
  }

  return (
    <AuthCard
      title="Créer un compte"
      subtitle="Vos leads restent privés : vous seul pouvez les consulter."
      footer={
        <p>
          Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
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
          <label htmlFor="signup-email">Adresse email</label>
          <input
            id="signup-email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="signup-password">Mot de passe</label>
          <input
            id="signup-password"
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            aria-describedby="signup-password-help"
          />
          <small id="signup-password-help" className="muted">
            8 caractères minimum.
          </small>
        </div>

        <div className="field">
          <label htmlFor="signup-confirmation">Confirmer le mot de passe</label>
          <input
            id="signup-confirmation"
            type="password"
            name="password-confirmation"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            minLength={8}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>
    </AuthCard>
  )
}
