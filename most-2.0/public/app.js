// ── Router ────────────────────────────────────────────────────────────────────

let currentView = 'translate';

function navigate(view) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('[data-view]').forEach(btn => btn.classList.remove('active'));

  const el = document.getElementById(`view-${view}`);
  if (el) el.classList.add('active');
  document.querySelectorAll(`[data-view="${view}"]`).forEach(b => b.classList.add('active'));

  currentView = view;
  if (view === 'review') loadReview();
  if (view === 'library') loadLibrary();
  if (view === 'stats') loadStats();
  if (view === 'settings') loadSettings();
}

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.view));
});

// ── Toast ─────────────────────────────────────────────────────────────────────

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Translate view ────────────────────────────────────────────────────────────

async function doTranslate() {
  const text = document.getElementById('translate-input').value.trim();
  const tone = document.getElementById('tone-select').value;
  if (!text) return;

  const btn = document.getElementById('translate-btn');
  btn.disabled = true;
  btn.textContent = 'Translating...';

  const results = document.getElementById('translate-results');
  results.innerHTML = '<div class="text-gray-400 text-sm animate-pulse">Generating 3 variants...</div>';

  try {
    const data = await api('POST', '/translate', { text, tone });
    renderVariants(data.id, data.variants);
  } catch (err) {
    results.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Translate';
  }
}

