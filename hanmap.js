// ============================================================
//  ЛОГИКА HanMap — ИСПОЛЬЗУЕТ DB из app.js
//  ПОЛНАЯ ВЕРСИЯ С ОЗВУЧКОЙ КАК В ПРИМЕРЕ
// ============================================================

// ============================================================
//  ПРОВЕРКА НАЛИЧИЯ БАЗЫ
// ============================================================
if (typeof DB === 'undefined' || DB.length === 0) {
    console.error('❌ ОШИБКА: app.js не загружен или база пуста!');
    document.getElementById('statHz').textContent = '❌ Ошибка';
    document.getElementById('statWord').textContent = 'Загрузите app.js';
} else {
    console.log('✅ hanmap.js: загружено ' + DB.length + ' иероглифов');
}

// ============================================================
//  ПЕРЕМЕННЫЕ
// ============================================================
var favs = new Set();
var order = [];
var pos = 0;
var dark = false;
var toastTimer = null;
var favOnly = false;

// Загружаем избранное из localStorage
try {
    var saved = JSON.parse(localStorage.getItem('hanmap_favs') || '[]');
    favs = new Set(saved);
} catch (e) {
    favs = new Set();
}

// Загружаем тему
try {
    dark = localStorage.getItem('hanmap_theme') === 'dark';
    if (dark) {
        document.body.classList.add('dark');
        document.getElementById('themeBtn').textContent = '☀️';
    }
} catch (e) {
    dark = false;
}

// ============================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================
function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
    return arr;
}

function buildOrder() {
    if (favOnly && favs.size > 0) {
        order = [];
        for (var i = 0; i < DB.length; i++) {
            if (favs.has(DB[i][0])) {
                order.push(i);
            }
        }
        if (order.length === 0) {
            order = DB.map(function(_, i) { return i; });
            favOnly = false;
            document.getElementById('favBtn').classList.remove('active');
        }
    } else {
        order = DB.map(function(_, i) { return i; });
    }
    if (pos >= order.length) pos = 0;
    updateFavCount();
}

function updateFavCount() {
    var fc = document.getElementById('favCount');
    if (fc) fc.textContent = favs.size;
    var fb = document.getElementById('favBtn');
    if (fb) {
        fb.innerHTML = (favs.size > 0 ? '❤️' : '🤍') + ' <span id="favCount">' + favs.size + '</span>';
    }
}

// ============================================================
//  ОЗВУЧКА (КАК В ПРИМЕРЕ)
// ============================================================
function speak(text) {
    if (!('speechSynthesis' in window)) {
        showToast('🔇 Озвучка недоступна в этом браузере');
        return;
    }
    try {
        speechSynthesis.cancel();
        var utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.8;
        utterance.pitch = 1;
        // Пробуем найти китайский голос
        var voices = speechSynthesis.getVoices();
        var zhVoice = null;
        for (var i = 0; i < voices.length; i++) {
            if (voices[i].lang === 'zh-CN' || voices[i].lang === 'zh' || voices[i].lang.startsWith('zh')) {
                zhVoice = voices[i];
                break;
            }
        }
        if (zhVoice) utterance.voice = zhVoice;
        speechSynthesis.speak(utterance);
    } catch (e) {
        console.error('Ошибка озвучки:', e);
        showToast('🔇 Ошибка озвучки');
    }
}

// ============================================================
//  ТОСТ (ВСПЛЫВАШКА)
// ============================================================
function showToast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
        el.classList.remove('show');
    }, 2000);
}

