// ============================================================
//  ПОЛНАЯ ЛОГИКА ИГРЫ — ОБЪЕДИНЁННАЯ ВЕРСИЯ
//  ТРЕБУЕТ app.js (с переменной DB)
// ============================================================

// ============================================================
//  1. ПРОВЕРКА И ПОДГОТОВКА ДАННЫХ
// ============================================================
if (typeof DB === 'undefined' || !Array.isArray(DB) || DB.length === 0) {
    console.error('❌ ОШИБКА: app.js не загружен или DB пуста!');
    // Чтобы игра не падала полностью при ошибке загрузки, создадим заглушку, 
    // но лучше исправить подключение скриптов.
    var DB = [
        ["人","rén","человек","👤"], ["大","dà","большой","📏"], ["小","xiǎo","маленький","🔬"],
        ["好","hǎo","хороший","👍"], ["水","shuǐ","вода","💧"], ["火","huǒ","огонь","🔥"]
    ];
}

console.log('✅ hanzi-game.js: База данных найдена (' + DB.length + ' иероглифов)');

// Создаем 5 наборов по 6 иероглифов из глобальной DB
var ALL_LEVELS = [];
var totalSets = 5;
var charsPerSet = 6;

for (var setIdx = 0; setIdx < totalSets; setIdx++) {
    var set = [];
    for (var i = 0; i < charsPerSet; i++) {
        // Берем иероглифы с шагом, чтобы наборы были разнообразными
        var idx = (setIdx * charsPerSet + i) % DB.length;
        var item = DB[idx];
        
        // Структура DB: [0:hanzi, 1:pinyin, 2:translation, 3:emoji, 4:words_array]
        set.push({
            h: item[0],
            p: item[1],
            r: item[2],
            e: item[3] || '🀄'
        });
    }
    ALL_LEVELS.push(set);
}

console.log('✅ Создано ' + ALL_LEVELS.length + ' игровых наборов');

// ============================================================
//  2. ПАРАМЕТРЫ ИГРЫ
// ============================================================
var NR = 8, NC = 6, TOT = NR * NC, NCOLORS = 6;
var GAP = 5, PAD = 5;
var board = [], sel = -1, score = 0, combo = 0, moves = 0, level = 1, goal = 200;
var nShuf = 3, nHint = 5, nBomb = 0, specials = 0, streak = 0, maxStreak = 0, busy = false, cellPx = 0;
var levelComplete = false;
var reshuffleAttempts = 0;
var victoryShown = false;

// ============================================================
//  3. ФУНКЦИИ ДЛЯ РАБОТЫ С НАБОРАМИ
// ============================================================
function getCharsForLevel(lvl) {
    var idx = (lvl - 1) % ALL_LEVELS.length;
    return ALL_LEVELS[idx];
}

function getCurrentChars() {
    return getCharsForLevel(level);
}

function randomChar() {
    var chars = getCurrentChars();
    var idx = Math.floor(Math.random() * chars.length);
    var d = chars[idx];
    return {
        h: d.h,
        p: d.p,
        r: d.r,
        e: d.e || '🀄',
        c: idx % NCOLORS,
        sp: null
    };
}

// ============================================================
//  4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================
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
            if (nr >= 0 && nr < NR && nc >= 0 && nc < NC) {
                res.push(nr * NC + nc);
            }
        }
    }
    return res;
}

function isNeighbor(a, b) {
    var n = getNeighbors(a);
    for (var i = 0; i < n.length; i++) {
        if (n[i] === b) return true;
    }
    return false;
}

