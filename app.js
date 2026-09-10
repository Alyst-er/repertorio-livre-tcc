(() => {
  "use strict";

  const DATA_KEY = "repertorioLivreFullstackData";
  const PROFILE_KEY = "repertorioLivreFullstackProfile";
  const uid = () => window.crypto && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const today = () => new Date().toISOString().slice(0, 10);

  const seed = [];

  const defaultProfile = {
    name: "",
    stageName: "",
    role: "",
    instruments: [],
    city: "",
    bio: "",
    instagram: "",
    phone: "",
    email: ""
  };

  function loadData() {
    try {
      const value = JSON.parse(localStorage.getItem(DATA_KEY));
      if (Array.isArray(value)) return value;
    } catch (error) { console.warn("Dados locais inválidos; usando amostra.", error); }
    return seed;
  }
  function saveData(data) { localStorage.setItem(DATA_KEY, JSON.stringify(data)); syncToServer(data); }
  function syncToServer(data) {
    fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repertoires: data }) }).catch(() => {});
  }
  function loadProfile() {
    try { return { ...defaultProfile, ...(JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}) }; }
    catch { return { ...defaultProfile }; }
  }
  function saveProfile(profile) { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) }).catch(() => {}); }
  function formatDate(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
  }
  function isUpcoming(value) { return value && new Date(`${value}T23:59:59`).getTime() >= Date.now(); }
  function toast(message, type = "success") {
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.textContent = message;
    document.body.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));
    setTimeout(() => { node.classList.remove("show"); setTimeout(() => node.remove(), 220); }, 3000);
  }

  function layout(title, content) {
    document.title = `${title} | Repertório Livre`;
    const page = document.body.dataset.page;
    const nav = [
      ["index.html", "Início", "♪", "home"],
      ["repertorios.html", "Repertórios", "▥", "repertoires"],
      ["criar.html", "Criar repertório", "+", "create", true],
      ["eventos.html", "Eventos", "▣", "events"],
      ["perfil.html", "Perfil & TCC", "♙", "profile"]
    ];
    return `
      <header class="topbar"><div class="container nav">
        <a class="brand" href="index.html"><span class="mark">RL</span><span><strong>Repertório Livre</strong><small>TCC Sistemas de Informação · UFRA Capitão Poço</small></span><em>● Interativo</em></a>
        <button class="menu-toggle" aria-label="Abrir menu">☰</button>
        <nav class="menu">${nav.map(([href, label, icon, key, highlight]) => `<a class="${page === key ? "active" : ""} ${highlight ? "highlight" : ""}" href="${href}"><span>${icon}</span>${label}</a>`).join("")}<a href="login.html"><span>◎</span>Entrar</a></nav>
      </div></header>
      ${content}
      <footer class="footer"><div class="container">
        <div class="footer-main"><div><strong class="footer-title">Repertório Livre</strong><span class="version">HTML · CSS · JS</span><p>Protótipo funcional do TCC em Sistemas de Informação, UFRA Campus Capitão Poço.</p><small class="local-badge">◉ Dados salvos localmente neste navegador</small></div><div class="footer-links"><a href="index.html">Início</a><a href="repertorios.html">Biblioteca</a><a href="criar.html">Novo repertório</a><a href="eventos.html">Agenda</a><a href="perfil.html">Perfil & TCC</a></div></div>
        <div class="footer-tools"><div><button class="button small" id="export-backup">↓ Baixar backup</button><button class="button small" id="import-backup">↑ Restaurar backup</button><input id="backup-file" type="file" accept="application/json,.json" hidden></div><span>© 2026 Repertório Livre · Feito para músicos, bandas e estudantes</span></div>
      </div></footer>`;
  }

  function bindGlobal() {
    const toggle = document.querySelector(".menu-toggle");
    const menu = document.querySelector(".menu");
    if (toggle) toggle.addEventListener("click", () => menu.classList.toggle("open"));
    document.querySelectorAll(".menu a").forEach((link) => link.addEventListener("click", () => menu.classList.remove("open")));

    const exportButton = document.getElementById("export-backup");
    const importButton = document.getElementById("import-backup");
    const fileInput = document.getElementById("backup-file");
    if (exportButton) exportButton.addEventListener("click", downloadBackup);
    if (importButton) importButton.addEventListener("click", () => fileInput.click());
    if (fileInput) fileInput.addEventListener("change", importBackup);
  }

  function downloadBackup() {
    const payload = { version: 1, app: "Repertório Livre", exportedAt: new Date().toISOString(), repertoires: loadData(), profile: loadProfile() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `repertorio-livre-backup-${today()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast("Backup JSON baixado com sucesso.");
  }

  function importBackup(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (payload.app !== "Repertório Livre" || payload.version !== 1 || !Array.isArray(payload.repertoires) || !payload.profile) throw new Error("Backup incompatível ou incompleto.");
        if (!confirm("Restaurar este backup substituirá os dados atuais neste navegador. Deseja continuar?")) return;
        saveData(payload.repertoires);
        saveProfile({ ...defaultProfile, ...payload.profile });
        toast(`${payload.repertoires.length} repertórios restaurados.`);
        setTimeout(() => location.reload(), 700);
      } catch (error) { toast(error.message || "Não foi possível ler o backup.", "error"); }
    };
    reader.readAsText(file);
  }

  function card(rep) {
    const date = rep.date ? `<span class="date">▣ ${formatDate(rep.date)}</span>` : `<span class="muted">Sem data</span>`;
    const category = rep.category ? `<small class="category">${esc(rep.category)}</small>` : "";
    const songs = rep.songs.slice(0, 4).map((song, index) => {
      const artist = song.artist ? ` — ${esc(song.artist)}` : "";
      const key = song.key ? `<b>${esc(song.key)}</b>` : "";
      return `<div><span>${index + 1}. ${esc(song.title)}${artist}</span>${key}</div>`;
    }).join("");
    const notes = rep.notes ? `<p class="note">${esc(rep.notes)}</p>` : "";
    return `<article class="card repertoire-card"><div class="card-top"><span class="tag">${rep.songs.length} música${rep.songs.length !== 1 ? "s" : ""}</span>${date}</div><h3>${esc(rep.name)}</h3>${category}<div class="song-preview"><small>FAIXAS EM DESTAQUE</small>${songs}</div>${notes}<div class="card-actions"><a class="button primary grow" href="visualizar.html?id=${encodeURIComponent(rep.id)}">Abrir repertório →</a><a class="icon-button" title="Editar" href="criar.html?edit=${encodeURIComponent(rep.id)}">✎</a><button class="icon-button" title="Duplicar" data-duplicate="${rep.id}">⧉</button><button class="icon-button danger" title="Excluir" data-delete="${rep.id}">♲</button></div></article>`;
  }

  function bindCardActions() {
    document.querySelectorAll("[data-duplicate]").forEach((button) => button.addEventListener("click", () => {
      const data = loadData();
      const original = data.find((rep) => rep.id === button.dataset.duplicate);
      if (!original) return;
      const copy = { ...original, id: uid(), name: `${original.name} (Cópia)`, created: Date.now(), updatedAt: Date.now(), songs: original.songs.map((song) => ({ ...song, id: uid() })) };
      saveData([copy, ...data]);
      toast("Repertório duplicado.");
      setTimeout(() => location.reload(), 450);
    }));
    document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
      const data = loadData();
      const target = data.find((rep) => rep.id === button.dataset.delete);
      if (!target || !confirm(`Excluir o repertório “${target.name}”?`)) return;
      saveData(data.filter((rep) => rep.id !== target.id));
      toast("Repertório removido.");
      setTimeout(() => location.reload(), 450);
    }));
  }

  function renderHome() {
    const data = loadData();
    const upcoming = data.filter((rep) => isUpcoming(rep.date)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const songs = data.reduce((sum, rep) => sum + rep.songs.length, 0);
    const featured = upcoming.slice(0, 3);
    return layout("Início", `<main><section class="hero"><div class="container"><span class="eyebrow">✦ Gestão Musical para Ensaios e Apresentações ao Vivo</span><h1>Seu repertório,<br><strong>sempre afinado e à mão.</strong></h1><p class="lead">Organize músicas, tonalidades, durações e anotações técnicas em um único ambiente rápido. Feito para cantores, instrumentistas e bandas manterem o foco no que realmente importa: a música.</p><div class="actions"><a class="button primary large" href="criar.html">＋ Criar novo repertório</a><a class="button large" href="repertorios.html">Explorar biblioteca →</a></div><div class="stats"><div><small>REPERTÓRIOS</small><strong>${data.length}</strong><span>Listas configuradas</span></div><div><small>MÚSICAS</small><strong>${songs}</strong><span>Com tons e observações</span></div><div><small>APRESENTAÇÕES</small><strong class="green">${upcoming.length}</strong><span>Datas agendadas</span></div><div><small>MODO PALCO</small><strong>100%</strong><span>Leitura e transposição</span></div></div></div></section><section class="section"><div class="container"><div class="section-heading"><div><span class="eyebrow green-text">Compromissos</span><h2>Próximas apresentações</h2><p class="muted">Planejamento do repertório e da agenda</p></div><a href="eventos.html" class="text-link">Ver cronograma completo →</a></div>${featured.length ? `<div class="grid three">${featured.map((rep) => `<article class="card event-card"><div class="card-top"><span class="tag green-tag">▣ ${formatDate(rep.date)}</span><span class="category">${esc(rep.category || "Evento")}</span></div><h3>${esc(rep.name)}</h3><p class="muted">${rep.location ? `⌖ ${esc(rep.location)}` : "Local não informado"}</p><div class="event-setlist">${rep.songs.slice(0, 3).map((song) => `<span>${esc(song.title)}</span>`).join(" · ")}</div><a href="visualizar.html?id=${encodeURIComponent(rep.id)}" class="button primary full">Abrir modo palco →</a></article>`).join("")}</div>` : `<div class="empty">Nenhuma apresentação futura agendada. <a class="text-link" href="criar.html">Criar repertório</a></div>`}</div></section><section class="section compact"><div class="container"><div class="callout"><span class="eyebrow">✦ Contexto do projeto</span><h2>Organização musical com aplicação prática e acadêmica</h2><p>O Repertório Livre foi pensado para diminuir o tempo perdido em ensaios, resolver desencontros de tonalidade e deixar o setlist acessível durante a apresentação.</p><a href="perfil.html" class="text-link">Conhecer o perfil e o TCC →</a></div></div></section></main>`);
  }

  function renderRepertoires() {
    const data = loadData();
    return layout("Repertórios", `<main class="page"><div class="container"><div class="page-heading"><div><span class="eyebrow">Biblioteca musical</span><h1>Seus repertórios</h1><p class="muted">${data.length} lista${data.length !== 1 ? "s" : ""} cadastrada${data.length !== 1 ? "s" : ""}</p></div><a href="criar.html" class="button primary">＋ Novo repertório</a></div><div class="filters"><label class="search-box">⌕<input id="search" placeholder="Buscar repertório, música, artista, tom ou observação..." aria-label="Buscar repertórios"></label><select id="category"><option value="all">Todas as categorias</option>${[...new Set(data.map((rep) => rep.category).filter(Boolean))].map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join("")}</select><select id="sort"><option value="recent">Mais recentes</option><option value="date">Data da apresentação</option><option value="songs">Quantidade de músicas</option><option value="name">Ordem alfabética</option></select></div><div id="results" class="grid three">${data.map(card).join("")}</div></div></main>`);
  }

  function bindRepertoires() {
    const data = loadData();
    const search = document.getElementById("search");
    const category = document.getElementById("category");
    const sort = document.getElementById("sort");
    const results = document.getElementById("results");
    function update() {
      const term = search.value.toLowerCase().trim();
      let filtered = data.filter((rep) => {
        if (category.value !== "all" && rep.category !== category.value) return false;
        if (!term) return true;
        return [rep.name, rep.notes, rep.location, ...rep.songs.flatMap((song) => [song.title, song.artist, song.key])].join(" ").toLowerCase().includes(term);
      });
      filtered.sort((a, b) => sort.value === "date" ? (a.date || "9999").localeCompare(b.date || "9999") : sort.value === "songs" ? b.songs.length - a.songs.length : sort.value === "name" ? a.name.localeCompare(b.name) : (b.updatedAt || b.created) - (a.updatedAt || a.created));
      results.innerHTML = filtered.length ? filtered.map(card).join("") : `<div class="empty span-all">Nenhum repertório encontrado para essa busca.</div>`;
      bindCardActions();
    }
    [search, category, sort].forEach((control) => control.addEventListener("input", update));
    bindCardActions();
  }

  function songRow(song = {}) {
    return `<div class="song-row" data-song-id="${esc(song.id || uid())}"><span class="song-number">01</span><input data-field="title" value="${esc(song.title)}" placeholder="Título da música"><input data-field="artist" value="${esc(song.artist)}" placeholder="Artista / intérprete"><input data-field="key" value="${esc(song.key)}" placeholder="Tom"><input data-field="duration" value="${esc(song.duration)}" placeholder="Duração"><input data-field="notes" value="${esc(song.notes)}" placeholder="Anotação de ensaio"><div class="song-buttons"><button type="button" data-up title="Mover para cima">↑</button><button type="button" data-down title="Mover para baixo">↓</button><button type="button" class="danger-text" data-remove title="Remover">×</button></div></div>`;
  }
  function renderCreate() {
    const data = loadData();
    const id = new URLSearchParams(location.search).get("edit");
    const existing = data.find((rep) => rep.id === id);
    const rep = existing || { name: "", date: "", time: "", location: "", category: "Acústico", notes: "", songs: [{}, {}, {}] };
    return layout(existing ? "Editar repertório" : "Criar repertório", `<main class="page"><div class="container narrow"><div class="back-line"><a href="repertorios.html">← Voltar para repertórios</a><span class="tag">${existing ? "Modo de edição" : "Novo cadastro"}</span></div><div class="page-heading solo"><div><span class="eyebrow">Configuração do setlist</span><h1>${existing ? "Editar repertório" : "Criar repertório musical"}</h1><p class="muted">Cadastre a sequência de músicas, tons, andamento e observações do ensaio ou apresentação.</p></div></div><form id="create-form" class="form"><section class="panel"><h2>♪ Dados principais do repertório</h2><div class="form-grid"><label class="wide">Nome do repertório *<input name="name" required value="${esc(rep.name)}" placeholder="Ex.: Show acústico — outubro/2026"></label><label>Data da apresentação<input type="date" name="date" value="${esc(rep.date)}"></label><label>Horário previsto<input type="time" name="time" value="${esc(rep.time)}"></label><label>Local / palco<input name="location" value="${esc(rep.location)}" placeholder="Ex.: Teatro Municipal"></label><label>Categoria<select name="category"><option ${rep.category === "Acústico" ? "selected" : ""}>Acústico</option><option ${rep.category === "Banda" ? "selected" : ""}>Banda</option><option ${rep.category === "Estudo" ? "selected" : ""}>Estudo</option><option ${rep.category === "Barzinho" ? "selected" : ""}>Barzinho</option><option ${rep.category === "Casamento" ? "selected" : ""}>Casamento</option><option ${rep.category === "Igreja" ? "selected" : ""}>Igreja</option><option ${rep.category === "Outro" ? "selected" : ""}>Outro</option></select></label></div></section><section class="panel"><div class="section-heading inline"><div><h2>♪ Sequência de músicas</h2><p class="muted">A ordem das faixas pode ser alterada antes de salvar.</p></div><button type="button" class="button small" id="suggest">✦ Sugerir clássicos</button></div><div id="songs" class="song-list">${rep.songs.map(songRow).join("")}</div><button type="button" id="add-song" class="button dashed full">＋ Adicionar música</button></section><section class="panel"><label>Observações gerais<textarea name="notes" rows="5" placeholder="Equipamentos, horário de passagem de som, combinações para o bis...">${esc(rep.notes)}</textarea></label></section><div class="form-actions"><a href="repertorios.html" class="button">Cancelar</a><button class="button primary" type="submit">✓ ${existing ? "Salvar alterações" : "Salvar repertório"}</button></div></form></div></main>`);
  }

  function bindCreate() {
    const data = loadData();
    const params = new URLSearchParams(location.search);
    const editId = params.get("edit");
    const songs = document.getElementById("songs");
    const redrawNumbers = () => songs.querySelectorAll(".song-row").forEach((row, index) => row.querySelector(".song-number").textContent = String(index + 1).padStart(2, "0"));
    const bindRows = () => {
      songs.querySelectorAll("[data-remove]").forEach((button) => button.onclick = () => { if (songs.children.length > 1) { button.closest(".song-row").remove(); redrawNumbers(); } else toast("Mantenha pelo menos uma faixa.", "error"); });
      songs.querySelectorAll("[data-up]").forEach((button) => button.onclick = () => { const row = button.closest(".song-row"); if (row.previousElementSibling) songs.insertBefore(row, row.previousElementSibling); redrawNumbers(); });
      songs.querySelectorAll("[data-down]").forEach((button) => button.onclick = () => { const row = button.closest(".song-row"); if (row.nextElementSibling) songs.insertBefore(row.nextElementSibling, row); redrawNumbers(); });
    };
    bindRows(); redrawNumbers();
    document.getElementById("add-song").onclick = () => { songs.insertAdjacentHTML("beforeend", songRow({ id: uid() })); bindRows(); redrawNumbers(); songs.lastElementChild.querySelector("input").focus(); };
    document.getElementById("suggest").onclick = () => { const suggestions = [{ title: "Como nossos pais", artist: "Elis Regina", key: "G", duration: "4:30" }, { title: "Oceano", artist: "Djavan", key: "A", duration: "4:40" }, { title: "Malandragem", artist: "Cássia Eller", key: "E", duration: "4:10" }]; suggestions.forEach((song) => songs.insertAdjacentHTML("beforeend", songRow({ ...song, id: uid() }))); bindRows(); redrawNumbers(); toast("Clássicos adicionados à lista."); };
    document.getElementById("create-form").onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const rows = [...songs.querySelectorAll(".song-row")].map((row) => { const result = {}; row.querySelectorAll("[data-field]").forEach((input) => result[input.dataset.field] = input.value.trim()); return { ...result, id: row.dataset.songId, key: result.key ? result.key.toUpperCase() : "" }; }).filter((song) => song.title);
      if (!rows.length) return toast("Adicione pelo menos uma música com título.", "error");
      const payload = { name: form.get("name").trim(), date: form.get("date"), time: form.get("time"), location: form.get("location").trim(), category: form.get("category"), notes: form.get("notes").trim(), songs: rows, updatedAt: Date.now() };
      if (!payload.name) return toast("Informe o nome do repertório.", "error");
      if (editId) { const updated = data.map((item) => item.id === editId ? { ...item, ...payload } : item); saveData(updated); toast("Repertório atualizado."); setTimeout(() => location.href = `visualizar.html?id=${encodeURIComponent(editId)}`, 500); }
      else { const newId = uid(); saveData([{ ...payload, id: newId, created: Date.now(), pinned: false }, ...data]); toast("Repertório criado."); setTimeout(() => location.href = `visualizar.html?id=${encodeURIComponent(newId)}`, 500); }
    };
  }

  function renderView() {
    const data = loadData();
    const id = new URLSearchParams(location.search).get("id");
    const rep = data.find((item) => item.id === id) || data[0];
    if (!rep) return layout("Repertório", `<main class="page"><div class="container"><div class="empty">Nenhum repertório encontrado.</div></div></main>`);
    return layout(rep.name, `<main class="page"><div class="container view-container"><div class="view-actions"><a href="repertorios.html">← Voltar</a><div><a class="button small" href="criar.html?edit=${encodeURIComponent(rep.id)}">✎ Editar</a><button class="button small" id="copy-setlist">⧉ Copiar setlist</button><button class="button small" id="share-setlist">♧ Compartilhar</button><button class="button small" id="print-setlist">▣ Imprimir / PDF</button><button class="button small danger-button" id="delete-setlist">Excluir</button></div></div><div class="stage-tools"><div><small>METRÔNOMO RÁPIDO</small><strong><span id="bpm-value">100</span> <small>BPM</small></strong><button id="bpm-minus">−</button><button id="bpm-plus">＋</button><button id="metronome" class="button primary small">▶ Iniciar</button></div><div><small>TEMA DA FOLHA</small><button class="theme-chip active" data-theme="vintage">Vintage</button><button class="theme-chip" data-theme="dark">Dark</button><button class="theme-chip" data-theme="clean">Clean</button></div><div><small>PROGRESSO DO SHOW</small><strong id="progress">0%</strong><span class="progress-bar"><i id="progress-fill"></i></span></div></div><article class="paper vintage" id="paper"><div class="paper-meta"><span>REPERTÓRIO LIVRE · SETLIST AO VIVO</span><span>${rep.songs.length} FAIXAS</span></div><h1>${esc(rep.name)}</h1><div class="paper-details">${rep.date ? `<span>▣ ${formatDate(rep.date)}</span>` : ""}${rep.time ? `<span>◷ ${esc(rep.time)}</span>` : ""}${rep.location ? `<span>⌖ ${esc(rep.location)}</span>` : ""}${rep.category ? `<b>${esc(rep.category)}</b>` : ""}</div><div id="track-list">${rep.songs.map((song, index) => `<div class="track" data-track="${esc(song.id)}"><button class="track-check">${String(index + 1).padStart(2, "0")}</button><div class="track-info"><strong>${esc(song.title)}</strong><span>${esc(song.artist || "Artista não informado")}${song.duration ? ` · ${esc(song.duration)}` : ""}${song.bpm ? ` · ${esc(song.bpm)} BPM` : ""}</span>${song.notes ? `<em>Anotação: ${esc(song.notes)}</em>` : ""}</div><div class="transpose"><button data-transpose="-1">♭</button><b data-key="${esc(song.key)}">${esc(song.key || "—")}</b><button data-transpose="1">♯</button></div></div>`).join("")}</div>${rep.notes ? `<div class="paper-notes"><b>Observações técnicas</b><p>${esc(rep.notes)}</p></div>` : ""}</article></div></main>`);
  }

  function bindView() {
    const rep = loadData().find((item) => item.id === new URLSearchParams(location.search).get("id")) || loadData()[0];
    const paper = document.getElementById("paper");
    const tracks = document.querySelectorAll(".track");
    const checked = new Set();
    const semitones = {};
    const scale = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const transpose = (key, delta) => { if (!key) return key; const minor = key.endsWith("m"); const base = minor ? key.slice(0, -1) : key; const index = scale.indexOf({ Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" }[base] || base); if (index < 0) return key; return scale[(index + delta + 120) % 12] + (minor ? "m" : ""); };
    const updateProgress = () => { const percent = rep.songs.length ? Math.round(checked.size / rep.songs.length * 100) : 0; document.getElementById("progress").textContent = `${percent}%`; document.getElementById("progress-fill").style.width = `${percent}%`; };
    tracks.forEach((track) => track.addEventListener("click", (event) => { if (event.target.closest(".transpose")) return; const id = track.dataset.track; track.classList.toggle("played"); track.classList.contains("played") ? checked.add(id) : checked.delete(id); track.querySelector(".track-check").textContent = track.classList.contains("played") ? "✓" : String([...tracks].indexOf(track) + 1).padStart(2, "0"); updateProgress(); }));
    tracks.forEach((track) => track.querySelectorAll("[data-transpose]").forEach((button) => button.onclick = (event) => { event.stopPropagation(); const id = track.dataset.track; semitones[id] = (semitones[id] || 0) + Number(button.dataset.transpose); const key = track.querySelector("[data-key]"); key.textContent = transpose(key.dataset.key, semitones[id]); }));
    document.querySelectorAll(".theme-chip").forEach((button) => button.onclick = () => { document.querySelectorAll(".theme-chip").forEach((item) => item.classList.remove("active")); button.classList.add("active"); paper.className = `paper ${button.dataset.theme}`; });
    document.getElementById("print-setlist").onclick = () => window.print();
    document.getElementById("delete-setlist").onclick = () => { if (confirm(`Excluir o repertório “${rep.name}”?`)) { saveData(loadData().filter((item) => item.id !== rep.id)); location.href = "repertorios.html"; } };
    document.getElementById("copy-setlist").onclick = () => { const text = [`🎵 ${rep.name}`, rep.date ? `Data: ${formatDate(rep.date)}` : "", rep.location ? `Local: ${rep.location}` : "", "", "--- SETLIST ---", ...rep.songs.map((song, index) => `${String(index + 1).padStart(2, "0")}. ${song.title}${song.artist ? ` — ${song.artist}` : ""} [Tom: ${song.key || "—"}]`)].filter(Boolean).join("\n"); navigator.clipboard?.writeText(text).then(() => toast("Setlist copiado."), () => toast("Não foi possível copiar automaticamente.", "error")); };
    document.getElementById("share-setlist").onclick = async () => { try { if (navigator.share) await navigator.share({ title: rep.name, text: `${rep.name} — ${rep.songs.length} faixas`, url: location.href }); else { await navigator.clipboard.writeText(location.href); toast("Link copiado para compartilhar."); } } catch {} };
    let bpm = 100; let timer = null; let audio;
    const beep = () => { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); const osc = audio.createOscillator(); const gain = audio.createGain(); osc.frequency.value = 880; gain.gain.value = .12; gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .06); osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .06); };
    const restartMetronome = () => { if (timer) clearInterval(timer); if (document.getElementById("metronome").dataset.running === "true") timer = setInterval(beep, 60000 / bpm); };
    document.getElementById("bpm-minus").onclick = () => { bpm = Math.max(40, bpm - 5); document.getElementById("bpm-value").textContent = bpm; restartMetronome(); };
    document.getElementById("bpm-plus").onclick = () => { bpm = Math.min(240, bpm + 5); document.getElementById("bpm-value").textContent = bpm; restartMetronome(); };
    document.getElementById("metronome").onclick = (event) => { const button = event.currentTarget; const running = button.dataset.running === "true"; button.dataset.running = String(!running); button.textContent = running ? "▶ Iniciar" : "■ Parar"; if (running) { clearInterval(timer); } else { beep(); restartMetronome(); } };
  }

  function renderEvents() {
    const data = loadData().filter((rep) => rep.date).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const upcoming = data.filter((rep) => isUpcoming(rep.date));
    const past = data.filter((rep) => !isUpcoming(rep.date));
    const eventCard = (rep) => `<article class="card event-card"><div class="card-top"><span class="tag green-tag">▣ ${formatDate(rep.date)}</span>${rep.time ? `<span class="muted">◷ ${esc(rep.time)}</span>` : ""}</div><h3>${esc(rep.name)}</h3><p class="muted">${rep.location ? `⌖ ${esc(rep.location)}` : "Local não informado"}</p><div class="event-setlist">${rep.songs.map((song) => esc(song.title)).join(" · ")}</div><div class="card-actions"><a href="visualizar.html?id=${encodeURIComponent(rep.id)}" class="button primary grow">Abrir modo palco →</a><a href="criar.html?edit=${encodeURIComponent(rep.id)}" class="button">Editar</a></div></article>`;
    return layout("Eventos", `<main class="page"><div class="container"><div class="page-heading"><div><span class="eyebrow green-text">Planejamento & agenda</span><h1>Eventos e apresentações</h1><p class="muted">Datas vinculadas aos repertórios para facilitar ensaios e apresentações ao vivo.</p></div><a href="criar.html" class="button primary">＋ Agendar no repertório</a></div><section class="subsection"><h2>● Próximas datas (${upcoming.length})</h2>${upcoming.length ? `<div class="grid two">${upcoming.map(eventCard).join("")}</div>` : `<div class="empty">Nenhuma apresentação futura agendada. <a class="text-link" href="criar.html">Adicionar evento</a></div>`}</section>${past.length ? `<section class="subsection history"><h2>✓ Histórico de apresentações (${past.length})</h2><div class="grid three">${past.map(eventCard).join("")}</div></section>` : ""}</div></main>`);
  }

  function renderProfile() {
    const profile = loadProfile();
    return layout("Perfil", `<main class="page"><div class="container narrow"><div class="page-heading solo"><div><span class="eyebrow">Músico & projeto acadêmico</span><h1>Perfil do músico & TCC</h1><p class="muted">Informações do artista, preferências de ensaio e contexto do protótipo desenvolvido na UFRA Capitão Poço.</p></div></div><section class="panel profile-card"><div class="profile-top"><div class="avatar">${esc(profile.stageName.charAt(0))}</div><div><h2>${esc(profile.stageName)}</h2><p class="muted">${esc(profile.role)} · ${esc(profile.city)}</p></div><button id="edit-profile" class="button">Editar meu perfil</button></div><div id="profile-display"><span class="label">SOBRE O MÚSICO</span><p>${esc(profile.bio)}</p><span class="label">INSTRUMENTOS & ATUAÇÃO</span><div class="chips">${profile.instruments.map((instrument) => `<span class="chip">♪ ${esc(instrument)}</span>`).join("")}</div><div class="contact-row"><span>◎ ${esc(profile.instagram)}</span><span>☏ ${esc(profile.phone)}</span><span>⌖ ${esc(profile.city)}</span></div></div><form id="profile-form" class="form hidden"><div class="form-grid"><label>Nome artístico<input name="stageName" value="${esc(profile.stageName)}"></label><label>Função<input name="role" value="${esc(profile.role)}"></label><label>Cidade<input name="city" value="${esc(profile.city)}"></label><label>Instrumentos<input name="instruments" value="${esc(profile.instruments.join(", "))}"></label><label class="wide">Bio<textarea name="bio" rows="4">${esc(profile.bio)}</textarea></label><label>Instagram<input name="instagram" value="${esc(profile.instagram)}"></label><label>Telefone<input name="phone" value="${esc(profile.phone)}"></label></div><div class="form-actions"><button type="button" id="cancel-profile" class="button">Cancelar</button><button class="button primary">Salvar perfil</button></div></form></section><section class="callout academic"><span class="eyebrow">⌘ Documentação acadêmica do protótipo</span><h2>Bacharelado em Sistemas de Informação · UFRA Capitão Poço</h2><p>O Repertório Livre foi concebido para organizar o trabalho de músicos e bandas, reduzindo a descentralização de arquivos, os desencontros de tonalidade e a falta de uma visualização adequada para palco.</p><div class="grid three"><div><b>1. Descentralização</b><p>Substituir prints, conversas e cadernos soltos por um repertório organizado.</p></div><div><b>2. Tonalidade</b><p>Registrar o tom de cada faixa e permitir a transposição durante a performance.</p></div><div><b>3. Modo palco</b><p>Disponibilizar uma folha legível, rápida e com alto contraste para o músico.</p></div></div></section></div></main>`);
  }

  function bindProfile() {
    const display = document.getElementById("profile-display");
    const form = document.getElementById("profile-form");
    document.getElementById("edit-profile").onclick = () => { display.classList.add("hidden"); form.classList.remove("hidden"); };
    document.getElementById("cancel-profile").onclick = () => { form.classList.add("hidden"); display.classList.remove("hidden"); };
    form.onsubmit = (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); const next = { ...loadProfile(), ...values, instruments: String(values.instruments).split(",").map((item) => item.trim()).filter(Boolean) }; saveProfile(next); toast("Perfil salvo."); setTimeout(() => location.reload(), 450); };
  }

  function render() {
    const page = document.body.dataset.page;
    let html = page === "home" ? renderHome() : page === "repertoires" ? renderRepertoires() : page === "create" ? renderCreate() : page === "view" ? renderView() : page === "events" ? renderEvents() : renderProfile();
    document.getElementById("app").innerHTML = html;
    bindGlobal();
    if (page === "repertoires") bindRepertoires();
    if (page === "create") bindCreate();
    if (page === "view") bindView();
    if (page === "profile") bindProfile();
  }

  async function bootstrapServerState() {
    try {
      const response = await fetch("/api/state");
      if (!response.ok) return;
      const state = await response.json();
      if (Array.isArray(state.repertoires) && state.repertoires.length) {
        localStorage.setItem(DATA_KEY, JSON.stringify(state.repertoires));
        if (state.profile) localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...loadProfile(), ...state.profile }));
        render();
      } else {
        syncToServer(loadData());
      }
    } catch (error) {
      console.info("Modo local ativo; backend indisponível.", error);
    }
  }

  render();
  bootstrapServerState();
})();
