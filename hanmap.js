// ============================================================
//  ТЕТРАДЬ (ПРОПИСЬ) — ПОЛНАЯ ВЕРСИЯ
// ============================================================

var canvas, ctx;
var drawing = false;
var lastX = 0, lastY = 0;
var inkColor = '#e03131';
var lineWidth = 6;
var history = [];
var historyIndex = -1;
var maxHistory = 50;

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ ПРОПИСИ
// ============================================================
function initWrite() {
    canvas = document.getElementById('pad');
    if (!canvas) {
        console.error('❌ Canvas не найден');
        return;
    }
    ctx = canvas.getContext('2d');

    var wrap = document.getElementById('canvasWrap');
    if (!wrap) return;
    
    // Большой размер
    var s = Math.min(wrap.clientWidth, window.innerWidth * 0.9, 480);
    if (s < 300) s = 380;
    
    var dpr = window.devicePixelRatio || 1;

    canvas.width = s * dpr;
    canvas.height = s * dpr;
    canvas.style.width = s + 'px';
    canvas.style.height = s + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Показываем образец
    var guide = document.getElementById('guide');
    var hz = document.getElementById('mainHz').textContent;
    if (guide) {
        guide.textContent = hz || '人';
        guide.style.fontSize = (s * 0.72) + 'px';
        guide.style.color = 'var(--red)';
        guide.style.opacity = '0.12';
        guide.className = '';
    }

    // Рисуем сетку
    drawGrid(s);

    // Открываем модалку
    var modal = document.getElementById('writeModal');
    if (modal) modal.classList.add('open');

    var title = document.getElementById('writeTitle');
    if (title) title.textContent = '✍️ Пропись: ' + (hz || '人');

    // Очищаем историю
    history = [];
    historyIndex = -1;
    saveState();

    // Настраиваем цвет
    var colorBtn = document.getElementById('colorBtn');
    if (colorBtn) {
        colorBtn.style.background = inkColor;
        colorBtn.textContent = '🎨';
    }

    // ---- ОБРАБОТЧИКИ СОБЫТИЙ ----
    canvas.onmousedown = null;
    canvas.onmousemove = null;
    canvas.onmouseup = null;
    canvas.onmouseleave = null;
    canvas.ontouchstart = null;
    canvas.ontouchmove = null;
    canvas.ontouchend = null;

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

    // ---- КНОПКИ ----
    var clearBtn = document.getElementById('clearBtn');
    var guideBtn = document.getElementById('guideBtn');
    var undoBtn = document.getElementById('undoBtn');
    var redoBtn = document.getElementById('redoBtn');
    var saveBtn = document.getElementById('saveBtn');
    var colorBtn = document.getElementById('colorBtn');

    if (clearBtn) {
        clearBtn.onclick = function() {
            if (confirm('🧽 Очистить всё?')) {
                clearCanvas();
                saveState();
            }
        };
    }

    if (guideBtn) {
        guideBtn.onclick = toggleGuide;
    }

    if (undoBtn) {
        undoBtn.onclick = undoDraw;
    }

    if (redoBtn) {
        redoBtn.onclick = redoDraw;
    }

    if (saveBtn) {
        saveBtn.onclick = saveDrawing;
    }

    if (colorBtn) {
        colorBtn.onclick = function() {
            var colors = ['#e03131', '#4263eb', '#2ecc71', '#ffd700', '#a855f7', '#ff6b6b', '#ffffff'];
            var current = colors.indexOf(inkColor);
            var next = (current + 1) % colors.length;
            inkColor = colors[next];
            this.style.background = inkColor;
            showToast('🎨 Цвет: ' + inkColor);
        };
    }
}

// ============================================================
//  РИСОВАНИЕ СЕТКИ
// ============================================================
function drawGrid(s) {
    if (!ctx) return;
    var color = getComputedStyle(document.body).getPropertyValue('--red') || '#e03131';
    ctx.clearRect(0, 0, s, s);
    
    // Внешняя рамка
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(2, 2, s - 4, s - 4);
    
    // Сетка
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    var lines = [
        [s/2, 0, s/2, s],
        [0, s/2, s, s/2],
        [0, 0, s, s],
        [s, 0, 0, s],
        [s/4, 0, s/4, s],
        [s*3/4, 0, s*3/4, s],
        [0, s/4, s, s/4],
        [0, s*3/4, s, s*3/4]
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

// ============================================================
//  РИСОВАНИЕ
// ============================================================
function startDraw(e) {
    drawing = true;
    var rect = canvas.getBoundingClientRect();
    lastX = (e.clientX - rect.left);
    lastY = (e.clientY - rect.top);
    ctx.beginPath();
    ctx.arc(lastX, lastY, lineWidth / 2, 0, 7);
    ctx.fillStyle = inkColor;
    ctx.fill();
}

function draw(e) {
    if (!drawing) return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left);
    var y = (e.clientY - rect.top);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = lineWidth;
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
    if (drawing) {
        drawing = false;
        saveState();
    }
}

// ============================================================
//  ОЧИСТКА
// ============================================================
function clearCanvas() {
    if (!ctx) return;
    var s = document.getElementById('canvasWrap').clientWidth || 380;
    drawGrid(s);
    var guide = document.getElementById('guide');
    if (guide) guide.className = '';
}

// ============================================================
//  ПОКАЗАТЬ/СКРЫТЬ ОБРАЗЕЦ
// ============================================================
function toggleGuide() {
    var guide = document.getElementById('guide');
    if (guide) guide.classList.toggle('hidden');
}

// ============================================================
//  ИСТОРИЯ (UNDO/REDO)
// ============================================================
function saveState() {
    if (!ctx) return;
    var data = canvas.toDataURL();
    // Удаляем все состояния после текущего индекса
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    history.push(data);
    if (history.length > maxHistory) {
        history.shift();
    }
    historyIndex = history.length - 1;
}

function undoDraw() {
    if (historyIndex <= 0) {
        showToast('↩️ Нет действий для отмены');
        return;
    }
    historyIndex--;
    restoreState(history[historyIndex]);
    showToast('↩️ Отмена');
}

function redoDraw() {
    if (historyIndex >= history.length - 1) {
        showToast('↪️ Нет действий для повтора');
        return;
    }
    historyIndex++;
    restoreState(history[historyIndex]);
    showToast('↪️ Повтор');
}

function restoreState(data) {
    if (!ctx) return;
    var img = new Image();
    img.onload = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        var guide = document.getElementById('guide');
        if (guide) guide.className = '';
    };
    img.src = data;
}

// ============================================================
//  СОХРАНЕНИЕ РИСУНКА
// ============================================================
function saveDrawing() {
    if (!canvas) return;
    var link = document.createElement('a');
    link.download = 'propis_' + Date.now() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('💾 Рисунок сохранён!');
}

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ (если не загружено)
// ============================================================
// Добавляем обработчик на кнопку "Пропись"
document.addEventListener('DOMContentLoaded', function() {
    var writeBtn = document.getElementById('writeBtn');
    if (writeBtn) {
        writeBtn.addEventListener('click', initWrite);
    }
    
    var clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (confirm('🧽 Очистить всё?')) {
                clearCanvas();
                saveState();
            }
        });
    }
    
    var guideBtn = document.getElementById('guideBtn');
    if (guideBtn) {
        guideBtn.addEventListener('click', toggleGuide);
    }
});

console.log('✅ Тетрадь (пропись) загружена');
