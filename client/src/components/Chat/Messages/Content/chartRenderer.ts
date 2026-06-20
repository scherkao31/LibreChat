/**
 * chartRenderer — moteur de rendu de graphiques, INJECTE dans l'iframe du widget
 * (comme le script de navigation du deck). Le modele n'ecrit PAS le SVG a la main :
 * il emet seulement des DONNEES dans un element
 *   <div class="lancya-chart" data-spec='{ ...json... }'></div>
 * et ce script calcule la geometrie (echelles, barres, points, arcs) et dessine un
 * SVG propre. Les couleurs sont des variables CSS (var(--accent)...), donc les color
 * pickers du widget recolorent le graphe en direct. Self-hosted, aucune librairie.
 *
 * Spec attendue (data-spec) :
 *   {
 *     "type": "bar" | "hbar" | "line" | "area" | "pie" | "donut",
 *     "labels": ["2021","2022","2023"],
 *     "series": [ { "name": "CA", "values": [1.2, 1.5, 1.9] }, ... ],
 *     "unit": "M",            // optionnel, suffixe des valeurs
 *     "showValues": true       // optionnel, affiche les valeurs (defaut true)
 *   }
 *
 * IMPORTANT (couleurs) : dans un SVG, var(--x) ne marche QUE via l'attribut style,
 * pas via les attributs de presentation. On met donc toutes les couleurs en style="".
 */
