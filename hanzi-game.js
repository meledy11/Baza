// ============================================================
//  ЛОГИКА ИГРЫ (матч-3, бонусы, комбо)
// ============================================================

var GAP = 5, PAD = 5;
var board = [], sel = -1, score = 0, combo = 0, moves = 0, level = 1, goal = 200;
var nShuf = 3, nHint = 5, nBomb = 0, specials = 0, streak = 0, maxStreak = 0, busy = false, cellPx = 0;
var levelComplete = false, victoryShown = false, reshuffleAttempts = 0;

function getCharsForLevel(lvl) {
  var shuffled = ALL_CHARS.slice();
  for (var i = shuffled.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = t;
  }
  return shuffled.slice(0, 6).map(function(char, idx) {
    return {
      h: char.h,
      p: char.p,
      r: char.r,
      e: char.e,
      c: idx % NCOLORS,
      sp: null
    };
  });
}

function getCurrentChars() {
  return getCharsForLevel(level);
}

function randomChar() {
  var chars = getCurrentChars();
  var idx = Math.floor(Math.random() * chars.length);
  return {
    h: chars[idx].h,
    p: chars[idx].p,
    r: chars[idx].r,
    e: chars[idx].e,
    c: chars[idx].c,
    sp: null
  };
}

function sleep(ms) {
  return new Promise(function(ok) { setTimeout(ok, ms); });
}

function getNeighbors(idx) {
  var r = Math.floor(idx / NC), c = idx % NC, res = [];
  if (r > 0) res.push(idx - NC);
  if (r < NR - 1) res.push(idx + NC);
  if (c > 0) res.push(idx - 1);
  if (c < NC - 1) res.push(idx + 1);
  return res;
}

function getAllNeighbors(idx) {
  var r = Math.floor(idx / NC), c = idx % NC, res = [];
  for (var dr = -1; dr <= 1; dr++) {
    for (var dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      var nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < NR && nc >= 0 && nc < NC) res.push(nr * NC + nc);
    }
  }
  return res;
}

function isNeighbor(a, b) {
  var n = getNeighbors(a);
  for (var i = 0; i < n.length; i++) if (n[i] === b) return true;
  return false;
}

function findAllCombinations(bd) {
  var results = [], used = {};
  for (var r = 0; r < NR; r++) {
    for (var c = 0; c <= NC - 3; c++) {
      var i = r * NC + c, ch = bd[i] ? bd[i].h : null;
      if (!ch) continue;
      var len = 1;
      while (c + len < NC && bd[i + len] && bd[i + len].h === ch) len++;
      if (len >= 3) {
        var ids = [];
        for (var k = 0; k < len; k++) ids.push(i + k);
        var key = ids.join('-');
        if (!used[key]) {
          used[key] = true;
          results.push({
            ids: ids,
            len: len,
            type: len >= 6 ? '6line' : len >= 5 ? '5line' : len === 4 ? '4line' : '3line',
            orient: 'h'
          });
        }
      }
      c += len - 1;
    }
  }
  for (var c = 0; c < NC; c++) {
    for (var r = 0; r <= NR - 3; r++) {
      var i = r * NC + c, ch = bd[i] ? bd[i].h : null;
      if (!ch) continue;
      var len = 1;
      while (r + len < NR && bd[i + len * NC] && bd[i + len * NC].h === ch) len++;
      if (len >= 3) {
        var ids = [];
        for (var k = 0; k < len; k++) ids.push(i + k * NC);
        var key = ids.join('-');
        if (!used[key]) {
          used[key] = true;
          results.push({
            ids: ids,
            len: len,
            type: len >= 6 ? '6line' : len >= 5 ? '5line' : len === 4 ? '4line' : '3line',
            orient: 'v'
          });
        }
      }
      r += len - 1;
    }
  }
  for (var r = 0; r < NR - 2; r++) {
    for (var c = 0; c < NC - 2; c++) {
      var patterns = [
        { ids: [r*NC+c, r*NC+c+1, r*NC+c+2, (r+1)*NC+c, (r+2)*NC+c], t: 'L' },
        { ids: [r*NC+c, r*NC+c+1, r*NC+c+2, (r+1)*NC+c+2, (r+2)*NC+c+2], t: 'L' },
        { ids: [r*NC+c, (r+1)*NC+c, (r+2)*NC+c, (r+2)*NC+c+1, (r+2)*NC+c+2], t: 'L' },
        { ids: [r*NC+c+2, (r+1)*NC+c+2, (r+2)*NC+c+2, (r+2)*NC+c, (r+2)*NC+c+1], t: 'L' },
        { ids: [r*NC+c, r*NC+c+1, r*NC+c+2, (r+1)*NC+c+1, (r+2)*NC+c+1], t: 'T' },
        { ids: [(r+2)*NC+c, (r+2)*NC+c+1, (r+2)*NC+c+2, (r+1)*NC+c+1, r*NC+c+1], t: 'T' },
        { ids: [r*NC+c, (r+1)*NC+c, (r+2)*NC+c, (r+1)*NC+c+1, (r+1)*NC+c+2], t: 'T' },
        { ids: [r*NC+c+2, (r+1)*NC+c+2, (r+2)*NC+c+2, (r+1)*NC+c+1, (r+1)*NC+c], t: 'T' }
      ];
      for (var p = 0; p < patterns.length; p++) {
        var ids = patterns[p].ids, ch = bd[ids[0]] ? bd[ids[0]].h : null;
        if (!ch) continue;
        var ok = true;
        for (var j = 0; j < ids.length; j++) {
          if (!bd[ids[j]] || bd[ids[j]].h !== ch) { ok = false; break; }
        }
        if (ok) {
          var key = ids.join('-');
          if (!used[key]) {
            used[key] = true;
            results.push({ ids: ids, len: 5, type: patterns[p].t, orient: patterns[p].t });
          }
        }
      }
    }
  }
  for (var r = 0; r < NR - 1; r++) {
    for (var c = 0; c < NC - 1; c++) {
      var ids = [r*NC+c, r*NC+c+1, (r+1)*NC+c, (r+1)*NC+c+1];
      var ch = bd[ids[0]] ? bd[ids[0]].h : null;
      if (!ch) continue;
      var ok = true;
      for (var j = 0; j < ids.length; j++) {
        if (!bd[ids[j]] || bd[ids[j]].h !== ch) { ok = false; break; }
      }
      if (ok) {
        var key = ids.join('-');
        if (!used[key]) {
          used[key] = true;
          results.push({ ids: ids, len: 4, type: 'square', orient: 'square' });
        }
      }
    }
  }
  return results;
}

