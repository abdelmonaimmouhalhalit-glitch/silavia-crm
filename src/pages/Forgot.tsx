import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import { useAuth } from '../auth/AuthProvider'
import { validateEmail } from '../lib/validation'

export default function Forgot() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }

    setError(null)
    setSubmitting(true)
    const { error: authError } = await requestPasswordReset(email)
    setSubmitting(false)

    if (authError) {
      setError(authError)
      return
    }

    // Message volontairement générique : on ne révèle pas si le compte existe.
    setMessage(
      'Si un compte existe avec cette adresse, un email contenant un lien de réinitialisation vient d’être envoyé. Pensez à vérifier vos courriers indésirables.',
    )
  }

  return (
    <AuthCard
      title="Mot de passe oublié"
      subtitle="Recevez un lien sécurisé pour définir un nouveau mot de passe."
      footer={
        <p>
          <Link to="/connexion">Retour à la connexion</Link>
        </p>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        {error ? (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="alert alert-success" role="status">
            {message}
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="forgot-email">Adresse email</label>
          <input
            id="forgot-email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
        </button>
      </form>
    </AuthCard>
  )
}
