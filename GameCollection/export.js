'use strict';

var Export = (function () {
  var COLUMNS = ['id', 'title', 'platform', 'rating', 'status', 'genres', 'releaseYear', 'notes', 'coverUrl'];
  var HEADERS = ['ID', 'Title', 'Platform', 'Rating', 'Status', 'Genres', 'Release Year', 'Notes', 'Cover URL'];

  function quoteField(value) {
    var str = (value === null || value === undefined) ? '' : String(value);
    str = str.replace(/"/g, '""');
    return '"' + str + '"';
  }

  function toCSV(games) {
    var rows = [HEADERS.map(quoteField).join(',')];
    games.forEach(function (game) {
      var row = COLUMNS.map(function (col) {
        var val = game[col];
        if (col === 'genres') {
          val = Array.isArray(val) ? val.join('|') : (val || '');
        }
        return quoteField(val);
      });
      rows.push(row.join(','));
    });
    return rows.join('\n');
  }

  function downloadCSV(games) {
    var csv = toCSV(games);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'game-collection.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    toCSV:       toCSV,
    downloadCSV: downloadCSV
  };
})();
