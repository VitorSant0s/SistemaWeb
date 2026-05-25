# Raiz Movimento

Base inicial do front-end da plataforma que conecta atletas e profissionais,
com acompanhamento de treinos, negociacoes e foco em experiencia mobile.

## Stack

- Vue 3 + TypeScript + Vite
- Vue Router
- Pinia
- Supabase JS Client
- PWA com `vite-plugin-pwa`

## Rodando localmente

```bash
npm install
npm run dev
```

## Variaveis de ambiente

Copie `.env.example` para `.env.local` e preencha com seu projeto Supabase:

```bash
cp .env.example .env.local
```

## Schema Supabase

O arquivo `supabase/schema.sql` contem o schema inicial do banco com tabelas,
enums, trigger de criacao automatica de perfil e politicas RLS para atletas e profissionais.

## Build de producao

```bash
npm run build
```
