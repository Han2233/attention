/* ==========================================================================
   注意力机制 —— 互动演示脚本
   4 个可视化：加权平均 / 热力图实验室 / 双头对比 / 因果掩码
   ========================================================================== */

const fmt = (v, d = 2) => Number(v).toFixed(d);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function softmax(arr) {
  const m = Math.max(...arr);
  const exps = arr.map((x) => Math.exp(x - m));  // 减 max：数值稳定
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// 高清 canvas 准备
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}
function watchSize(canvas, redraw) {
  new ResizeObserver(() => { setupCanvas(canvas); redraw(); }).observe(canvas);
}

/* ============================================================
   演示 1：加权平均直觉（canvas）
   三个值向量 + 分数滑杆 → Softmax 权重 → 加权平均输出箭头
   ============================================================ */
(function () {
  const canvas = document.getElementById('wa-canvas');
  const infoEl = document.getElementById('wa-info');
  const VECTORS = [
    { name: '猫', x: 3.0, y: 1.0, color: '#2563eb' },
    { name: '狗', x: 2.5, y: 2.0, color: '#d97706' },
    { name: '苹果', x: 1.0, y: 3.0, color: '#dc2626' },
  ];
  const sliders = [
    document.getElementById('wa-s1'),
    document.getElementById('wa-s2'),
    document.getElementById('wa-s3'),
  ];
  const vals = [
    document.getElementById('wa-s1v'),
    document.getElementById('wa-s2v'),
    document.getElementById('wa-s3v'),
  ];

  function draw() {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    // 坐标系：原点左下区域，x∈[-0.5,5]，y∈[-0.5,4.2]
    const ox = 70, oy = h - 46;
    const sx = (w - 130) / 5.5, sy = (h - 100) / 4.7;
    const px = (x) => ox + x * sx;
    const py = (y) => oy - y * sy;

    // 坐标轴
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ox, py(-0.5)); ctx.lineTo(ox, py(4.2)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(-0.5), oy); ctx.lineTo(px(5), oy); ctx.stroke();

    // 三个值向量
    VECTORS.forEach((v) => {
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(px(v.x), py(v.y)); ctx.stroke();
      // 箭头
      const ang = Math.atan2(oy - py(v.y), px(v.x) - ox);
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.moveTo(px(v.x), py(v.y));
      ctx.lineTo(px(v.x) - 10 * Math.cos(ang - 0.4), py(v.y) + 10 * Math.sin(ang - 0.4));
      ctx.lineTo(px(v.x) - 10 * Math.cos(ang + 0.4), py(v.y) + 10 * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
      // 标签
      ctx.fillStyle = v.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(v.name + ' (' + v.x + ', ' + v.y + ')', px(v.x) + 8, py(v.y) - 6);
    });

    // Softmax 权重
    const scores = sliders.map((s) => parseFloat(s.value));
    const weights = softmax(scores);
    // 加权平均输出
    const oxv = VECTORS.reduce((s, v, i) => s + v.x * weights[i], 0);
    const oyv = VECTORS.reduce((s, v, i) => s + v.y * weights[i], 0);

    // 权重条（画布右上）
    let barY = 16;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    VECTORS.forEach((v, i) => {
      ctx.fillStyle = '#334155';
      ctx.fillText(v.name, w - 190, barY + 10);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(w - 150, barY, 130, 14);
      ctx.fillStyle = v.color;
      ctx.fillRect(w - 150, barY, 130 * weights[i], 14);
      ctx.fillStyle = '#64748b';
      ctx.fillText(fmt(weights[i] * 100, 0) + '%', w - 14, barY + 10);
      barY += 22;
    });

    // 输出向量（粗箭头 + 虚线辅助线）
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(px(oxv), py(oyv)); ctx.stroke();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.2;
    VECTORS.forEach((v, i) => {
      if (weights[i] > 0.01) {
        ctx.beginPath();
        ctx.moveTo(px(v.x * weights[i]), py(v.y * weights[i]));
        ctx.lineTo(px(v.x * weights[i]), oy);
        ctx.lineTo(ox, oy);
        ctx.stroke();
      }
    });
    ctx.setLineDash([]);
    ctx.fillStyle = '#6d28d9';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('输出 = 加权平均 (' + fmt(oxv, 2) + ', ' + fmt(oyv, 2) + ')', px(oxv) + 10, py(oyv) + 18);

    // 信息面板
    const terms = VECTORS.map((v, i) => fmt(weights[i], 2) + '×(' + v.x + ',' + v.y + ')').join(' + ');
    infoEl.innerHTML =
      '权重：' + weights.map((w2, i) => '<b>' + VECTORS[i].name + ' ' + fmt(w2 * 100, 0) + '%</b>').join('　') +
      '　·　输出 = ' + terms + ' = <b>(' + fmt(oxv, 2) + ', ' + fmt(oyv, 2) + ')</b>' +
      '<br><span style="color:var(--ink-faint)">把分数拖到极端（10/0/0）试试：权重变成 one-hot，输出就完全等于分数最高的那个向量。</span>';
  }

  sliders.forEach((s, i) => {
    s.addEventListener('input', () => { vals[i].textContent = s.value; draw(); });
  });
  watchSize(canvas, draw);
  draw();
})();

