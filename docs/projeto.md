# Raiz Movimento - Visao Geral do Projeto

## Objetivo

O **Raiz Movimento** e uma plataforma com foco em atletas e profissionais de saude/esporte.
A proposta e conectar pessoas para contratacao de servicos (treinador, nutricionista, fisioterapia) e oferecer experiencia mobile para acompanhamento de treino.

## Stack Tecnica

- **Front-end:** Vue 3 + TypeScript + Vite
- **Estado:** Pinia
- **Roteamento:** Vue Router
- **Backend as a Service:** Supabase
- **PWA:** vite-plugin-pwa

## Arquitetura Atual

- `src/main.ts`: bootstrap da aplicacao, Pinia e Router.
- `src/router.ts`: rotas principais (`/` e `/entrar`).
- `src/views/HomeView.vue`: home dashboard mobile-first.
- `src/views/AuthView.vue`: login/cadastro com foco em acessibilidade.
- `src/stores/auth.ts`: fluxo de autenticacao e sessao.
- `src/lib/supabase.ts`: cliente Supabase com fallback para dev sem variaveis.
- `supabase/schema.sql`: modelagem inicial de tabelas e politicas RLS.

## Implementacao Realizada

### 1) Base do projeto

- Migracao para Vue 3 + Vite + TypeScript.
- Configuracao de rotas e store global.

### 2) Integracao com Supabase

- Cliente Supabase centralizado.
- Fluxo de login e cadastro.
- Modo desenvolvimento sem quebrar quando variaveis de ambiente nao existem.

### 3) Design mobile-first

- Home baseada em referencia visual de app fitness escuro com acento neon.
- Tela de autenticacao em formato app mobile.
- Adaptacao para desktop com layout dedicado (sidebar).

### 4) Acessibilidade

- Foco visivel para teclado.
- Melhorias semanticas (`main`, `header`, `nav`, `aria-*`).
- Labels e atributos para formulario e feedback com `aria-live`.

## Estado Atual do Produto

O projeto esta em fase de interface e fundacao tecnica.
Ja possui:

- tela inicial;
- tela de login/cadastro;
- base de autenticacao;
- schema inicial no Supabase;
- pipeline de build funcionando.

Ainda falta evoluir os modulos principais de negocio (negociacoes, contratos e treinos com dados reais).

## Como rodar

```bash
npm install
npm run dev
```

Para build:

```bash
npm run build
```

## Variaveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Sem essas variaveis, o app abre em modo de desenvolvimento com Supabase desativado.
