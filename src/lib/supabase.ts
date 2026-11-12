import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/**
 * Message affiché à l'écran si le fichier .env.local est incomplet.
 * On ne lève pas d'exception ici : l'application affiche un écran de configuration
 * explicite plutôt qu'une page blanche.
 */
export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "Configuration Supabase manquante. Copiez .env.example vers .env.local puis renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY."
    : null

/**
 * Client Supabase côté navigateur.
 * On utilise UNIQUEMENT la clé publique `anon` : la clé `service_role`
 * ne doit jamais être exposée au front (elle contourne la Row Level Security).
 */
export const supabase = createClient(
  supabaseUrl || 'https://configuration-manquante.supabase.co',
  supabaseAnonKey || 'configuration-manquante',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export const LEADS_TABLE = 'leads'
