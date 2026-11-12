# Silavia — CRM léger de suivi de prospection

Application web de suivi de prospection commerciale, en français, inspirée d'une base Notion « Silavia ».
Chaque utilisateur possède un compte privé : ses leads ne sont visibles que par lui (Row Level Security Postgres).

- **Stack** : Vite + React + TypeScript, React Router, CSS maison (thème clair/sombre automatique), Supabase (Auth + Postgres).
- **Fonctionnalités** : inscription / connexion / déconnexion / mot de passe oublié, tableau de leads avec cases à cocher,
  filtres par période, recherche, tri par dernière action, panneau de performance (taux de conversion),
  ajout / modification / suppression de leads, import d'un export CSV Notion.

---

## 1. Prérequis

- Node.js 18+ et npm
- Un compte [Supabase](https://supabase.com) (offre gratuite suffisante)

---

## 2. Créer le projet Supabase (étapes manuelles)

1. Allez sur <https://supabase.com/dashboard> puis **New project**.
2. Renseignez :
   - **Name** : `silavia` (ou ce que vous voulez)
   - **Database password** : choisissez un mot de passe fort et conservez-le
   - **Region** : la plus proche de vos utilisateurs (ex. `eu-west-3` pour Paris)
3. Attendez la fin du provisioning (~1 minute).

### 2.1 Copier les clés

1. Dans le projet : **Project Settings** (roue crantée) → **API**.
2. Copiez :
   - **Project URL** → variable `VITE_SUPABASE_URL`
   - **anon / public key** → variable `VITE_SUPABASE_ANON_KEY`

> ⚠️ **Ne copiez jamais la clé `service_role`** dans le front ni dans `.env.local`.
> Elle contourne la Row Level Security. Seule la clé `anon` est utilisée par cette application.

Puis, à la racine du projet :

```bash
cp .env.example .env.local
```

Éditez `.env.local` :

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
```

`.env.local` est ignoré par Git (voir `.gitignore`). **Redémarrez `npm run dev`** après toute modification.

### 2.2 Exécuter le schéma SQL

1. Dans le dashboard Supabase : **SQL Editor** → **New query**.
2. Ouvrez le fichier [`supabase/schema.sql`](supabase/schema.sql) du projet.
3. Copiez **tout** son contenu dans l'éditeur, puis cliquez sur **Run** (ou `Ctrl/Cmd + Entrée`).

Le script est idempotent : il crée la table `public.leads`, active la RLS, crée les 4 policies
(`select`, `insert`, `update`, `delete`) et l'index `(user_id, last desc)`.

Vérification rapide dans le SQL Editor :

```sql
select tablename, rowsecurity from pg_tables where tablename = 'leads';   -- rowsecurity = true
select policyname, cmd from pg_policies where tablename = 'leads';        -- 4 lignes
```

### 2.3 Activer l'authentification email

1. **Authentication** → **Sign In / Providers** (ou **Providers**) → **Email** : vérifiez que le provider est **activé**.
2. Choisissez votre mode :
   - **Pour tester rapidement** : désactivez **Confirm email** (Authentication → Providers → Email → *Confirm email* off).
     L'inscription ouvre alors directement une session.
   - **Pour la production** : laissez **Confirm email** activé. L'utilisateur reçoit un email de confirmation.
     Pour éviter les limitations d'envoi Supabase, configurez un SMTP personnalisé
     (Authentication → Emails → SMTP Settings).
3. **Mot de passe minimum** : Authentication → Providers → Email → *Minimum password length* = **8**
   (l'application valide déjà 8 caractères côté formulaire).

### 2.4 URL de redirection (obligatoire pour la réinitialisation)

1. **Authentication** → **URL Configuration**.
2. **Site URL** : `http://localhost:5173` en développement (l'URL de votre site en production).
3. **Redirect URLs** — ajoutez :

   ```
   http://localhost:5173/reinitialiser-mot-de-passe
   http://localhost:5173/connexion
   https://votre-domaine.com/reinitialiser-mot-de-passe
   https://votre-domaine.com/connexion
   ```

Sans ces URL, le lien reçu par email ne ramènera pas l'utilisateur sur la bonne page.

---

## 3. Installation et lancement

```bash
npm install
npm run dev
```

L'application est disponible sur <http://localhost:5173>.

Si `.env.local` est incomplet, l'application affiche un écran « Configuration requise » au lieu d'une page blanche.

### Scripts disponibles

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement Vite |
| `npm run build` | Vérification TypeScript + build de production (`dist/`) |
| `npm run preview` | Prévisualisation du build |
| `npm test` | Tests unitaires Vitest (stats, CSV, dates) |
| `npm run test:watch` | Tests en mode watch |

---

## 4. Utilisation

### Écran principal (`/tableau`, protégé)

Deux zones côte à côte (empilées sur mobile) :

1. **Leads** — tableau : Nom, Poste, Société, LinkedIn/Email (lien cliquable, `rel="noopener"`), Téléphone, Adresse,
   les 6 cases (Outreach, Réponse, RDV pris, RDV tenu, Pitch, Closing), Commission, Dernière action.
   - Cocher/décocher une case : **mise à jour optimiste**, `last` passe à la date du jour ; en cas d'échec réseau,
     la valeur est restaurée et un message d'erreur s'affiche.
   - Onglets de période : Tous / Cette semaine (depuis lundi) / Ce mois / Cette année.
   - Recherche sur nom, poste, société, téléphone, adresse (insensible à la casse et aux accents).
   - Tri par dernière action décroissante.
   - **Ajouter un lead** ouvre une modale ; cliquer sur un nom ouvre la même modale en édition (avec suppression + confirmation).
2. **Performance** — barres de progression calculées sur les leads filtrés :
   Outreach Rate, Response Rate, Book Rate, Show Rate, Pitch Rate, Close Rate, Conversion Rate
   (division par zéro → 0 %), plus total leads, réponses, clients closés et commission totale (format fr-FR, €).

### Routes

| Route | Accès |
| --- | --- |
| `/connexion` | Public (redirige vers `/tableau` si déjà connecté) |
| `/inscription` | Public |
| `/mot-de-passe-oublie` | Public |
| `/reinitialiser-mot-de-passe` | Public (nécessite la session temporaire du lien email) |
| `/tableau` | **Protégé** par `RequireAuth` |
| `/` et `*` | Redirection vers `/tableau` |

### Import CSV — analyse automatique et adaptation

Bouton **Importer un CSV** → choisissez un fichier : l'application l'analyse **avant** toute écriture en base,
puis affiche une fenêtre de confirmation détaillant ce qu'elle a compris.

Ce qui est détecté tout seul :

- **Séparateur** : `,`, `;`, tabulation ou `|`, choisi en testant la cohérence du nombre de colonnes d'une ligne
  à l'autre — un export Excel français en `;` passe donc sans réglage.
- **Ligne d'en-têtes** : les lignes de préambule (titre, lignes vides) sont ignorées.
- **Colonnes** : correspondance par en-tête (exacte, puis approchante : `Company Name`, `Nom`, `Phone Number`,
  `Dernière action`…), puis **déduction par le contenu** pour les colonnes inconnues — e-mails/URLs → `LinkedIn/Email`,
  numéros → `Téléphone`, dates → `Dernière action`, montants → `Commission`, texte → `Nom`.
  Chaque correspondance est affichée avec un badge `en-tête`, `approchant` ou `déduit`.
- **Valeurs** : `Yes`, `true`, `oui`, `1`, `✓` = coché (tout le reste = décoché) ; montants `1 250,50 €` ou `1250.5` ;
  dates `October 15, 2026`, `Oct 15, 2026`, `15 October 2026`, `15 oct. 2026`, `15/10/2026`, `2026-10-15`.
- **Avertissements explicites** : aucune colonne de date (→ date du jour), dates illisibles, colonnes inutilisées,
  lignes sans nom.

Le panneau de confirmation rappelle le séparateur retenu, la ligne d'en-têtes, le nombre de leads détectés,
les colonnes ignorées, les avertissements et un aperçu des noms. **Rien n'est inséré avant le clic sur
« Importer N leads »** ; l'insertion se fait ensuite en un seul appel (`user_id` renseigné automatiquement) et le
message final récapitule le nombre importé et le séparateur utilisé.

Si aucun nom ne peut être identifié, l'erreur liste les colonnes réellement trouvées dans le fichier.

Exemples acceptés, sans aucune configuration manuelle :

```csv
Name,Job,Company Name,Email/LinkedIn,Phone,Address,Commission,Last,Outreach,Response,Book,Show,Pitch,Close
Marie Curie,CTO,Radium SA,https://linkedin.com/in/marie,0601020304,"1 rue Curie, Paris",1200,October 15 2026,Yes,Yes,No,No,No,No
```

```csv
Nom;Société;Téléphone;Dernière action;Closing
"Durand; Paul";Acme;0601020304;15/10/2026;Oui
```

---

## 5. Vérifier l'isolation des données entre deux comptes (RLS)

Cette vérification est **le point de sécurité le plus important** : un utilisateur ne doit jamais pouvoir lire
ni modifier les leads d'un autre.

### Test manuel via l'interface (2 minutes)

1. Créez le compte A : `alice@example.com` (mot de passe ≥ 8 caractères), connectez-vous.
2. Ajoutez 2 leads dans A. Notez qu'ils apparaissent dans le tableau et dans Performance.
3. Déconnectez-vous (bouton **Déconnexion** dans l'en-tête).
4. Créez le compte B : `bob@example.com`, connectez-vous.
5. **Résultat attendu** : le tableau de B est vide (« Aucun lead pour l'instant… »), et les compteurs de Performance sont à 0.
6. Ajoutez 1 lead dans B, déconnectez-vous, reconnectez-vous avec A.
7. **Résultat attendu** : A voit ses 2 leads (et pas celui de B) ; B ne voit que son lead.

### Test SQL (SQL Editor) — la RLS s'applique au rôle `authenticated`

> ⚠️ Le SQL Editor s'exécute avec un rôle privilégié qui **contourne** la RLS.
> Pour tester réellement les policies, on endosse le rôle `authenticated` avec l'identité d'un utilisateur.

```sql
-- Récupérez les identifiants des deux comptes
select id, email from auth.users;

-- Simulez la session de l'utilisateur A (remplacez l'UUID)
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<UUID_DE_A>","role":"authenticated"}';

  select count(*) as leads_visibles_pour_A from public.leads;              -- uniquement les leads de A
  select count(*) as leads_de_B_visibles from public.leads where user_id = '<UUID_DE_B>'; -- doit renvoyer 0

  -- Tentative de modification d'un lead de B : doit affecter 0 ligne
  update public.leads set nom = 'piraté' where user_id = '<UUID_DE_B>';
rollback;
```

### Test via l'API (curl) — ce que fait réellement le front

```bash
# 1. Connectez-vous en tant que A pour obtenir un access_token
curl -s "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"motdepasse123"}' | jq -r .access_token

# 2. Listez les leads avec le token de A : seuls les leads de A sont renvoyés
curl -s "$VITE_SUPABASE_URL/rest/v1/leads?select=id,nom,user_id" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $TOKEN_A"
```

Résultats attendus :

- La liste ne contient que des lignes dont `user_id` = identifiant de A.
- Un `GET` ciblant l'id d'un lead de B renvoie `[]`.
- Un `PATCH`/`DELETE` sur un lead de B renvoie `0` ligne modifiée (PostgREST : `204`/`200` sans effet, ou `406`).
- Un `POST` avec un `user_id` étranger est rejeté par la policy `with check (user_id = auth.uid())`.

### Tests automatisés

```bash
npm test
```

Couverture (53 tests) :
- `src/lib/stats.test.ts` — taux (y compris division par zéro), commissions, filtres de période et recherche.
- `src/lib/csv.test.ts` — parser CSV (guillemets, retours à la ligne, BOM, CRLF), mapping des colonnes Notion,
  **analyse automatique** : détection du séparateur (`,` `;` tabulation), en-têtes après préambule,
  déduction des colonnes par le contenu, avertissements (dates illisibles, colonnes inutilisées).
- `src/lib/dates.test.ts` — conversion des dates Notion, bornes de période, formatage fr-FR.
- `src/pages/Dashboard.test.tsx` — tests de composants (jsdom + faux client Supabase) : protection des routes,
  redirection d'un utilisateur déjà connecté, cases à cocher optimistes **avec retour arrière si l'appel échoue**,
  filtres de période, recalcul des statistiques, recherche, import CSV (succès + colonne `Name` manquante),
  ajout via la modale, déconnexion, validation des formulaires de connexion.

Ces tests ne nécessitent aucun projet Supabase : [`src/test-utils/fakeSupabase.ts`](src/test-utils/fakeSupabase.ts)
remplace `@supabase/supabase-js` et enregistre les appels (`insert`, `update`, `delete`, `signOut`…) pour les assertions.

---

## 6. Structure du projet

```
.
├── index.html
├── .env.example
├── supabase/
│   └── schema.sql              # table leads + RLS + index
├── src/
│   ├── App.tsx                 # routes
│   ├── main.tsx                # point d'entrée (BrowserRouter + AuthProvider)
│   ├── styles.css              # styles + thème clair/sombre automatique
│   ├── auth/
│   │   ├── AuthProvider.tsx    # user, loading, signIn, signUp, signOut
│   │   └── RequireAuth.tsx     # protection des routes + écran de chargement
│   ├── pages/
│   │   ├── Login.tsx           # /connexion
│   │   ├── Signup.tsx          # /inscription
│   │   ├── Forgot.tsx          # /mot-de-passe-oublie
│   │   ├── Reset.tsx           # /reinitialiser-mot-de-passe
│   │   ├── Dashboard.tsx       # /tableau (protégé)
│   │   └── Dashboard.test.tsx  # tests de composants (jsdom + faux Supabase)
│   ├── components/
│   │   ├── LeadTable.tsx
│   │   ├── LeadDialog.tsx
│   │   ├── StatsPanel.tsx
│   │   └── AuthCard.tsx
│   ├── test-utils/
│   │   └── fakeSupabase.ts     # faux client Supabase pour les tests
│   └── lib/
│       ├── supabase.ts         # client Supabase (clé anon uniquement)
│       ├── csv.ts              # analyse auto du CSV : séparateur, en-têtes, colonnes, rapport
│       ├── stats.ts            # calculs des taux + filtres
│       ├── dates.ts            # dates ISO, périodes, formats fr-FR
│       ├── validation.ts       # validation email / mot de passe
│       ├── authErrors.ts       # messages d'erreur français génériques
│       ├── text.ts             # normalisation (casse, accents)
│       └── types.ts            # types Lead / LeadInput
```

---

## 7. Déploiement

### Vercel

1. Poussez le projet sur GitHub, puis **Add New… → Project** et importez le dépôt.
2. Framework preset : **Vite**. Build : `npm run build`. Output : `dist`.
3. Ajoutez les variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Production + Preview).
4. L'application est une SPA : le fichier [`vercel.json`](vercel.json) fourni réécrit toutes les routes vers `index.html`.
5. Ajoutez l'URL de production dans Supabase → **Authentication → URL Configuration**.

### Netlify

1. **Add new site → Import an existing project**.
2. Build command : `npm run build`, Publish directory : `dist`.
3. Variables d'environnement : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Le fichier [`netlify.toml`](netlify.toml) fourni contient le build et la redirection SPA.
5. Mettez à jour **URL Configuration** dans Supabase (Site URL + Redirect URLs de production).

---

## 8. Sécurité et qualité

- **RLS activée** sur `public.leads` avec 4 policies `user_id = auth.uid()` (select / insert / update / delete).
- Aucune requête n'utilise la clé `service_role` : seule la clé `anon` est exposée au navigateur.
- **Aucun `dangerouslySetInnerHTML`** : React échappe tout contenu utilisateur (noms, adresses, liens).
- Les liens externes s'ouvrent avec `target="_blank"` + `rel="noopener noreferrer"`.
- Messages d'erreur d'authentification volontairement génériques (pas d'énumération des comptes).
- Accessibilité : labels associés à chaque champ et à chaque case à cocher, `aria-pressed` sur les onglets,
  `role="progressbar"` sur les barres, focus visible, contrastes respectés en clair et en sombre.
- Responsive : tableau à défilement horizontal, panneaux empilés sur mobile, modale plein écran en bas de l'écran.

### Limites connues

- La suppression d'un utilisateur est gérée par la contrainte `on delete cascade` sur `leads.user_id`.
- L'import CSV n'échoue pas si des colonnes optionnelles sont absentes : les champs correspondants restent vides.
- Le tri et les filtres sont faits côté client (volumes attendus : quelques milliers de leads par utilisateur).
