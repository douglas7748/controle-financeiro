/* =========================
   HELPERS
========================= */
const formatBRL = (value) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const $ = (selector) => document.querySelector(selector);

function gerarId() {
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

function setHojeNoInputData() {
  const inputData = $("#data");
  if (!inputData) return;
  inputData.value = new Date().toISOString().slice(0, 10);
}

function dataToISO(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ✅ parse local (evita bug de fuso) */
function parseLocalDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/* ✅ mensal seguro (evita bug do dia 29/30/31) */
function diasNoMes(ano, mesIndex) {
  return new Date(ano, mesIndex + 1, 0).getDate();
}

function addMonthsSafe(dateObj, monthsToAdd) {
  const ano = dateObj.getFullYear();
  const mes = dateObj.getMonth();
  const dia = dateObj.getDate();

  const novoMes = mes + monthsToAdd;
  const novoAno = ano + Math.floor(novoMes / 12);
  const mesFinal = ((novoMes % 12) + 12) % 12;

  const ultimoDia = diasNoMes(novoAno, mesFinal);
  const diaFinal = Math.min(dia, ultimoDia);

  return new Date(novoAno, mesFinal, diaFinal);
}

/* =========================
   STORAGE KEYS
========================= */
const STORAGE_KEY = "transacoes_v1";
const META_KEY = "meta_mensal_v1";

/* =========================
   STATE
========================= */
let transacoes = [];

/* =========================
   ELEMENTS
========================= */
const form = $("#formTransacao");
const lista = $("#lista");

const totalEntradasEl = $("#totalEntradas");
const totalSaidasEl = $("#totalSaidas");
const saldoEl = $("#saldo");

const buscaEl = $("#busca");
const mesEl = $("#mes");
const filtroTipoEl = $("#filtroTipo");

const btnLimpar = $("#btnLimpar");
const btnExportar = $("#btnExportar");

// Tema
const themeToggle = $("#themeToggle");

// Meta
const metaValorEl = $("#metaValor");
const salvarMetaBtn = $("#salvarMeta");
const barraProgressoEl = $("#barraProgresso");
const textoMetaEl = $("#textoMeta");

// Recorrência
const quantidadeEl = $("#quantidade");
const frequenciaEl = $("#frequencia");

/* =========================
   LOAD / SAVE
========================= */
function salvarTransacoes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transacoes));
}

function carregarTransacoes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  transacoes = raw ? JSON.parse(raw) : [];
}

/* =========================
   FILTROS
========================= */
function aplicarFiltros(data) {
  const texto = (buscaEl?.value || "").trim().toLowerCase();
  const mes = mesEl?.value || ""; // yyyy-mm
  const tipo = filtroTipoEl?.value || "todos";

  return data.filter((t) => {
    const matchTexto =
      !texto ||
      t.descricao.toLowerCase().includes(texto) ||
      t.categoria.toLowerCase().includes(texto);

    const matchMes = !mes || t.data.startsWith(mes);
    const matchTipo = tipo === "todos" || t.tipo === tipo;

    return matchTexto && matchMes && matchTipo;
  });
}

/* =========================
   RENDER
========================= */
function render() {
  if (!totalEntradasEl || !totalSaidasEl || !saldoEl) return;

  const filtradas = aplicarFiltros(transacoes);

  const entradas = filtradas
    .filter((t) => t.tipo === "entrada")
    .reduce((acc, t) => acc + Number(t.valor), 0);

  const saidas = filtradas
    .filter((t) => t.tipo === "saida")
    .reduce((acc, t) => acc + Number(t.valor), 0);

  const saldo = entradas - saidas;

  totalEntradasEl.textContent = formatBRL(entradas);
  totalSaidasEl.textContent = formatBRL(saidas);
  saldoEl.textContent = formatBRL(saldo);
}

function renderLista() {
  if (!lista) return;

  const filtradas = aplicarFiltros(transacoes)
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data));

  lista.innerHTML = filtradas
    .map((t) => {
      const badgeClass = t.tipo === "entrada" ? "entrada" : "saida";
      const dataBR = t.data.split("-").reverse().join("/");

      return `
        <tr>
          <td>${dataBR}</td>
          <td>${t.descricao}</td>
          <td>${t.categoria}</td>
          <td><span class="badge ${badgeClass}">${t.tipo}</span></td>
          <td>${formatBRL(t.valor)}</td>
          <td>
            <button class="btn btn-outline" data-action="editar" data-id="${t.id}">Editar</button>
            <button class="btn btn-outline" data-action="excluir" data-id="${t.id}">Excluir</button>
          </td>
        </tr>
      `;
    })
    .join("");

  render();
  atualizarMeta();
}

/* =========================
   AÇÕES (CRUD) + RECORRÊNCIA (CORRIGIDO)
========================= */
function adicionarTransacao({ tipo, descricao, categoria, valor, data }) {
  const quantidade = Math.max(1, Number(quantidadeEl?.value || 1));
  const frequencia = frequenciaEl?.value || "mensal";

  const base = parseLocalDate(data);

  for (let i = 0; i < quantidade; i++) {
    let d;

    if (frequencia === "mensal") d = addMonthsSafe(base, i);
    else if (frequencia === "anual") d = new Date(base.getFullYear() + i, base.getMonth(), base.getDate());
    else if (frequencia === "semanal") d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i * 7);
    else d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i); // diaria

    transacoes.push({
      id: gerarId(),
      tipo,
      descricao: quantidade > 1 ? `${descricao} (${i + 1}/${quantidade})` : descricao,
      categoria,
      valor: Number(valor),
      data: dataToISO(d),
    });
  }

  salvarTransacoes();
  renderLista();
}