export const CHART_RENDER_SCRIPT = String.raw`<script id="ld-chart">
(function(){
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  // Couleur d'une serie / part : on alterne --accent / --accent-2, puis on baisse
  // l'opacite. Tout reste en var() => themable en direct par les pickers.
  function seriesStyle(i){
    var base = (i % 2 === 0) ? 'var(--accent)' : 'var(--accent-2, var(--accent))';
    var ops = [1,1,0.74,0.74,0.52,0.52,0.36,0.36];
    var op = (i < ops.length) ? ops[i] : 0.28;
    return 'fill:' + base + ';fill-opacity:' + op;
  }
  function seriesStroke(i){
    var base = (i % 2 === 0) ? 'var(--accent)' : 'var(--accent-2, var(--accent))';
    return 'stroke:' + base + ';stroke-opacity:1';
  }
  var TXT = 'fill:var(--text)';
  var MUT = 'fill:var(--text);fill-opacity:.55';
  var GRID = 'stroke:var(--text);stroke-opacity:.12';

  function fmt(n, unit){
    var r = Math.round(n * 100) / 100;
    var parts = String(r).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    var s = parts.join(',');
    return unit ? s + ' ' + unit : s;
  }
  function niceMax(v){
    if (v <= 0) { return 1; }
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * p;
  }
  function svgEl(w, h, inner){
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif">' + inner + '</svg>';
  }
  function legend(series, x, y){
    var out = '', cx = x;
    for (var i = 0; i < series.length; i++){
      out += '<rect x="' + cx + '" y="' + (y - 9) + '" width="12" height="12" rx="2" style="' + seriesStyle(i) + '"/>';
      out += '<text x="' + (cx + 18) + '" y="' + (y + 1) + '" font-size="13" style="' + TXT + '">' + esc(series[i].name || ('Serie ' + (i + 1))) + '</text>';
      cx += 30 + String(series[i].name || '').length * 7.5;
    }
    return out;
  }

  function renderBars(spec, w, h, horizontal){
    var labels = spec.labels || [];
    var series = spec.series || [];
    var unit = spec.unit || '';
    var showV = spec.showValues !== false;
    var multi = series.length > 1;
    var top = multi ? 44 : 20;
    var bottom = horizontal ? 24 : 46;
    var left = horizontal ? Math.min(220, 30 + 7 * Math.max.apply(null, labels.map(function(l){ return String(l).length; }).concat([4]))) : 64;
    var right = 24;
    var pw = w - left - right, ph = h - top - bottom;
    var maxv = 0;
    series.forEach(function(s){ (s.values || []).forEach(function(v){ if (v > maxv) { maxv = v; } }); });
    var axisMax = niceMax(maxv);
    var ticks = 4, g = '';

    if (multi) { g += legend(series, left, 22); }

    if (horizontal){
      for (var t = 0; t <= ticks; t++){
        var vx = left + (pw * t / ticks);
        g += '<line x1="' + vx + '" y1="' + top + '" x2="' + vx + '" y2="' + (top + ph) + '" style="' + GRID + '"/>';
        g += '<text x="' + vx + '" y="' + (top + ph + 16) + '" font-size="12" text-anchor="middle" style="' + MUT + '">' + fmt(axisMax * t / ticks, unit) + '</text>';
      }
      var gh = ph / Math.max(1, labels.length);
      for (var i = 0; i < labels.length; i++){
        var bh = gh * 0.62 / Math.max(1, series.length);
        var y0 = top + gh * i + (gh - bh * series.length) / 2;
        g += '<text x="' + (left - 10) + '" y="' + (top + gh * i + gh / 2 + 4) + '" font-size="13" text-anchor="end" style="' + TXT + '">' + esc(labels[i]) + '</text>';
        for (var s2 = 0; s2 < series.length; s2++){
          var val = (series[s2].values || [])[i] || 0;
          var bw = pw * (val / axisMax);
          var by = y0 + bh * s2;
          g += '<rect x="' + left + '" y="' + by + '" width="' + Math.max(0, bw) + '" height="' + Math.max(0, bh - 3) + '" rx="3" style="' + seriesStyle(s2) + '"/>';
          if (showV) { g += '<text x="' + (left + bw + 6) + '" y="' + (by + bh / 2 + 2) + '" font-size="12" style="' + MUT + '">' + fmt(val, unit) + '</text>'; }
        }
      }
    } else {
      for (var t2 = 0; t2 <= ticks; t2++){
        var vy = top + ph - (ph * t2 / ticks);
        g += '<line x1="' + left + '" y1="' + vy + '" x2="' + (left + pw) + '" y2="' + vy + '" style="' + GRID + '"/>';
        g += '<text x="' + (left - 10) + '" y="' + (vy + 4) + '" font-size="12" text-anchor="end" style="' + MUT + '">' + fmt(axisMax * t2 / ticks, unit) + '</text>';
      }
      var gw = pw / Math.max(1, labels.length);
      for (var j = 0; j < labels.length; j++){
        var bw2 = gw * 0.66 / Math.max(1, series.length);
        var x0 = left + gw * j + (gw - bw2 * series.length) / 2;
        g += '<text x="' + (left + gw * j + gw / 2) + '" y="' + (top + ph + 20) + '" font-size="13" text-anchor="middle" style="' + TXT + '">' + esc(labels[j]) + '</text>';
        for (var s3 = 0; s3 < series.length; s3++){
          var val2 = (series[s3].values || [])[j] || 0;
          var bh2 = ph * (val2 / axisMax);
          var bx = x0 + bw2 * s3;
          g += '<rect x="' + bx + '" y="' + (top + ph - bh2) + '" width="' + Math.max(0, bw2 - 4) + '" height="' + Math.max(0, bh2) + '" rx="3" style="' + seriesStyle(s3) + '"/>';
          if (showV) { g += '<text x="' + (bx + (bw2 - 4) / 2) + '" y="' + (top + ph - bh2 - 7) + '" font-size="12" text-anchor="middle" style="' + MUT + '">' + fmt(val2, unit) + '</text>'; }
        }
      }
    }
    return svgEl(w, h, g);
  }

  function renderLine(spec, w, h, area){
    var labels = spec.labels || [];
    var series = spec.series || [];
    var unit = spec.unit || '';
    var showV = spec.showValues !== false;
    var multi = series.length > 1;
    var top = multi ? 44 : 20, bottom = 46, left = 64, right = 24;
    var pw = w - left - right, ph = h - top - bottom;
    var maxv = 0;
    series.forEach(function(s){ (s.values || []).forEach(function(v){ if (v > maxv) { maxv = v; } }); });
    var axisMax = niceMax(maxv);
    var ticks = 4, g = '';
    if (multi) { g += legend(series, left, 22); }
    for (var t = 0; t <= ticks; t++){
      var vy = top + ph - (ph * t / ticks);
      g += '<line x1="' + left + '" y1="' + vy + '" x2="' + (left + pw) + '" y2="' + vy + '" style="' + GRID + '"/>';
      g += '<text x="' + (left - 10) + '" y="' + (vy + 4) + '" font-size="12" text-anchor="end" style="' + MUT + '">' + fmt(axisMax * t / ticks, unit) + '</text>';
    }
    var n = labels.length;
    function px(i){ return n <= 1 ? left + pw / 2 : left + pw * i / (n - 1); }
    function py(v){ return top + ph - ph * (v / axisMax); }
    for (var i = 0; i < n; i++){
      g += '<text x="' + px(i) + '" y="' + (top + ph + 20) + '" font-size="13" text-anchor="middle" style="' + TXT + '">' + esc(labels[i]) + '</text>';
    }
    for (var s = 0; s < series.length; s++){
      var vals = series[s].values || [];
      var pts = [];
      for (var k = 0; k < n; k++){ pts.push(px(k) + ',' + py(vals[k] || 0)); }
      if (area){
        g += '<polygon points="' + (left + ',' + (top + ph)) + ' ' + pts.join(' ') + ' ' + (left + pw) + ',' + (top + ph) + '" style="' + seriesStyle(s) + ';fill-opacity:.14;stroke:none"/>';
      }
      g += '<polyline points="' + pts.join(' ') + '" fill="none" style="' + seriesStroke(s) + '" stroke-width="2.5"/>';
      for (var k2 = 0; k2 < n; k2++){
        var cy = py(vals[k2] || 0), cx = px(k2);
        g += '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" style="' + seriesStyle(s) + ';fill-opacity:1"/>';
        if (showV && !multi) { g += '<text x="' + cx + '" y="' + (cy - 10) + '" font-size="12" text-anchor="middle" style="' + MUT + '">' + fmt(vals[k2] || 0, unit) + '</text>'; }
      }
    }
    return svgEl(w, h, g);
  }

  function renderPie(spec, w, h, donut){
    var labels = spec.labels || [];
    var vals = ((spec.series || [])[0] || {}).values || [];
    var unit = spec.unit || '';
    var total = 0; vals.forEach(function(v){ total += (v || 0); });
    if (total <= 0) { total = 1; }
    var legendW = 230;
    var cx = (w - legendW) / 2, cy = h / 2;
    var r = Math.min((w - legendW), h) / 2 * 0.86;
    var inner = donut ? r * 0.58 : 0;
    var a = -Math.PI / 2, g = '';
    function pt(rr, ang){ return (cx + rr * Math.cos(ang)) + ' ' + (cy + rr * Math.sin(ang)); }
    for (var i = 0; i < vals.length; i++){
      var frac = (vals[i] || 0) / total;
      var a2 = a + frac * Math.PI * 2;
      var large = (a2 - a) > Math.PI ? 1 : 0;
      g += '<path d="M ' + pt(r, a) + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + pt(r, a2) + ' L ' + cx + ' ' + cy + ' Z" style="' + seriesStyle(i) + ';fill-opacity:1;stroke:var(--bg);stroke-width:2"/>';
      var mid = (a + a2) / 2;
      if (frac > 0.06){
        var lr = donut ? (r + inner) / 2 : r * 0.62;
        g += '<text x="' + (cx + lr * Math.cos(mid)) + '" y="' + (cy + lr * Math.sin(mid) + 4) + '" font-size="13" text-anchor="middle" style="fill:var(--bg);font-weight:600">' + Math.round(frac * 100) + '%</text>';
      }
      a = a2;
    }
    if (donut) { g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + inner + '" style="fill:var(--bg)"/>'; }
    var ly = cy - vals.length * 13 + 13, lx = w - legendW + 14;
    for (var j = 0; j < vals.length; j++){
      var yy = ly + j * 26;
      g += '<rect x="' + lx + '" y="' + (yy - 11) + '" width="13" height="13" rx="3" style="' + seriesStyle(j) + ';fill-opacity:1"/>';
      g += '<text x="' + (lx + 20) + '" y="' + yy + '" font-size="13" style="' + TXT + '">' + esc(labels[j] || ('Part ' + (j + 1))) + '</text>';
      g += '<text x="' + (lx + 20) + '" y="' + (yy + 16) + '" font-size="12" style="' + MUT + '">' + fmt(vals[j] || 0, unit) + ' (' + Math.round((vals[j] || 0) / total * 100) + '%)</text>';
    }
    return svgEl(w, h, g);
  }

  function render(el){
    var spec;
    try { spec = JSON.parse(el.getAttribute('data-spec') || '{}'); } catch (e) { el.innerHTML = '<div style="padding:24px;color:var(--text)">Donnees du graphique illisibles.</div>'; return; }
    var w = el.clientWidth || 1100, h = el.clientHeight || 480;
    var type = (spec.type || 'bar').toLowerCase();
    var svg;
    if (type === 'pie') { svg = renderPie(spec, w, h, false); }
    else if (type === 'donut') { svg = renderPie(spec, w, h, true); }
    else if (type === 'line') { svg = renderLine(spec, w, h, false); }
    else if (type === 'area') { svg = renderLine(spec, w, h, true); }
    else if (type === 'hbar') { svg = renderBars(spec, w, h, true); }
    else { svg = renderBars(spec, w, h, false); }
    el.innerHTML = svg;
  }

  [].slice.call(document.querySelectorAll('.lancya-chart[data-spec]')).forEach(render);
})();
</script>`;
