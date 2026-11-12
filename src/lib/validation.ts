export const PASSWORD_MIN_LENGTH = 8

export function isValidEmail(email: string): boolean {
  const value = email.trim()
  if (!value || value.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Merci de saisir votre adresse email.'
  if (!isValidEmail(email)) return 'Merci de saisir une adresse email valide.'
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Merci de saisir un mot de passe.'
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`
  }
  return null
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (password !== confirmation) return 'Les deux mots de passe ne correspondent pas.'
  return null
}