// ============================================================
//  ОТРИСОВКА КАРТЫ
// ============================================================
function render() {
    if (!DB || DB.length === 0 || order.length === 0) {
        document.getElementById('mainHz').textContent = '⚠️';
        document.getElementById('mainPy').textContent = 'Нет данных';
        document.getElementById('mainRu').textContent = 'Загрузите app.js';
        return;
    }

    var idx = order[pos];
    var d = DB[idx];
    if (!d) return;

    // Главный иероглиф
    document.getElementById('mainHz').textContent = d[0];
    document.getElementById('mainPy').textContent = d[1];
    document.getElementById('mainRu').textContent = d[2];

    // Слова (связки)
    var wordsHtml = '';
    var words = d[4] || [];
    for (var i = 0; i < words.length; i++) {
        var w = words[i];
        // Разбиваем слово на символы и подсвечиваем главный иероглиф
        var chars = w[0].split('');
        var colored = chars.map(function(c) {
            return '<span class="' + (c === d[0] ? 'c-red' : 'c-blue') + '">' + c + '</span>';
        }).join('');
        wordsHtml += '<div class="word" data-i="' + i + '" style="animation-delay:' + (i * 70) + 'ms">' +
            '<div class="py">' + w[1] + '</div>' +
            '<div class="hz">' + colored + '</div>' +
            '<div class="ru">' + w[2] + '</div>' +
            '</div>';
    }
    document.getElementById('words').innerHTML = wordsHtml;

    // Навигация
    document.getElementById('posLabel').textContent = (pos + 1) + ' / ' + order.length;

    // Статистика
    document.getElementById('statHz').textContent = DB.length + ' иероглифов';
    var totalWords = 0;
    for (var i = 0; i < DB.length; i++) {
        if (DB[i][4]) totalWords += DB[i][4].length;
    }
    document.getElementById('statWord').textContent = totalWords + ' слов';

    // Кнопка избранного
    var likeBtn = document.getElementById('likeBtn');
    if (favs.has(d[0])) {
        likeBtn.innerHTML = '❤️ В избранном';
        likeBtn.style.color = '#e03131';
    } else {
        likeBtn.innerHTML = '🤍 В избранное';
        likeBtn.style.color = '';
    }

    // Рисуем линии после рендера
    setTimeout(drawLines, 100);
}

// ============================================================
//  ЛИНИИ (СВЯЗИ МЕЖДУ ГЛАВНЫМ ИЕРОГЛИФОМ И СЛОВАМИ)
// ============================================================
function drawLines() {
    var svg = document.getElementById('lines');
    var map = document.getElementById('map');
    if (!svg || !map) return;

    var W = map.clientWidth;
    var H = map.clientHeight;

    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    var mainNode = document.querySelector('.main-node');
    var words = document.querySelectorAll('.word');
    if (!mainNode || words.length === 0) {
        svg.innerHTML = '';
        return;
    }

    var col = getComputedStyle(document.body).getPropertyValue('--line').trim() || '#8ea2ff';
    var html = '<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="' + col + '"/></marker></defs>';

    var m0 = map.getBoundingClientRect();
    var mr = mainNode.getBoundingClientRect();
    var x1 = mr.right - m0.left + 2;
    var y1 = mr.top + mr.height / 2 - m0.top;

    words.forEach(function(el, i) {
        var r = el.getBoundingClientRect();
        var x2 = r.left - m0.left - 10;
        var y2 = r.top + r.height / 2 - m0.top;
        var dx = Math.max(30, (x2 - x1) * 0.45);
        html += '<path class="ln" style="animation-delay:' + (i * 80) + 'ms" d="M' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2 + '" fill="none" stroke="' + col + '" stroke-width="2" marker-end="url(#ar)"/>';
    });

    svg.innerHTML = html;

    // Анимация линий
    svg.querySelectorAll('.ln').forEach(function(p) {
        try {
            var L = p.getTotalLength();
            p.style.strokeDasharray = L;
            p.style.strokeDashoffset = L;
            requestAnimationFrame(function() {
                p.style.strokeDashoffset = 0;
            });
        } catch (e) {
            // Игнорируем ошибки для путей
        }
    });
}

// ============================================================
//  НАВИГАЦИЯ
// ============================================================
function go(delta) {
    if (order.length === 0) return;
    pos = (pos + delta + order.length) % order.length;
    render();
}

function goTo(idx) {
    pos = order.indexOf(idx);
    if (pos === -1) pos = 0;
    render();
}

// ============================================================
//  ПОИСК
// ============================================================
function search(query) {
    if (!query || query.trim() === '') {
        buildOrder();
        render();
        return;
    }
    query = query.toLowerCase().trim();
    var results = [];
    for (var i = 0; i < DB.length; i++) {
        var d = DB[i];
        var match = d[0].includes(query) ||
            d[1].toLowerCase().includes(query) ||
            d[2].toLowerCase().includes(query);
        // Поиск по словам
        if (!match && d[4]) {
            for (var j = 0; j < d[4].length; j++) {
                var w = d[4][j];
                if (w[0].includes(query) ||
                    w[1].toLowerCase().includes(query) ||
                    w[2].toLowerCase().includes(query)) {
                    match = true;
                    break;
                }
            }
        }
        if (match) results.push(i);
    }
    order = results;
    pos = 0;
    render();
    if (results.length === 0) {
        showToast('🔍 Ничего не найдено');
    } else {
        showToast('🔍 Найдено: ' + results.length + ' иероглифов');
    }
}

