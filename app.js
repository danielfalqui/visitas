let DATA = [];

/* =========================
   SUPABASE
========================= */
const SUPABASE_URL = "https://qslpehvwstrxbnpncqkt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_p81sFGQ7AX94RU71fAOzig_4Ea-bwoh";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================
   DATA FIXO
========================= */
async function loadData() {
  try {
    const response = await fetch("./data.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Falha ao buscar data.json: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();

    if (!json.regioes || !Array.isArray(json.regioes)) {
      throw new Error('Formato inválido no data.json. O arquivo precisa ter: { "regioes": [...] }');
    }

    DATA = json.regioes;
    console.log("DATA carregado com sucesso:", DATA);
  } catch (error) {
    console.error("Erro em loadData():", error);
    throw error;
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function makeChurchKey(reg, dist, church) {
  return reg + "_" + dist + "_" + church;
}

function makeNode(label, number, popupRecords = []) {
  const node = document.createElement("div");
  node.className = "node";

  const circle = document.createElement("div");
  circle.className = "circle";

  if (number > 0) {
    const n = document.createElement("div");
    n.className = "circleNumber";
    n.textContent = number;
    circle.appendChild(n);
  }

  const lab = document.createElement("div");
  lab.className = "labelUnder";
  lab.textContent = label;

  node.appendChild(circle);
  node.appendChild(lab);

  if (popupRecords.length > 0) {
    const popup = document.createElement("div");
    popup.className = "popup";

    popupRecords.forEach(record => {
      const item = document.createElement("div");
      item.className = "popupItem";

      const date = document.createElement("div");
      date.className = "popupDate";
      date.textContent = record.data || "-";

      const obs = document.createElement("div");
      obs.className = "popupObs";
      obs.textContent = record.observacao || "Sem observação";

      item.appendChild(date);
      item.appendChild(obs);
      popup.appendChild(item);
    });

    node.appendChild(popup);

    circle.addEventListener("mouseenter", () => {
      popup.classList.add("show");
    });

    circle.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!popup.matches(":hover")) {
          popup.classList.remove("show");
        }
      }, 80);
    });

    popup.addEventListener("mouseleave", () => {
      popup.classList.remove("show");
    });

    popup.addEventListener("mouseenter", () => {
      popup.classList.add("show");
    });
  }

  return { node, circle };
}

function normalizeText(text) {
  return (text || "").trim().toLowerCase();
}

function uniqueDepartmentCountByChurch(visits) {
  const map = {};

  visits.forEach(v => {
    if (!map[v.church_key]) {
      map[v.church_key] = new Set();
    }
    map[v.church_key].add(normalizeText(v.departamento));
  });

  const counts = {};
  Object.keys(map).forEach(key => {
    counts[key] = map[key].size;
  });

  return counts;
}

function getChurchNameFromKey(churchKey) {
  for (const regiao of DATA) {
    for (const distrito of regiao.distritos) {
      for (const igreja of distrito.igrejas) {
        const key = makeChurchKey(regiao.id, distrito.id, igreja);
        if (key === churchKey) {
          return igreja;
        }
      }
    }
  }
  return "Igreja";
}

