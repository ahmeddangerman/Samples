'use strict';

(function () {
  var filters = { platform: '', status: '', search: '' };
  var debounceTimer = null;

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function () {
    var settings = Storage.getSettings();
    if (!settings.rawgApiKey) {
      UI.renderApiKeyPrompt();
    }

    renderLibrary();
    bindEvents();
  });

  function renderLibrary() {
    UI.renderLibrary(Storage.getGames(), filters);
  }

  /* ── Event Binding ── */
  function bindEvents() {
    // Header buttons
    document.getElementById('btn-add').addEventListener('click', function () {
      UI.openForm(null);
    });
    document.getElementById('btn-add-empty').addEventListener('click', function () {
      UI.openForm(null);
    });
    document.getElementById('btn-export').addEventListener('click', function () {
      var games = Storage.getGames();
      if (games.length === 0) {
        alert('No games to export.');
        return;
      }
      Export.downloadCSV(games);
    });

    // Filter bar
    document.getElementById('filter-platform').addEventListener('change', function () {
      filters.platform = this.value;
      renderLibrary();
    });
    document.getElementById('filter-status').addEventListener('change', function () {
      filters.status = this.value;
      renderLibrary();
    });
    document.getElementById('filter-search').addEventListener('input', function () {
      filters.search = this.value.trim();
      renderLibrary();
    });

    // Modal close
    document.getElementById('btn-close-modal').addEventListener('click', UI.closeForm);
    document.getElementById('btn-cancel').addEventListener('click', UI.closeForm);
    document.getElementById('modal-overlay').addEventListener('click', function (e) {
      if (e.target === this) UI.closeForm();
    });

    // Escape key closes modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') UI.closeForm();
    });

    // Form submit
    document.getElementById('game-form').addEventListener('submit', handleFormSubmit);

    // Cover URL preview on input
    document.getElementById('form-cover-url').addEventListener('input', function () {
      UI.updateCoverPreview(this.value.trim());
    });

    // RAWG autocomplete on title input
    document.getElementById('form-title').addEventListener('input', handleTitleInput);

    // Autocomplete item click (event delegation)
    document.getElementById('rawg-autocomplete').addEventListener('click', function (e) {
      var item = e.target.closest('.rawg-item');
      if (!item) return;
      var rawgData = JSON.parse(item.dataset.rawgData);
      populateFromRawg(rawgData);
    });

    // Click outside autocomplete to dismiss
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.title-wrap')) {
        UI.clearAutocomplete();
      }
    });

    // Card actions (event delegation on grid)
    document.getElementById('game-grid').addEventListener('click', function (e) {
      var editBtn = e.target.closest('.card-action-btn.edit');
      var deleteBtn = e.target.closest('.card-action-btn.delete');

      if (editBtn) {
        var id = editBtn.dataset.id;
        var game = Storage.getGames().find(function (g) { return g.id === id; });
        if (game) UI.openForm(game);
      }

      if (deleteBtn) {
        var delId = deleteBtn.dataset.id;
        var delGame = Storage.getGames().find(function (g) { return g.id === delId; });
        var name = delGame ? delGame.title : 'this game';
        if (window.confirm('Delete "' + name + '"?')) {
          Storage.deleteGame(delId);
          renderLibrary();
        }
      }
    });

    // API key banner
    document.getElementById('btn-save-key').addEventListener('click', saveApiKey);
    document.getElementById('api-key-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') saveApiKey();
    });
    document.getElementById('btn-dismiss-banner').addEventListener('click', function () {
      UI.hideApiKeyPrompt();
    });
  }

  /* ── Form Submit ── */
  function handleFormSubmit(e) {
    e.preventDefault();
    var values = UI.getFormValues();

    if (!values.title) {
      var titleInput = document.getElementById('form-title');
      titleInput.classList.add('error');
      titleInput.focus();
      return;
    }
    document.getElementById('form-title').classList.remove('error');

    var id = document.getElementById('form-id').value;
    if (id) {
      Storage.updateGame(id, values);
    } else {
      Storage.addGame(values);
    }

    UI.closeForm();
    renderLibrary();
  }

  /* ── RAWG Autocomplete ── */
  function handleTitleInput() {
    var q = this.value.trim();
    clearTimeout(debounceTimer);
    UI.clearAutocomplete();

    if (q.length < 3) return;

    var settings = Storage.getSettings();
    if (!settings.rawgApiKey) return;

    debounceTimer = setTimeout(function () {
      RAWG.search(q, settings.rawgApiKey)
        .then(function (data) {
          UI.renderAutocomplete(data.results || []);
        })
        .catch(function (err) {
          if (err && (err.status === 401 || err.status === 429)) {
            var errEl = document.getElementById('rawg-error');
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
            setTimeout(function () { errEl.classList.add('hidden'); }, 4000);
          }
        });
    }, 400);
  }

  function populateFromRawg(rawgGame) {
    var fields = RAWG.extractFields(rawgGame);

    document.getElementById('form-title').value = rawgGame.name || '';
    UI.setFormField('cover-url', fields.coverUrl);
    UI.setFormField('genres', fields.genres.join(', '));
    if (fields.releaseYear) UI.setFormField('release-year', fields.releaseYear);
    UI.updateCoverPreview(fields.coverUrl);

    // Optionally fetch description from detail endpoint
    var settings = Storage.getSettings();
    if (settings.rawgApiKey && fields.rawgId) {
      RAWG.getGameDetails(fields.rawgId, settings.rawgApiKey)
        .then(function (detail) {
          var notes = document.getElementById('form-notes');
          if (!notes.value && detail.description_raw) {
            notes.value = detail.description_raw.slice(0, 500);
          }
        })
        .catch(function () { /* non-critical, ignore */ });
    }

    UI.clearAutocomplete();
    document.getElementById('form-title').focus();
  }

  /* ── API Key ── */
  function saveApiKey() {
    var key = document.getElementById('api-key-input').value.trim();
    if (!key) return;
    var settings = Storage.getSettings();
    settings.rawgApiKey = key;
    Storage.saveSettings(settings);
    document.getElementById('api-key-input').value = '';
    UI.hideApiKeyPrompt();
  }
})();
