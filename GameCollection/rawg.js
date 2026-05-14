'use strict';

var RAWG = (function () {
  var BASE = 'https://api.rawg.io/api';

  function search(query, apiKey) {
    var url = BASE + '/games?key=' + encodeURIComponent(apiKey) +
      '&search=' + encodeURIComponent(query) +
      '&page_size=8&search_precise=true';
    return fetch(url).then(function (res) {
      if (res.status === 401) return Promise.reject({ status: 401, message: 'Invalid API key.' });
      if (res.status === 429) return Promise.reject({ status: 429, message: 'Rate limit exceeded. Try again shortly.' });
      if (!res.ok) return Promise.reject({ status: res.status, message: 'Request failed.' });
      return res.json();
    });
  }

  function getGameDetails(rawgId, apiKey) {
    var url = BASE + '/games/' + rawgId + '?key=' + encodeURIComponent(apiKey);
    return fetch(url).then(function (res) {
      if (!res.ok) return Promise.reject({ status: res.status, message: 'Could not fetch game details.' });
      return res.json();
    });
  }

  function extractFields(rawgGame) {
    var year = rawgGame.released
      ? parseInt(rawgGame.released.split('-')[0], 10)
      : null;
    var genres = rawgGame.genres
      ? rawgGame.genres.map(function (g) { return g.name; })
      : [];
    return {
      rawgId:      rawgGame.id || null,
      coverUrl:    rawgGame.background_image || '',
      genres:      genres,
      releaseYear: isNaN(year) ? null : year
    };
  }

  return {
    search:         search,
    getGameDetails: getGameDetails,
    extractFields:  extractFields
  };
})();
