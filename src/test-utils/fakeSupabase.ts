/**
 * Faux client Supabase utilisé UNIQUEMENT par les tests de composants.
 * Il reproduit le sous-ensemble de l'API utilisé par l'application
 * (auth + requêtes `from('leads')`) et enregistre les appels pour les assertions.
 */

export type FakeRow = Record<string, unknown>

export type FakeSession = { user: { id: string; email: string }; access_token: string } | null

export type FakeCalls = {
  signIns: { email: string; password: string }[]
  signUps: { email: string; password: string }[]
  signOuts: number
  updates: { payload: FakeRow; filters: Record<string, string> }[]
  inserts: FakeRow[][]
  deletes: { filters: Record<string, string> }[]
}

export type FakeState = {
  session: FakeSession
  leads: FakeRow[]
  calls: FakeCalls
  failUpdate: boolean
  failInsert: boolean
  listeners: ((event: string, session: FakeSession) => void)[]
}

const emptyCalls = (): FakeCalls => ({
  signIns: [],
  signUps: [],
  signOuts: 0,
  updates: [],
  inserts: [],
  deletes: [],
})

const state: FakeState = {
  session: null,
  leads: [],
  calls: emptyCalls(),
  failUpdate: false,
  failInsert: false,
  listeners: [],
}

export function resetFakeSupabase(
  options: {
    leads?: FakeRow[]
    session?: FakeSession
    failUpdate?: boolean
    failInsert?: boolean
  } = {},
): FakeState {
  state.session = options.session ?? null
  state.leads = (options.leads ?? []).map((row) => ({ ...row }))
  state.calls = emptyCalls()
  state.failUpdate = Boolean(options.failUpdate)
  state.failInsert = Boolean(options.failInsert)
  state.listeners = []
  return state
}

export function fakeState(): FakeState {
  return state
}

type QueryResult = { data: unknown; error: { message: string } | null }

function createQueryBuilder() {
  let action: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let payload: FakeRow | FakeRow[] | null = null
  const filters: Record<string, string> = {}

  const matches = (row: FakeRow): boolean =>
    Object.entries(filters).every(([column, value]) => String(row[column]) === String(value))

  const execute = async (): Promise<QueryResult> => {
    switch (action) {
      case 'insert': {
        if (state.failInsert) return { data: null, error: { message: 'insert refusé' } }
        const rows = (Array.isArray(payload) ? payload : [payload ?? {}]) as FakeRow[]
        state.calls.inserts.push(rows)
        rows.forEach((row, index) => {
          state.leads.push({
            id: `fake-${state.leads.length + index + 1}`,
            created_at: '2026-01-01T00:00:00.000Z',
            ...row,
          })
        })
        return { data: null, error: null }
      }
      case 'update': {
        if (state.failUpdate) return { data: null, error: { message: 'update refusé' } }
        const patch = (payload ?? {}) as FakeRow
        state.calls.updates.push({ payload: patch, filters: { ...filters } })
        state.leads.forEach((row) => {
          if (matches(row)) Object.assign(row, patch)
        })
        return { data: null, error: null }
      }
      case 'delete': {
        state.calls.deletes.push({ filters: { ...filters } })
        state.leads = state.leads.filter((row) => !matches(row))
        return { data: null, error: null }
      }
      case 'select':
      default:
        return { data: state.leads.filter(matches), error: null }
    }
  }

  const builder = {
    select: () => {
      action = 'select'
      return builder
    },
    insert: (rows: FakeRow | FakeRow[]) => {
      action = 'insert'
      payload = rows
      return builder
    },
    update: (patch: FakeRow) => {
      action = 'update'
      payload = patch
      return builder
    },
    delete: () => {
      action = 'delete'
      return builder
    },
    eq: (column: string, value: string) => {
      filters[column] = value
      return builder
    },
    order: () => builder,
    then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      execute().then(onFulfilled, onRejected),
  }

  return builder
}

export const fakeSupabaseClient = {
  from: (_table: string) => createQueryBuilder(),
  auth: {
    getSession: async () => ({ data: { session: state.session }, error: null }),
    onAuthStateChange: (callback: (event: string, session: FakeSession) => void) => {
      state.listeners.push(callback)
      return { data: { subscription: { unsubscribe: () => {} } } }
    },
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      state.calls.signIns.push(credentials)
      state.session = { user: { id: 'user-1', email: credentials.email }, access_token: 'token' }
      // Comportement de Supabase : un événement SIGNED_IN est émis.
      state.listeners.forEach((listener) => listener('SIGNED_IN', state.session))
      return { data: { session: state.session }, error: null }
    },
    signUp: async (credentials: { email: string; password: string }) => {
      state.calls.signUps.push(credentials)
      return { data: { session: null }, error: null }
    },
    signOut: async () => {
      state.calls.signOuts += 1
      state.session = null
      state.listeners.forEach((listener) => listener('SIGNED_OUT', null))
      return { error: null }
    },
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    updateUser: async () => ({ data: {}, error: null }),
  },
}