// ============================================================
//  ТЕМА
// ============================================================
function toggleTheme() {
    dark = !dark;
    document.body.classList.toggle('dark', dark);
    document.getElementById('themeBtn').textContent = dark ? '☀️' : '🌙';
    localStorage.setItem('hanmap_theme', dark ? 'dark' : 'light');
    setTimeout(drawLines, 300);
}

// ============================================================
//  ИЗБРАННОЕ
// ============================================================
function toggleFavorite() {
    if (order.length === 0) return;
    var idx = order[pos];
    var d = DB[idx];
    var char = d[0];
    if (favs.has(char)) {
        favs.delete(char);
        showToast('❌ Удалено из избранного: ' + char);
    } else {
        favs.add(char);
        showToast('❤️ Добавлено в избранное: ' + char);
    }
    localStorage.setItem('hanmap_favs', JSON.stringify(Array.from(favs)));
    buildOrder();
    updateFavCount();
    render();
}

function toggleFavFilter() {
    var btn = document.getElementById('favBtn');
    if (favs.size === 0) {
        showToast('📭 Избранное пусто — отметьте ❤️ иероглифы');
        return;
    }
    favOnly = !favOnly;
    btn.classList.toggle('active', favOnly);
    buildOrder();
    render();
    showToast(favOnly ? '❤️ Только избранное' : '📚 Все иероглифы');
}

// ============================================================
//  БАЗА (СЕТКА)
// ============================================================
function buildGrid(q) {
    q = q || document.getElementById('q').value || '';
    q = q.toLowerCase().trim();

    var grid = document.getElementById('grid');
    if (!grid) return;

    var items = [];
    for (var i = 0; i < DB.length; i++) {
        var d = DB[i];
        var match = !q ||
            d[0].includes(q) ||
            d[1].toLowerCase().includes(q) ||
            d[2].toLowerCase().includes(q) ||
            (d[4] && d[4].some(function(w) {
                return w[0].includes(q) || w[2].toLowerCase().includes(q);
            }));
        if (match) {
            items.push({ d: d, i: i });
        }
    }

    if (items.length === 0) {
        grid.innerHTML = '<div class="empty">Ничего не найдено 🔍</div>';
        return;
    }

    grid.innerHTML = '';
    items.forEach(function(item) {
        var tile = document.createElement('div');
        tile.className = 'tile';
        tile.setAttribute('data-i', item.i);
        tile.innerHTML = '<div class="t-hz">' + item.d[0] + '</div>' +
            '<div class="t-py">' + item.d[1] + '</div>';
        tile.addEventListener('click', function() {
            var idx = parseInt(this.getAttribute('data-i'));
            goTo(idx);
            closeModals();
        });
        grid.appendChild(tile);
    });
}

function showGrid() {
    buildGrid();
    var modal = document.getElementById('gridModal');
    if (modal) modal.classList.add('open');
}

// ============================================================
//  МОДАЛКИ
// ============================================================
function closeModals() {
    document.querySelectorAll('.modal').forEach(function(m) {
        m.classList.remove('open');
    });
}

// ============================================================
//  ПРОПИСЬ
// ============================================================
var canvas, ctx, drawing = false, lastX, lastY;

function initWrite() {
    canvas = document.getElementById('pad');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    var wrap = document.getElementById('canvasWrap');
    if (!wrap) return;
    var s = wrap.clientWidth;
    if (s === 0) s = 300;
    var dpr = window.devicePixelRatio || 1;

    canvas.width = s * dpr;
    canvas.height = s * dpr;
    canvas.style.width = s + 'px';
    canvas.style.height = s + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var guide = document.getElementById('guide');
    var hz = document.getElementById('mainHz').textContent;
    if (guide) {
        guide.textContent = hz || '人';
        guide.style.fontSize = s * 0.78 + 'px';
        guide.className = '';
    }

    // Рисуем сетку
    drawGrid(s);

    var modal = document.getElementById('writeModal');
    if (modal) modal.classList.add('open');

    var title = document.getElementById('writeTitle');
    if (title) title.textContent = '✍️ Пропись: ' + hz;

    // Обработчики событий
    canvas.onmousedown = startDraw;
    canvas.onmousemove = draw;
    canvas.onmouseup = endDraw;
    canvas.onmouseleave = endDraw;

    canvas.ontouchstart = function(e) {
        e.preventDefault();
        var t = e.touches[0];
        startDraw({ clientX: t.clientX, clientY: t.clientY });
    };
    canvas.ontouchmove = function(e) {
        e.preventDefault();
        var t = e.touches[0];
        draw({ clientX: t.clientX, clientY: t.clientY });
    };
    canvas.ontouchend = function(e) {
        e.preventDefault();
        endDraw();
    };
}

