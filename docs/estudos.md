# O que estudar para evoluir o projeto

## Prioridade Alta

### 1) Vue 3 (Composition API)

Estudar:

- `ref`, `computed`, `watch`, `onMounted`
- componentizacao
- boas praticas de composables

Motivo: o front ja esta em Vue 3 e os proximos modulos dependem disso.

### 2) Supabase (Auth + Database + RLS)

Estudar:

- Auth (sessao, confirmacao de email, reset de senha)
- consultas CRUD no Postgres via Supabase
- **RLS (Row Level Security)** e politicas de acesso

Motivo: seguranca e dados do produto dependem fortemente de RLS.

### 3) Modelagem de dados para marketplace

Estudar:

- entidades e relacionamentos (atletas, profissionais, ofertas, negociacoes, propostas, contratos)
- estados de negociacao (maquina de estado)

Motivo: evita retrabalho quando o projeto crescer.

## Prioridade Media

### 4) UX Mobile e Design System

Estudar:

- grid mobile-first
- escala tipografica
- tokens de design (cores, espacamentos, raio, sombras)
- acessibilidade visual (contraste, alvos de toque)

Motivo: manter consistencia entre telas novas.

### 5) Acessibilidade Web

Estudar:

- WAI-ARIA basico
- foco por teclado
- semantica HTML
- testes com leitor de tela

Motivo: app com melhor usabilidade para todos e maior qualidade de interface.

### 6) PWA

Estudar:

- service worker
- cache strategy
- comportamento offline
- instalacao em Android/iOS

Motivo: parte da proposta e experiencia mobile tipo app.

## Prioridade Futura

### 7) Testes

Estudar:

- unitarios (Vitest)
- componente (Vue Test Utils)
- E2E (Playwright)

Motivo: reduzir regressao nas evolucoes de UI e fluxo de auth.

### 8) Observabilidade

Estudar:

- monitoramento de erros no front
- logs de eventos de produto

Motivo: acelerar diagnostico em ambiente real.

## Roadmap tecnico sugerido de estudo + execucao

1. Consolidar Auth e RLS no Supabase
2. Implementar modulo Marketplace com dados reais
3. Implementar modulo Negociacoes e Propostas
4. Implementar Contratos
5. Integrar modulo de Treinos
6. Adicionar testes e melhoria de performance