/* =========================
   SUPABASE CRUD
========================= */
async function getAll() {
  const { data, error } = await supabaseClient
    .from("visitas")
    .select("*")
    .order("data", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function insertVisit(payload) {
  const { error } = await supabaseClient
    .from("visitas")
    .insert(payload);

  if (error) throw error;
}

async function deleteVisitsByChurchKey(churchKey) {
  const { error } = await supabaseClient
    .from("visitas")
    .delete()
    .eq("church_key", churchKey);

  if (error) throw error;
}

/* =========================
   ELEMENTOS
========================= */
const grid = document.getElementById("grid");
const deptGrid = document.getElementById("deptGrid");

const recordScreen = document.getElementById("recordScreen");
const gridScreen = document.getElementById("gridScreen");
const deptScreen = document.getElementById("deptScreen");

const breadcrumb = document.getElementById("breadcrumb");
const btnBack = document.getElementById("btnBack");
const btnHome = document.getElementById("btnHome");
const btnConsulta = document.getElementById("btnConsulta");

const inpDept = document.getElementById("inpDept");
const inpDate = document.getElementById("inpDate");
const inpObs = document.getElementById("inpObs");
const btnSave = document.getElementById("btnSave");
const btnClearChurch = document.getElementById("btnClearChurch");
const recordList = document.getElementById("recordList");

const queryDept = document.getElementById("queryDept");
const btnPesquisarDept = document.getElementById("btnPesquisarDept");
const deptInfo = document.getElementById("deptInfo");

const pageTitle = document.getElementById("pageTitle");
const recordTitle = document.getElementById("recordTitle");
const recordSub = document.getElementById("recordSub");

let state = {
  screen: "regions",
  reg: null,
  dist: null,
  church: null,
  key: null
};

/* =========================
   TELAS
========================= */
function hideAllScreens() {
  gridScreen.classList.add("hidden");
  recordScreen.classList.add("hidden");
  deptScreen.classList.add("hidden");
}

function showRegions() {
  state.screen = "regions";
  state.reg = null;
  state.dist = null;
  state.church = null;
  state.key = null;

  hideAllScreens();
  gridScreen.classList.remove("hidden");

  pageTitle.textContent = "REGIÃO";
  grid.className = "grid regions";
  grid.innerHTML = "";
  breadcrumb.textContent = "";
  btnBack.disabled = true;

  DATA.forEach(regiao => {
    const { node, circle } = makeNode(regiao.rotulo, 0);

    circle.onclick = () => {
      state.reg = regiao;
      showDistricts();
    };

    grid.appendChild(node);
  });
}

function showDistricts() {
  state.screen = "districts";

  hideAllScreens();
  gridScreen.classList.remove("hidden");

  grid.className = "grid auto";
  grid.innerHTML = "";
  breadcrumb.textContent = state.reg.nome;
  btnBack.disabled = false;
  pageTitle.textContent = "DISTRITO";

  state.reg.distritos.forEach(distrito => {
    const { node, circle } = makeNode(distrito.nome, 0);

    circle.onclick = () => {
      state.dist = distrito;
      showChurches();
    };

    grid.appendChild(node);
  });
}

async function showChurches() {
  state.screen = "churches";

  hideAllScreens();
  gridScreen.classList.remove("hidden");

  grid.innerHTML = "";
  grid.className = "grid auto";
  pageTitle.textContent = "IGREJAS";
  breadcrumb.textContent = `${state.reg.nome} > ${state.dist.nome}`;

  const churches = state.dist.igrejas;

  if (!Array.isArray(churches) || churches.length === 0) {
    const msg = document.createElement("div");
    msg.style.fontSize = "22px";
    msg.style.color = "#555";
    msg.style.textAlign = "center";
    msg.style.width = "100%";
    msg.style.marginTop = "30px";
    msg.textContent = "Nenhuma igreja encontrada neste distrito.";
    grid.appendChild(msg);
    return;
  }

  const visits = await getAll();
  const counts = uniqueDepartmentCountByChurch(visits);

  churches.forEach(igreja => {
    const key = makeChurchKey(state.reg.id, state.dist.id, igreja);
    const count = counts[key] || 0;

    const { node, circle } = makeNode(igreja, count);

    circle.onclick = () => {
      state.church = igreja;
      state.key = key;
      showRecord();
    };

    grid.appendChild(node);
  });
}

function showRecord() {
  state.screen = "record";

  hideAllScreens();
  recordScreen.classList.remove("hidden");

  pageTitle.textContent = "REGISTRO";
  btnBack.disabled = false;

  recordTitle.textContent = state.church;
  recordSub.textContent = `${state.reg.nome} > ${state.dist.nome}`;

  inpDate.value = today();
  inpDept.value = "";
  inpObs.value = "";

  loadRecords();
}

function showDepartmentScreen() {
  state.screen = "departmentSearch";

  hideAllScreens();
  deptScreen.classList.remove("hidden");

  pageTitle.textContent = "CONSULTA";
  breadcrumb.textContent = "";
  btnBack.disabled = false;

  deptGrid.innerHTML = "";
  deptInfo.textContent = "";
}

async function renderDepartmentResults() {
  const departamento = queryDept.value;

  deptGrid.innerHTML = "";
  deptInfo.textContent = "";

  if (!departamento) {
    deptInfo.textContent = "Selecione um departamento.";
    return;
  }

  const visits = await getAll();
  const filtered = visits.filter(v => normalizeText(v.departamento) === normalizeText(departamento));

  if (!filtered.length) {
    deptInfo.textContent = "Nenhum registro encontrado para este departamento.";
    return;
  }

  const grouped = {};

  filtered.forEach(v => {
    const churchKey = v.church_key;
    const realChurchName = v.igreja || v.church_name || getChurchNameFromKey(churchKey);

    if (!grouped[churchKey]) {
      grouped[churchKey] = {
        igreja: realChurchName,
        total: 0,
        registros: []
      };
    }

    grouped[churchKey].total += 1;
    grouped[churchKey].registros.push(v);
  });

  const items = Object.values(grouped).sort((a, b) => a.igreja.localeCompare(b.igreja));

  deptInfo.textContent = `${departamento} • ${items.length} igrejas encontradas`;

  items.forEach(item => {
    const registrosOrdenados = item.registros
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
      .map(r => ({
        data: r.data,
        observacao: r.observacao
      }));

    const { node } = makeNode(item.igreja, item.total, registrosOrdenados);
    deptGrid.appendChild(node);
  });
}

async function loadRecords() {
  recordList.innerHTML = "";
  const visits = await getAll();

  visits
    .filter(v => v.church_key === state.key)
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
    .forEach(v => {
      const div = document.createElement("div");
      const obs = v.observacao ? ` - ${v.observacao}` : "";
      div.textContent = `${v.departamento} - ${v.data}${obs}`;
      recordList.appendChild(div);
    });
}

/* =========================
   BOTÕES
========================= */
btnSave.onclick = async () => {
  const dep = inpDept.value;
  const date = inpDate.value;
  const obs = inpObs.value;

  if (!dep) {
    alert("Escolha um departamento.");
    return;
  }

  if (!obs) {
    alert("Escolha uma observação.");
    return;
  }

  try {
    await insertVisit({
      church_key: state.key,
      church_name: state.church,
      igreja: state.church,
      regiao: state.reg.nome,
      distrito: state.dist.nome,
      departamento: dep,
      data: date,
      observacao: obs
    });

    await loadRecords();
    await showChurches();
  } catch (error) {
    console.error(error);
    alert("Não foi possível salvar o registro.");
  }
};

btnClearChurch.onclick = async () => {
  try {
    const all = await getAll();
    const total = all.filter(v => v.church_key === state.key).length;

    if (!total) {
      alert("Esta igreja não possui registros para apagar.");
      return;
    }

    const confirmed = confirm(`Deseja apagar ${total} registro(s) desta igreja?`);
    if (!confirmed) return;

    await deleteVisitsByChurchKey(state.key);

    await loadRecords();
    await showChurches();
    alert("Registros apagados com sucesso.");
  } catch (error) {
    console.error(error);
    alert("Não foi possível zerar os registros desta igreja.");
  }
};

btnPesquisarDept.onclick = () => {
  renderDepartmentResults();
};

btnConsulta.onclick = () => {
  showDepartmentScreen();
};

btnBack.onclick = () => {
  if (state.screen === "record") {
    showChurches();
    return;
  }

  if (state.screen === "churches") {
    state.dist = null;
    showDistricts();
    return;
  }

  if (state.screen === "districts") {
    showRegions();
    return;
  }

  if (state.screen === "departmentSearch") {
    showRegions();
  }
};

btnHome.onclick = () => {
  showRegions();
};

(async function init() {
  try {
    await loadData();
    console.log("DATA carregado:", DATA);
    showRegions();
  } catch (error) {
    console.error(error);
    alert("Erro ao carregar os dados. Verifique o arquivo data.json.");
  }
})();