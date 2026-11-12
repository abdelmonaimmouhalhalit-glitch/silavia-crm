// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AuthProvider } from '../auth/AuthProvider'
import { todayISO } from '../lib/dates'
import { fakeState, resetFakeSupabase, type FakeRow, type FakeSession } from '../test-utils/fakeSupabase'

// Remplace le client Supabase réel par le faux client de test.
vi.mock('@supabase/supabase-js', async () => {
  const mod = await import('../test-utils/fakeSupabase')
  return { createClient: () => mod.fakeSupabaseClient }
})

const session: FakeSession = {
  user: { id: 'user-1', email: 'alice@example.com' },
  access_token: 'token-de-test',
}

const makeLead = (overrides: FakeRow = {}): FakeRow => ({
  id: 'lead-1',
  user_id: 'user-1',
  created_at: '2026-01-01T00:00:00.000Z',
  nom: 'Nom par défaut',
  poste: null,
  societe: null,
  lien: null,
  tel: null,
  adresse: null,
  commission: 0,
  last: todayISO(),
  outreach: false,
  reponse: false,
  rdv: false,
  present: false,
  pitch: false,
  close: false,
  ...overrides,
})

function renderApp(initialPath = '/tableau') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  resetFakeSupabase()
})

afterEach(() => {
  cleanup()
})

describe('protection des routes', () => {
  it('redirige vers /connexion quand aucune session n’est active', async () => {
    renderApp('/tableau')
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeTruthy()
    // Le tableau protégé n'est jamais affiché.
    expect(screen.queryByRole('heading', { name: 'Leads' })).toBeNull()
  })

  it('redirige un utilisateur déjà connecté depuis /connexion vers le tableau', async () => {
    resetFakeSupabase({ session, leads: [makeLead({ nom: 'Alice Martin' })] })
    renderApp('/connexion')
    expect(await screen.findByRole('heading', { name: 'Leads' })).toBeTruthy()
  })
})