function getBooster(shape) {
  var map = {
    '4line': { name: 'laser', emoji: '⚡', label: 'ЛАЗЕР' },
    '5line': { name: 'star', emoji: '⭐', label: 'ЗВЕЗДА' },
    '6line': { name: 'rainbow', emoji: '🌈', label: 'РАДУГА' },
    'L': { name: 'bomb', emoji: '💥', label: 'БОМБА' },
    'T': { name: 'laser', emoji: '⚡', label: 'ЛАЗЕР' },
    'square': { name: 'bomb', emoji: '💥', label: 'БОМБА' }
  };
  return map[shape.type] || null;
}

function findMatches(bd) {
  var allShapes = findAllCombinations(bd), matched = {}, shapes = [];
  for (var i = 0; i < allShapes.length; i++) {
    var shape = allShapes[i], ids = shape.ids, hasBomb = false;
    for (var j = 0; j < ids.length; j++) {
      if (bd[ids[j]] && bd[ids[j]].sp === 'bomb') { hasBomb = true; break; }
    }
    if (hasBomb) {
      var bombIdx = -1;
      for (var j = 0; j < ids.length; j++) {
        if (bd[ids[j]] && bd[ids[j]].sp === 'bomb') { bombIdx = ids[j]; break; }
      }
      if (bombIdx >= 0) {
        var neighbors = getAllNeighbors(bombIdx);
        for (var j = 0; j < neighbors.length; j++) matched[neighbors[j]] = true;
        matched[bombIdx] = true;
      }
    } else {
      for (var j = 0; j < ids.length; j++) matched[ids[j]] = true;
      shapes.push(shape);
    }
  }
  var matchedArr = [];
  for (var key in matched) matchedArr.push(parseInt(key));
  return { matched: matchedArr, shapes: shapes };
}

function anyMove(bd) {
  for (var i = 0; i < TOT; i++) {
    if (!bd[i]) continue;
    var ns = getNeighbors(i);
    for (var j = 0; j < ns.length; j++) {
      var ni = ns[j];
      if (!bd[ni]) continue;
      var temp = bd[i];
      bd[i] = bd[ni];
      bd[ni] = temp;
      var result = findMatches(bd);
      var temp2 = bd[i];
      bd[i] = bd[ni];
      bd[ni] = temp2;
      if (result.matched.length > 0) return [i, ni];
    }
  }
  return null;
}

