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

    // 每个词都带上名字，避免「s/√16=1.55」这种读不懂的展示
    const sLine = top.map((x) => 's(<b>' + TOKENS[x.i] + '</b>) = ' + fmt(SCORES[sel][x.i], 1)).join('，');
    const scaledLine = top.map((x) => {
      const s = SCORES[sel][x.i];
      const sc = scaleEl.checked ? s / Math.sqrt(dk) : s;
      return 's(<b>' + TOKENS[x.i] + '</b>) = ' + fmt(s, 1) +
        (scaleEl.checked ? '　÷√' + dk + ' →　' + fmt(sc, 2) : '　' + fmt(sc, 2));
    }).join('，');

    infoEl.innerHTML =
      '<b>查询词「' + TOKENS[sel] + '」的计算过程：</b><br>' +
      '① 打分（点积）：' + sLine + '；<br>' +
      '② 缩放：' + scaledLine + '；<br>' +
      '③ Softmax 归一化 → 权重（按权重从大到小，前 4 名）：' +
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
   演示 5：代码逐步执行可视化（追踪 PyTorch forward）
   左边代码行高亮，右边矩阵面板逐步展示中间结果（以「头 1」为例）
   ============================================================ */
(function () {
  const codeEl = document.getElementById('step-code');
  const panelEl = document.getElementById('step-panel');
  const prevBtn = document.getElementById('step-prev');
  const nextBtn = document.getElementById('step-next');
  const autoBtn = document.getElementById('step-auto');
  const resetBtn = document.getElementById('step-reset');

  // 与 8.1 一致的 PyTorch forward 代码（带语法着色与行号）
  const CODE_LINES = [
    '<span class="kw">def</span> <span class="fnc">forward</span>(self, x, mask=<span class="kw">None</span>):',
    '    B, T, _ = x.shape',
    '    Q = self.Wq(x).view(B, T, self.n_heads, self.d_k).transpose(<span class="num">1</span>, <span class="num">2</span>)',
    '    K = self.Wk(x).view(B, T, self.n_heads, self.d_k).transpose(<span class="num">1</span>, <span class="num">2</span>)',
    '    V = self.Wv(x).view(B, T, self.n_heads, self.d_k).transpose(<span class="num">1</span>, <span class="num">2</span>)',
    '    scores = Q @ K.transpose(-<span class="num">2</span>, -<span class="num">1</span>) / math.sqrt(self.d_k)',
    '    <span class="kw">if</span> mask <span class="kw">is not</span> <span class="kw">None</span>:',
    '        scores = scores.masked_fill(mask == <span class="num">0</span>, float(<span class="str">\'-inf\'</span>))',
    '    attn = scores.softmax(dim=-<span class="num">1</span>)',
    '    out = attn @ V',
    '    out = out.transpose(<span class="num">1</span>, <span class="num">2</span>).contiguous().view(B, T, -<span class="num">1</span>)',
    '    <span class="kw">return</span> self.Wo(out), attn',
  ];

  // 迷你数据：B=1, T=4, d_model=6, n_heads=2 → d_k=3（演示「头 1」的运算）
  const x = [[1, 0, 1, 0, 1, 0], [0, 1, 1, 0, 0, 1], [1, 1, 0, 1, 0, 0], [0, 0, 1, 1, 1, 0]];
  // 头 1 投影后的 Q、K、V（这里直接给出 Wq/Wk/Wv 投影后的结果，省略具体权重）
  const Q = [[1, 0, 1], [0, 1, 1], [1, 1, 0], [0, 0, 1]];
  const K = [[1, 0, 1], [0, 1, 0], [1, 1, 1], [0, 0, 1]];
  const V = [[1, 2, 0], [0, 1, 1], [1, 0, 1], [2, 3, 1]];
  const DK = Math.sqrt(3);

  const raw = Q.map((q) => K.map((k) => q.reduce((s2, qv, i2) => s2 + qv * k[i2], 0)));
  const scaled = raw.map((row) => row.map((v) => v / DK));
  const weights = scaled.map((row) => {
    const m = Math.max(...row);
    const exps = row.map((v) => Math.exp(v - m));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
  });
  const out = weights.map((wrow) =>
    V[0].map((_, c) => wrow.reduce((s2, wv, r) => s2 + wv * V[r][c], 0))
  );

  function mtable(data, rlabs, clabs, markMax) {
    let html = '<table class="mtable"><tr><td class="mlab"></td>' +
      clabs.map((c) => '<td class="mtop">' + c + '</td>').join('') + '</tr>';
    data.forEach((row, i) => {
      const mx = markMax ? row.indexOf(Math.max(...row)) : -1;
      html += '<tr><td class="mlab">' + rlabs[i] + '</td>' +
        row.map((v, j2) => {
          let cls = '';
          if (markMax && j2 === mx) cls = ' class="mx"';
          else if (markMax && v > 1) cls = ' class="hot"';
          const shown = markMax ? fmt(v, 3) : fmt(v, 2);
          return '<td' + cls + '>' + shown + '</td>';
        }).join('') + '</tr>';
    });
    return html + '</table>';
  }

  // 步骤：高亮的代码行（从 0 数起）+ 右侧面板
  const STEPS = [
    {
      title: '第 0 步 · 输入 x：(B=1, T=4, d_model=6)',
      lines: [],
      desc: '输入是 4 个词、每个词 6 维的词向量表。模型配置：<b>d_model=6，n_heads=2</b> → 每个头分到 <b>d_k = 6÷2 = 3</b> 维。下面全程演示「头 1」的运算（头 2 并行做同样的事）。',
      html: '<b>输入 x（4×6）</b>' + mtable(x, ['词1', '词2', '词3', '词4'], ['d₁', 'd₂', 'd₃', 'd₄', 'd₅', 'd₆'], false),
    },
    {
      title: '第 1 步 · B, T, _ = x.shape',
      lines: [1],
      desc: '解包形状：<b>B=1</b>（1 句话）、<b>T=4</b>（4 个词）、最后一个维度 6 忽略。',
      html: '<b>B = 1，T = 4</b>（d_model = 6）',
    },
    {
      title: '第 2 步 · 投影并切成多头',
      lines: [2, 3, 4],
      desc: 'Wq/Wk/Wv 把 x 从 6 维投影到 6 维，再 <b>view(B,T,2,3)</b> 切成两个头、<b>transpose(1,2)</b> 把头的维度挪到前面 → (1, <b>2</b>, 4, 3)。下面展示「头 1」拿到的 Q、K、V（各 4×3）。',
      html: '<b>头 1 的 Q（4×3）</b>' + mtable(Q, ['词1', '词2', '词3', '词4'], ['d₁', 'd₂', 'd₃'], false) +
        '<b>头 1 的 K（4×3）</b>' + mtable(K, ['词1', '词2', '词3', '词4'], ['d₁', 'd₂', 'd₃'], false) +
        '<b>头 1 的 V（4×3）</b>' + mtable(V, ['词1', '词2', '词3', '词4'], ['d₁', 'd₂', 'd₃'], false),
    },
    {
      title: '第 3 步 · scores = Q·Kᵀ（原始分数）',
      lines: [5],
      desc: '每个词（查询）与每个词（键）点积：第 i 行第 j 列 = qᵢ·kⱼ。紫色 = 每行最高分——「词1」最关注「词3」，「词2/词3」也最关注「词3」。',
      html: '<b>原始分数 QKᵀ（4×4）</b>' + mtable(raw, ['词1', '词2', '词3', '词4'], ['词1', '词2', '词3', '词4'], true),
    },
    {
      title: '第 4 步 · ÷√d_k（缩放）',
      lines: [5],
      desc: '同一行代码的第二半：所有分数 ÷ √3。数值整体变小、差距被压缩——防止 Softmax 饱和。',
      html: '<b>缩放后分数（÷√3）</b>' + mtable(scaled, ['词1', '词2', '词3', '词4'], ['词1', '词2', '词3', '词4'], true),
    },
    {
      title: '第 5 步 · mask 判断',
      lines: [6, 7],
      desc: '本演示没有掩码，<b>跳过</b>这两行。真实场景：masked_fill 把被禁止位置（mask==0）填成 −inf，Softmax 后权重精确为 0（见第 6 章演示 4）。',
      html: '<b>mask = None → 跳过 if 分支</b>',
    },
    {
      title: '第 6 步 · Softmax 归一化',
      lines: [8],
      desc: '每行变成和为 1 的概率分布——「词1 看词3 多重、看词4 多重」全部写进这一行。PyTorch 的 softmax 内部已做「减 max」数值稳定。',
      html: '<b>注意力权重（每行和 = 1）</b>' + mtable(weights, ['词1', '词2', '词3', '词4'], ['词1', '词2', '词3', '词4'], true),
    },
    {
      title: '第 7 步 · out = attn·V（加权求和）',
      lines: [9],
      desc: '输出的第 i 行 = 所有值向量按第 i 行权重混合：out[0] = 0.256·v₁ + 0.144·v₂ + 0.456·v₃ + 0.144·v₄。每个词的表示已经「融合」了它最关心的那些词的信息。',
      html: '<b>头 1 的输出（4×3）</b>' + mtable(out, ['词1', '词2', '词3', '词4'], ['d₁', 'd₂', 'd₃'], false) +
        '<p style="font-size:12.5px;color:var(--ink-faint);margin-top:6px">out[0] = 0.256×(1,2,0) + 0.144×(0,1,1) + 0.456×(1,0,1) + 0.144×(2,3,1) = (' + fmt(out[0][0], 3) + ', ' + fmt(out[0][1], 3) + ', ' + fmt(out[0][2], 3) + ')</p>',
    },
    {
      title: '第 8 步 · 拼回多头并投影输出',
      lines: [10, 11],
      desc: 'transpose(1,2) 把头维度挪回去、contiguous() 整理内存、view 拼成 (B, T, 6)（头 1 的 3 维 + 头 2 的 3 维接在一起）；最后 Wᴼ 投影一次并返回输出和注意力权重。',
      html: '<b>(1, 2, 4, 3) → (1, 4, 6)</b><br><span style="font-size:13.5px;color:var(--ink-soft)">头 1 与头 2 的输出沿最后一维拼接，再过 Wᴼ 投影 → 最终 (1, 4, 6)，与输入形状一致（可继续堆叠下一层）。</span>',
    },
  ];

  let step = 0;
  let timer = null;

  function render() {
    const s = STEPS[step];
    codeEl.innerHTML = CODE_LINES.map((ln, i) =>
      '<span class="ln' + (s.lines.includes(i) ? ' hl' : ' dim') + '">' + ln + '</span>'
    ).join('');
    panelEl.innerHTML = '<h4>' + s.title + '</h4>' +
      '<p class="step-desc">' + s.desc + '</p>' + s.html;
    autoBtn.textContent = timer ? '暂停' : '自动播放';
  }

  function go(delta) {
    step = Math.min(STEPS.length - 1, Math.max(0, step + delta));
    render();
  }
  function stopAuto() {
    if (timer) { clearInterval(timer); timer = null; render(); }
  }

  prevBtn.addEventListener('click', () => { stopAuto(); go(-1); });
  nextBtn.addEventListener('click', () => { stopAuto(); go(1); });
  resetBtn.addEventListener('click', () => { stopAuto(); step = 0; render(); });
  autoBtn.addEventListener('click', () => {
    if (timer) { stopAuto(); return; }
    if (step >= STEPS.length - 1) step = -1;
    timer = setInterval(() => {
      step++;
      render();
      if (step >= STEPS.length - 1) stopAuto();
    }, 2400);
    render();
  });

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