describe('écran principal', () => {
  it('affiche l’email de l’utilisateur et les leads triés par dernière action', async () => {
    resetFakeSupabase({
      session,
      leads: [
        makeLead({ id: 'l1', nom: 'Ancien lead', last: '2020-01-01' }),
        makeLead({ id: 'l2', nom: 'Lead récent', last: todayISO() }),
      ],
    })

    renderApp()

    expect(await screen.findByText('Lead récent')).toBeTruthy()
    expect(screen.getByText('alice@example.com')).toBeTruthy()

    const names = screen.getAllByRole('rowheader').map((cell) => cell.textContent)
    expect(names).toEqual(['Lead récent', 'Ancien lead'])
  })

  it('met à jour une case à cocher en optimiste et enregistre la date du jour', async () => {
    resetFakeSupabase({ session, leads: [makeLead({ id: 'l1', nom: 'Alice Martin' })] })
    renderApp()

    await screen.findByText('Alice Martin')
    const checkbox = screen.getByLabelText('Outreach pour Alice Martin') as HTMLInputElement
    expect(checkbox.checked).toBe(false)

    fireEvent.click(checkbox)

    // Optimiste : la case est cochée immédiatement.
    expect(checkbox.checked).toBe(true)

    await waitFor(() => expect(fakeState().calls.updates).toHaveLength(1))
    expect(fakeState().calls.updates[0]).toEqual({
      payload: { outreach: true, last: todayISO() },
      filters: { id: 'l1' },
    })
  })

  it('restaure l’état précédent et affiche une erreur si la sauvegarde échoue', async () => {
    resetFakeSupabase({
      session,
      leads: [makeLead({ id: 'l1', nom: 'Alice Martin' })],
      failUpdate: true,
    })
    renderApp()

    await screen.findByText('Alice Martin')
    const checkbox = screen.getByLabelText('Réponse pour Alice Martin') as HTMLInputElement
    fireEvent.click(checkbox)

    await waitFor(() => expect(checkbox.checked).toBe(false))
    expect(await screen.findByText(/n'a pas pu être enregistrée/)).toBeTruthy()
  })

  it('filtre par période et recalcule les statistiques', async () => {
    resetFakeSupabase({
      session,
      leads: [
        makeLead({
          id: 'l1',
          nom: 'Alice Martin',
          last: todayISO(),
          outreach: true,
          reponse: true,
          rdv: true,
          present: true,
          pitch: true,
          close: true,
          commission: 1500,
        }),
        makeLead({ id: 'l2', nom: 'Bob Durand', last: '2020-01-01' }),
      ],
    })

    renderApp()

    await screen.findByText('Alice Martin')
    expect(screen.getByText('Bob Durand')).toBeTruthy()

    // 1 lead en outreach sur 2 leads au total
    expect(
      screen.getByRole('progressbar', { name: 'Outreach Rate' }).getAttribute('aria-valuenow'),
    ).toBe('50')
    // 1 closing pour 1 outreach
    expect(
      screen.getByRole('progressbar', { name: 'Conversion Rate' }).getAttribute('aria-valuenow'),
    ).toBe('100')
    expect(screen.getByText('Total leads').nextElementSibling?.textContent).toBe('2')
    expect(screen.getByText('Clients closés').nextElementSibling?.textContent).toBe('1')
    expect(screen.getByText('Commission totale').nextElementSibling?.textContent).toContain('1')

    fireEvent.click(screen.getByRole('button', { name: 'Cette semaine' }))

    await waitFor(() => expect(screen.queryByText('Bob Durand')).toBeNull())
    expect(screen.getByText('Alice Martin')).toBeTruthy()
    // Un seul lead sur la période filtrée : 1 outreach / 1 lead
    expect(screen.getByText('Total leads').nextElementSibling?.textContent).toBe('1')
    expect(
      screen.getByRole('progressbar', { name: 'Outreach Rate' }).getAttribute('aria-valuenow'),
    ).toBe('100')
  })

  it('recherche dans le tableau', async () => {
    resetFakeSupabase({
      session,
      leads: [
        makeLead({ id: 'l1', nom: 'Alice Martin', societe: 'Société Générale' }),
        makeLead({ id: 'l2', nom: 'Bob Durand', societe: 'Acme' }),
      ],
    })

    renderApp()

    await screen.findByText('Alice Martin')
    fireEvent.change(screen.getByLabelText('Rechercher un lead'), {
      target: { value: 'societe generale' },
    })

    await waitFor(() => expect(screen.queryByText('Bob Durand')).toBeNull())
    expect(screen.getByText('Alice Martin')).toBeTruthy()
  })

  it('importe un CSV Notion et insère les leads par lot', async () => {
    resetFakeSupabase({ session, leads: [] })
    const { container } = renderApp()

    await screen.findByRole('heading', { name: 'Leads' })

    const csv = [
      'Name,Company Name,Last,Close',
      '"Marie Curie",Acme,"October 15, 2026",Yes',
    ].join('\n')
    const file = { name: 'export-notion.csv', text: () => Promise.resolve(csv) } as unknown as File

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    // 1. L'analyse est présentée, rien n'est encore écrit en base.
    expect(await screen.findByText('Import CSV — analyse automatique')).toBeTruthy()
    expect(screen.getByText(/virgule/)).toBeTruthy()
    expect(fakeState().calls.inserts).toHaveLength(0)

    // 2. Après confirmation, insertion groupée.
    fireEvent.click(screen.getByRole('button', { name: /Importer 1 lead/ }))

    await waitFor(() => expect(fakeState().calls.inserts).toHaveLength(1))

    const inserted = fakeState().calls.inserts[0]
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      nom: 'Marie Curie',
      societe: 'Acme',
      last: '2026-10-15',
      close: true,
      user_id: 'user-1',
    })

    expect(await screen.findByText(/1 lead\(s\) importé/)).toBeTruthy()
    expect(await screen.findByText('Marie Curie')).toBeTruthy()
  })

  it('affiche une erreur claire si aucun nom ne peut être identifié dans le CSV', async () => {
    resetFakeSupabase({ session, leads: [] })
    const { container } = renderApp()

    await screen.findByRole('heading', { name: 'Leads' })

    const file = {
      name: 'sans-nom.csv',
      text: () => Promise.resolve('Col A,Col B\n42,7'),
    } as unknown as File

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/« Name »/)).toBeTruthy()
    expect(fakeState().calls.inserts).toHaveLength(0)
  })

  it('ajoute un lead via la modale', async () => {
    resetFakeSupabase({ session, leads: [] })
    renderApp()

    await screen.findByRole('heading', { name: 'Leads' })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un lead' }))

    fireEvent.change(await screen.findByLabelText('Nom *'), { target: { value: 'Nouveau Prospect' } })
    fireEvent.change(screen.getByLabelText('Société'), { target: { value: 'Silavia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(fakeState().calls.inserts).toHaveLength(1))
    expect(fakeState().calls.inserts[0][0]).toMatchObject({
      nom: 'Nouveau Prospect',
      societe: 'Silavia',
      user_id: 'user-1',
      outreach: false,
    })
  })

  it('se déconnecte depuis l’en-tête', async () => {
    resetFakeSupabase({ session, leads: [makeLead({ nom: 'Alice Martin' })] })
    renderApp()

    await screen.findByText('Alice Martin')
    fireEvent.click(screen.getByRole('button', { name: 'Déconnexion' }))

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeTruthy()
    expect(fakeState().calls.signOuts).toBe(1)
  })
})

describe('authentification', () => {
  it('valide les champs du formulaire de connexion en français', async () => {
    renderApp('/connexion')

    await screen.findByRole('heading', { name: 'Connexion' })
    fireEvent.change(screen.getByLabelText('Adresse email'), { target: { value: 'pas-un-email' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'court' } })
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Merci de saisir une adresse email valide.')).toBeTruthy()
    expect(fakeState().calls.signIns).toHaveLength(0)
  })

  it('refuse un mot de passe de moins de 8 caractères', async () => {
    renderApp('/connexion')

    await screen.findByRole('heading', { name: 'Connexion' })
    fireEvent.change(screen.getByLabelText('Adresse email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'court' } })
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(
      await screen.findByText('Le mot de passe doit contenir au moins 8 caractères.'),
    ).toBeTruthy()
    expect(fakeState().calls.signIns).toHaveLength(0)
  })

  it('connecte l’utilisateur et affiche le tableau', async () => {
    renderApp('/connexion')

    await screen.findByRole('heading', { name: 'Connexion' })
    fireEvent.change(screen.getByLabelText('Adresse email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'motdepasse123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByRole('heading', { name: 'Leads' })).toBeTruthy()
    expect(fakeState().calls.signIns).toEqual([{ email: 'alice@example.com', password: 'motdepasse123' }])
  })
})