/* ============================================================
   演示 2：注意力热力图实验室
   经典句 "The animal didn't cross the street because it was too tired"
   ============================================================ */
(function () {
  const gridEl = document.getElementById('att-grid');
  const toksEl = document.getElementById('att-toks');
  const infoEl = document.getElementById('att-info');
  const dkEl = document.getElementById('att-dk');
  const dkVal = document.getElementById('att-dk-val');
  const scaleEl = document.getElementById('att-scale');

  const TOKENS = ['the', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', 'tired'];

  // 基础分数矩阵：对角线高、邻近词次之（模拟「局部语法注意力」）
  function baseScore(i, j) {
    const d = Math.abs(i - j);
    if (d === 0) return 3.5;
    if (d === 1) return 2.2;
    if (d === 2) return 1.2;
    return 0.6;
  }
  const SCORES = TOKENS.map((_, i) => TOKENS.map((_, j) => baseScore(i, j)));
  // 手工覆盖的特殊语义关系（模拟模型学到的「指代/搭配」注意力）
  const OVERRIDES = [
    [7, 1, 6.2], [7, 5, 4.4], [7, 3, 2.2], [7, 0, 1.0], [7, 4, 1.0], [7, 2, 1.2],
    [3, 5, 5.4], [3, 1, 3.8], [3, 6, 2.2],
    [10, 7, 3.6], [10, 8, 3.0], [10, 9, 2.6],
    [6, 2, 3.2], [6, 3, 2.6],
    [5, 3, 4.0], [5, 1, 2.2],
    [8, 7, 2.8],
    [1, 7, 3.2], [1, 0, 2.8],
    [0, 1, 2.8],
    [4, 5, 2.8],
    [2, 3, 2.6], [2, 1, 2.2],
    [9, 10, 2.6],
  ];
  OVERRIDES.forEach(([i, j, v]) => { SCORES[i][j] = v; });

  let sel = 7;  // 默认选中 "it"

  function weightsForRow(i) {
    const dk = parseInt(dkEl.value, 10);
    const scaled = SCORES[i].map((s) => (scaleEl.checked ? s / Math.sqrt(dk) : s));
    return softmax(scaled);
  }

  function render() {
    const wrow = weightsForRow(sel);
    const maxW = Math.max(...wrow);
    // 表格：列头 = 被看的词，行头 = 查询词
    let html = '<table class="att"><tr><th></th>' +
      TOKENS.map((t) => '<th>' + t + '</th>').join('') + '</tr>';
    TOKENS.forEach((t, i) => {
      const w2 = weightsForRow(i);
      html += '<tr><td class="rowlab">' + t + '</td>' +
        TOKENS.map((_, j) => {
          const a = w2[j] / Math.max(...w2);
          const bg = 'rgba(124, 58, 237, ' + fmt(a * 0.85, 2) + ')';
          const fg = a > 0.5 ? '#fff' : '#5b21b6';
          return '<td style="background:' + bg + ';color:' + fg + '"' +
            (i === sel ? ' class="sel"' : '') + ' data-row="' + i + '" data-col="' + j + '" title="' +
            t + ' → ' + TOKENS[j] + ': ' + fmt(w2[j], 3) + '">' + fmt(w2[j] * 100, 0) + '</td>';
        }).join('') + '</tr>';
    });
    html += '</table>';
    gridEl.innerHTML = html;

    // 词条按钮
    toksEl.innerHTML = TOKENS.map((t, i) =>
      '<button class="tok-btn' + (i === sel ? ' on' : '') + '" data-i="' + i + '">' + t + '</button>'
    ).join('');

    showInfo();
  }

  function showInfo() {
    const w = weightsForRow(sel);
    const dk = parseInt(dkEl.value, 10);
    // 按权重排序取前 4
    const top = w.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, 4);
    const bars = top.map((x) =>
      '<div class="wbar"><span class="wn">' + TOKENS[x.i] + '</span>' +
      '<span class="wt"><span class="wf" style="width:' + fmt(x.v / top[0].v * 100, 1) + '%"></span></span>' +
      '<span class="wv">' + fmt(x.v * 100, 0) + '%</span></div>'
    ).join('');

    const sLine = top.map((x) => 's(' + TOKENS[x.i] + ') = ' + fmt(SCORES[sel][x.i], 1)).join('，');
    const scaledLine = top.map((x) => 's/' + (scaleEl.checked ? '√' + dk + '=' + fmt(SCORES[sel][x.i] / Math.sqrt(dk), 2) : '(无缩放) ' + fmt(SCORES[sel][x.i], 2))).join('，');

    infoEl.innerHTML =
      '<b>查询词「' + TOKENS[sel] + '」的计算过程：</b><br>' +
      '① 打分：' + sLine + '；<br>' +
      '② 缩放：' + scaledLine + '；<br>' +
      '③ Softmax → 权重（top 4）：' +
      '<div style="margin-top:6px">' + bars + '</div>' +
      '④ 输出 = Σ 权重ⱼ × vⱼ —— 这就是「' + TOKENS[sel] + '」位置的上下文感知表示。' +
      (sel === 7 ? '<br><b style="color:#6d28d9">看点：it 把大部分权重给了 animal（6.2 分）——模型「看懂」了 it 指代 animal！</b>' : '');
  }

  gridEl.addEventListener('click', (e) => {
    const td = e.target.closest('td[data-row]');
    if (!td) return;
    sel = parseInt(td.dataset.row, 10);
    render();
  });
  toksEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    sel = parseInt(b.dataset.i, 10);
    render();
  });
  dkEl.addEventListener('input', () => { dkVal.textContent = dkEl.value; render(); });
  scaleEl.addEventListener('change', render);

  dkVal.textContent = '16';
  render();
})();

