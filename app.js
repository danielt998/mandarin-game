const FALLBACK_SENTENCES = [
  ["你好！", "Nǐ hǎo!", "Hello!"], ["谢谢你。", "Xièxie nǐ.", "Thank you."],
  ["我喜欢喝茶。", "Wǒ xǐhuan hē chá.", "I like drinking tea."], ["今天很热。", "Jīntiān hěn rè.", "It is very hot today."],
  ["你叫什么名字？", "Nǐ jiào shénme míngzi?", "What is your name?"], ["他在学校。", "Tā zài xuéxiào.", "He is at school."],
  ["我们去吃饭吧。", "Wǒmen qù chīfàn ba.", "Let's go eat."], ["我听不懂。", "Wǒ tīng bu dǒng.", "I don't understand."],
  ["她会说中文。", "Tā huì shuō Zhōngwén.", "She can speak Chinese."], ["明天见！", "Míngtiān jiàn!", "See you tomorrow!"],
  ["这个多少钱？", "Zhège duōshao qián?", "How much is this?"], ["我想回家。", "Wǒ xiǎng huí jiā.", "I want to go home."]
].map(([hanzi, pinyin, english], index) => ({
  id: `starter-${index}`, hanzi, pinyin, english, source: "Starter set",
  difficulty: index < 4 ? "beginner" : index < 8 ? "explorer" : "challenge"
}));

const STORE_KEY = "hanzi-hop-stats-v1";
const letters = ["A", "B", "C", "D"];
const DIFFICULTIES = {
  beginner: { description: "Short, familiar sentences with pinyin.", xp: 10 },
  explorer: { description: "Everyday phrases with a little more to decode.", xp: 15 },
  challenge: { description: "Longer sentences. Listen closely and trust your reading.", xp: 20 }
};
const NUANCE_LEVELS = {
  core: { description: "Clear, high-value distinctions.", xp: 20 },
  advanced: { description: "Grammar details where context changes the meaning.", xp: 25 },
  expert: { description: "Subtle implications, expectation, and speaker stance.", xp: 30 }
};
let stats = loadStats();
let allSentences = [...FALLBACK_SENTENCES], sentences = [...FALLBACK_SENTENCES];
let round = 0, correctInRound = 0, current = null, answered = false;
let nuanceCards = [], nuanceIndex = 0, nuanceAnswered = false;
const $ = (id) => document.getElementById(id);

function loadStats() {
  try {
    const loaded = { xp: 0, answers: 0, correct: 0, bestStreak: 0, activeDays: {}, misses: {}, difficulty: "beginner", nuanceLevel: "core", ...JSON.parse(localStorage.getItem(STORE_KEY)) };
    return { ...loaded, difficulty: DIFFICULTIES[loaded.difficulty] ? loaded.difficulty : "beginner", nuanceLevel: NUANCE_LEVELS[loaded.nuanceLevel] ? loaded.nuanceLevel : "core" };
  } catch { return { xp: 0, answers: 0, correct: 0, bestStreak: 0, activeDays: {}, misses: {}, difficulty: "beginner", nuanceLevel: "core" }; }
}
function saveStats() { localStorage.setItem(STORE_KEY, JSON.stringify(stats)); }
function shuffle(items) { return [...items].sort(() => Math.random() - .5); }
function today() { return new Date().toISOString().slice(0, 10); }
function classifyDifficulty(hanzi) {
  const characters = [...hanzi].filter((character) => /\p{Script=Han}/u.test(character)).length;
  return characters <= 5 ? "beginner" : characters <= 10 ? "explorer" : "challenge";
}
function applyDifficulty() {
  const selected = allSentences.filter((item) => item.difficulty === stats.difficulty);
  const fallback = FALLBACK_SENTENCES.filter((item) => item.difficulty === stats.difficulty);
  sentences = selected.length >= 4 ? selected : [...selected, ...fallback.filter((item) => !selected.some((selectedItem) => selectedItem.id === item.id))];
  sentences = shuffle(sentences);
  document.querySelectorAll(".difficulty").forEach((button) => button.classList.toggle("active", button.dataset.difficulty === stats.difficulty));
  $("difficulty-description").textContent = DIFFICULTIES[stats.difficulty].description;
}