function excluirTransacao(id) {
  transacoes = transacoes.filter((t) => t.id !== id);
  salvarTransacoes();
  renderLista();
}

function editarTransacao(id) {
  const t = transacoes.find((x) => x.id === id);
  if (!t) return;

  $("#tipo").value = t.tipo;
  $("#descricao").value = t.descricao;
  $("#categoria").value = t.categoria;
  $("#valor").value = t.valor;
  $("#data").value = t.data;

  if (quantidadeEl) quantidadeEl.value = 1;
  if (frequenciaEl) frequenciaEl.value = "mensal";

  const btn = form.querySelector('button[type="submit"]');
  btn.textContent = "Salvar edição";
  btn.dataset.editing = id;
}

function salvarEdicao(id, data) {
  transacoes = transacoes.map((t) => {
    if (t.id !== id) return t;
    return {
      ...t,
      ...data,
      valor: Number(data.valor),
    };
  });

  salvarTransacoes();
  renderLista();

  const btn = form.querySelector('button[type="submit"]');
  btn.textContent = "Adicionar";
  delete btn.dataset.editing;

  form.reset();
  setHojeNoInputData();

  if (quantidadeEl) quantidadeEl.value = 1;
  if (frequenciaEl) frequenciaEl.value = "mensal";
}

/* =========================
   EXPORTAR CSV
========================= */
function exportarCSV() {
  const filtradas = aplicarFiltros(transacoes);

  const header = ["data", "descricao", "categoria", "tipo", "valor"];
  const rows = filtradas.map((t) => [
    t.data,
    String(t.descricao).replaceAll(";", ","),
    String(t.categoria).replaceAll(";", ","),
    t.tipo,
    String(t.valor).replace(".", ","),
  ]);

  const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transacoes.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================
   TEMA (persistente)
========================= */
function carregarTema() {
  const saved = localStorage.getItem("theme");
  if (saved === "light") document.body.classList.add("light-mode");

  if (themeToggle) {
    themeToggle.textContent = document.body.classList.contains("light-mode")
      ? "Modo Escuro"
      : "Modo Claro";
  }
}

function alternarTema() {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem("theme", isLight ? "light" : "dark");

  if (themeToggle) {
    themeToggle.textContent = isLight ? "Modo Escuro" : "Modo Claro";
  }
}

/* =========================
   META MENSAL (persistente)
========================= */
function getMeta() {
  const m = localStorage.getItem(META_KEY);
  return m ? Number(m) : 0;
}

function setMeta(valor) {
  localStorage.setItem(META_KEY, String(valor));
}

function carregarMeta() {
  if (!metaValorEl) return;
  const meta = getMeta();
  metaValorEl.value = meta > 0 ? meta : "";
}

function atualizarMeta() {
  if (!metaValorEl || !barraProgressoEl || !textoMetaEl) return;

  const meta = getMeta();
  const filtradas = aplicarFiltros(transacoes);

  const totalSaidas = filtradas
    .filter((t) => t.tipo === "saida")
    .reduce((acc, t) => acc + Number(t.valor), 0);

  if (meta <= 0) {
    barraProgressoEl.style.width = "0%";
    textoMetaEl.textContent = "Defina uma meta para ver o progresso.";
    return;
  }

  const porcentagem = Math.min((totalSaidas / meta) * 100, 100);
  barraProgressoEl.style.width = `${porcentagem.toFixed(0)}%`;

  textoMetaEl.textContent =
    `Você gastou ${formatBRL(totalSaidas)} de ${formatBRL(meta)} (${porcentagem.toFixed(0)}%).`;
}

/* =========================
   EVENTS
========================= */
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const data = {
      tipo: $("#tipo").value,
      descricao: $("#descricao").value.trim(),
      categoria: $("#categoria").value,
      valor: $("#valor").value,
      data: $("#data").value,
    };

    if (!data.descricao || !data.valor || !data.data) return;

    const btn = form.querySelector('button[type="submit"]');
    const editingId = btn.dataset.editing;

    if (editingId) {
      salvarEdicao(editingId, data);
    } else {
      adicionarTransacao(data);
      form.reset();
      setHojeNoInputData();
      if (quantidadeEl) quantidadeEl.value = 1;
      if (frequenciaEl) frequenciaEl.value = "mensal";
    }
  });
}

if (lista) {
  lista.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "excluir") {
      if (confirm("Deseja excluir esta transação?")) excluirTransacao(id);
    }

    if (action === "editar") {
      editarTransacao(id);
    }
  });
}

[buscaEl, mesEl, filtroTipoEl].forEach((el) => {
  if (!el) return;
  el.addEventListener("input", renderLista);
});

if (btnLimpar) {
  btnLimpar.addEventListener("click", () => {
    if (confirm("Isso vai apagar todas as transações. Continuar?")) {
      transacoes = [];
      salvarTransacoes();
      renderLista();
    }
  });
}

if (btnExportar) {
  btnExportar.addEventListener("click", exportarCSV);
}

if (themeToggle) {
  themeToggle.addEventListener("click", alternarTema);
}

if (salvarMetaBtn) {
  salvarMetaBtn.addEventListener("click", () => {
    const valor = Number(metaValorEl?.value || 0);
    setMeta(valor);
    atualizarMeta();
  });
}

/* =========================
   INIT
========================= */
carregarTema();

carregarTransacoes();
renderLista();

carregarMeta();
atualizarMeta();

setHojeNoInputData();