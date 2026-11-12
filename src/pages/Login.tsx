import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import { useAuth } from '../auth/AuthProvider'
import { validateEmail, validatePassword } from '../lib/validation'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { from?: string } | null
  // On n'accepte qu'un chemin interne (jamais `//domaine` ni un antislash),
  // pour éviter toute redirection ouverte après connexion.
  const requestedPath = state?.from
  const target =
    typeof requestedPath === 'string' && /^\/(?!\/)[^\\]*$/.test(requestedPath) ? requestedPath : '/tableau'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Un utilisateur déjà connecté est renvoyé vers l'application.
  if (!loading && user) {
    return <Navigate to={target} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setError(null)
    setSubmitting(true)
    const { error: authError } = await signIn(email, password)
    setSubmitting(false)

    if (authError) {
      setError(authError)
      return
    }
    navigate(target, { replace: true })
  }

  return (
    <AuthCard
      title="Connexion"
      subtitle="Accédez à votre suivi de prospection Silavia."
      footer={
        <p>
          Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
        </p>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        {error ? (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="login-email">Adresse email</label>
          <input
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Mot de passe</label>
          <input
            id="login-password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            aria-describedby="login-password-help"
          />
          <small id="login-password-help" className="muted">
            8 caractères minimum.
          </small>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>

        <p className="auth-links">
          <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </p>
      </form>
    </AuthCard>
  )
}