function renderRound() {
  answered = false; current = sentences[round % sentences.length];
  const options = shuffle([current.english, ...shuffle(sentences.filter((item) => item.id !== current.id).map((item) => item.english)).slice(0, 3)]);
  $("round-label").textContent = `Round ${round + 1} of 10`;
  $("correct-label").textContent = `${correctInRound} correct`;
  $("progress-fill").style.width = `${round * 10}%`;
  $("source-label").textContent = current.source;
  $("hanzi").textContent = current.hanzi;
  $("pinyin").textContent = stats.difficulty === "challenge" ? "Listen, then make your best match." : (current.pinyin || "Use the translation clue below.");
  $("translation").textContent = current.english; $("translation").hidden = true;
  $("reveal-button").hidden = false; $("feedback").hidden = true;
  const container = $("answers"); container.replaceChildren();
  options.forEach((option, index) => {
    const item = $("answer-template").content.cloneNode(true);
    const button = item.querySelector("button");
    item.querySelector(".choice-letter").textContent = letters[index];
    item.querySelector(".answer-text").textContent = option;
    button.addEventListener("click", () => chooseAnswer(button, option === current.english));
    container.append(item);
  });
}
function chooseAnswer(button, isCorrect) {
  if (answered) return; answered = true;
  document.querySelectorAll("#answers .answer").forEach((answer) => {
    answer.disabled = true;
    if (answer.querySelector(".answer-text").textContent === current.english) answer.classList.add("correct");
  });
  stats.answers += 1; stats.activeDays[today()] = (stats.activeDays[today()] || 0) + 1;
  if (isCorrect) { stats.correct += 1; stats.xp += DIFFICULTIES[stats.difficulty].xp; correctInRound += 1; button.classList.add("correct"); }
  else { button.classList.add("wrong"); stats.misses[current.id] = { hanzi: current.hanzi, english: current.english, count: (stats.misses[current.id]?.count || 0) + 1 }; }
  stats.bestStreak = Math.max(stats.bestStreak, currentDailyStreak()); saveStats(); updateHeader();
  $("feedback-icon").textContent = isCorrect ? "✨" : "💡";
  $("feedback-title").textContent = isCorrect ? `Nice! +${DIFFICULTIES[stats.difficulty].xp} XP` : "Not this time.";
  $("feedback-copy").textContent = isCorrect ? "Keep the momentum going." : `${current.hanzi} means “${current.english}”`;
  $("next-button").innerHTML = round === 9 ? "Finish <span aria-hidden='true'>✓</span>" : "Next <span aria-hidden='true'>→</span>";
  $("feedback").hidden = false;
}
function nextRound() {
  round += 1;
  if (round === 10) { round = 0; correctInRound = 0; sentences = shuffle(sentences); }
  renderRound();
}
function currentDailyStreak() {
  let count = 0, date = new Date();
  while (stats.activeDays[date.toISOString().slice(0, 10)]) { count++; date.setDate(date.getDate() - 1); }
  return count;
}
function updateHeader() { $("xp-total").textContent = stats.xp; $("streak-count").textContent = currentDailyStreak(); }
function renderStats() {
  $("stat-xp").textContent = stats.xp; $("stat-accuracy").textContent = stats.answers ? `${Math.round(stats.correct / stats.answers * 100)}%` : "—";
  $("stat-best-streak").textContent = stats.bestStreak;
  const days = []; for (let offset = 6; offset >= 0; offset--) { const date = new Date(); date.setDate(date.getDate() - offset); days.push(date); }
  $("week-total").textContent = `${days.filter((date) => stats.activeDays[date.toISOString().slice(0, 10)]).length} / 7`;
  $("week-summary").textContent = stats.answers ? `${stats.answers} answers saved on this device.` : "Start with one round today.";
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  $("activity-days").replaceChildren(...days.map((date) => { const node = document.createElement("div"); node.className = `day${stats.activeDays[date.toISOString().slice(0, 10)] ? " active" : ""}`; node.innerHTML = `<span>${labels[date.getDay()]}</span><i class="day-dot"></i>`; return node; }));
  const misses = Object.values(stats.misses).sort((a, b) => b.count - a.count).slice(0, 4);
  $("review-list").replaceChildren(...(misses.length ? misses.map((item) => { const li = document.createElement("li"); li.innerHTML = `<span class="review-hanzi">${item.hanzi}</span><small>${item.english}<br>missed ${item.count}×</small>`; return li; }) : [Object.assign(document.createElement("li"), { className: "empty", textContent: "Nothing queued yet — great work." })]));
}
function speak() {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(current.hanzi); utterance.lang = "zh-CN"; utterance.rate = .8; speechSynthesis.speak(utterance);
}
function renderNuance() {
  const levelCards = nuanceCards.filter((card) => card.level === stats.nuanceLevel);
  if (!levelCards.length) {
    $("nuance-question").textContent = `No ${stats.nuanceLevel} cards have been added yet.`;
    $("nuance-a").textContent = ""; $("nuance-b").textContent = ""; $("nuance-answers").replaceChildren();
    return;
  }
  nuanceAnswered = false;
  const card = levelCards[nuanceIndex % levelCards.length];
  $("nuance-tag").textContent = card.tag.toUpperCase();
  $("nuance-count").textContent = `${nuanceIndex % levelCards.length + 1} / ${levelCards.length}`;
  $("nuance-a").textContent = `A. ${card.sentenceA}`;
  $("nuance-b").textContent = `B. ${card.sentenceB}`;
  $("nuance-question").textContent = card.question;
  $("nuance-feedback-title").textContent = "";
  $("nuance-feedback-copy").textContent = "";
  $("nuance-feedback").hidden = true;
  const container = $("nuance-answers"); container.replaceChildren();
  card.choices.forEach((choice, index) => {
    const item = $("answer-template").content.cloneNode(true);
    const button = item.querySelector("button");
    item.querySelector(".choice-letter").textContent = letters[index];
    item.querySelector(".answer-text").textContent = choice;
    button.addEventListener("click", () => chooseNuanceAnswer(button, index, card));
    container.append(item);
  });
}
function chooseNuanceAnswer(button, index, card) {
  if (nuanceAnswered) return;
  nuanceAnswered = true;
  document.querySelectorAll("#nuance-answers .answer").forEach((answer, answerIndex) => {
    answer.disabled = true;
    if (answerIndex === card.answerIndex) answer.classList.add("correct");
  });
  const isCorrect = index === card.answerIndex;
  stats.answers += 1; stats.activeDays[today()] = (stats.activeDays[today()] || 0) + 1;
  if (isCorrect) { stats.correct += 1; stats.xp += NUANCE_LEVELS[stats.nuanceLevel].xp; button.classList.add("correct"); }
  else { button.classList.add("wrong"); stats.misses[`nuance-${card.id}`] = { hanzi: card.tag, english: card.question, count: (stats.misses[`nuance-${card.id}`]?.count || 0) + 1 }; }
  stats.bestStreak = Math.max(stats.bestStreak, currentDailyStreak()); saveStats(); updateHeader();
  $("nuance-feedback-icon").textContent = isCorrect ? "✨" : "💡";
  $("nuance-feedback-title").textContent = isCorrect ? `Sharp reading! +${NUANCE_LEVELS[stats.nuanceLevel].xp} XP` : "Look at the contrast.";
  $("nuance-feedback-copy").textContent = card.explanation;
  $("nuance-feedback").hidden = false;
}
async function loadNuanceCards() {
  try {
    const response = await fetch("data/nuance-cards.json");
    if (!response.ok) throw new Error(`Could not load Nuance Lab cards: ${response.status}`);
    const cards = await response.json();
    if (!Array.isArray(cards) || !cards.every((card) => card.id && NUANCE_LEVELS[card.level] && card.sentenceA && card.sentenceB && card.question && Array.isArray(card.choices) && Number.isInteger(card.answerIndex) && card.explanation)) throw new Error("Nuance Lab data has an invalid card.");
    nuanceCards = cards; renderNuance();
  } catch (error) {
    $("nuance-question").textContent = "Nuance Lab could not load its cards.";
    console.error(error);
  }
}
function findTranslation(value) {
  if (!value) return null;
  if (typeof value.text === "string") return value.text;
  if (Array.isArray(value)) { for (const child of value) { const found = findTranslation(child); if (found) return found; } }
  if (Array.isArray(value.translations)) return findTranslation(value.translations);
  return null;
}
async function loadTatoeba() {
  const endpoints = [
    "https://api.tatoeba.org/v1/sentences?lang=cmn&trans:lang=eng&limit=30",
    "https://api.tatoeba.org/unstable/sentences?lang=cmn&trans:lang=eng&limit=30"
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
      if (!response.ok) continue;
      const payload = await response.json(), rows = payload.data || payload;
      const imported = (Array.isArray(rows) ? rows : []).map((row) => ({ id: `tatoeba-${row.id}`, hanzi: row.text, pinyin: "", english: findTranslation(row.translations), source: "Tatoeba sentence", difficulty: classifyDifficulty(row.text) })).filter((item) => item.hanzi && item.english);
      if (imported.length >= 4) { allSentences = imported; applyDifficulty(); $("source-label").textContent = "Tatoeba sentence"; renderRound(); return; }
    } catch { /* The starter set remains available when Tatoeba cannot be reached. */ }
  }
  $("source-label").textContent = "Starter set · Tatoeba unavailable";
}
document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-item,.view").forEach((node) => node.classList.remove("active"));
  button.classList.add("active"); $(button.dataset.view).classList.add("active"); if (button.dataset.view === "stats-view") renderStats();
}));
document.querySelectorAll(".difficulty").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.difficulty === stats.difficulty) return;
  stats.difficulty = button.dataset.difficulty; round = 0; correctInRound = 0; saveStats(); applyDifficulty(); renderRound();
}));
document.querySelectorAll(".nuance-level").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.nuanceLevel === stats.nuanceLevel) return;
  stats.nuanceLevel = button.dataset.nuanceLevel; nuanceIndex = 0; saveStats(); applyNuanceLevel(); renderNuance();
}));
$("reveal-button").addEventListener("click", () => { $("translation").hidden = false; $("reveal-button").hidden = true; });
$("next-button").addEventListener("click", nextRound); $("listen-button").addEventListener("click", speak);
$("nuance-next-button").addEventListener("click", () => { nuanceIndex += 1; renderNuance(); });
function applyNuanceLevel() {
  document.querySelectorAll(".nuance-level").forEach((button) => button.classList.toggle("active", button.dataset.nuanceLevel === stats.nuanceLevel));
  $("nuance-level-description").textContent = NUANCE_LEVELS[stats.nuanceLevel].description;
}
applyDifficulty(); applyNuanceLevel(); updateHeader(); renderRound(); loadTatoeba(); loadNuanceCards();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(() => {});
