'use strict';

var UI = (function () {

  var PLATFORM_CLASS = {
    'PC':            'badge-pc',
    'PS5':           'badge-ps5',
    'PS4':           'badge-ps4',
    'Xbox Series X': 'badge-xbox-sx',
    'Xbox One':      'badge-xbox-one',
    'Nintendo Switch': 'badge-switch',
    'Other':         'badge-other'
  };

  var STATUS_CLASS = {
    'Not Started': 'status-not-started',
    'Playing':     'status-playing',
    'Completed':   'status-completed',
    'Dropped':     'status-dropped'
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Library ── */

  function renderLibrary(games, filters) {
    var grid = document.getElementById('game-grid');
    var emptyState = document.getElementById('empty-state');
    var countEl = document.getElementById('game-count');

    var filtered = applyFilters(games, filters);

    if (games.length === 0) {
      emptyState.classList.remove('hidden');
      grid.innerHTML = '';
    } else {
      emptyState.classList.add('hidden');
      grid.innerHTML = '';
      filtered.forEach(function (game) {
        grid.appendChild(renderCard(game));
      });
    }

    var noun = filtered.length === 1 ? 'game' : 'games';
    countEl.textContent = filtered.length + ' ' + noun + (games.length !== filtered.length ? ' (filtered)' : '');
  }

  function applyFilters(games, filters) {
    filters = filters || {};
    return games.filter(function (g) {
      if (filters.platform && g.platform !== filters.platform) return false;
      if (filters.status && g.status !== filters.status) return false;
      if (filters.search) {
        var q = filters.search.toLowerCase();
        if (g.title.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderCard(game) {
    var card = document.createElement('div');
    card.className = 'game-card';
    card.dataset.id = game.id;

    var coverHtml;
    if (game.coverUrl) {
      coverHtml = '<img class="card-cover" src="' + escapeHtml(game.coverUrl) + '" alt="' + escapeHtml(game.title) + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
        '<div class="card-cover-placeholder" style="display:none">&#x1F3AE;</div>';
    } else {
      coverHtml = '<div class="card-cover-placeholder">&#x1F3AE;</div>';
    }

    var platformClass = PLATFORM_CLASS[game.platform] || 'badge-other';
    var statusClass = STATUS_CLASS[game.status] || 'status-not-started';

    var ratingHtml = game.rating && game.rating > 0
      ? '<span class="card-rating"><span class="rating-value">&#9733; ' + game.rating + '</span>/10</span>'
      : '<span class="card-rating">Unrated</span>';

    var genresHtml = '';
    if (game.genres && game.genres.length > 0) {
      genresHtml = '<div class="card-genres">' +
        game.genres.slice(0, 3).map(function (g) {
          return '<span class="genre-pill">' + escapeHtml(g) + '</span>';
        }).join('') +
        '</div>';
    }

    card.innerHTML =
      coverHtml +
      '<div class="card-actions">' +
        '<button class="card-action-btn edit" data-id="' + escapeHtml(game.id) + '" title="Edit">&#9998;</button>' +
        '<button class="card-action-btn delete" data-id="' + escapeHtml(game.id) + '" title="Delete">&#128465;</button>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="card-title">' + escapeHtml(game.title) + '</div>' +
        '<div class="card-meta">' +
          '<span class="badge ' + platformClass + '">' + escapeHtml(game.platform) + '</span>' +
          '<span class="status-chip ' + statusClass + '">' + escapeHtml(game.status) + '</span>' +
        '</div>' +
        ratingHtml +
        genresHtml +
      '</div>';

    return card;
  }

  /* ── Form Modal ── */

  function openForm(game) {
    var overlay = document.getElementById('modal-overlay');
    var title = document.getElementById('modal-title');
    var form = document.getElementById('game-form');

    title.textContent = game ? 'Edit Game' : 'Add Game';

    document.getElementById('form-id').value = game ? game.id : '';
    document.getElementById('form-title').value = game ? game.title : '';
    document.getElementById('form-platform').value = game ? game.platform : 'PC';
    document.getElementById('form-status').value = game ? game.status : 'Not Started';
    document.getElementById('form-rating').value = game ? (game.rating || 0) : 0;
    document.getElementById('form-release-year').value = game ? (game.releaseYear || '') : '';
    document.getElementById('form-genres').value = game && game.genres ? game.genres.join(', ') : '';
    document.getElementById('form-cover-url').value = game ? (game.coverUrl || '') : '';
    document.getElementById('form-notes').value = game ? (game.notes || '') : '';

    document.getElementById('form-title').classList.remove('error');
    document.getElementById('rawg-error').classList.add('hidden');

    updateCoverPreview(game ? game.coverUrl : '');
    clearAutocomplete();

    overlay.classList.add('active');
    setTimeout(function () { document.getElementById('form-title').focus(); }, 50);
  }

  function closeForm() {
    document.getElementById('modal-overlay').classList.remove('active');
    clearAutocomplete();
  }

  function updateCoverPreview(url) {
    var preview = document.getElementById('cover-preview');
    if (url) {
      preview.innerHTML = '<img src="' + escapeHtml(url) + '" alt="Cover" onerror="this.parentNode.innerHTML=\'<span class=cover-placeholder>No cover</span>\'">';
    } else {
      preview.innerHTML = '<span class="cover-placeholder">No cover</span>';
    }
  }

  /* ── RAWG Autocomplete ── */

  function renderAutocomplete(results) {
    var ac = document.getElementById('rawg-autocomplete');
    if (!results || results.length === 0) {
      clearAutocomplete();
      return;
    }
    ac.innerHTML = '';
    results.forEach(function (r) {
      var item = document.createElement('div');
      item.className = 'rawg-item';
      item.dataset.rawgId = r.id;
      item.dataset.rawgName = r.name;
      item.dataset.rawgData = JSON.stringify(r);

      var thumbHtml = r.background_image
        ? '<img class="rawg-item-thumb" src="' + escapeHtml(r.background_image) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
        : '<div class="rawg-item-thumb-placeholder">&#x1F3AE;</div>';

      var year = r.released ? r.released.split('-')[0] : '';
      var genres = r.genres ? r.genres.map(function (g) { return g.name; }).slice(0, 3).join(', ') : '';
      var meta = [year, genres].filter(Boolean).join(' &middot; ');

      item.innerHTML =
        thumbHtml +
        '<div class="rawg-item-info">' +
          '<div class="rawg-item-name">' + escapeHtml(r.name) + '</div>' +
          '<div class="rawg-item-meta">' + meta + '</div>' +
        '</div>';

      ac.appendChild(item);
    });
    ac.classList.remove('hidden');
  }

  function clearAutocomplete() {
    var ac = document.getElementById('rawg-autocomplete');
    ac.innerHTML = '';
    ac.classList.add('hidden');
  }

  /* ── API Key Prompt ── */

  function renderApiKeyPrompt() {
    document.getElementById('api-key-banner').classList.remove('hidden');
  }

  function hideApiKeyPrompt() {
    document.getElementById('api-key-banner').classList.add('hidden');
  }

  /* ── Getters for form values ── */

  function getFormValues() {
    var genresRaw = document.getElementById('form-genres').value.trim();
    var genres = genresRaw
      ? genresRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      : [];

    var releaseYear = parseInt(document.getElementById('form-release-year').value, 10);
    var rating = parseInt(document.getElementById('form-rating').value, 10);

    return {
      title:       document.getElementById('form-title').value.trim(),
      platform:    document.getElementById('form-platform').value,
      status:      document.getElementById('form-status').value,
      rating:      isNaN(rating) ? 0 : Math.min(10, Math.max(0, rating)),
      releaseYear: isNaN(releaseYear) ? null : releaseYear,
      genres:      genres,
      coverUrl:    document.getElementById('form-cover-url').value.trim(),
      notes:       document.getElementById('form-notes').value.trim()
    };
  }

  function setFormField(field, value) {
    var el = document.getElementById('form-' + field);
    if (el) el.value = value;
  }

  return {
    renderLibrary:      renderLibrary,
    renderCard:         renderCard,
    openForm:           openForm,
    closeForm:          closeForm,
    updateCoverPreview: updateCoverPreview,
    renderAutocomplete: renderAutocomplete,
    clearAutocomplete:  clearAutocomplete,
    renderApiKeyPrompt: renderApiKeyPrompt,
    hideApiKeyPrompt:   hideApiKeyPrompt,
    getFormValues:      getFormValues,
    setFormField:       setFormField
  };
})();
