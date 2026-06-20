/**
 * diagramRenderer — moteur de rendu de schemas, INJECTE dans l'iframe du widget (meme
 * principe que chartRenderer). Le modele n'ecrit PAS le SVG : il decrit des NOEUDS et
 * des LIENS dans
 *   <div class="lancya-diagram" data-spec='{ ...json... }'></div>
 * et ce script calcule la mise en page (placement des boites, niveaux, routage des
 * fleches) et dessine un SVG propre. Couleurs en variables CSS (themable). Self-hosted.
 *
 * Spec attendue (data-spec) :
 *   {
 *     "layout": "flow" | "tree" | "cycle",
 *     "direction": "lr" | "tb",            // flow/tree : sens de lecture
 *     "nodes": [ { "id": "a", "label": "Etape 1", "sub": "detail optionnel" }, ... ],
 *     "edges": [ { "from": "a", "to": "b", "label": "optionnel" }, ... ]
 *   }
 * flow = suite d'etapes ; tree = hierarchie/organigramme ; cycle = boucle.
 * Couleurs uniquement via style="" (var() ne marche pas en attribut de presentation SVG).
 */
export const DIAGRAM_RENDER_SCRIPT = String.raw`<script id="ld-diagram">
(function(){
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  var BOX = 'fill:var(--bg);stroke:var(--accent);stroke-width:2';
  var TXT = 'fill:var(--text)';
  var SUB = 'fill:var(--text);fill-opacity:.55';
  var EDGE = 'stroke:var(--accent);stroke-width:2;fill:none';

  function wrapLabel(s, maxChars){
    var words = String(s == null ? '' : s).split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++){
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (t.length > maxChars && cur){ lines.push(cur); cur = words[i]; } else { cur = t; }
    }
    if (cur) { lines.push(cur); }
    return lines.length ? lines : [''];
  }
  function sizeBox(node){
    var lines = wrapLabel(node.label, 22);
    var longest = 0;
    lines.forEach(function(l){ if (l.length > longest) { longest = l.length; } });
    if (node.sub) { longest = Math.max(longest, Math.min(26, String(node.sub).length)); }
    var w = Math.max(120, Math.min(264, longest * 8.4 + 34));
    var h = 22 + lines.length * 20 + (node.sub ? 18 : 0);
    node._lines = lines;
    node.w = w; node.h = h;
  }

  // Point sur le bord de la boite (centre cx,cy, taille w,h) en direction de (tx,ty).
  function border(cx, cy, w, h, tx, ty){
    var dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) { return { x: cx, y: cy }; }
    var sx = dx !== 0 ? (w / 2) / Math.abs(dx) : Infinity;
    var sy = dy !== 0 ? (h / 2) / Math.abs(dy) : Infinity;
    var s = Math.min(sx, sy);
    return { x: cx + dx * s, y: cy + dy * s };
  }

  function layoutFlow(nodes, dir){
    var gap = 66, cur = 0;
    nodes.forEach(function(n){
      if (dir === 'tb'){ n.cx = 0; n.cy = cur + n.h / 2; cur += n.h + gap; }
      else { n.cx = cur + n.w / 2; n.cy = 0; cur += n.w + gap; }
    });
  }
  function layoutTree(nodes, edges, dir){
    var byId = {}; nodes.forEach(function(n){ byId[n.id] = n; });
    var level = {}; nodes.forEach(function(n){ level[n.id] = 0; });
    for (var k = 0; k < nodes.length; k++){
      edges.forEach(function(e){
        if (byId[e.from] && byId[e.to] && level[e.to] < level[e.from] + 1){ level[e.to] = level[e.from] + 1; }
      });
    }
    var levels = [];
    nodes.forEach(function(n){ var L = level[n.id]; (levels[L] = levels[L] || []).push(n); });
    var levelGap = 78, sibGap = 34, depthCursor = 0;
    for (var L = 0; L < levels.length; L++){
      var row = levels[L] || [];
      var depthSize = 0;
      row.forEach(function(n){ depthSize = Math.max(depthSize, dir === 'lr' ? n.w : n.h); });
      var breadthTotal = 0;
      row.forEach(function(n){ breadthTotal += (dir === 'lr' ? n.h : n.w) + sibGap; });
      breadthTotal -= sibGap;
      var b = -breadthTotal / 2;
      for (var i = 0; i < row.length; i++){
        var n2 = row[i];
        var bSize = dir === 'lr' ? n2.h : n2.w;
        var breadthPos = b + bSize / 2;
        var depthPos = depthCursor + depthSize / 2;
        if (dir === 'lr'){ n2.cx = depthPos; n2.cy = breadthPos; } else { n2.cx = breadthPos; n2.cy = depthPos; }
        b += bSize + sibGap;
      }
      depthCursor += depthSize + levelGap;
    }
  }
  function layoutCycle(nodes){
    var n = nodes.length;
    var maxW = 0; nodes.forEach(function(x){ maxW = Math.max(maxW, x.w); });
    var R = Math.max(150, (maxW + 40) * n / (2 * Math.PI));
    for (var i = 0; i < n; i++){
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      nodes[i].cx = R * Math.cos(a);
      nodes[i].cy = R * Math.sin(a);
    }
  }

  function renderBox(n){
    var x = n.cx - n.w / 2, y = n.cy - n.h / 2;
    var g = '<rect x="' + x + '" y="' + y + '" width="' + n.w + '" height="' + n.h + '" rx="10" style="' + BOX + '"/>';
    var blockH = n._lines.length * 20;
    var ty = n.cy - (n.sub ? 9 : 0) - blockH / 2 + 16;
    for (var i = 0; i < n._lines.length; i++){
      g += '<text x="' + n.cx + '" y="' + (ty + i * 20) + '" text-anchor="middle" font-size="15" font-weight="600" style="' + TXT + '">' + esc(n._lines[i]) + '</text>';
    }
    if (n.sub){ g += '<text x="' + n.cx + '" y="' + (ty + blockH + 4) + '" text-anchor="middle" font-size="12" style="' + SUB + '">' + esc(n.sub) + '</text>'; }
    return g;
  }
  function renderEdge(a, b){
    var p1 = border(a.cx, a.cy, a.w, a.h, b.cx, b.cy);
    var p2 = border(b.cx, b.cy, b.w, b.h, a.cx, a.cy);
    var g = '<line x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y + '" style="' + EDGE + '" marker-end="url(#ld-ar)"/>';
    return g;
  }
  function renderEdgeLabel(a, b, label){
    var mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
    var tw = String(label).length * 6.6 + 10;
    return '<rect x="' + (mx - tw / 2) + '" y="' + (my - 9) + '" width="' + tw + '" height="17" rx="3" style="fill:var(--bg)"/>' +
           '<text x="' + mx + '" y="' + (my + 3) + '" text-anchor="middle" font-size="12" style="fill:var(--text);fill-opacity:.7">' + esc(label) + '</text>';
  }

  function render(el){
    var spec;
    try { spec = JSON.parse(el.getAttribute('data-spec') || '{}'); } catch (e){ el.innerHTML = '<div style="padding:24px;color:var(--text)">Donnees du schema illisibles.</div>'; return; }
    var nodes = spec.nodes || [];
    if (!nodes.length){ el.innerHTML = ''; return; }
    var edges = spec.edges || [];
    var byId = {}; nodes.forEach(function(n){ byId[n.id] = n; sizeBox(n); });
    var layout = (spec.layout || 'flow').toLowerCase();
    var dir = (spec.direction || (layout === 'tree' ? 'tb' : 'lr')).toLowerCase();

    // flow sans edges explicites : on enchaine les noeuds dans l'ordre.
    if (layout === 'flow' && !edges.length){
      for (var i = 0; i < nodes.length - 1; i++){ edges.push({ from: nodes[i].id, to: nodes[i + 1].id }); }
    }
    if (layout === 'cycle' && !edges.length){
      for (var j = 0; j < nodes.length; j++){ edges.push({ from: nodes[j].id, to: nodes[(j + 1) % nodes.length].id }); }
    }

    if (layout === 'tree'){ layoutTree(nodes, edges, dir); }
    else if (layout === 'cycle'){ layoutCycle(nodes); }
    else { layoutFlow(nodes, dir); }

    // Bbox + transform pour rentrer dans le conteneur (jamais agrandi au-dela de 1).
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function(n){
      minX = Math.min(minX, n.cx - n.w / 2); maxX = Math.max(maxX, n.cx + n.w / 2);
      minY = Math.min(minY, n.cy - n.h / 2); maxY = Math.max(maxY, n.cy + n.h / 2);
    });
    var W = el.clientWidth || 1120, H = el.clientHeight || 560, pad = 24;
    var bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    var scale = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh, 1);
    var ox = (W - bw * scale) / 2 - minX * scale;
    var oy = (H - bh * scale) / 2 - minY * scale;

    var defs = '<defs><marker id="ld-ar" markerWidth="11" markerHeight="11" refX="8.5" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,3 L0,6 Z" style="fill:var(--accent)"/></marker></defs>';
    var body = '';
    edges.forEach(function(e){ var a = byId[e.from], b = byId[e.to]; if (a && b){ body += renderEdge(a, b); } });
    nodes.forEach(function(n){ body += renderBox(n); });
    edges.forEach(function(e){ var a = byId[e.from], b = byId[e.to]; if (a && b && e.label){ body += renderEdgeLabel(a, b, e.label); } });

    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif">' +
      defs + '<g transform="translate(' + ox + ',' + oy + ') scale(' + scale + ')">' + body + '</g></svg>';
  }

  [].slice.call(document.querySelectorAll('.lancya-diagram[data-spec]')).forEach(render);
})();
</script>`;
