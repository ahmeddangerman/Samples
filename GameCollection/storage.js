'use strict';

var Storage = (function () {
  var GAMES_KEY = 'gc_games';
  var SETTINGS_KEY = 'gc_settings';

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getGames() {
    try {
      return JSON.parse(localStorage.getItem(GAMES_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveGames(games) {
    localStorage.setItem(GAMES_KEY, JSON.stringify(games));
  }

  function addGame(game) {
    var games = getGames();
    var now = new Date().toISOString();
    game.id = generateId();
    game.createdAt = now;
    game.updatedAt = now;
    games.push(game);
    saveGames(games);
    return game;
  }

  function updateGame(id, patch) {
    var games = getGames();
    var idx = games.findIndex(function (g) { return g.id === id; });
    if (idx === -1) return null;
    patch.updatedAt = new Date().toISOString();
    games[idx] = Object.assign({}, games[idx], patch);
    saveGames(games);
    return games[idx];
  }

  function deleteGame(id) {
    var games = getGames().filter(function (g) { return g.id !== id; });
    saveGames(games);
  }

  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  return {
    generateId: generateId,
    getGames: getGames,
    saveGames: saveGames,
    addGame: addGame,
    updateGame: updateGame,
    deleteGame: deleteGame,
    getSettings: getSettings,
    saveSettings: saveSettings
  };
})();