function bestMove(bd) {
  var best = null, bestScore = -1;
  for (var i = 0; i < TOT; i++) {
    if (!bd[i]) continue;
    var ns = getNeighbors(i);
    for (var j = 0; j < ns.length; j++) {
      var ni = ns[j];
      if (!bd[ni]) continue;
      var temp = bd[i];
      bd[i] = bd[ni];
      bd[ni] = temp;
      var result = findMatches(bd);
      var temp2 = bd[i];
      bd[i] = bd[ni];
      bd[ni] = temp2;
      if (result.matched.length > 0) {
        var sc = result.matched.length * 10;
        for (var k = 0; k < result.shapes.length; k++) {
          var sh = result.shapes[k];
          sc += sh.len * 20;
          var booster = getBooster(sh);
          if (booster) sc += 200;
          if (sh.type === 'L' || sh.type === 'T') sc += 100;
        }
        if (sc > bestScore) {
          bestScore = sc;
          best = [i, ni];
        }
      }
    }
  }
  return best;
}

function hasMatchAt(bd, idx) {
  var r = Math.floor(idx / NC), c = idx % NC, ch = bd[idx] ? bd[idx].h : null;
  if (!ch) return false;
  if (c >= 2 && bd[idx-1] && bd[idx-2] && bd[idx-1].h === ch && bd[idx-2].h === ch) return true;
  if (r >= 2 && bd[idx-NC] && bd[idx-2*NC] && bd[idx-NC].h === ch && bd[idx-2*NC].h === ch) return true;
  return false;
}

function initBoard() {
  board = [];
  levelComplete = false;
  victoryShown = false;
  for (var i = 0; i < TOT; i++) {
    var att = 0;
    do { board[i] = randomChar(); att++; } while (hasMatchAt(board, i) && att < 300);
  }
  reshuffleAttempts = 0;
  while (!anyMove(board) && reshuffleAttempts < 10) {
    reshuffleAttempts++;
    reshuffle(true);
  }
  if (!anyMove(board)) {
    for (var i = 0; i < TOT; i++) board[i] = randomChar();
    if (!anyMove(board)) {
      board = [];
      for (var i = 0; i < TOT; i++) {
        board[i] = randomChar();
        while (hasMatchAt(board, i)) board[i] = randomChar();
      }
    }
  }
  applyTheme();
  updateUI();
}

function reshuffle(skipCheck) {
  var items = [];
  for (var i = 0; i < TOT; i++) if (board[i]) items.push(board[i]);
  for (var i = items.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = items[i];
    items[i] = items[j];
    items[j] = t;
  }
  var k = 0;
  for (var i = 0; i < TOT; i++) if (board[i]) {
    board[i] = items[k++];
    board[i].sp = null;
  }
  for (var i = 0; i < TOT; i++) {
    if (!board[i]) board[i] = randomChar();
    var att = 0;
    while (hasMatchAt(board, i) && att < 300) {
      board[i] = randomChar();
      att++;
    }
  }
  if (!skipCheck && !anyMove(board)) {
    if (reshuffleAttempts < 10) {
      reshuffleAttempts++;
      reshuffle(false);
    } else {
      for (var i = 0; i < TOT; i++) board[i] = randomChar();
    }
  }
}

function activateBomb(idx) {
  var removed = {};
  removed[idx] = true;
  var neighbors = getAllNeighbors(idx);
  for (var i = 0; i < neighbors.length; i++) removed[neighbors[i]] = true;
  var cells = document.querySelectorAll('.c');
  for (var key in removed) {
    var ki = parseInt(key);
    if (cells[ki]) cells[ki].classList.add('boom');
  }
  var pts = Object.keys(removed).length * 12 + 40;
  score += pts;
  return removed;
}

function activateLaser(idx, orient) {
  var r = Math.floor(idx / NC), c = idx % NC, removed = {};
  removed[idx] = true;
  var cells = document.querySelectorAll('.c');
  if (orient === 'h' || !orient) {
    for (var i = 0; i < NC; i++) {
      var id = r * NC + i;
      removed[id] = true;
      if (cells[id]) cells[id].classList.add('lhit');
    }
  }
  if (orient === 'v' || !orient) {
    for (var i = 0; i < NR; i++) {
      var id = i * NC + c;
      removed[id] = true;
      if (cells[id]) cells[id].classList.add('lhit');
    }
  }
  var pts = Object.keys(removed).length * 10 + 35;
  score += pts;
  return removed;
}

