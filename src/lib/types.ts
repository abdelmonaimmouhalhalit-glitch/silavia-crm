/**
 * Types partagés de l'application Silavia.
 * Ces types reflètent exactement la table `public.leads` (cf. supabase/schema.sql).
 */

export type BooleanField = 'outreach' | 'reponse' | 'rdv' | 'present' | 'pitch' | 'close'

/** Données d'un lead telles qu'envoyées à Supabase (sans les champs gérés par la base). */
export type LeadInput = {
  nom: string
  poste: string | null
  societe: string | null
  lien: string | null
  tel: string | null
  adresse: string | null
  commission: number
  last: string
  outreach: boolean
  reponse: boolean
  rdv: boolean
  present: boolean
  pitch: boolean
  close: boolean
}

/** Un lead tel que lu depuis Supabase. */
export type Lead = LeadInput & {
  id: string
  user_id: string
  created_at: string
}

export const emptyLeadInput = (last: string): LeadInput => ({
  nom: '',
  poste: null,
  societe: null,
  lien: null,
  tel: null,
  adresse: null,
  commission: 0,
  last,
  outreach: false,
  reponse: false,
  rdv: false,
  present: false,
  pitch: false,
  close: false,
})
