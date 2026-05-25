<template>
  <main class="mobile-page home-page" aria-labelledby="home-title">
    <aside class="desktop-sidebar" aria-label="Navegacao lateral">
      <p class="sidebar-brand">Raiz Movimento</p>
      <button class="sidebar-item active" aria-current="page">Inicio</button>
      <button class="sidebar-item">Metricas</button>
      <button class="sidebar-item">Agenda</button>
      <button class="sidebar-item">Perfil</button>
      <button class="sidebar-item">Mensagens</button>
    </aside>

    <header class="home-header">
      <div class="hello-block">
        <p class="hello-top">Ola, Vitor</p>
        <h1 id="home-title">Bom dia</h1>
      </div>
      <button class="icon-circle" aria-label="Notificacoes">!</button>
    </header>

    <section class="challenge-card" aria-label="Desafio diario">
      <div>
        <p class="challenge-label">Desafio diario</p>
        <p class="challenge-copy">Defina seu plano antes das 9h e mantenha consistencia.</p>
      </div>
      <div class="challenge-avatar" aria-hidden="true">RM</div>
    </section>

    <section class="week-row" aria-label="Dias da semana">
      <button class="day-pill">Dom 22</button>
      <button class="day-pill">Seg 23</button>
      <button class="day-pill">Ter 24</button>
      <button class="day-pill active" aria-current="date">Qua 25</button>
      <button class="day-pill">Qui 26</button>
      <button class="day-pill">Sex 27</button>
    </section>

    <section class="workout-card" aria-labelledby="workout-title">
      <p class="workout-time">1 de marco - 14:00</p>
      <h2 id="workout-title">Treine como um powerhouse</h2>
      <p class="workout-sub">Plano semanal com acompanhamento profissional</p>
      <RouterLink class="btn-ghost" to="/entrar">Entrar para iniciar</RouterLink>
    </section>

    <section class="stats-grid" aria-label="Metricas da semana">
      <article class="stat-tile lime">
        <p>Corrida semanal</p>
        <strong>1.2k kcal</strong>
        <span>Consumo ativo</span>
      </article>
      <article class="stat-tile blue">
        <p>Corrida semanal</p>
        <strong>12.5k passos</strong>
        <span>Passos acumulados</span>
      </article>
    </section>

    <nav class="bottom-nav" aria-label="Navegacao principal">
      <button class="nav-item active" aria-current="page">Inicio</button>
      <button class="nav-item">Metricas</button>
      <button class="nav-item">Agenda</button>
      <button class="nav-item">Perfil</button>
    </nav>
  </main>
</template>
