// ── Router ────────────────────────────────────────────────────────────────────

let currentView = 'translate';

function navigate(view) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('[data-view]').forEach(btn => btn.classList.remove('active'));

  const el = document.getElementById(`view-${view}`);
  if (el) el.classList.add('active');
  document.querySelectorAll(`[data-view="${view}"]`).forEach(b => b.classList.add('active'));

  currentView = view;
  if (view === 'challenge') loadChallenge();
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

// ── Challenge view ────────────────────────────────────────────────────────────

let challengeStatus = null;

async function loadChallenge() {
  const el = document.getElementById('challenge-content');
  el.innerHTML = '<div class="text-gray-400 text-sm">Loading...</div>';
  try {
    challengeStatus = await api('GET', '/challenge/status');
    renderChallengeView();
  } catch (err) {
    el.innerHTML = `<div class="text-red-400 text-sm">${err.message}</div>`;
  }
}

function renderChallengeView() {
  const el = document.getElementById('challenge-content');
  const s = challengeStatus;

  if (!s.started) {
    el.innerHTML = `
      <div class="max-w-lg mx-auto text-center py-10">
        <div class="text-6xl mb-4">🇷🇺</div>
        <h2 class="text-2xl font-bold text-white mb-2">30-Day Russian Speaking Challenge</h2>
        <p class="text-gray-400 mb-2">30 days. 30 topics. Speak Russian every day.</p>
        <p class="text-gray-500 text-sm mb-8">Each day you'll get 6 phrases to hear aloud and repeat. Mark them done and complete the day. Build a real streak.</p>
        <button class="primary text-base px-8 py-3" onclick="doStartChallenge()">Begin Challenge</button>
      </div>`;
    return;
  }

  const { currentDay, topic, completionGrid, todayPhrases, isCompleted, totalCompleted } = s;
  const practicedCount = todayPhrases.filter(p => p.repsToday > 0).length;
  const allPracticed = practicedCount >= todayPhrases.length;
  const isDay30Done = currentDay === 30 && isCompleted;

  // Progress grid (30 circles)
  const gridDots = completionGrid.map((done, i) => {
    const day = i + 1;
    const isToday = day === currentDay;
    let cls, label;
    if (done) {
      cls = 'bg-green-500 border-green-500';
      label = '✓';
    } else if (isToday) {
      cls = 'bg-orange-500 border-orange-500 ring-2 ring-orange-300';
      label = day;
    } else {
      cls = 'bg-gray-800 border-gray-700 text-gray-600';
      label = day;
    }
    return `<div class="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold ${cls}" title="Day ${day}">${label}</div>`;
  }).join('');

  // Phrase cards
  const phraseCards = todayPhrases.map(p => {
    const reps = p.repsToday;
    const done = reps > 0;
    const mastered = reps >= 3;
    const cardBorder = mastered ? 'border-green-600' : done ? 'border-blue-700' : 'border-gray-800';
    const btnLabel = mastered ? `Mastered ✓ (${reps})` : done ? `Said it (${reps})` : 'Said it';
    const btnCls = mastered ? 'bg-green-700 border-green-600 text-white' : done ? 'bg-blue-800 border-blue-700 text-white' : 'ghost';

    return `
      <div class="bg-gray-900 border ${cardBorder} rounded-xl p-4 transition-colors">
        <p class="ru text-3xl text-white leading-snug mb-1">${esc(p.russian)}</p>
        <p class="text-gray-300 text-sm mb-1">${esc(p.english)}</p>
        ${p.breakdown ? `<p class="text-gray-600 text-xs mb-3">${esc(p.breakdown)}</p>` : '<div class="mb-3"></div>'}
        <div class="flex gap-2">
          <button class="ghost" onclick="challengeHear(${JSON.stringify(p.russian)})">🔊 Hear</button>
          <button class="${btnCls} border rounded px-3 py-1.5 text-sm font-medium" onclick="challengeSaid(${currentDay}, ${p.index}, this)">${btnLabel}</button>
        </div>
      </div>`;
  }).join('');

  const nextDayPreview = currentDay < 30
    ? `<p class="text-gray-500 text-sm mt-2">Up next: Day ${currentDay + 1}</p>`
    : '';

  el.innerHTML = `
    <div class="space-y-5">

      <!-- Header -->
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-xl font-bold text-white">Day ${currentDay} / 30 — ${esc(topic)}</h2>
          <p class="text-sm text-gray-400">${totalCompleted} day${totalCompleted !== 1 ? 's' : ''} completed</p>
        </div>
        <button class="ghost text-xs text-red-400 border-red-900" onclick="confirmRestartChallenge()">Restart</button>
      </div>

      <!-- Progress grid -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p class="text-xs text-gray-500 mb-3 uppercase tracking-wide">30-Day Progress</p>
        <div class="flex flex-wrap gap-1.5">${gridDots}</div>
      </div>

      ${isDay30Done ? `
        <div class="bg-gray-900 border border-green-700 rounded-xl p-6 text-center">
          <div class="text-5xl mb-3">🏆</div>
          <h3 class="text-xl font-bold text-green-400 mb-1">Challenge Complete!</h3>
          <p class="text-gray-400">You finished 30 days of Russian speaking practice. Молодец!</p>
        </div>
      ` : isCompleted ? `
        <div class="bg-gray-900 border border-green-800 rounded-xl p-4 text-center">
          <p class="text-green-400 font-semibold">Day ${currentDay} complete! ✓</p>
          ${nextDayPreview}
        </div>
      ` : `
        <!-- Speaking drills -->
        <div>
          <p class="text-sm font-medium text-gray-300 mb-3">Today's Speaking Drills
            <span class="text-gray-500 font-normal ml-2">${practicedCount}/${todayPhrases.length} done</span>
          </p>
          <div class="space-y-3">${phraseCards}</div>
        </div>

        <button
          id="complete-day-btn"
          class="w-full py-3 rounded-xl font-semibold text-base transition-all ${allPracticed ? 'bg-orange-600 hover:bg-orange-500 text-white cursor-pointer' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}"
          onclick="doCompleteDay()"
          ${allPracticed ? '' : 'disabled'}
        >${allPracticed ? `Complete Day ${currentDay} →` : `Practice all ${todayPhrases.length} phrases to complete`}</button>
      `}

    </div>`;
}