/* ============================================================
   演示 3：双头对比
   Head1 语法头（局部注意力） vs Head2 指代头（远距离呼应）
   ============================================================ */
(function () {
  const toksEl = document.getElementById('mh-toks');
  const h1El = document.getElementById('mh-head1');
  const h2El = document.getElementById('mh-head2');
  const infoEl = document.getElementById('mh-info');

  const TOKENS = ['the', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', 'tired'];

  // Head 1：局部语法头（对角线 + 邻近词）
  const HEAD1 = TOKENS.map((_, i) => TOKENS.map((_, j) => {
    const d = Math.abs(i - j);
    if (d === 0) return 3.5;
    if (d === 1) return 2.2;
    if (d === 2) return 1.0;
    return 0.3;
  }));
  // Head 2：指代头（远距离呼应）
  const HEAD2 = TOKENS.map((_, i) => TOKENS.map(() => 0.3));
  [[7, 1, 8.0], [7, 5, 2.0], [1, 7, 3.5], [5, 3, 4.5], [3, 5, 5.0], [10, 7, 4.0], [6, 2, 3.2], [8, 7, 2.5], [2, 3, 2.0], [9, 10, 1.8], [0, 1, 2.2], [4, 5, 2.2]]
    .forEach(([i, j, v]) => { HEAD2[i][j] = v; });

  let sel = 7;

  function render() {
    toksEl.innerHTML = TOKENS.map((t, i) =>
      '<button class="tok-btn' + (i === sel ? ' on' : '') + '" data-i="' + i + '">' + t + '</button>'
    ).join('');
    const w1 = softmax(HEAD1[sel].map((s) => s / 4));
    const w2 = softmax(HEAD2[sel].map((s) => s / 4));
    h1El.innerHTML = bars(w1);
    h2El.innerHTML = bars(w2);
    const top1 = argTop(w1), top2 = argTop(w2);
    infoEl.innerHTML =
      '「<b>' + TOKENS[sel] + '</b>」在两个头的视角下完全不同：<br>' +
      'Head 1（语法头）最关注 <b>' + TOKENS[top1] + '</b>（' + fmt(w1[top1] * 100, 0) + '%）——靠得近、语法相关；<br>' +
      'Head 2（指代头）最关注 <b>' + TOKENS[top2] + '</b>（' + fmt(w2[top2] * 100, 0) + '%）——距离远、语义呼应。<br>' +
      '<span style="color:var(--ink-faint)">两个头并行、独立、互不干扰，最后把各自输出拼接起来——这就是 Multi-Head 的全部秘密。</span>';
  }
  function bars(w) {
    const sorted = w.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, 5);
    return sorted.map((x) =>
      '<div class="wbar"><span class="wn">' + TOKENS[x.i] + '</span>' +
      '<span class="wt"><span class="wf" style="width:' + fmt(x.v / sorted[0].v * 100, 1) + '%"></span></span>' +
      '<span class="wv">' + fmt(x.v * 100, 0) + '%</span></div>'
    ).join('');
  }
  function argTop(w) {
    let best = 0;
    w.forEach((v, i) => { if (v > w[best]) best = i; });
    return best;
  }

  toksEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    sel = parseInt(b.dataset.i, 10);
    render();
  });
  render();
})();