// ============================================================
//  5. ПОИСК КОМБИНАЦИЙ (ВКЛЮЧАЯ L, T, КВАДРАТЫ)
// ============================================================
function findAllCombinations(bd) {
    var results = [], used = {};

    // Горизонтальные
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

    // Вертикальные
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

    // L и T формы
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
                    if (!bd[ids[j]] || bd[ids[j]].h !== ch) {
                        ok = false;
                        break;
                    }
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

    // Квадраты 2x2
    for (var r = 0; r < NR - 1; r++) {
        for (var c = 0; c < NC - 1; c++) {
            var ids = [r*NC+c, r*NC+c+1, (r+1)*NC+c, (r+1)*NC+c+1];
            var ch = bd[ids[0]] ? bd[ids[0]].h : null;
            if (!ch) continue;
            var ok = true;
            for (var j = 0; j < ids.length; j++) {
                if (!bd[ids[j]] || bd[ids[j]].h !== ch) {
                    ok = false;
                    break;
                }
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
            if (bd[ids[j]] && bd[ids[j]].sp === 'bomb') {
                hasBomb = true;
                break;
            }
        }
        if (hasBomb) {
            var bombIdx = -1;
            for (var j = 0; j < ids.length; j++) {
                if (bd[ids[j]] && bd[ids[j]].sp === 'bomb') {
                    bombIdx = ids[j];
                    break;
                }
            }
            if (bombIdx >= 0) {
                var neighbors = getAllNeighbors(bombIdx);
                for (var j = 0; j < neighbors.length; j++) {
                    matched[neighbors[j]] = true;
                }
                matched[bombIdx] = true;
            }
        } else {
            for (var j = 0; j < ids.length; j++) {
                matched[ids[j]] = true;
            }
            shapes.push(shape);
        }
    }
    var matchedArr = [];
    for (var key in matched) {
        matchedArr.push(parseInt(key));
    }
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

// ============================================================
//  6. ИНИЦИАЛИЗАЦИЯ ДОСКИ
// ============================================================
function initBoard() {
    board = [];
    levelComplete = false;
    victoryShown = false;
    for (var i = 0; i < TOT; i++) {
        var att = 0;
        do {
            board[i] = randomChar();
            att++;
        } while (hasMatchAt(board, i) && att < 300);
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
    for (var i = 0; i < TOT; i++) {
        if (board[i]) items.push(board[i]);
    }
    for (var i = items.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = items[i];
        items[i] = items[j];
        items[j] = t;
    }
    var k = 0;
    for (var i = 0; i < TOT; i++) {
        if (board[i]) {
            board[i] = items[k++];
            board[i].sp = null;
        }
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

// ============================================================
//  7. ТЕМЫ
// ============================================================
var THEMES = [
    { id: 't1', name: '🌳 Дерево', bg: 't1' },
    { id: 't2', name: '⚙️ Металл', bg: 't2' },
    { id: 't3', name: '💡 Неон', bg: 't3' },
    { id: 't4', name: '🧶 Бархат', bg: 't4' },
    { id: 't5', name: '🎨 Пастель', bg: 't5' }
];

function getTheme() {
    return THEMES[(level - 1) % THEMES.length];
}

function applyTheme() {
    var theme = getTheme();
    var boardEl = document.getElementById('board');
    var bgEl = document.getElementById('bg');
    var uHzEl = document.getElementById('uHz');
    if (boardEl) boardEl.className = theme.id;
    if (bgEl) bgEl.className = 'bg ' + theme.bg;
    if (uHzEl) uHzEl.textContent = theme.name;
}

// ============================================================
//  8. РЕНДЕРИНГ
// ============================================================
function calcSize() {
    var wrap = document.querySelector('.ba');
    if (!wrap) return;
    var ww = wrap.clientWidth - 12, wh = wrap.clientHeight - 8;
    var bw = ww, bh = bw * NR / NC;
    if (bh > wh) {
        bh = wh;
        bw = bh * NC / NR;
    }
    var cw = Math.floor((bw - PAD * 2 - GAP * (NC - 1)) / NC);
    var ch = Math.floor((bh - PAD * 2 - GAP * (NR - 1)) / NR);
    cellPx = Math.min(cw, ch);
    var bEl = document.getElementById('board');
    if (!bEl) return;
    bEl.style.width = (cellPx * NC + GAP * (NC - 1) + PAD * 2) + 'px';
    bEl.style.height = (cellPx * NR + GAP * (NR - 1) + PAD * 2) + 'px';
    bEl.style.gridTemplateColumns = 'repeat(' + NC + ',' + cellPx + 'px)';
    bEl.style.gridTemplateRows = 'repeat(' + NR + ',' + cellPx + 'px)';
    bEl.style.gap = GAP + 'px';
    bEl.style.padding = PAD + 'px';
}

function render(fallSet) {
    fallSet = fallSet || {};
    var b = document.getElementById('board');
    if (!b) return;
    b.innerHTML = '';
    var hzPx = Math.max(16, Math.floor(cellPx * .44));
    var pyPx = Math.max(8, Math.floor(cellPx * .13));
    var ruPx = Math.max(8, Math.floor(cellPx * .12));
    var emPx = Math.max(8, Math.floor(cellPx * .12));
    var bdPx = Math.max(8, Math.floor(cellPx * .16));

    for (var i = 0; i < TOT; i++) {
        var el = document.createElement('div');
        el.setAttribute('data-i', String(i));
        var d = board[i];
        if (!d) {
            el.className = 'c empty';
        } else {
            var cls = 'c c' + d.c;
            if (d.sp === 'bomb') cls += ' sp-bomb';
            else if (d.sp === 'laser') cls += ' sp-laser';
            else if (d.sp === 'star') cls += ' sp-star';
            else if (d.sp === 'rainbow') cls += ' sp-rainbow';
            el.className = cls;
            el.style.width = cellPx + 'px';
            el.style.height = cellPx + 'px';
            var badges = { bomb: '💥', laser: '⚡', star: '⭐', rainbow: '🌈' };
            el.innerHTML = '<span class="hz" style="font-size:' + hzPx + 'px">' + d.h +
                '</span><span class="py" style="font-size:' + pyPx + 'px">' + d.p +
                '</span><span class="ru" style="font-size:' + ruPx + 'px">' + d.r +
                '</span>' + (d.e ? '<span class="emo" style="font-size:' + emPx + 'px">' + d.e + '</span>' : '') +
                (d.sp ? '<span class="badge" style="font-size:' + bdPx + 'px">' + (badges[d.sp] || '✨') + '</span>' : '');
            if (sel === i) el.classList.add('sel');
            if (fallSet[i]) {
                el.classList.add('drop');
                var row = Math.floor(i / NC);
                el.style.setProperty('--dy', (-(row + 1) * 68) + 'px');
                el.style.setProperty('--dd', (0.2 + row * 0.04) + 's');
            }
        }
        b.appendChild(el);
    }
}

function updateUI() {
    var uSc = document.getElementById('uSc');
    var uCo = document.getElementById('uCo');
    var uLv = document.getElementById('uLv');
    var uSp = document.getElementById('uSp');
    var pFill = document.getElementById('pFill');
    var uGl = document.getElementById('uGl');
    var cSh = document.getElementById('cSh');
    var cHi = document.getElementById('cHi');
    var cBm = document.getElementById('cBm');
    var bSh = document.getElementById('bSh');
    var bHi = document.getElementById('bHi');
    var uSet = document.getElementById('uSet');

    if (uSc) uSc.textContent = score;
    if (uCo) uCo.textContent = combo;
    if (uLv) uLv.textContent = level;
    if (uSp) uSp.textContent = specials;
    if (pFill) pFill.style.width = Math.min(100, score / goal * 100) + '%';
    if (uGl) uGl.textContent = goal;
    if (cSh) cSh.textContent = nShuf;
    if (cHi) cHi.textContent = nHint;
    if (cBm) cBm.textContent = nBomb;
    if (bSh) bSh.classList.toggle('off', nShuf <= 0);
    if (bHi) bHi.classList.toggle('off', nHint <= 0);
    if (uSet) {
        var setNum = ((level - 1) % 5) + 1;
        uSet.textContent = 'Набор ' + setNum;
    }
}

// ============================================================
//  9. ЭФФЕКТЫ
// ============================================================
function salute(idx, emos) {
    emos = emos || ['✨', '⭐', '💥', '🌟'];
    var cells = document.querySelectorAll('.c');
    var el = cells[idx];
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    for (var i = 0; i < 16; i++) {
        var s = document.createElement('div');
        s.className = 'salute';
        s.textContent = emos[Math.floor(Math.random() * emos.length)];
        s.style.fontSize = (16 + Math.random() * 20) + 'px';
        var ang = Math.random() * Math.PI * 2;
        var d1 = 60 + Math.random() * 140;
        var d2 = 40 + Math.random() * 100;
        s.style.left = cx + 'px';
        s.style.top = cy + 'px';
        s.style.setProperty('--t1x', (Math.cos(ang) * d1 * 0.5) + 'px');
        s.style.setProperty('--t1y', (Math.sin(ang) * d1 * 0.5 - 40) + 'px');
        s.style.setProperty('--t2x', (Math.cos(ang + 0.5) * d2) + 'px');
        s.style.setProperty('--t2y', (Math.sin(ang + 0.5) * d2 - 80) + 'px');
        s.style.setProperty('--dur', (1 + Math.random()) + 's');
        document.body.appendChild(s);
        (function(nd) {
            setTimeout(function() { nd.remove(); }, 2000);
        })(s);
    }
}

function rainEmojis(cx, cy, count, emos) {
    count = count || 12;
    emos = emos || ['✨', '⭐', '💥', '🌟', '🌈', '🎆'];
    for (var i = 0; i < count; i++) {
        var el = document.createElement('div');
        el.className = 'rain';
        el.textContent = emos[Math.floor(Math.random() * emos.length)];
        el.style.fontSize = (14 + Math.random() * 18) + 'px';
        el.style.left = (cx + (Math.random() - 0.5) * 280) + 'px';
        el.style.top = (cy - 20 + (Math.random() - 0.5) * 40) + 'px';
        el.style.setProperty('--rd', (1.5 + Math.random() * 1.5) + 's');
        document.body.appendChild(el);
        (function(nd) {
            setTimeout(function() { nd.remove(); }, 3000);
        })(el);
    }
}

function floatPts(idx, pts) {
    var cells = document.querySelectorAll('.c');
    var el = cells[idx];
    if (!el) return;
    var br = document.getElementById('board').getBoundingClientRect();
    var cr = el.getBoundingClientRect();
    var f = document.createElement('div');
    f.className = 'fpts';
    f.textContent = '+' + pts;
    f.style.fontSize = Math.max(14, cellPx * 0.32) + 'px';
    f.style.left = (cr.left - br.left + cr.width / 2 - 18) + 'px';
    f.style.top = (cr.top - br.top - 5) + 'px';
    document.getElementById('board').appendChild(f);
    setTimeout(function() { f.remove(); }, 900);
}

function showCombo(c) {
    var el = document.getElementById('cmb');
    if (!el) return;
    var emos = ['🔥', '⚡', '💥', '🌟', '✨', '🌈'];
    el.textContent = emos[Math.min(c - 1, emos.length - 1)] + ' COMBO ×' + c + '!';
    el.style.fontSize = Math.max(28, cellPx * 0.7) + 'px';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 1150);
}

function showStreak(text, color) {
    var el = document.getElementById('streak');
    if (!el) return;
    el.textContent = text;
    el.style.color = color || '#ffd700';
    el.style.fontSize = Math.max(18, cellPx * 0.42) + 'px';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 1400);
}

// ============================================================
//  10. ЗВУКИ
// ============================================================
var actx = null;

function snd(f, d, tp, v, dl) {
    try {
        if (!actx) actx = new(window.AudioContext || window.webkitAudioContext)();
        if (actx.state === 'suspended') actx.resume();
        var t = actx.currentTime + (dl || 0);
        var o = actx.createOscillator();
        var g = actx.createGain();
        o.type = tp || 'sine';
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(v || 0.06, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (d || 0.1));
        o.connect(g);
        g.connect(actx.destination);
        o.start(t);
        o.stop(t + (d || 0.1));
    } catch (e) {}
}

function sndMatch(n) {
    for (var i = 0; i < Math.min(n, 7); i++) {
        snd(460 + i * 65, 0.09, i % 2 ? 'triangle' : 'sine', 0.06, i * 0.035);
    }
}

function sndCombo(c) {
    for (var i = 0; i < Math.min(c + 2, 9); i++) {
        snd(340 + i * 55 + c * 20, 0.1, 'sine', 0.07, i * 0.032);
    }
}

function sndBoom() {
    for (var i = 0; i < 8; i++) {
        snd(180 + Math.random() * 280, 0.09, 'sawtooth', 0.04, i * 0.04);
    }
}

function sndSpec() {
    [523, 659, 784, 1047].forEach(function(f, i) {
        snd(f, 0.11, 'sine', 0.07, i * 0.065);
    });
}

function sndSwap() {
    snd(520, 0.05);
    snd(720, 0.04, 'sine', 0.04, 0.04);
}

function sndBad() {
    snd(155, 0.12, 'sawtooth', 0.04);
    snd(120, 0.12, 'sawtooth', 0.03, 0.07);
}

function sndLvl() {
    [523, 659, 784, 1047, 1318].forEach(function(f, i) {
        snd(f, 0.13, 'sine', 0.07, i * 0.08);
    });
}

function sndShuf() {
    for (var i = 0; i < 6; i++) {
        snd(210 + i * 85, 0.05, 'sine', 0.04, i * 0.04);
    }
}

function sndStreak() {
    [523, 659, 784, 1047, 1318, 1568].forEach(function(f, i) {
        snd(f, 0.09, 'sine', 0.08, i * 0.05);
    });
}

// ============================================================
//  11. АКТИВАЦИЯ СПЕЦИАЛЬНЫХ СПОСОБНОСТЕЙ
// ============================================================
function activateBomb(idx) {
    sndBoom();
    var removed = {};
    removed[idx] = true;
    var neighbors = getAllNeighbors(idx);
    for (var i = 0; i < neighbors.length; i++) {
        removed[neighbors[i]] = true;
    }
    var cells = document.querySelectorAll('.c');
    for (var key in removed) {
        var ki = parseInt(key);
        if (cells[ki]) cells[ki].classList.add('boom');
    }
    salute(idx, ['💥', '🔥', '🌟', '✨']);
    var pts = Object.keys(removed).length * 12 + 40;
    score += pts;
    floatPts(idx, pts);
    showStreak('💥 БОМБА! +' + pts, '#ff6b6b');
    return removed;
}

function activateLaser(idx, orient) {
    sndSpec();
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
    salute(idx, ['⚡', '✨', '💥']);
    var pts = Object.keys(removed).length * 10 + 35;
    score += pts;
    floatPts(idx, pts);
    showStreak('⚡ ЛАЗЕР! +' + pts, '#aa88ee');
    return removed;
}

function activateStar(idx) {
    sndSpec();
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
    salute(idx, ['⭐', '🌟', '✨', '💫', '🌈']);
    var pts = Object.keys(removed).length * 15 + 55;
    score += pts;
    floatPts(idx, pts);
    showStreak('⭐ ЗВЕЗДА! +' + pts, '#88eebb');
    return removed;
}

function activateRainbow(idx) {
    sndSpec();
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
        if (colors[h].length > bestN) {
            bestN = colors[h].length;
            best = h;
        }
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
    salute(idx, ['🌈', '✨', '⭐', '💫', '🌟', '🎆']);
    rainEmojis(window.innerWidth / 2, window.innerHeight / 3, 20, ['🌈', '✨', '⭐', '💫']);
    var pts = Object.keys(removed).length * 18 + 80;
    score += pts;
    floatPts(idx, pts);
    showStreak('🌈 РАДУГА! +' + pts, '#ffd700');
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
    var sp1 = board[idx1] ? board[idx1].sp : null;
    var sp2 = board[idx2] ? board[idx2].sp : null;
    if (!sp1 || !sp2) return null;
    sndBoom();
    sndSpec();
    var removed = {};
    var cells = document.querySelectorAll('.c');

    if (sp1 === 'bomb' && sp2 === 'bomb') {
        for (var i = 0; i < TOT; i++) removed[i] = true;
        showStreak('💥💥 МЕГА ВЗРЫВ!', '#ff4444');
        rainEmojis(window.innerWidth / 2, window.innerHeight / 3, 40, ['💥', '🔥', '✨', '⭐']);
    } else if ((sp1 === 'bomb' && sp2 === 'laser') || (sp1 === 'laser' && sp2 === 'bomb')) {
        var bombIdx = sp1 === 'bomb' ? idx1 : idx2;
        var r = Math.floor(bombIdx / NC), c = bombIdx % NC;
        for (var dr = -1; dr <= 1; dr++) {
            var rr = r + dr;
            if (rr >= 0 && rr < NR) {
                for (var i = 0; i < NC; i++) removed[rr * NC + i] = true;
            }
        }
        for (var dc = -1; dc <= 1; dc++) {
            var cc = c + dc;
            if (cc >= 0 && cc < NC) {
                for (var i = 0; i < NR; i++) removed[i * NC + cc] = true;
            }
        }
        showStreak('💥⚡ КРЕСТ ОГНЯ!', '#ff8800');
    } else if ((sp1 === 'bomb' && sp2 === 'star') || (sp1 === 'star' && sp2 === 'bomb')) {
        var starIdx = sp1 === 'star' ? idx1 : idx2;
        var ch = board[starIdx] ? board[starIdx].h : null;
        for (var i = 0; i < TOT; i++) {
            if (board[i] && board[i].h === ch) {
                removed[i] = true;
                var rr = Math.floor(i / NC), cc = i % NC;
                for (var dr = -1; dr <= 1; dr++) {
                    for (var dc = -1; dc <= 1; dc++) {
                        var nr = rr + dr, nc = cc + dc;
                        if (nr >= 0 && nr < NR && nc >= 0 && nc < NC) {
                            removed[nr * NC + nc] = true;
                        }
                    }
                }
            }
        }
        showStreak('💥⭐ ЗВЁЗДНЫЙ ВЗРЫВ!', '#ffaa00');
    } else if (sp1 === 'laser' && sp2 === 'laser') {
        var r1 = Math.floor(idx1 / NC), c1 = idx1 % NC;
        var r2 = Math.floor(idx2 / NC), c2 = idx2 % NC;
        for (var i = 0; i < NC; i++) {
            removed[r1 * NC + i] = true;
            removed[r2 * NC + i] = true;
        }
        for (var i = 0; i < NR; i++) {
            removed[i * NC + c1] = true;
            removed[i * NC + c2] = true;
        }
        showStreak('⚡⚡ ДВОЙНОЙ ЛАЗЕР!', '#aa44ff');
    } else if ((sp1 === 'laser' && sp2 === 'star') || (sp1 === 'star' && sp2 === 'laser')) {
        var starIdx2 = sp1 === 'star' ? idx1 : idx2;
        var ch2 = board[starIdx2] ? board[starIdx2].h : null;
        for (var i = 0; i < TOT; i++) {
            if (board[i] && board[i].h === ch2) removed[i] = true;
        }
        var r3 = Math.floor(idx1 / NC), c3 = idx1 % NC;
        for (var i = 0; i < NC; i++) removed[r3 * NC + i] = true;
        for (var i = 0; i < NR; i++) removed[i * NC + c3] = true;
        showStreak('⚡⭐ ЛАЗЕРНАЯ ЗВЕЗДА!', '#88ddff');
    } else if (sp1 === 'star' && sp2 === 'star') {
        var ch1 = board[idx1] ? board[idx1].h : null;
        var ch2 = board[idx2] ? board[idx2].h : null;
        for (var i = 0; i < TOT; i++) {
            if (board[i] && (board[i].h === ch1 || board[i].h === ch2)) {
                removed[i] = true;
            }
        }
        showStreak('⭐⭐ ДВОЙНАЯ ЗВЕЗДА!', '#44ffaa');
    } else if (sp1 === 'rainbow' || sp2 === 'rainbow') {
        var other = sp1 === 'rainbow' ? idx2 : idx1;
        var ch3 = board[other] ? board[other].h : null;
        if (ch3) {
            for (var i = 0; i < TOT; i++) {
                if (board[i] && board[i].h === ch3) removed[i] = true;
            }
        }
        showStreak('🌈 РАДУГА+!', '#ffd700');
    } else {
        var r4 = Math.floor(idx1 / NC), c4 = idx1 % NC;
        var r5 = Math.floor(idx2 / NC), c5 = idx2 % NC;
        for (var dr = -1; dr <= 1; dr++) {
            for (var dc = -1; dc <= 1; dc++) {
                var nr1 = r4 + dr, nc1 = c4 + dc;
                if (nr1 >= 0 && nr1 < NR && nc1 >= 0 && nc1 < NC) {
                    removed[nr1 * NC + nc1] = true;
                }
                var nr2 = r5 + dr, nc2 = c5 + dc;
                if (nr2 >= 0 && nr2 < NR && nc2 >= 0 && nc2 < NC) {
                    removed[nr2 * NC + nc2] = true;
                }
            }
        }
        showStreak('✨ КОМБО!', '#ffd700');
    }

    for (var key in removed) {
        var ki = parseInt(key);
        if (cells[ki]) cells[ki].classList.add('boom');
    }
    salute(idx1, ['💥', '⚡', '⭐', '🌈', '✨']);
    salute(idx2, ['💥', '⚡', '⭐', '🌈', '✨']);
    var pts = Object.keys(removed).length * 15 + 100;
    score += pts;
    floatPts(idx1, pts);
    return removed;
}

// ============================================================
//  12. СТРЕЙК И ГРАВИТАЦИЯ
// ============================================================
function updateStreak() {
    streak++;
    if (streak > maxStreak) maxStreak = streak;
    var mult = 1, bonus = 0, text = '', color = '#ffd700';
    if (streak >= 7) {
        mult = 5;
        bonus = 60;
        text = '🔥 СУПЕР СТРЕЙК ×5!';
        color = '#ff4444';
        sndStreak();
        rainEmojis(window.innerWidth / 2, window.innerHeight / 3, 25, ['🔥', '⚡', '💥', '🌟']);
    } else if (streak >= 5) {
        mult = 3;
        bonus = 35;
        text = '🔥 СТРЕЙК ×3!';
        color = '#ff8800';
        sndStreak();
        rainEmojis(window.innerWidth / 2, window.innerHeight / 3, 12, ['🔥', '⚡', '✨']);
    } else if (streak >= 3) {
        mult = 2;
        bonus = 18;
        text = '🔥 СТРЕЙК ×2!';
        color = '#ffaa00';
        sndStreak();
    }
    if (text) showStreak(text, color);
    if (bonus > 0) {
        score += bonus;
        floatPts(Math.floor(Math.random() * TOT), bonus);
    }
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
            // Улучшенная логика заполнения (из образца HTML)
            if (Math.random() < 0.25) {
                var chars = getCurrentChars();
                var targetChar = chars[Math.floor(Math.random() * chars.length)];
                var r = Math.floor(i / NC), c = i % NC;
                var matchBelow = (r < NR - 2 && board[(r+1)*NC+c] && board[(r+2)*NC+c] && board[(r+1)*NC+c].h === targetChar.h && board[(r+2)*NC+c].h === targetChar.h);
                if (matchBelow) {
                   board[i] = { h: targetChar.h, p: targetChar.p, r: targetChar.r, e: targetChar.e, c: targetChar.c, sp: null };
                   continue;
                }
            }
            board[i] = randomChar();
        }
    }
}

// ============================================================
//  13. ПРОВЕРКА ПОБЕДЫ И ПЕРЕХОД УРОВНЯ
// ============================================================
function checkWinCondition() {
    if (!levelComplete && !victoryShown && score >= goal) {
        victoryShown = true;
        levelComplete = true;
        busy = true;
        sndLvl();
        rainEmojis(window.innerWidth / 2, window.innerHeight / 3, 40, ['🎉', '🎊', '✨', '⭐', '🌈', '💖', '🔥']);
        showStreak('🎉 УРОВЕНЬ ' + level + ' ПРОЙДЕН!', '#ffd700');
        setTimeout(function() {
            doNextLevel();
        }, 1500);
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

// ============================================================
//  14. ТУТОРИАЛ
// ============================================================
var TUT = [
    { em: '🎯', ti: 'Как играть?', st: 'Меняй местами <span class="hl">соседние кубики</span>, чтобы собрать <span class="hl">3+ одинаковых</span> в ряд.', demo: [1, 1, 1, 0, 0] },
    { em: '⚡', ti: '4 в ряд → ЛАЗЕР!', st: 'Собери <span class="hl">4 в ряд</span> → ⚡ <span class="hl">Лазер</span> удаляет строку или столбец!', demo: [1, 1, 1, 1, 0] },
    { em: '⭐', ti: '5 в ряд → ЗВЕЗДА!', st: 'Собери <span class="hl">5 в ряд</span> → ⭐ <span class="hl">Звезда</span> удаляет все того же цвета!', demo: [1, 1, 1, 1, 1] },
    { em: '💥', ti: 'L/T-форма → БОМБА!', st: 'Собери <span class="hl">L или T форму</span> → 💥 <span class="hl">Бомба</span> взрывает 3×3 вокруг!', demo: [1, 1, 1, 0, 1] },
    { em: '🌈', ti: '6+ в ряд → РАДУГА!', st: 'Собери <span class="hl">6+ в ряд</span> → 🌈 <span class="hl">Радуга</span> удаляет все одного цвета!', demo: [1, 1, 1, 1, 1, 1] }
];
var tutStep = 0;

function showTut() {
    tutStep = 0;
    document.getElementById('tov').classList.add('show');
    renderTut();
}

function closeTut() {
    document.getElementById('tov').classList.remove('show');
}

function renderTut() {
    var s = TUT[tutStep];
    document.getElementById('tEm').textContent = s.em;
    document.getElementById('tTi').textContent = s.ti;
    document.getElementById('tSt').innerHTML = '<div class="step">' + s.st + '</div>';
    var demo = document.getElementById('tDemo');
    demo.innerHTML = '';
    for (var i = 0; i < (s.demo ? s.demo.length : 5); i++) {
        var d = document.createElement('div');
        d.className = 'dc' + (s.demo && s.demo[i] ? ' on' : '') + (i === Math.floor((s.demo ? s.demo.length : 5) / 2) && tutStep > 0 ? ' hl' : '');
        demo.appendChild(d);
    }
    var dots = document.getElementById('tDots');
    dots.innerHTML = '';
    for (var i = 0; i < TUT.length; i++) {
        var dot = document.createElement('div');
        dot.className = 'dot' + (i === tutStep ? ' on' : '');
        dots.appendChild(dot);
    }
    document.getElementById('tBtn').textContent = tutStep === TUT.length - 1 ? 'Играть! 🎮' : 'Дальше ➡️';
}

function doTutNext() {
    if (tutStep < TUT.length - 1) {
        tutStep++;
        renderTut();
    } else {
        closeTut();
    }
}

// ============================================================
//  15. ОСНОВНАЯ ЛОГИКА ИГРЫ
// ============================================================
async function animSwap(a, b) {
    var cells = document.querySelectorAll('.c');
    var ea = cells[a], eb = cells[b];
    if (!ea || !eb) return;
    ea.classList.add('swp');
    eb.classList.add('swp');
    var ra = ea.getBoundingClientRect();
    var rb = eb.getBoundingClientRect();
    var dx = rb.left - ra.left;
    var dy = rb.top - ra.top;
    ea.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    eb.style.transform = 'translate(' + (-dx) + 'px,' + (-dy) + 'px)';
    await sleep(280);
    ea.style.transform = '';
    eb.style.transform = '';
    ea.classList.remove('swp');
    eb.classList.remove('swp');
}

function shakeCell(i) {
    var el = document.querySelectorAll('.c')[i];
    if (!el) return;
    el.classList.add('shk');
    setTimeout(function() { el.classList.remove('shk'); }, 400);
}

async function resolveWithShapes(initRes, mult) {
    await resolveLoop(initRes.matched, initRes.shapes, {}, mult);
}

async function resolveLoop(matched, shapes, newBoosters, mult) {
    mult = mult || 1;
    while (matched && matched.length > 0) {
        if (levelComplete || victoryShown) return;
        combo++;
        var n = matched.length;
        var cells = document.querySelectorAll('.c');
        var isComplexShape = false;

        if (shapes) {
            for (var si = 0; si < shapes.length; si++) {
                var t = shapes[si].type;
                if (t === 'L' || t === 'T' || t === 'square') {
                    isComplexShape = true;
                    for (var k = 0; k < shapes[si].ids.length; k++) {
                        var id = shapes[si].ids[k];
                        if (cells[id]) cells[id].classList.add('shape-hl');
                    }
                }
            }
        }

        var pts = (n * 10 + (combo - 1) * 15 + (n >= 5 ? 30 : n >= 4 ? 15 : 0)) * mult;
        if (shapes) {
            for (var si = 0; si < shapes.length; si++) {
                if (shapes[si].type === 'L' || shapes[si].type === 'T') pts += 25;
                if (shapes[si].len >= 5) pts += 30;
            }
        }
        pts = Math.floor(pts);
        score += pts;
        sndMatch(n);
        if (combo >= 2) {
            sndCombo(combo);
            showCombo(combo);
        }

        var mid = matched[Math.floor(matched.length / 2)];
        floatPts(mid, pts);

        var allRemoved = {};
        for (var mi = 0; mi < matched.length; mi++) {
            var idx = matched[mi];
            var d = board[idx];
            if (d && d.sp && !newBoosters[idx] && !allRemoved[idx]) {
                var rem = activateSpecial(idx, d.sp);
                if (rem) {
                    for (var key in rem) allRemoved[key] = true;
                }
            }
        }

        for (var mi = 0; mi < matched.length; mi++) {
            var idx = matched[mi];
            if (allRemoved[idx]) continue;
            var d = board[idx];
            if (!d) continue;
            if (!newBoosters[idx]) {
                allRemoved[idx] = true;
                if (cells[idx]) cells[idx].classList.add('gone');
                if (d.e && cells[idx]) {
                    var rect = cells[idx].getBoundingClientRect();
                    (function(em, x, y) {
                        setTimeout(function() {
                            var s = document.createElement('div');
                            s.className = 'salute';
                            s.textContent = em;
                            s.style.fontSize = '18px';
                            s.style.left = x + 'px';
                            s.style.top = y + 'px';
                            s.style.setProperty('--t1x', ((Math.random() - 0.5) * 80) + 'px');
                            s.style.setProperty('--t1y', (-40 - Math.random() * 60) + 'px');
                            s.style.setProperty('--t2x', ((Math.random() - 0.5) * 120) + 'px');
                            s.style.setProperty('--t2y', (-80 - Math.random() * 80) + 'px');
                            s.style.setProperty('--dur', (0.8 + Math.random() * 0.5) + 's');
                            document.body.appendChild(s);
                            setTimeout(function() { s.remove(); }, 1400);
                        }, 50);
                    })(d.e, rect.left + rect.width / 2 - 9, rect.top + rect.height / 2 - 9);
                }
            }
        }

        await sleep(isComplexShape ? 600 : 440);
        if (levelComplete || victoryShown) return;

        for (var key in allRemoved) board[parseInt(key)] = null;
        newBoosters = {};
        var fall = gravity();
        fillEmpty();
        render(fall);
        updateUI();
        await sleep(380);
        if (levelComplete || victoryShown) return;
        if (score >= goal) {
            checkWinCondition();
            return;
        }

        var newRes = findMatches(board);
        matched = newRes.matched;
        shapes = newRes.shapes;

        if (shapes && shapes.length > 0) {
            for (var si = 0; si < shapes.length; si++) {
                var sh = shapes[si];
                var booster = getBooster(sh);
                if (!booster) continue;
                var midIdx = sh.ids[Math.floor(sh.ids.length / 2)];
                if (board[midIdx] && !board[midIdx].sp) {
                    board[midIdx].sp = booster.name;
                    if (booster.name === 'laser') board[midIdx].lOrient = sh.orient;
                    newBoosters[midIdx] = true;
                    specials++;
                    sndSpec();
                    var emos = { bomb: ['💥', '🔥'], laser: ['⚡', '✨'], star: ['⭐', '🌟'], rainbow: ['🌈', '✨'] };
                    salute(midIdx, emos[booster.name] || ['✨']);
                    showStreak(booster.emoji + ' ' + booster.label + '!', '#ffd700');
                }
            }
            if (Object.keys(newBoosters).length > 0) {
                render();
                updateUI();
                await sleep(380);
            }
        }
    }
}

async function resolveAll(mult) {
    var result = findMatches(board);
    await resolveLoop(result.matched, result.shapes, {}, mult);
}

async function trySwap(a, b) {
    if (busy || levelComplete || !isNeighbor(a, b)) return;
    busy = true;
    sel = -1;
    sndSwap();

    var spA = board[a] ? board[a].sp : null;
    var spB = board[b] ? board[b].sp : null;

    await animSwap(a, b);

    if (spA && spB) {
        var removed = activateCombo(a, b);
        if (removed) {
            moves++;
            combo = 0;
            var mult = updateStreak();
            await sleep(480);
            for (var key in removed) board[parseInt(key)] = null;
            var fall = gravity();
            fillEmpty();
            render(fall);
            updateUI();
            await sleep(380);
            await resolveAll(mult);
            busy = false;
            updateUI();
            checkWinCondition();
            if (!levelComplete && !anyMove(board)) { reshuffle(); render(); }
            updateUI();
            return;
        }
    }

    if (spA && !spB) {
        var removed = activateSpecial(a, spA);
        if (removed) {
            moves++;
            combo = 0;
            var mult = updateStreak();
            await sleep(450);
            for (var key in removed) board[parseInt(key)] = null;
            var fall = gravity();
            fillEmpty();
            render(fall);
            updateUI();
            await sleep(380);
            await resolveAll(mult);
            busy = false;
            updateUI();
            checkWinCondition();
            if (!levelComplete && !anyMove(board)) { reshuffle(); render(); }
            updateUI();
            return;
        }
    }

    if (spB && !spA) {
        var removed = activateSpecial(b, spB);
        if (removed) {
            moves++;
            combo = 0;
            var mult = updateStreak();
            await sleep(450);
            for (var key in removed) board[parseInt(key)] = null;
            var fall = gravity();
            fillEmpty();
            render(fall);
            updateUI();
            await sleep(380);
            await resolveAll(mult);
            busy = false;
            updateUI();
            checkWinCondition();
            if (!levelComplete && !anyMove(board)) { reshuffle(); render(); }
            updateUI();
            return;
        }
    }

    var temp = board[a];
    board[a] = board[b];
    board[b] = temp;
    var result = findMatches(board);

    if (result.matched.length === 0) {
        sndBad();
        var temp2 = board[a];
        board[a] = board[b];
        board[b] = temp2;
        await animSwap(a, b);
        render();
        shakeCell(a);
        shakeCell(b);
        busy = false;
        return;
    }

    moves++;
    combo = 0;
    var mult = updateStreak();
    render();
    await resolveWithShapes(result, mult);
    busy = false;
    updateUI();
    checkWinCondition();
    if (!levelComplete && !anyMove(board)) { reshuffle(); render(); }
    updateUI();
}

// ============================================================
//  16. ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ
// ============================================================
function doShuffle() {
    if (busy || levelComplete || nShuf <= 0) return;
    nShuf--;
    sndShuf();
    reshuffle();
    render();
    updateUI();
    showStreak('🔀 ПЕРЕМЕШАНО!', '#88aaff');
}

function doHint() {
    if (busy || levelComplete || nHint <= 0) return;
    var currentShapes = findAllCombinations(board);
    var complexFound = false;
    var cells = document.querySelectorAll('.c');
    for (var i = 0; i < currentShapes.length; i++) {
        var t = currentShapes[i].type;
        if (t === 'L' || t === 'T' || t === 'square' || t === 'cross' || t === '5line' || t === '6line') {
            complexFound = true;
            for (var k = 0; k < currentShapes[i].ids.length; k++) {
                var id = currentShapes[i].ids[k];
                if (cells[id]) {
                    cells[id].classList.add('best');
                    (function(nd) {
                        setTimeout(function() { nd.classList.remove('best'); }, 2500);
                    })(cells[id]);
                }
            }
        }
    }
    if (complexFound) {
        nHint--;
        sndShuf();
        showStreak('💡 СМОТРИ ФОРМУ!', '#ffd700');
        updateUI();
        return;
    }
    var mv = bestMove(board);
    if (!mv) {
        showStreak('😅 Нет доступных ходов!', '#ff6b6b');
        return;
    }
    nHint--;
    sndShuf();
    for (var i = 0; i < mv.length; i++) {
        var el = cells[mv[i]];
        if (el) {
            el.classList.add('best');
            (function(nd) {
                setTimeout(function() { nd.classList.remove('best'); }, 2500);
            })(el);
        }
    }
    showStreak('💡 ЛУЧШИЙ ХОД!', '#2ecc71');
    updateUI();
}

function doUseBomb() {
    if (busy || levelComplete || nBomb <= 0) return;
    nBomb--;
    var valid = [];
    for (var i = 0; i < TOT; i++) {
        if (board[i] && !board[i].sp) valid.push(i);
    }
    if (!valid.length) return;
    var idx = valid[Math.floor(Math.random() * valid.length)];
    board[idx].sp = 'bomb';
    specials++;
    salute(idx, ['💥', '🔥', '✨']);
    render();
    updateUI();
    showStreak('💥 БОМБА УСТАНОВЛЕНА!', '#ff6b6b');
}

function onClick(i) {
    if (busy || levelComplete || !board[i]) return;
    if (sel < 0) {
        sel = i;
        render();
    } else if (sel === i) {
        sel = -1;
        render();
    } else if (isNeighbor(sel, i)) {
        var a = sel;
        trySwap(a, i);
    } else {
        sel = i;
        render();
    }
}

// ============================================================
//  17. ГЛОБАЛЬНЫЙ ОБЪЕКТ
// ============================================================
var G = {
    shuffle: doShuffle,
    hint: doHint,
    useBomb: doUseBomb,
    showTut: showTut,
    tutNext: doTutNext,
    closeTut: closeTut,
    newGame: doNewGame
};

// ============================================================
//  18. ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    var bEl = document.getElementById('board');
    var si = -1, sx = 0, sy = 0, mv = false;

    function getIdx(e) {
        var t = e.touches ? e.touches[0] : e;
        var el = document.elementFromPoint(t.clientX, t.clientY);
        while (el && el !== document.body) {
            if (el.getAttribute && el.getAttribute('data-i') !== null) {
                return parseInt(el.getAttribute('data-i'));
            }
            el = el.parentElement;
        }
        return -1;
    }

    bEl.addEventListener('pointerdown', function(e) {
        if (busy || levelComplete) return;
        var i = getIdx(e);
        if (i < 0 || !board[i]) return;
        si = i;
        sx = e.clientX;
        sy = e.clientY;
        mv = false;
        var el = document.querySelectorAll('.c')[i];
        if (el) el.classList.add('drag');
        try { bEl.setPointerCapture(e.pointerId); } catch (ex) {}
        e.preventDefault();
    });

    bEl.addEventListener('pointermove', function(e) {
        if (si < 0 || busy || levelComplete) return;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
        mv = true;
        var tgt = -1;
        if (Math.abs(dx) > Math.abs(dy)) {
            var c = si % NC;
            if (dx > 0 && c < NC - 1) tgt = si + 1;
            else if (dx < 0 && c > 0) tgt = si - 1;
        } else {
            var r = Math.floor(si / NC);
            if (dy > 0 && r < NR - 1) tgt = si + NC;
            else if (dy < 0 && r > 0) tgt = si - NC;
        }
        var se = document.querySelectorAll('.c')[si];
        if (se) se.classList.remove('drag');
        if (tgt >= 0 && board[tgt]) {
            var a = si;
            si = -1;
            sel = -1;
            trySwap(a, tgt);
        }
        e.preventDefault();
    });

    bEl.addEventListener('pointerup', function(e) {
        if (si >= 0) {
            var el = document.querySelectorAll('.c')[si];
            if (el) el.classList.remove('drag');
        }
        if (!mv && si >= 0 && !busy && !levelComplete) onClick(si);
        si = -1;
        mv = false;
        e.preventDefault();
    });

    bEl.addEventListener('pointercancel', function() {
        if (si >= 0) {
            var el = document.querySelectorAll('.c')[si];
            if (el) el.classList.remove('drag');
        }
        si = -1;
        mv = false;
    });

    bEl.addEventListener('contextmenu', function(e) { e.preventDefault(); });

    initBoard();
    calcSize();
    render();
    updateUI();

    window.addEventListener('resize', function() {
        calcSize();
        render();
    });
});

console.log('✅ hanzi-game.js загружен!');