function drawGrid(s) {
    if (!ctx) return;
    var color = getComputedStyle(document.body).getPropertyValue('--red') || '#e03131';
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(1, 1, s - 2, s - 2);

    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.45;

    var lines = [
        [s / 2, 0, s / 2, s],
        [0, s / 2, s, s / 2],
        [0, 0, s, s],
        [s, 0, 0, s]
    ];
    lines.forEach(function(l) {
        ctx.beginPath();
        ctx.moveTo(l[0], l[1]);
        ctx.lineTo(l[2], l[3]);
        ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
}

function startDraw(e) {
    drawing = true;
    var rect = canvas.getBoundingClientRect();
    lastX = (e.clientX - rect.left);
    lastY = (e.clientY - rect.top);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, 7);
    var ink = getComputedStyle(document.body).getPropertyValue('--ink') || '#20243a';
    ctx.fillStyle = ink;
    ctx.fill();
}

function draw(e) {
    if (!drawing) return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left);
    var y = (e.clientY - rect.top);
    var ink = getComputedStyle(document.body).getPropertyValue('--ink') || '#20243a';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
}

function endDraw() {
    drawing = false;
}

function clearWrite() {
    if (!ctx) return;
    var s = document.getElementById('canvasWrap').clientWidth || 300;
    drawGrid(s);
    var guide = document.getElementById('guide');
    if (guide) guide.className = '';
}

function toggleGuide() {
    var guide = document.getElementById('guide');
    if (guide) guide.classList.toggle('hidden');
}

// ============================================================
//  ТЕСТ
// ============================================================
var quizData = [];
var quizIdx = 0;
var quizScore = 0;

function startQuiz() {
    var shuffled = DB.slice();
    shuffle(shuffled);
    quizData = shuffled.slice(0, 10);
    quizIdx = 0;
    quizScore = 0;
    var scoreEl = document.getElementById('qScore');
    if (scoreEl) scoreEl.textContent = '0 / ' + quizData.length;
    var nextBtn = document.getElementById('qNext');
    if (nextBtn) nextBtn.hidden = true;
    var modal = document.getElementById('quizModal');
    if (modal) modal.classList.add('open');
    showQuizQuestion();
}

function showQuizQuestion() {
    if (quizIdx >= quizData.length) {
        document.getElementById('qRu').textContent = '🎉 Тест завершён!';
        document.getElementById('qOpts').innerHTML = '';
        var scoreEl = document.getElementById('qScore');
        if (scoreEl) scoreEl.textContent = quizScore + ' / ' + quizData.length;
        var nextBtn = document.getElementById('qNext');
        if (nextBtn) {
            nextBtn.hidden = false;
            nextBtn.textContent = '🔄 Заново';
        }
        return;
    }

    var d = quizData[quizIdx];
    document.getElementById('qRu').textContent = d[2];

    var opts = [d];
    var others = DB.filter(function(item) { return item[0] !== d[0]; });
    shuffle(others);
    for (var i = 0; i < 3 && i < others.length; i++) {
        opts.push(others[i]);
    }
    shuffle(opts);

    var container = document.getElementById('qOpts');
    container.innerHTML = '';
    for (var i = 0; i < opts.length; i++) {
        var btn = document.createElement('button');
        btn.className = 'q-opt';
        btn.innerHTML = opts[i][0] + '<small>' + opts[i][1] + '</small>';
        btn.setAttribute('data-char', opts[i][0]);
        btn.onclick = function() {
            checkQuizAnswer(this);
        };
        container.appendChild(btn);
    }
    var scoreEl = document.getElementById('qScore');
    if (scoreEl) scoreEl.textContent = quizScore + ' / ' + quizData.length;
}

function checkQuizAnswer(btn) {
    var selected = btn.getAttribute('data-char');
    var correct = quizData[quizIdx][0];
    var btns = document.querySelectorAll('.q-opt');

    for (var i = 0; i < btns.length; i++) {
        btns[i].disabled = true;
        if (btns[i].getAttribute('data-char') === correct) {
            btns[i].classList.add('ok');
        }
        if (btns[i] === btn && selected !== correct) {
            btns[i].classList.add('bad');
        }
    }

    if (selected === correct) {
        quizScore++;
        speak(correct);
        showToast('✅ Правильно!');
    } else {
        speak(correct);
        showToast('❌ Правильно: ' + correct);
    }

    var scoreEl = document.getElementById('qScore');
    if (scoreEl) scoreEl.textContent = quizScore + ' / ' + quizData.length;
    var nextBtn = document.getElementById('qNext');
    if (nextBtn) {
        nextBtn.hidden = false;
        nextBtn.textContent = quizIdx < quizData.length - 1 ? 'Дальше →' : '📊 Результат';
    }
}

