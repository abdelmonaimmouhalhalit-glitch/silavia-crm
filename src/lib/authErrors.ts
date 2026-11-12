/**
 * Traduction des erreurs Supabase en messages français, clairs et volontairement
 * génériques : on ne révèle jamais si un email existe déjà en base.
 */
export function translateAuthError(message?: string | null): string {
  const raw = (message ?? '').toLowerCase()

  if (!raw) return 'Une erreur est survenue. Merci de réessayer.'

  if (raw.includes('invalid login credentials')) {
    return 'Email ou mot de passe incorrect.'
  }
  if (raw.includes('email not confirmed')) {
    return "Votre adresse email n'est pas encore confirmée. Vérifiez votre boîte de réception."
  }
  if (raw.includes('user already registered') || raw.includes('already registered')) {
    return 'Si un compte existe avec cet email, connectez-vous ou réinitialisez votre mot de passe.'
  }
  if (raw.includes('password should be at least') || raw.includes('weak password')) {
    return 'Le mot de passe doit contenir au moins 8 caractères.'
  }
  if (raw.includes('rate limit') || raw.includes('too many requests') || raw.includes('over_email_send_rate_limit')) {
    return 'Trop de tentatives. Merci de réessayer dans quelques instants.'
  }
  if (raw.includes('invalid email') || raw.includes('unable to validate email')) {
    return 'Merci de saisir une adresse email valide.'
  }
  if (raw.includes('same password')) {
    return "Le nouveau mot de passe doit être différent de l'ancien."
  }
  if (raw.includes('auth session missing') || raw.includes('session_not_found')) {
    return 'Votre session a expiré. Merci de demander un nouveau lien de réinitialisation.'
  }
  if (raw.includes('database error saving new user')) {
    return 'La création du compte a échoué. Merci de réessayer plus tard.'
  }

  return 'Une erreur est survenue. Merci de réessayer.'
}