function activateStar(idx) {
  var ch = board[idx] ? board[idx].h : null;
  if (!ch) return {};
  var removed = {};
  removed[idx] = true;
  var cells = document.querySelectorAll('.c');
  for (var i = 0; i < TOT; i++) {
    if (i !== idx && board[i] && board[i].h === ch) {
      removed[i] = true;
      if (cells[i]) cells[i].classList.add('shit');
    }
  }
  if (cells[idx]) cells[idx].classList.add('shit');
  var pts = Object.keys(removed).length * 15 + 55;
  score += pts;
  return removed;
}

function activateRainbow(idx) {
  var colors = {};
  for (var i = 0; i < TOT; i++) {
    if (i !== idx && board[i]) {
      var h = board[i].h;
      if (!colors[h]) colors[h] = [];
      colors[h].push(i);
    }
  }
  var best = null, bestN = 0;
  for (var h in colors) {
    if (colors[h].length > bestN) { bestN = colors[h].length; best = h; }
  }
  var removed = {};
  removed[idx] = true;
  var cells = document.querySelectorAll('.c');
  if (best) {
    for (var j = 0; j < colors[best].length; j++) {
      var id = colors[best][j];
      removed[id] = true;
      if (cells[id]) cells[id].classList.add('rhit');
    }
  }
  if (cells[idx]) cells[idx].classList.add('rhit');
  var pts = Object.keys(removed).length * 18 + 80;
  score += pts;
  return removed;
}

function activateSpecial(idx, sp) {
  if (sp === 'bomb') return activateBomb(idx);
  if (sp === 'laser') return activateLaser(idx, board[idx] ? board[idx].lOrient || 'h' : 'h');
  if (sp === 'star') return activateStar(idx);
  if (sp === 'rainbow') return activateRainbow(idx);
  return null;
}

function activateCombo(idx1, idx2) {
  var sp1 = board[idx1] ? board[idx1].sp : null, sp2 = board[idx2] ? board[idx2].sp : null;
  if (!sp1 || !sp2) return null;
  var removed = {}, cells = document.querySelectorAll('.c');
  if (sp1 === 'bomb' && sp2 === 'bomb') {
    for (var i = 0; i < TOT; i++) removed[i] = true;
  } else if ((sp1 === 'bomb' && sp2 === 'laser') || (sp1 === 'laser' && sp2 === 'bomb')) {
    var bombIdx = sp1 === 'bomb' ? idx1 : idx2, r = Math.floor(bombIdx / NC), c = bombIdx % NC;
    for (var dr = -1; dr <= 1; dr++) {
      var rr = r + dr;
      if (rr >= 0 && rr < NR) for (var i = 0; i < NC; i++) removed[rr * NC + i] = true;
    }
    for (var dc = -1; dc <= 1; dc++) {
      var cc = c + dc;
      if (cc >= 0 && cc < NC) for (var i = 0; i < NR; i++) removed[i * NC + cc] = true;
    }
  } else if ((sp1 === 'bomb' && sp2 === 'star') || (sp1 === 'star' && sp2 === 'bomb')) {
    var starIdx = sp1 === 'star' ? idx1 : idx2, ch = board[starIdx] ? board[starIdx].h : null;
    for (var i = 0; i < TOT; i++) {
      if (board[i] && board[i].h === ch) {
        removed[i] = true;
        var rr = Math.floor(i / NC), cc = i % NC;
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
          var nr = rr + dr, nc = cc + dc;
          if (nr >= 0 && nr < NR && nc >= 0 && nc < NC) removed[nr * NC + nc] = true;
        }
      }
    }
  } else if (sp1 === 'laser' && sp2 === 'laser') {
    var r1 = Math.floor(idx1 / NC), c1 = idx1 % NC, r2 = Math.floor(idx2 / NC), c2 = idx2 % NC;
    for (var i = 0; i < NC; i++) { removed[r1 * NC + i] = true; removed[r2 * NC + i] = true; }
    for (var i = 0; i < NR; i++) { removed[i * NC + c1] = true; removed[i * NC + c2] = true; }
  } else if ((sp1 === 'laser' && sp2 === 'star') || (sp1 === 'star' && sp2 === 'laser')) {
    var starIdx2 = sp1 === 'star' ? idx1 : idx2, ch2 = board[starIdx2] ? board[starIdx2].h : null;
    for (var i = 0; i < TOT; i++) if (board[i] && board[i].h === ch2) removed[i] = true;
    var r3 = Math.floor(idx1 / NC), c3 = idx1 % NC;
    for (var i = 0; i < NC; i++) removed[r3 * NC + i] = true;
    for (var i = 0; i < NR; i++) removed[i * NC + c3] = true;
  } else if (sp1 === 'star' && sp2 === 'star') {
    var ch1 = board[idx1] ? board[idx1].h : null, ch2 = board[idx2] ? board[idx2].h : null;
    for (var i = 0; i < TOT; i++) if (board[i] && (board[i].h === ch1 || board[i].h === ch2)) removed[i] = true;
  } else if (sp1 === 'rainbow' || sp2 === 'rainbow') {
    var other = sp1 === 'rainbow' ? idx2 : idx1, ch3 = board[other] ? board[other].h : null;
    if (ch3) for (var i = 0; i < TOT; i++) if (board[i] && board[i].h === ch3) removed[i] = true;
  } else {
    var r4 = Math.floor(idx1 / NC), c4 = idx1 % NC, r5 = Math.floor(idx2 / NC), c5 = idx2 % NC;
    for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
      var nr1 = r4 + dr, nc1 = c4 + dc;
      if (nr1 >= 0 && nr1 < NR && nc1 >= 0 && nc1 < NC) removed[nr1 * NC + nc1] = true;
      var nr2 = r5 + dr, nc2 = c5 + dc;
      if (nr2 >= 0 && nr2 < NR && nc2 >= 0 && nc2 < NC) removed[nr2 * NC + nc2] = true;
    }
  }
  for (var key in removed) {
    var ki = parseInt(key);
    if (cells[ki]) cells[ki].classList.add('boom');
  }
  var pts = Object.keys(removed).length * 15 + 100;
  score += pts;
  return removed;
}