function renderVariants(translationId, variants) {
  const container = document.getElementById('translate-results');
  container.innerHTML = '';

  variants.forEach((v, i) => {
    const card = document.createElement('div');
    card.className = 'bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2';
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <span class="text-xs text-gray-500 font-medium uppercase tracking-wide">Variant ${i + 1}</span>
      </div>
      <p class="ru text-2xl leading-snug text-white">${esc(v.russian)}</p>
      <p class="text-gray-300 text-sm">${esc(v.english)}</p>
      <p class="text-gray-500 text-xs leading-relaxed">${esc(v.breakdown)}</p>
      <div class="flex gap-2 pt-1 flex-wrap">
        <button class="ghost" onclick="copyText(${JSON.stringify(v.russian)})">Copy</button>
        <button class="ghost" onclick="speakText(${JSON.stringify(v.russian)})">Listen</button>
        <button class="ghost" onclick="saveVariantToLibrary(${JSON.stringify(v)}, ${translationId})">Save to Library</button>
        <button class="ghost" onclick="extractVocab(${JSON.stringify(v)}, ${translationId})">Add to Deck</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function saveVariantToLibrary(variant, translationId) {
  try {
    await api('POST', '/phrases', {
      russian: variant.russian,
      english: variant.english,
      breakdown: variant.breakdown,
      source_translation_id: translationId,
    });
    toast('Saved to library');
  } catch (err) {
    toast(err.message);
  }
}

async function extractVocab(variant, translationId) {
  // Split the Russian sentence into individual words and add each as a card
  const words = variant.russian.match(/[а-яёА-ЯЁ]+/g) || [];
  if (!words.length) return toast('No Russian words found');

  const cards = words.map(w => ({
    russian: w.toLowerCase(),
    english: '',
    example_russian: variant.russian,
    example_english: variant.english,
  }));

  try {
    const { added } = await api('POST', '/cards/bulk', { cards });
    toast(`${added} word${added !== 1 ? 's' : ''} added to deck`);
  } catch (err) {
    toast(err.message);
  }
}

document.getElementById('translate-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doTranslate();
});

// ── Review view ───────────────────────────────────────────────────────────────

let reviewQueue = [];
let reviewIndex = 0;
let cardFlipped = false;

async function loadReview() {
  const area = document.getElementById('review-card-area');
  const info = document.getElementById('review-queue-info');
  area.innerHTML = '<div class="text-gray-400 text-sm">Loading...</div>';

  try {
    const { due, new: newCards, total } = await api('GET', '/cards/due');
    reviewQueue = [...due, ...newCards];
    reviewIndex = 0;

    // Update badge
    const badge = document.getElementById('due-badge');
    if (total > 0) {
      badge.textContent = total;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    if (!total) {
      info.textContent = '';
      area.innerHTML = '<div class="text-center text-gray-400 py-12">Nothing due today. Come back tomorrow.</div>';
      return;
    }

    info.textContent = `${due.length} due, ${newCards.length} new`;
    renderReviewCard();
  } catch (err) {
    area.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
  }
}

function renderReviewCard() {
  const area = document.getElementById('review-card-area');
  cardFlipped = false;

  if (reviewIndex >= reviewQueue.length) {
    area.innerHTML = `
      <div class="text-center py-12">
        <p class="text-2xl font-bold text-green-400 mb-2">Session complete.</p>
        <p class="text-gray-400 text-sm">${reviewQueue.length} card${reviewQueue.length !== 1 ? 's' : ''} reviewed</p>
        <button class="primary mt-6" onclick="loadReview()">Refresh</button>
      </div>`;
    document.getElementById('due-badge').classList.add('hidden');
    return;
  }

  const card = reviewQueue[reviewIndex];
  const progress = `${reviewIndex + 1} / ${reviewQueue.length}`;

  area.innerHTML = `
    <div class="mb-3 flex justify-between items-center text-xs text-gray-500">
      <span>${progress}</span>
      <span>${card.reps === 0 ? 'New' : `Interval: ${card.interval_days}d`}</span>
    </div>
    <div class="card-flip cursor-pointer" onclick="flipCard(this)">
      <div class="card-inner min-h-48 relative">
        <div class="card-front bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-48">
          <p class="ru text-4xl text-white text-center mb-2">${esc(card.russian)}</p>
          <p class="text-xs text-gray-500 mt-4">Tap to reveal</p>
          <button class="ghost mt-2" onclick="event.stopPropagation(); speakText(${JSON.stringify(card.russian)})">Listen</button>
        </div>
        <div class="card-back bg-gray-900 border border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center min-h-48">
          <p class="ru text-3xl text-white text-center mb-2">${esc(card.russian)}</p>
          <p class="text-blue-300 text-lg text-center mb-2">${esc(card.english || '(no translation)')}</p>
          ${card.example_russian ? `<p class="ru text-xs text-gray-400 text-center mt-2 italic">${esc(card.example_russian)}</p>` : ''}
          ${card.example_english ? `<p class="text-xs text-gray-500 text-center">${esc(card.example_english)}</p>` : ''}
        </div>
      </div>
    </div>
    <div id="rating-row" class="hidden mt-4 flex gap-2">
      <button class="rating-btn" style="background:#dc2626" onclick="rateCard(${card.id},1)" title="1">Again<br><span class="text-xs font-normal opacity-75">1</span></button>
      <button class="rating-btn" style="background:#d97706" onclick="rateCard(${card.id},2)" title="2">Hard<br><span class="text-xs font-normal opacity-75">2</span></button>
      <button class="rating-btn" style="background:#2563eb" onclick="rateCard(${card.id},3)" title="3">Good<br><span class="text-xs font-normal opacity-75">3</span></button>
      <button class="rating-btn" style="background:#16a34a" onclick="rateCard(${card.id},4)" title="4">Easy<br><span class="text-xs font-normal opacity-75">4</span></button>
    </div>`;
}

function flipCard(el) {
  const inner = el.querySelector('.card-inner');
  inner.classList.toggle('flipped');
  cardFlipped = !cardFlipped;
  if (cardFlipped) {
    document.getElementById('rating-row').classList.remove('hidden');
  }
}

async function rateCard(id, rating) {
  try {
    await api('POST', `/cards/${id}/review`, { rating });
    reviewIndex++;
    renderReviewCard();
  } catch (err) {
    toast(err.message);
  }
}

document.addEventListener('keydown', e => {
  if (currentView !== 'review') return;
  if (e.key === ' ') { e.preventDefault(); document.querySelector('.card-flip')?.click(); }
  if (['1','2','3','4'].includes(e.key) && cardFlipped) {
    const card = reviewQueue[reviewIndex];
    if (card) rateCard(card.id, Number(e.key));
  }
});

// ── Library view ──────────────────────────────────────────────────────────────

let libActiveCategory = '';

async function loadLibrary() {
  // Load category chips
  try {
    const cats = await api('GET', '/phrases/categories');
    const chipContainer = document.getElementById('lib-category-chips');
    chipContainer.innerHTML = `
      <span class="chip${libActiveCategory === '' ? ' active' : ''}" onclick="setLibCategory('')">All</span>
      ${cats.map(c => `<span class="chip${libActiveCategory === c ? ' active' : ''}" onclick="setLibCategory('${esc(c)}')">${esc(c)}</span>`).join('')}
    `;
  } catch {}

  const q = document.getElementById('lib-search').value;
  try {
    const phrases = await api('GET', `/phrases?q=${encodeURIComponent(q)}&category=${encodeURIComponent(libActiveCategory)}`);
    const list = document.getElementById('library-list');

    if (!phrases.length) {
      list.innerHTML = '<div class="text-gray-500 text-sm">No phrases found.</div>';
      return;
    }

    list.innerHTML = phrases.map(p => `
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <p class="ru text-lg text-white leading-snug">${esc(p.russian)}</p>
          <p class="text-gray-400 text-sm">${esc(p.english)}</p>
          ${p.breakdown ? `<p class="text-gray-600 text-xs mt-1">${esc(p.breakdown)}</p>` : ''}
          ${p.category ? `<span class="text-xs text-blue-400 mt-1 inline-block">${esc(p.category)}</span>` : ''}
        </div>
        <div class="flex flex-col gap-1 shrink-0">
          <button class="ghost" onclick="copyText(${JSON.stringify(p.russian)})">Copy</button>
          <button class="ghost" onclick="speakText(${JSON.stringify(p.russian)})">Listen</button>
          <button class="ghost text-red-400 border-red-900" onclick="deletePhrase(${p.id})">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('library-list').innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
  }
}

function setLibCategory(cat) {
  libActiveCategory = cat;
  loadLibrary();
}

async function deletePhrase(id) {
  if (!confirm('Delete this phrase?')) return;
  try {
    await api('DELETE', `/phrases/${id}`);
    loadLibrary();
    toast('Deleted');
  } catch (err) {
    toast(err.message);
  }
}

// ── Stats view ────────────────────────────────────────────────────────────────

async function loadStats() {
  const el = document.getElementById('stats-content');
  el.innerHTML = '<div class="text-gray-400 text-sm">Loading...</div>';

  try {
    const s = await api('GET', '/stats');

    const streakColor = s.streak >= 7 ? 'text-green-400' : s.streak >= 3 ? 'text-yellow-400' : 'text-gray-300';
    const chartHtml = buildMiniChart(s.reviewsByDay);

    el.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        ${statCard('Total cards', s.totalCards)}
        ${statCard('Learned', s.learnedCards)}
        ${statCard('Due today', s.dueToday)}
        ${statCard('Phrases', s.totalPhrases)}
        ${statCard('Translations', s.totalTranslations)}
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div class="text-3xl font-bold ${streakColor}">${s.streak}</div>
          <div class="text-xs text-gray-500 mt-1">Day streak</div>
        </div>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p class="text-sm text-gray-400 mb-3">Reviews last 30 days</p>
        ${chartHtml}
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
  }
}

function statCard(label, value) {
  return `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
      <div class="text-3xl font-bold text-white">${value}</div>
      <div class="text-xs text-gray-500 mt-1">${label}</div>
    </div>`;
}

function buildMiniChart(data) {
  if (!data.length) return '<div class="text-gray-500 text-sm text-center py-4">No reviews yet.</div>';

  const max = Math.max(...data.map(d => d.count), 1);
  const bars = data.map(d => {
    const h = Math.max(4, Math.round((d.count / max) * 80));
    return `<div class="flex flex-col items-center gap-1">
      <span class="text-xs text-gray-500">${d.count}</span>
      <div class="w-4 bg-blue-600 rounded-sm" style="height:${h}px"></div>
      <span class="text-xs text-gray-600" style="writing-mode:vertical-rl;transform:rotate(180deg)">${d.day.slice(5)}</span>
    </div>`;
  });

  return `<div class="flex items-end gap-1 overflow-x-auto pb-2">${bars.join('')}</div>`;
}

// ── Import view ───────────────────────────────────────────────────────────────

async function doImport() {
  const text = document.getElementById('import-text').value.trim();
  if (!text) return;

  const results = document.getElementById('import-results');
  results.innerHTML = '<div class="text-gray-400 text-sm">Scanning...</div>';

  try {
    const { unknown, total, unknown_count } = await api('POST', '/import/conversation', { text });

    if (!unknown.length) {
      results.innerHTML = `<div class="text-green-400 text-sm">All ${total} words are already in your deck.</div>`;
      return;
    }

    results.innerHTML = `
      <p class="text-sm text-gray-400 mb-3">Found ${unknown_count} unknown words (out of ${total} total). Fill in translations and add to deck.</p>
      <div id="import-word-list" class="space-y-2 mb-4">
        ${unknown.map((w, i) => `
          <div class="flex gap-2 items-center">
            <span class="ru text-white w-32 shrink-0">${esc(w.russian)}</span>
            <input type="text" placeholder="English meaning" id="imp-${i}" class="flex-1">
            <input type="checkbox" id="imp-check-${i}" checked class="w-4 h-4 accent-blue-600">
          </div>`).join('')}
      </div>
      <button class="primary" onclick="addImportedWords(${JSON.stringify(unknown.map(w => w.russian))})">Add Selected to Deck</button>
    `;
  } catch (err) {
    results.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
  }
}

async function addImportedWords(russianWords) {
  const cards = russianWords
    .map((russian, i) => {
      const checked = document.getElementById(`imp-check-${i}`)?.checked;
      const english = document.getElementById(`imp-${i}`)?.value?.trim() || '';
      if (!checked) return null;
      return { russian, english };
    })
    .filter(Boolean);

  if (!cards.length) return toast('Nothing selected');

  try {
    const { added } = await api('POST', '/cards/bulk', { cards });
    toast(`${added} card${added !== 1 ? 's' : ''} added`);
    document.getElementById('import-results').innerHTML = `<div class="text-green-400 text-sm">${added} cards added to your deck.</div>`;
  } catch (err) {
    toast(err.message);
  }
}

// ── Settings view ─────────────────────────────────────────────────────────────

async function loadSettings() {
  try {
    const s = await api('GET', '/settings');
    if (s.default_tone) document.getElementById('setting-default-tone').value = s.default_tone;
    if (s.daily_new_cap) document.getElementById('setting-daily-cap').value = s.daily_new_cap;
    populateTTSVoices(s.tts_voice);
  } catch {}
}

function populateTTSVoices(selected) {
  const sel = document.getElementById('setting-tts-voice');
  sel.innerHTML = '';
  const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('ru'));
  if (!voices.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No Russian voices found';
    sel.appendChild(opt);
    return;
  }
  voices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.name === selected) opt.selected = true;
    sel.appendChild(opt);
  });
}

window.speechSynthesis?.addEventListener('voiceschanged', () => {
  if (currentView === 'settings') populateTTSVoices();
});

async function saveSettings() {
  const payload = {
    default_tone: document.getElementById('setting-default-tone').value,
    daily_new_cap: document.getElementById('setting-daily-cap').value,
    tts_voice: document.getElementById('setting-tts-voice').value,
  };
  try {
    await api('POST', '/settings', payload);

    // Apply default tone to translate view
    document.getElementById('tone-select').value = payload.default_tone;
    toast('Settings saved');
  } catch (err) {
    toast(err.message);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('Copied')).catch(() => toast('Copy failed'));
}

let activeSpeech = null;
function speakText(text) {
  if (!window.speechSynthesis) return toast('TTS not supported');
  if (activeSpeech) { speechSynthesis.cancel(); activeSpeech = null; return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  const savedVoice = document.getElementById('setting-tts-voice')?.value;
  if (savedVoice) {
    const v = speechSynthesis.getVoices().find(v => v.name === savedVoice);
    if (v) u.voice = v;
  }
  u.onend = () => { activeSpeech = null; };
  activeSpeech = u;
  speechSynthesis.speak(u);
}

async function exportData() {
  const a = document.createElement('a');
  a.href = '/api/export';
  a.download = '';
  a.click();
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async function init() {
  // Load settings to set default tone
  try {
    const s = await api('GET', '/settings');
    if (s.default_tone) document.getElementById('tone-select').value = s.default_tone;
  } catch {}

  // Show due count badge
  try {
    const { total } = await api('GET', '/cards/due');
    if (total > 0) {
      const badge = document.getElementById('due-badge');
      badge.textContent = total;
      badge.classList.remove('hidden');
    }
  } catch {}
})();
