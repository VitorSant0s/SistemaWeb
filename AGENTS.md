# AGENTS.md — Raiz Movimento / natureza-app

## Dev commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `vue-tsc -b` then `vite build` — both typecheck and bundle |
| `npm run preview` | Vite preview of production build |

No test, lint, or formatter commands are configured.

## Architecture

- **Vue 3 + TS + Vite 8**, Pinia, Vue Router, Supabase JS client, PWA via `vite-plugin-pwa`
- **Entry:** `src/main.ts` — creates Pinia + Router, calls `auth.init()` before mounting the app
- **Routes** (`src/router.ts`):
  - `/` → HomeView.vue (meta: requiresAuth)
  - `/entrar` → AuthView.vue (meta: guestOnly)
- **Auth store** (`src/stores/auth.ts`): the only store so far. Handles signIn/signUp/signOut with Supabase.
- **Supabase client** (`src/lib/supabase.ts`): returns `null` when env vars are missing; the auth store has a full dev-mode fallback that uses localStorage.
- **CSS:** monolithic `src/style.css` — no scoped styles, no CSS framework/tailwind.
- **Supabase schema** (`supabase/schema.sql`): tables for profiles, professional_profiles, service_offers, negotiations, proposals, contracts, workouts — with RLS policies.
- **UI language:** Brazilian Portuguese throughout.

## Key quirks