function updateStreak() {
  streak++;
  if (streak > maxStreak) maxStreak = streak;
  var mult = 1, bonus = 0, text = '', color = '#ffd700';
  if (streak >= 7) { mult = 5; bonus = 60; }
  else if (streak >= 5) { mult = 3; bonus = 35; }
  else if (streak >= 3) { mult = 2; bonus = 18; }
  if (bonus > 0) { score += bonus; }
  return mult;
}

function gravity() {
  var fall = {};
  for (var c = 0; c < NC; c++) {
    var w = NR - 1;
    for (var r = NR - 1; r >= 0; r--) {
      var i = r * NC + c;
      if (board[i] !== null) {
        var wi = w * NC + c;
        if (w !== r) {
          board[wi] = board[i];
          board[i] = null;
          fall[wi] = true;
        }
        w--;
      }
    }
  }
  return fall;
}

function fillEmpty() {
  for (var i = 0; i < TOT; i++) {
    if (board[i] === null) {
      board[i] = randomChar();
    }
  }
}

function checkWinCondition() {
  if (!levelComplete && !victoryShown && score >= goal) {
    victoryShown = true;
    levelComplete = true;
    busy = true;
    setTimeout(function() { doNextLevel(); }, 1500);
  }
}

function doNextLevel() {
  levelComplete = false;
  victoryShown = false;
  busy = false;
  level = (level % 5) + 1;
  goal = 200 + ((level - 1) * 100);
  score = 0;
  combo = 0;
  moves = 0;
  streak = 0;
  maxStreak = 0;
  specials = 0;
  nShuf = Math.min(5, nShuf + 1);
  nHint = Math.min(5, nHint + 1);
  sel = -1;
  var els = document.querySelectorAll('.c');
  for (var i = 0; i < els.length; i++) els[i].className = 'c';
  initBoard();
  calcSize();
  render();
  updateUI();
}

function doNewGame() {
  closeTut();
  var els = document.querySelectorAll('.c');
  for (var i = 0; i < els.length; i++) els[i].className = 'c';
  level = 1;
  score = 0;
  combo = 0;
  moves = 0;
  goal = 200;
  nShuf = 3;
  nHint = 5;
  nBomb = 0;
  specials = 0;
  streak = 0;
  maxStreak = 0;
  sel = -1;
  busy = false;
  levelComplete = false;
  victoryShown = false;
  initBoard();
  calcSize();
  render();
  updateUI();
}