function nextQuestion() {
    quizIdx++;
    var nextBtn = document.getElementById('qNext');
    if (nextBtn) nextBtn.hidden = true;
    if (quizIdx >= quizData.length) {
        showQuizQuestion();
    } else {
        showQuizQuestion();
    }
}

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================
function init() {
    console.log('🔄 HanMap инициализация...');

    // Строим порядок
    buildOrder();

    // Рендерим
    render();

    // ---- НАВИГАЦИЯ ----
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.addEventListener('click', function() { go(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function() { go(1); });

    // ---- ОЗВУЧКА ИЕРОГЛИФА ----
    var mainNode = document.getElementById('mainNode');
    var speakBtn = document.getElementById('speakBtn');
    if (mainNode) mainNode.addEventListener('click', function() {
        var hz = document.getElementById('mainHz').textContent;
        if (hz && hz !== '⚠️') speak(hz);
    });
    if (speakBtn) speakBtn.addEventListener('click', function() {
        var hz = document.getElementById('mainHz').textContent;
        if (hz && hz !== '⚠️') speak(hz);
    });

    // ---- ОЗВУЧКА СЛОВ ПРИ КЛИКЕ (КАК В ПРИМЕРЕ) ----
    document.getElementById('words').addEventListener('click', function(e) {
        var el = e.target.closest('.word');
        if (!el) return;
        var idx = parseInt(el.dataset.i);
        if (isNaN(idx)) return;
        var d = DB[order[pos]];
        if (!d || !d[4]) return;
        var w = d[4][idx];
        if (!w) return;
        speak(w[0]); // Озвучиваем слово
        showToast('🔊 ' + w[0] + ' — ' + w[2]);
    });

    // ---- ИЗБРАННОЕ ----
    var likeBtn = document.getElementById('likeBtn');
    var favBtn = document.getElementById('favBtn');
    if (likeBtn) likeBtn.addEventListener('click', toggleFavorite);
    if (favBtn) favBtn.addEventListener('click', toggleFavFilter);

    // ---- ТЕМА ----
    var themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // ---- ПЕРЕМЕШАТЬ ----
    var randBtn = document.getElementById('randBtn');
    if (randBtn) {
        randBtn.addEventListener('click', function() {
            shuffle(order);
            pos = 0;
            render();
            showToast('🎲 Перемешано!');
        });
    }

    // ---- БАЗА (СЕТКА) ----
    var gridBtn = document.getElementById('gridBtn');
    if (gridBtn) gridBtn.addEventListener('click', showGrid);

    // ---- ПРОПИСЬ ----
    var writeBtn = document.getElementById('writeBtn');
    var clearBtn = document.getElementById('clearBtn');
    var guideBtn = document.getElementById('guideBtn');
    if (writeBtn) writeBtn.addEventListener('click', initWrite);
    if (clearBtn) clearBtn.addEventListener('click', clearWrite);
    if (guideBtn) guideBtn.addEventListener('click', toggleGuide);

    // ---- ТЕСТ ----
    var quizBtn = document.getElementById('quizBtn');
    var qNext = document.getElementById('qNext');
    if (quizBtn) quizBtn.addEventListener('click', startQuiz);
    if (qNext) qNext.addEventListener('click', nextQuestion);

    // ---- ПОИСК ----
    var searchInput = document.getElementById('q');
    if (searchInput) {
        var searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() {
                search(searchInput.value);
            }, 300);
        });
    }

    // ---- ЗАКРЫТИЕ МОДАЛОК ----
    document.querySelectorAll('[data-close]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var modal = this.closest('.modal');
            if (modal) modal.classList.remove('open');
        });
    });

    document.querySelectorAll('.modal').forEach(function(m) {
        m.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('open');
            }
        });
    });

    // ---- РЕСАЙЗ ----
    var resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(drawLines, 300);
    });

    // ---- КЛАВИАТУРА ----
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'Escape') closeModals();
        if (e.key === 'f' || e.key === 'F') toggleFavorite();
    });

    // ---- ПРЕДЗАГРУЗКА ГОЛОСОВ ----
    if ('speechSynthesis' in window) {
        speechSynthesis.getVoices();
        speechSynthesis.onvoiceschanged = function() {
            speechSynthesis.getVoices();
        };
    }

    console.log('✅ HanMap загружен!');
    console.log('📚 Всего иероглифов: ' + DB.length);
}

// ============================================================
//  ЗАПУСК
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
