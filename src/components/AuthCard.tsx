import type { ReactNode } from 'react'

type AuthCardProps = {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

/** Coquille commune aux pages d'authentification. */
export default function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="auth-page">
      <main className="auth-card card">
        <p className="auth-brand">Silavia</p>
        <h1 className="auth-title">{title}</h1>
        {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </main>
    </div>
  )
}
