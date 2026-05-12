let treinos = [];
let graficoSemanal, graficoMensal;

// ========================
// LOCAL STORAGE
// ========================
function salvarLocalStorage() {
  localStorage.setItem("treinos", JSON.stringify(treinos));
}

function carregarLocalStorage() {
  const data = localStorage.getItem("treinos");
  if (data) {
    treinos = JSON.parse(data);
  }
}

// ========================
// ADICIONAR TREINO
// ========================
function addTreino(e) {
  e.preventDefault();

  const tipo = document.getElementById("tipo").value;
  const distancia = parseFloat(document.getElementById("distancia").value);
  const tempo = parseFloat(document.getElementById("tempo").value);
  const data = document.getElementById("data").value;

  if (!tipo || !distancia || !tempo || !data) {
    mostrarMensagem("Preencha todos os campos!", true);
    return;
  }

  const treino = {
    id: Date.now(),
    tipo,
    distancia,
    tempo,
    data
  };

  treinos.push(treino);

  salvarLocalStorage();
  renderTreinos();
  atualizarGraficos();

  mostrarMensagem("Treino adicionado com sucesso!");
  document.getElementById("formTreino").reset();
}

// ========================
// RENDER LISTA
// ========================
function renderTreinos() {
  const lista = document.getElementById("listaTreinos");
  const filtro = document.getElementById("filtroTipo").value;

  lista.innerHTML = "";

  let filtrados = treinos;

  if (filtro) {
    filtrados = treinos.filter(t => t.tipo === filtro);
  }

  filtrados.sort((a, b) => new Date(b.data) - new Date(a.data));

  filtrados.forEach(t => {
    const row = `
      <tr>
        <td>${t.tipo}</td>
        <td>${t.distancia}</td>
        <td>${t.tempo}</td>
        <td>${t.data}</td>
        <td><button class="delete" onclick="deleteTreino(${t.id})">X</button></td>
      </tr>
    `;
    lista.innerHTML += row;
  });
}

// ========================
// DELETE
// ========================
function deleteTreino(id) {
  treinos = treinos.filter(t => t.id !== id);
  salvarLocalStorage();
  renderTreinos();
  atualizarGraficos();
}

// ========================
// GRÁFICOS
// ========================
function gerarDadosGrafico() {
  const semanal = {};
  const mensal = {};

  treinos.forEach(t => {
    const data = new Date(t.data);
    const semana = `${data.getFullYear()}-S${Math.ceil(data.getDate()/7)}`;
    const mes = `${data.getFullYear()}-${data.getMonth()+1}`;

    semanal[semana] = (semanal[semana] || 0) + t.distancia;
    mensal[mes] = (mensal[mes] || 0) + t.distancia;
  });

  return { semanal, mensal };
}

function atualizarGraficos() {
  const dados = gerarDadosGrafico();

  if (graficoSemanal) graficoSemanal.destroy();
  if (graficoMensal) graficoMensal.destroy();

  graficoSemanal = new Chart(document.getElementById("graficoSemanal"), {
    type: "line",
    data: {
      labels: Object.keys(dados.semanal),
      datasets: [{
        label: "Km por Semana",
        data: Object.values(dados.semanal)
      }]
    }
  });

  graficoMensal = new Chart(document.getElementById("graficoMensal"), {
    type: "bar",
    data: {
      labels: Object.keys(dados.mensal),
      datasets: [{
        label: "Km por Mês",
        data: Object.values(dados.mensal)
      }]
    }
  });

  calcularEstatisticas();
}

// ========================
// ESTATÍSTICAS (EXTRA)
// ========================
function calcularEstatisticas() {
  const semanas = {};
  const meses = {};

  treinos.forEach(t => {
    const data = new Date(t.data);
    const semana = Math.ceil(data.getDate()/7);
    const mes = data.getMonth();

    semanas[semana] = (semanas[semana] || 0) + t.distancia;
    meses[mes] = (meses[mes] || 0) + 1;
  });

  const mediaSemanal = Object.values(semanas).reduce((a,b)=>a+b,0) / Object.keys(semanas).length || 0;
  const totalMensal = Object.values(meses).reduce((a,b)=>a+b,0);

  document.getElementById("estatisticas").innerHTML =
    `📊 Média semanal: ${mediaSemanal.toFixed(2)} km <br>
     📅 Total de treinos no mês: ${totalMensal}`;
}

// ========================
// UI
// ========================
function mostrarMensagem(msg, erro=false) {
  const el = document.getElementById("mensagem");
  el.textContent = msg;
  el.style.color = erro ? "red" : "green";

  setTimeout(() => el.textContent = "", 3000);
}

// ========================
// EVENTOS
// ========================
document.getElementById("formTreino").addEventListener("submit", addTreino);
document.getElementById("filtroTipo").addEventListener("change", renderTreinos);

// INIT
carregarLocalStorage();
renderTreinos();
atualizarGraficos();