- **Dev bypasses auth.** The router guard returns `true` unconditionally in dev mode (`import.meta.env.DEV`) — no Supabase needed to navigate.
- **Dev login works without Supabase.** Auth store falls back to a `localStorage`-based mock (`dev-auth-user` key) if Supabase env vars are unset. Any email/password succeeds.
- **Build = typecheck + bundle.** `vue-tsc -b` runs first and will fail on type errors.
- **TypeScript 6.0** (via `tsconfig.node.json`), **vue-tsc 3.2**, **Vite 8** — all current-bleeding-edge versions.
- **Non-standard tsconfig setup:** `tsconfig.json` references `tsconfig.app.json` (src) and `tsconfig.node.json` (vite.config). Both enable `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly`.
- **Env file:** `.env` is gitignored. Copy `.env.example` → `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **No tests exist** — no test runner or test deps in package.json.
- **VSCode:** recommended extension is Vue.volar (`.vscode/extensions.json`).

## Stores

| Store | File | What it manages |
|---|---|---|
| `useAuthStore` | `src/stores/auth.ts` | signIn/signUp/signOut, role, user, dev-mode localStorage fallback |
| `usePerfilStore` | `src/stores/perfil.ts` | profile (name, city, avatar), health (notes, exams, share flag), professional (specialty, bio, price); syncs localStorage before any `await` in `init()` |
| `useNegociacaoStore` | `src/stores/negociacao.ts` | negotiations, proposals, contracts lifecycle; all localStorage-based |

## Key stores patterns

- **Perfil init:** reads localStorage synchronously first, then awaits Supabase. This avoids stale empty forms on first render. When using store fields in `v-model`, always use **writable computed** (not `ref` copies):
  ```ts
  const field = computed({
    get: () => perfilStore.profile.fullName,
    set: (v) => { perfilStore.profile.fullName = v },
  })
  ```
  This ensures two-way binding survives async init.

## Project state

10 routes: Home, Auth, Profissionais, Negotiations, Contracts, AthleteDetail, Messages, Agenda (+ WorkoutForm modal), Metrics, Perfil.
Full negotiation/proposal/contract lifecycle implemented in UI.
Professional discovery (directory + offers), athlete detail view with health sharing.
## Supabase sync status

Every service follows the same pattern: **Supabase is primary, localStorage is cache + fallback**.

| Service | Supabase reads | Supabase writes | LocalStorage cache |
|---|---|---|---|
| `profileService` | ✅ `profiles` table | ✅ `profiles`/`professional_profiles` | ✅ before/after each Supabase call |
| `negotiationService` | ✅ `negotiations` table | ✅ create/update | ✅ caches on load |
| `proposalService` | ✅ `proposals` table | ✅ create | ✅ caches on load |
| `contractService` | ✅ `contracts` table | ✅ create/update | ✅ caches on load |
| `offerService` | ✅ `service_offers` table | ✅ create/update | ✅ caches on load |
| `workoutService` | ✅ `workouts` table | ✅ CRUD | ✅ caches on load |
| `challengeService` | ✅ `daily_challenges` table | ✅ upsert | ✅ reads/writes localStorage always |
| `messageService` | ✅ `conversations`/`messages` | ✅ send/create | ✅ reads/writes localStorage always |
| `professionalDirectoryService` | ✅ `profiles` + `professional_profiles` | ❌ (read-only) | ✅ caches directory on load |

**Cache rule:** Every successful Supabase `load` overwrites its localStorage key. Every mutation writes to Supabase first (if available) AND to localStorage. When Supabase is unavailable (`!supabase`), all services fall back to localStorage. Mock data is seeded only in `import.meta.env.DEV` mode.

**Schema tables added:** `conversations`, `messages` with RLS policies keyed on `participant_ids`.

## Supabase Storage

- **Bucket `exam-images`** — for exam photo uploads. Created in `schema.sql`. When Supabase is available, `ExamForm.vue` uploads the file before saving and stores the public URL instead of the data URL. Dev mode falls back to data URLs in localStorage.

## Session 3 — Notificações, contra-proposta, home dashboard

### Completed

| # | Task | Files |
|---|---|---|
| 1 | PerfilView: stale `ref()` copy → writable computed for every `v-model` field | `src/views/PerfilView.vue` |
| 2 | Perfil store `init()`: read localStorage sync **before** `await` Supabase | `src/stores/perfil.ts` |
| 3 | MessagesView: consume `?pro=` query param to auto-start chat with a professional | `src/views/MessagesView.vue`, `src/router.ts` |
| 4 | ProfissionaisView: user picks which offer to negotiate; sends offer id in query | `src/views/ProfissionaisView.vue` |
| 5 | Fix broken links (`/contratos/:id`, agenda filter param) | `src/views/NegotiationsView.vue`, `src/stores/negociacao.ts` |
| 6 | Guard all mock data behind `import.meta.env.DEV` | `src/services/profileService.ts`, `negotiationService.ts`, `proposalService.ts`, `contractService.ts`, `offerService.ts`, `workoutService.ts`, `challengeService.ts`, `messageService.ts` |
| 7 | Add `try/catch` + loading states to all async ops | `src/stores/perfil.ts`, `src/stores/agenda.ts`, `src/views/PerfilView.vue`, `src/views/AgendaView.vue`, `src/views/MetricasView.vue` |
| 8 | Upload exam images to Supabase Storage bucket (`exam-images`) | `src/components/ExamForm.vue` |
| 9 | Sync all services to Supabase (messageService, professionalDirectoryService, etc.) | `src/services/messageService.ts`, `src/services/professionalDirectoryService.ts` |
| 10 | Contra-proposta flow: professional can send counter-proposal; "Aceitar" button changes text to show amount | `src/stores/negociacao.ts`, `src/views/NegotiationsView.vue` |
| 11 | Notificações system: `notificationService.ts`, `addNotification` calls from `negociacaoStore.sendProposal`/`respondToProposal`/`sendMessage`, badge + panel on HomeView | `src/services/notificationService.ts`, `src/stores/negociacao.ts`, `src/views/HomeView.vue`, `src/style.css`, `src/services/messageService.ts` |
| 12 | Home dashboard: pro-athletes grid (professional view), active-contracts grid (athlete view), sidebar links to Profissionais/Negociacoes/Contratos, bottom-nav updated | `src/views/HomeView.vue` |
| 13 | Schema: `conversations`, `messages` tables + RLS | `supabase/schema.sql` |

### Pending (next session)

Nothing planned.