function challengeHear(russian) {
  speakText(russian);
}

async function challengeSaid(dayNumber, phraseIndex, btn) {
  try {
    const { reps_done } = await api('POST', '/challenge/speak', {
      day_number: dayNumber,
      phrase_index: phraseIndex,
    });

    // Update the phrase's repsToday in local state
    if (challengeStatus && challengeStatus.todayPhrases) {
      challengeStatus.todayPhrases[phraseIndex].repsToday = reps_done;
    }

    // Update button appearance
    const mastered = reps_done >= 3;
    const done = reps_done > 0;
    btn.textContent = mastered ? `Mastered ✓ (${reps_done})` : `Said it (${reps_done})`;
    btn.className = mastered
      ? 'bg-green-700 border-green-600 text-white border rounded px-3 py-1.5 text-sm font-medium'
      : 'bg-blue-800 border-blue-700 text-white border rounded px-3 py-1.5 text-sm font-medium';

    // Update card border
    const card = btn.closest('.bg-gray-900');
    if (card) {
      card.classList.remove('border-gray-800', 'border-blue-700', 'border-green-600');
      card.classList.add(mastered ? 'border-green-600' : 'border-blue-700');
    }

    // Recheck if all phrases are now practiced
    const allPracticed = challengeStatus.todayPhrases.every(p => p.repsToday > 0);
    const completeBtn = document.getElementById('complete-day-btn');
    if (completeBtn) {
      completeBtn.disabled = !allPracticed;
      completeBtn.className = `w-full py-3 rounded-xl font-semibold text-base transition-all ${
        allPracticed ? 'bg-orange-600 hover:bg-orange-500 text-white cursor-pointer' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
      }`;
      completeBtn.textContent = allPracticed
        ? `Complete Day ${challengeStatus.currentDay} →`
        : `Practice all ${challengeStatus.todayPhrases.length} phrases to complete`;
    }

    // Update progress counter
    const practicedCount = challengeStatus.todayPhrases.filter(p => p.repsToday > 0).length;
    const counterEl = document.querySelector('#challenge-content .text-gray-500.font-normal');
    if (counterEl) counterEl.textContent = `${practicedCount}/${challengeStatus.todayPhrases.length} done`;
  } catch (err) {
    toast(err.message);
  }
}

async function doStartChallenge() {
  try {
    await api('POST', '/challenge/start');
    await loadChallenge();
    toast('Challenge started! Day 1 begins now.');
  } catch (err) {
    toast(err.message);
  }
}

async function doCompleteDay() {
  try {
    const { dayCompleted } = await api('POST', '/challenge/complete-day');
    toast(`Day ${dayCompleted} complete! Keep going!`);
    await loadChallenge();
  } catch (err) {
    toast(err.message);
  }
}

async function confirmRestartChallenge() {
  if (!confirm('Restart the 30-day challenge? All progress will be lost.')) return;
  try {
    await api('POST', '/challenge/start');
    await loadChallenge();
    toast('Challenge restarted from Day 1.');
  } catch (err) {
    toast(err.message);
  }
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

  // Load challenge as the default landing view
  await loadChallenge();

  // Show challenge badge if active and today not yet completed
  try {
    const cs = await api('GET', '/challenge/status');
    if (cs.started && !cs.isCompleted) {
      const badge = document.getElementById('challenge-badge');
      badge.textContent = `Day ${cs.currentDay}`;
      badge.classList.remove('hidden');
    }
  } catch {}
})();