/* ============================================================
   演示 4：因果掩码
   "I love cyber security"，勾选掩码前后对比
   ============================================================ */
(function () {
  const gridEl = document.getElementById('mask-grid');
  const maskEl = document.getElementById('mask-on');
  const infoEl = document.getElementById('mask-info');

  const TOKENS = ['I', 'love', 'cyber', 'security'];
  // 固定分数：对角 3.0、其余 1.5（无掩码时每行权重接近均匀）
  const SCORES = TOKENS.map((_, i) => TOKENS.map((_, j) => (i === j ? 3.0 : 1.5)));

  function render() {
    const masked = maskEl.checked;
    let html = '<table class="att"><tr><th></th>' +
      TOKENS.map((t) => '<th>' + t + '</th>').join('') + '</tr>';
    TOKENS.forEach((t, i) => {
      html += '<tr><td class="rowlab">' + t + '</td>';
      // 行内有效分数：掩码时上三角(含 j>i)置 -inf
      const valid = TOKENS.map((_, j) => (masked && j > i ? -Infinity : SCORES[i][j]));
      const w = softmax(valid);
      const maxW = Math.max(...w);
      TOKENS.forEach((_, j) => {
        if (masked && j > i) {
          html += '<td class="masked">−∞</td>';
        } else {
          const a = w[j] / maxW;
          const bg = 'rgba(124, 58, 237, ' + fmt(a * 0.85, 2) + ')';
          html += '<td style="background:' + bg + ';color:' + (a > 0.5 ? '#fff' : '#5b21b6') + '">' +
            fmt(w[j] * 100, 0) + '%</td>';
        }
      });
      html += '</tr>';
    });
    html += '</table>';
    gridEl.innerHTML = html;
    infoEl.innerHTML = masked
      ? '<b>已应用因果掩码：</b>上三角位置分数设为 −∞，Softmax 后权重精确为 0。' +
        '每个词只能看到自己及左边的词——「I」的权重 100% 给了自己；「love」分给 I 和自己；这就是 GPT 逐词生成的注意力模式（预测第 4 个词时不能偷看第 4 个词本身）。'
      : '<b>无掩码（双向）：</b>每个词都能看到全句（包括右边的未来词）——BERT 的完形填空模式。' +
        '生成任务里这种模式会「作弊」，所以必须加下三角掩码。';
  }

  maskEl.addEventListener('change', render);
  render();
})();

/* ============================================================
   页面 UI：导航高亮 + 回到顶部
   ============================================================ */
(function () {
  const links = document.querySelectorAll('.nav a');
  const sections = document.querySelectorAll('section.chapter');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      }
    });
  }, { rootMargin: '-15% 0px -70% 0px' });
  sections.forEach((s) => obs.observe(s));

  const toTop = document.getElementById('toTop');
  window.addEventListener('scroll', () => {
    toTop.classList.toggle('show', window.scrollY > 600);
  }, { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();
