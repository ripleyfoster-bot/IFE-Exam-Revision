(function () {
  'use strict';
  var CFG = window.IFE_CONFIG;
  var MODS = window.IFE_MODULES || [];
  var KEY = 'ife3.progress.v1';
  var app = document.getElementById('app');
  var S = load();
  var unitFilter = -1; // -1 = all units

  /* ---------- storage ---------- */
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch (e) {}
    return { v: 1, items: {}, exams: {} };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- AI socket (off until configured) ---------- */
  var AI = {
    get on() { return !!(CFG.ai && CFG.ai.enabled && CFG.ai.endpoint); },
    explain: function (payload) {
      var headers = { 'Content-Type': 'application/json' };
      if (CFG.ai.accessKey) headers['X-Access-Key'] = CFG.ai.accessKey;
      return fetch(CFG.ai.endpoint, { method: 'POST', headers: headers, body: JSON.stringify(payload) })
        .then(function (r) { if (!r.ok) throw new Error('AI ' + r.status); return r.json(); })
        .then(function (j) { return j.text; });
    }
  };

  /* ---------- helpers ---------- */
  function h(tag, props) {
    var e = document.createElement(tag), k;
    if (props) for (k in props) {
      var v = props[k];
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (x) { add(e, x); }); return; }
    e.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  function btn(label, cls, fn) { return h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick: fn }, label); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function show() { app.innerHTML = ''; for (var i = 0; i < arguments.length; i++) add(app, arguments[i]); window.scrollTo(0, 0); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function topbar(title, back, right) {
    return h('header', { class: 'top' },
      back ? h('button', { class: 'back', type: 'button', 'aria-label': 'Back', onclick: back }, '‹') : h('span', { class: 'back ghost' }),
      h('h1', null, title), h('span', { class: 'right' }, right || ''));
  }
  function bar(frac, cls) { return h('div', { class: 'bar ' + (cls || '') }, h('i', { style: 'width:' + Math.round(frac * 100) + '%' })); }

  /* ---------- item index and mastery ---------- */
  function build(m) {
    var it = [];
    m.cards.forEach(function (c, i) { it.push({ id: m.id + '.c' + i, type: 'card', u: c[0], q: c[1], a: c[2] }); });
    m.fills.forEach(function (f, i) { it.push({ id: m.id + '.f' + i, type: 'fill', u: f[0], text: f[1], a: f[2], d: f[3] }); });
    m.questions.forEach(function (q, i) { it.push({ id: m.id + '.q' + i, type: 'q', u: q.u, q: q.q, o: q.o, a: q.a, order: q.order, g: q.g || [] }); });
    m.matches.forEach(function (s, i) { s.pairs.forEach(function (p, j) { it.push({ id: m.id + '.p' + i + '.' + j, type: 'pair', u: s.u, set: i, k: j }); }); });
    m.diagrams.forEach(function (d, i) { d.marks.forEach(function (k, j) { it.push({ id: m.id + '.d' + i + '.' + j, type: 'mark', u: d.u, dg: i, k: j }); }); });
    m._items = it;
  }
  MODS.forEach(build);

  // Boxes 0..3. First sight: right -> 2, wrong -> 0. After that: right +1, wrong -1.
  function mark(id, ok) {
    var r = S.items[id];
    if (!r) r = S.items[id] = { b: ok ? 2 : 0, n: 0, c: 0 };
    else r.b = ok ? Math.min(3, r.b + 1) : Math.max(0, r.b - 1);
    r.n++; if (ok) r.c++; r.t = Date.now(); save();
  }
  function weight(id) { var r = S.items[id]; return r ? [6, 3, 1.5, 0.5][r.b] : 4; }
  function pick(items, n) {
    var pool = items.map(function (x) { return { x: x, w: weight(x.id) }; }), out = [];
    while (out.length < n && pool.length) {
      var tot = 0, k; pool.forEach(function (p) { tot += p.w; });
      var r = Math.random() * tot;
      for (k = 0; k < pool.length - 1; k++) { r -= pool[k].w; if (r <= 0) break; }
      out.push(pool.splice(k, 1)[0].x);
    }
    return out;
  }
  function stats(items) {
    var sum = 0, seen = 0;
    items.forEach(function (x) { var r = S.items[x.id]; if (r) { seen++; sum += r.b / 3; } });
    return { mastery: items.length ? sum / items.length : 0, seen: seen, total: items.length };
  }
  function unitItems(m, u) { return m._items.filter(function (x) { return x.u === u; }); }
  function inFilter(x) { return unitFilter < 0 || x.u === unitFilter; }

  /* ---------- home ---------- */
  function home() {
    var list = MODS.map(function (m) {
      var st = stats(m._items);
      return h('button', { class: 'modcard', type: 'button', onclick: function () { unitFilter = -1; modScreen(m); } },
        h('strong', null, m.title), h('span', null, m.subtitle), bar(st.mastery), h('small', null, pct(st.mastery) + ' mastered'));
    });
    if (RV) {
      var rs = rvState(), dn = rvDayNow();
      list.push(h('button', { class: 'modcard rvcard', type: 'button', onclick: rvHome },
        h('strong', null, RV.title), h('span', null, RV.subtitle + ': every module, in the IFE exam formats'),
        bar(rs.start ? Math.min(7, dn) / 7 : 0), h('small', null, rs.start ? (dn > 7 ? 'All 7 days open' : 'Day ' + dn + ' of 7') : 'Not started')));
    }
    show(topbar('IFE Level 3 Revision', null, h('button', { class: 'link', type: 'button', onclick: about }, 'About')),
      h('p', { class: 'lead' }, 'Pick a module. The app tracks what you know and steers practice to your weak spots.'), list);
  }

  function about() {
    var u = S.user || {};
    show(topbar('About', home),
      h('div', { class: 'panel' },
        u.name ? h('p', null, h('b', null, u.name), u.company ? ', ' + u.company : '', u.exam ? ' · exam ' + u.exam.split('-').reverse().join('/') : '') : null,
        btn('Change my details', '', function () { welcome(true); }),
        h('p', { class: 'gap' }, 'Version ' + CFG.version + '. Your details and progress are stored on this device only.'),
        h('p', null, 'AI tutor: ' + (AI.on ? 'on' : 'off in this version') + '.')),
      h('div', { class: 'panel' }, h('h2', { class: 'in' }, 'Course material and disclaimer'), notices()),
      h('p', { class: 'copy' }, COPY),
      btn('Reset all progress', 'bad', function () {
        // keeps the user's details and agreement; erases learning progress only
        if (window.confirm('Erase all progress on this device?')) { S = { v: 1, items: {}, exams: {}, user: S.user }; save(); home(); }
      }));
  }

  /* ---------- opening screen ---------- */
  var COPY = '\u00a9 2026 Ripley Foster, XRF Systems. All rights reserved.';
  function notices() {
    return h('ul', { class: 'notice' },
      h('li', null, 'The course material is owned by the ASFP (Association for Specialist Fire Protection), ', h('a', { href: 'https://www.asfp.org.uk', target: '_blank', rel: 'noopener' }, 'www.asfp.org.uk'), '.'),
      h('li', null, 'All content in this app is based on the ASFP Level 3 course workbooks.'),
      h('li', null, 'It may contain errors or omissions. Always check against the official course material.'),
      h('li', null, 'Ripley Foster and XRF Systems accept no responsibility for any errors or omissions, or for any use made of this content.'));
  }
  function daysTo(key) { return key ? -daysSince(key) : null; }
  function examLine(key) {
    var n = daysTo(key);
    if (n === null) return null;
    return n > 1 ? n + ' days to your exam' : n === 1 ? 'Your exam is tomorrow' : n === 0 ? 'Your exam is today. Good luck.' : 'Your exam date has passed';
  }
  // First launch (or "Change my details"): name, company, optional exam date and the agreement.
  function welcome(editing) {
    var u = S.user || {};
    var name = h('input', { class: 'fin', type: 'text', autocomplete: 'name', value: u.name || '', 'aria-label': 'Your name' });
    var comp = h('input', { class: 'fin', type: 'text', autocomplete: 'organization', value: u.company || '', 'aria-label': 'Your company' });
    var exam = h('input', { class: 'fin', type: 'date', value: u.exam || '', 'aria-label': 'Exam date (optional)' });
    var tick = h('input', { type: 'checkbox', id: 'agree' });
    if (u.agreed) tick.checked = true;
    var go = btn(editing ? 'Save' : 'Agree and continue', 'primary', function () {
      S.user = { name: name.value.trim(), company: comp.value.trim(), exam: exam.value || '', agreed: u.agreed || new Date().toISOString() };
      save(); home();
    });
    function check() { go.disabled = !(name.value.trim() && comp.value.trim() && tick.checked); }
    [name, comp, exam].forEach(function (x) { x.addEventListener('input', check); });
    tick.addEventListener('change', check);
    show(editing ? topbar('My details', about) : h('div', { class: 'brand' }, h('div', { class: 'logo' }, 'IFE L3'), h('h1', null, 'IFE Level 3 Revision'), h('p', null, 'A revision companion for the ASFP Level 3 course')),
      h('div', { class: 'panel' },
        h('label', { class: 'fl' }, 'Your name', name),
        h('label', { class: 'fl' }, 'Your company', comp),
        h('label', { class: 'fl' }, 'Exam date (optional)', exam, h('small', null, 'Shows a countdown each time you open the app.'))),
      h('div', { class: 'panel' }, h('h2', { class: 'in' }, 'Before you start'), notices(),
        h('label', { class: 'agree', for: 'agree' }, tick, h('span', null, 'I confirm I received the course material directly from the ASFP. I will not use or share this information without the ASFP\'s permission, and I accept the points above.'))),
      go, h('p', { class: 'copy' }, 'Your details are stored on this device only.'), h('p', { class: 'copy' }, COPY));
    check();
  }
  // Later launches: a short cover with name, countdown and copyright.
  function cover() {
    var u = S.user;
    if (!u || !u.agreed || !u.name) return welcome(false);
    var line = examLine(u.exam);
    show(h('div', { class: 'brand cover' }, h('div', { class: 'logo' }, 'IFE L3'), h('h1', null, 'IFE Level 3 Revision'),
        h('p', { class: 'hi' }, 'Welcome back, ' + u.name), h('p', null, u.company),
        line ? h('div', { class: 'count' }, line) : null),
      btn('Continue', 'primary', home),
      h('button', { class: 'link center', type: 'button', onclick: function () { welcome(true); } }, 'Change my details'),
      h('p', { class: 'copy' }, 'Course material owned by the ASFP, www.asfp.org.uk. Always check the official course material.'),
      h('p', { class: 'copy' }, COPY));
  }

  /* ---------- module screen ---------- */
  function modScreen(m) {
    var all = stats(m._items);
    var units = m.units.map(function (name, u) { return { u: u, name: name, st: stats(unitItems(m, u)) }; });
    var ready = units.every(function (x) { return x.st.mastery >= CFG.passMark; });
    var ex = S.exams[m.id] || [], best = 0;
    ex.forEach(function (e) { best = Math.max(best, e.s / e.n); });

    var chips = h('div', { class: 'chips' },
      [h('button', { class: 'chip' + (unitFilter < 0 ? ' on' : ''), type: 'button', onclick: function () { unitFilter = -1; modScreen(m); } }, 'All units')]
        .concat(units.map(function (x) {
          return h('button', { class: 'chip' + (unitFilter === x.u ? ' on' : ''), type: 'button', onclick: function () { unitFilter = x.u; modScreen(m); } }, m.noIntro ? 'Unit ' + (x.u + 1) : x.u === 0 ? 'Intro' : 'Unit ' + x.u);
        })));

    var rows = units.map(function (x) {
      var cls = x.st.seen === 0 ? 'new' : x.st.mastery >= CFG.passMark ? 'good' : x.st.mastery < 0.5 ? 'weak' : '';
      return h('div', { class: 'urow' }, h('div', { class: 'uname' }, x.name, h('b', null, x.st.seen === 0 ? 'Not started' : pct(x.st.mastery))), bar(x.st.mastery, cls));
    });

    function tile(icon, label, sub, fn, cls) {
      return h('button', { class: 'tile ' + (cls || ''), type: 'button', onclick: fn }, h('span', { class: 'ico' }, icon), h('strong', null, label), h('small', null, sub));
    }
    show(topbar(m.title, home),
      h('div', { class: 'panel hero' },
        h('div', { class: 'big' }, pct(all.mastery)), h('div', null, 'mastered · ' + all.seen + ' of ' + all.total + ' items seen'),
        h('div', { class: 'ready ' + (ready ? 'yes' : '') }, ready ? 'Every unit is at 85% or above. Try the final exam.' : 'Target: every unit at 85% before the final exam.'),
        ex.length ? h('div', { class: 'best' }, 'Best exam score: ' + pct(best) + ' (' + ex.length + ' attempt' + (ex.length > 1 ? 's' : '') + ')') : null),
      h('h2', null, 'Practise'), chips,
      h('div', { class: 'tiles' },
        tile('★', 'Train me', 'Smart mix of your weak spots', function () { train(m); }, 'wide accent'),
        tile('▤', 'Flash cards', 'Recall, then rate yourself', function () { cardsMode(m); }),
        tile('⇄', 'Match up', 'Pair terms and meanings', function () { matchMode(m); }),
        tile('…', 'Missing word', 'Complete the sentence', function () { fillMode(m); }),
        tile('◎', 'Label the diagram', 'Tap labels into place', function () { diagramList(m); })),
      h('h2', null, 'Progress by unit'), rows,
      h('h2', null, 'Final exam'),
      h('div', { class: 'panel' }, h('p', null, CFG.examLength + ' questions across the whole module. Pass mark ' + pct(CFG.passMark) + '. No feedback until the end.'),
        btn('Start final exam', 'primary', function () { exam(m); })));
  }

  /* ---------- session runner ---------- */
  function runSession(m, title, tasks, again) {
    var i = 0, right = 0, missed = [];
    if (!tasks.length) { show(topbar(title, function () { modScreen(m); }), h('p', { class: 'lead' }, 'Nothing here for this unit yet. Choose "All units" or another activity.')); return; }
    function next() {
      if (i >= tasks.length) return summary();
      var t = tasks[i], body = h('div', { class: 'task' });
      show(topbar(title, function () { modScreen(m); }, (i + 1) + ' / ' + tasks.length), bar(i / tasks.length, 'thin'), body);
      body.appendChild(h('div', { class: 'utag' }, m.units[t.u]));
      var done = function (ok) { if (ok !== null) mark(t.id, ok); if (ok) right++; else missed.push(t); i++; next(); };
      if (t.type === 'card') renderCard(t, body, done);
      else if (t.type === 'fill') renderFill(m, t, body, done);
      else renderQ(m, t, body, done, false);
    }
    function summary() {
      var weak = {}; missed.forEach(function (t) { weak[t.u] = (weak[t.u] || 0) + 1; });
      var names = Object.keys(weak).sort(function (a, b) { return weak[b] - weak[a]; }).slice(0, 2).map(function (u) { return m.units[u]; });
      show(topbar(title, function () { modScreen(m); }),
        h('div', { class: 'panel hero' }, h('div', { class: 'big' }, right + ' / ' + tasks.length), h('div', null, 'known this round'),
          names.length ? h('div', { class: 'ready' }, 'Most misses in: ' + names.join('; ')) : h('div', { class: 'ready yes' }, 'Clean round.')),
        btn('Go again', 'primary', again), btn('Back to module', '', function () { modScreen(m); }));
    }
    next();
  }

  function train(m) { runSession(m, 'Train me', pick(m._items.filter(function (x) { return inFilter(x) && (x.type === 'card' || x.type === 'fill' || x.type === 'q'); }), 12), function () { train(m); }); }
  function cardsMode(m) { runSession(m, 'Flash cards', pick(m._items.filter(function (x) { return inFilter(x) && x.type === 'card'; }), 10), function () { cardsMode(m); }); }
  function fillMode(m) { runSession(m, 'Missing word', pick(m._items.filter(function (x) { return inFilter(x) && x.type === 'fill'; }), 10), function () { fillMode(m); }); }

  /* ---------- task renderers ---------- */
  function feedback(m, ok, text, t) {
    var box = h('div', { class: 'fb ' + (ok ? 'ok' : 'no') }, h('strong', null, ok ? 'Correct. ' : 'Not quite. '), text || '');
    if (!ok && AI.on) {
      var out = h('p', { class: 'ai' });
      box.appendChild(btn('Explain this', 'link', function () {
        out.textContent = 'Thinking…';
        AI.explain({ module: m.id, unit: m.units[t.u], item: t }).then(function (x) { out.textContent = x || 'No explanation available.'; }, function () { out.textContent = 'The AI tutor could not be reached.'; });
      }));
      box.appendChild(out);
    }
    return box;
  }

  function renderCard(t, body, done) {
    var ans = h('div', { class: 'card-a', hidden: true }, t.a);
    var rate = h('div', { class: 'rate', hidden: true },
      btn('Didn\'t know', 'bad', function () { done(false); }), btn('Nearly', 'mid', function () { done(null); }), btn('Knew it', 'good', function () { done(true); }));
    var reveal = btn('Show answer', 'primary', function () { ans.hidden = false; rate.hidden = false; reveal.hidden = true; });
    add(body, [h('div', { class: 'card-q' }, t.q), ans, reveal, rate]);
  }

  function renderFill(m, t, body, done) {
    var ok = null, parts = t.text.split('___'), blank = h('span', { class: 'blank' }, '          ');
    var after = h('div');
    var grid = h('div', { class: 'opts two' }, shuffle([t.a].concat(t.d)).map(function (o) {
      return h('button', { class: 'opt', type: 'button', 'data-v': o, onclick: function (ev) {
        if (ok !== null) return;
        ok = o === t.a; blank.textContent = t.a; blank.className = 'blank ' + (ok ? 'ok' : 'no');
        ev.currentTarget.classList.add(ok ? 'ok' : 'no');
        Array.prototype.forEach.call(grid.children, function (b) { b.disabled = true; if (b.getAttribute('data-v') === t.a) b.classList.add('ok'); });
        add(after, [feedback(m, ok, ok ? '' : 'The missing word is "' + t.a + '".', t), btn('Next', 'primary', function () { done(ok); })]);
      } }, o);
    }));
    add(body, [h('div', { class: 'card-q' }, parts[0], blank, parts[1] || ''), grid, after]);
  }

  // Practice: check then show feedback. Exam: record silently.
  function renderQ(m, t, body, done, examMode) {
    var after = h('div'), locked = false, go;
    body.appendChild(h('div', { class: 'card-q' }, t.q));
    if (t.order) {
      var seq = [], pool = shuffle(t.order), list = h('ol', { class: 'seq' }), bank = h('div', { class: 'bank' });
      var draw = function () {
        list.innerHTML = ''; bank.innerHTML = '';
        seq.forEach(function (s, k) { list.appendChild(h('li', null, h('button', { class: 'opt', type: 'button', onclick: function () { if (locked) return; seq.splice(k, 1); draw(); } }, s))); });
        pool.filter(function (s) { return seq.indexOf(s) < 0; }).forEach(function (s) { bank.appendChild(h('button', { class: 'chip', type: 'button', onclick: function () { if (locked) return; seq.push(s); draw(); } }, s)); });
        go.disabled = seq.length !== t.order.length;
      };
      go = btn(examMode ? 'Next' : 'Check', 'primary', function () {
        var ok = seq.join('|') === t.order.join('|'); locked = true;
        if (examMode) return done(ok, seq.join(' → '));
        go.hidden = true;
        add(after, [feedback(m, ok, ok ? '' : 'Correct order: ' + t.order.join(' → '), t), btn('Next', 'primary', function () { done(ok); })]);
      });
      add(body, [h('p', { class: 'hint' }, 'Tap the items in order. Tap one in your list to remove it.'), list, bank, go, after]);
      draw();
      return;
    }
    var multi = t.a.length > 1, sel = [];
    var opts = shuffle(t.o.map(function (text, i) { return { text: text, i: i }; }));
    var grid = h('div', { class: 'opts' }, opts.map(function (o) {
      return h('button', { class: 'opt', type: 'button', 'data-i': o.i, onclick: function (ev) {
        if (locked) return;
        var at = sel.indexOf(o.i);
        if (multi) { if (at < 0) sel.push(o.i); else sel.splice(at, 1); ev.currentTarget.classList.toggle('sel'); }
        else { sel = [o.i]; Array.prototype.forEach.call(grid.children, function (b) { b.classList.remove('sel'); }); ev.currentTarget.classList.add('sel'); }
        go.disabled = !sel.length;
      } }, o.text);
    }));
    go = btn(examMode ? 'Next' : 'Check', 'primary', function () {
      var ok = sel.length === t.a.length && sel.every(function (i) { return t.a.indexOf(i) >= 0; }); locked = true;
      if (examMode) return done(ok, sel.map(function (i) { return t.o[i]; }).join('; '), sel.slice());
      go.hidden = true;
      Array.prototype.forEach.call(grid.children, function (b) {
        var i = +b.getAttribute('data-i'), right = t.a.indexOf(i) >= 0;
        if (right) b.classList.add('ok'); else if (sel.indexOf(i) >= 0) b.classList.add('no');
      });
      add(after, [feedback(m, ok, ok ? '' : 'The correct answer' + (multi ? 's are' : ' is') + ' shown in green.', t), btn('Next', 'primary', function () { done(ok); })]);
    });
    go.disabled = true;
    add(body, [h('p', { class: 'hint' }, multi ? 'Select all that apply.' : 'Choose one.'), grid, go, after]);
  }

  /* ---------- match up ---------- */
  function matchMode(m) {
    var sets = m.matches.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return unitFilter < 0 || x.s.u === unitFilter; });
    if (!sets.length) return runSession(m, 'Match up', [], null);
    // weakest set first, with a little randomness
    sets = shuffle(sets).sort(function (a, b) { return setScore(m, a.i) - setScore(m, b.i); });
    var x = sets[0], items = m._items.filter(function (it) { return it.type === 'pair' && it.set === x.i; });
    var chosen = pick(items, 5), right = 0, firstTry = {}, selL = null;
    var body = h('div', { class: 'task' });
    function col(side) {
      return h('div', { class: 'mcol' }, shuffle(chosen).map(function (it) {
        return h('button', { class: 'opt m' + side, type: 'button', 'data-id': it.id, onclick: function (ev) { tap(side, it, ev.currentTarget); } }, x.s.pairs[it.k][side === 'L' ? 0 : 1]);
      }));
    }
    function tap(side, it, el) {
      if (el.classList.contains('ok')) return;
      if (side === 'L') { Array.prototype.forEach.call(body.querySelectorAll('.mL'), function (b) { b.classList.remove('sel'); }); el.classList.add('sel'); selL = { it: it, el: el }; return; }
      if (!selL) return;
      var ok = selL.it.id === it.id;
      if (!(selL.it.id in firstTry)) firstTry[selL.it.id] = ok;
      if (ok) { right++; el.classList.add('ok'); selL.el.classList.remove('sel'); selL.el.classList.add('ok'); selL = null; if (right === chosen.length) finish(); }
      else { el.classList.add('no'); setTimeout(function () { el.classList.remove('no'); }, 500); }
    }
    function finish() {
      var clean = 0; chosen.forEach(function (it) { var ok = firstTry[it.id] === true; mark(it.id, ok); if (ok) clean++; });
      add(body, [h('div', { class: 'fb ' + (clean === chosen.length ? 'ok' : 'no') }, h('strong', null, clean + ' of ' + chosen.length + ' matched first time.')),
        btn('Another round', 'primary', function () { matchMode(m); }), btn('Back to module', '', function () { modScreen(m); })]);
    }
    show(topbar('Match up', function () { modScreen(m); }), body);
    add(body, [h('div', { class: 'utag' }, m.units[x.s.u]), h('div', { class: 'card-q small' }, x.s.title), h('p', { class: 'hint' }, 'Tap an item on the left, then its match on the right.'),
      h('div', { class: 'mgrid' }, col('L'), col('R'))]);
  }
  function setScore(m, i) { return stats(m._items.filter(function (it) { return it.type === 'pair' && it.set === i; })).mastery; }

  /* ---------- label the diagram ---------- */
  function diagramList(m) {
    var ds = m.diagrams.map(function (d, i) { return { d: d, i: i }; }).filter(function (x) { return unitFilter < 0 || x.d.u === unitFilter; });
    if (!ds.length) return runSession(m, 'Label the diagram', [], null);
    show(topbar('Label the diagram', function () { modScreen(m); }), ds.map(function (x) {
      var st = stats(m._items.filter(function (it) { return it.type === 'mark' && it.dg === x.i; }));
      return h('button', { class: 'modcard', type: 'button', onclick: function () { diagram(m, x.i); } }, h('strong', null, x.d.title), h('span', null, m.units[x.d.u]), bar(st.mastery), h('small', null, st.seen ? pct(st.mastery) + ' mastered' : 'Not started'));
    }));
  }
  function diagram(m, di) {
    var d = m.diagrams[di], sel = null, right = 0, firstTry = {};
    var fig = h('div', { class: 'fig' }, h('div', { html: '<svg viewBox="0 0 340 220" role="img" aria-label="' + d.title + '">' + d.svg + '</svg>' }));
    var key = h('ol', { class: 'key' }), bank = h('div', { class: 'bank' }), after = h('div');
    d.marks.forEach(function (k, j) {
      var id = m.id + '.d' + di + '.' + j, li = h('li', null, '?');
      key.appendChild(li);
      fig.appendChild(h('button', { class: 'pin', type: 'button', style: 'left:' + (k.x / 340 * 100) + '%;top:' + (k.y / 220 * 100) + '%', onclick: function (ev) {
        var el = ev.currentTarget; if (!sel || el.classList.contains('ok')) return;
        var ok = sel.l === k.l; if (!(id in firstTry)) firstTry[id] = ok;
        if (ok) { el.classList.add('ok'); li.textContent = k.l; li.className = 'ok'; sel.el.remove(); sel = null; if (++right === d.marks.length) finish(); }
        else { el.classList.add('no'); setTimeout(function () { el.classList.remove('no'); }, 500); }
      } }, String(j + 1)));
    });
    shuffle(d.marks).forEach(function (k) {
      bank.appendChild(h('button', { class: 'chip', type: 'button', onclick: function (ev) {
        Array.prototype.forEach.call(bank.children, function (b) { b.classList.remove('on'); }); ev.currentTarget.classList.add('on'); sel = { l: k.l, el: ev.currentTarget };
      } }, k.l));
    });
    function finish() {
      var clean = 0; d.marks.forEach(function (k, j) { var id = m.id + '.d' + di + '.' + j, ok = firstTry[id] === true; mark(id, ok); if (ok) clean++; });
      add(after, [h('div', { class: 'fb ' + (clean === d.marks.length ? 'ok' : 'no') }, h('strong', null, clean + ' of ' + d.marks.length + ' placed first time.')),
        btn('Try again', 'primary', function () { diagram(m, di); }), btn('Other diagrams', '', function () { diagramList(m); })]);
    }
    show(topbar(d.title, function () { diagramList(m); }), h('div', { class: 'task' }, h('div', { class: 'utag' }, m.units[d.u]), h('p', { class: 'hint' }, d.hint + ' Tap a label, then tap its number.'), fig, bank, key, after));
  }

  /* ---------- final exam ---------- */
  function examPaper(m) {
    var qs = m._items.filter(function (x) { return x.type === 'q'; }), n = Math.min(CFG.examLength, qs.length);
    var out = [], taken = {}, byU = {}, left = [];
    // a question clashes if it shares a topic tag with one already on the paper
    function free(q) { return q.g.every(function (t) { return !taken[t]; }); }
    function take(q) { out.push(q); q.g.forEach(function (t) { taken[t] = true; }); }
    qs.forEach(function (q) { (byU[q.u] = byU[q.u] || []).push(q); });
    // first pass: each unit gets its share of the paper, in proportion to its question count
    Object.keys(byU).forEach(function (u) {
      var quota = Math.floor(byU[u].length * n / qs.length), got = 0;
      shuffle(byU[u]).forEach(function (q) { if (got < quota && free(q)) { take(q); got++; } else left.push(q); });
    });
    // second pass: top up from whatever is left, still avoiding clashes
    left = shuffle(left);
    left.forEach(function (q) { if (out.length < n && free(q)) take(q); });
    // last resort (small banks only): allow clashes rather than set a short paper
    left.forEach(function (q) { if (out.length < n && out.indexOf(q) < 0) out.push(q); });
    return shuffle(out);
  }
  function exam(m) {
    var paper = examPaper(m), i = 0, res = [];
    function next() {
      if (i >= paper.length) return result();
      var t = paper[i], body = h('div', { class: 'task' });
      show(topbar('Final exam', function () { if (window.confirm('Leave the exam? This attempt will not be saved.')) modScreen(m); }, (i + 1) + ' / ' + paper.length), bar(i / paper.length, 'thin'), body);
      renderQ(m, t, body, function (ok, given, picks) { res.push({ t: t, ok: ok, given: given, picks: picks }); i++; next(); }, true);
    }
    function result() {
      var score = 0, byU = {};
      res.forEach(function (r) { mark(r.t.id, r.ok); if (r.ok) score++; var b = byU[r.t.u] = byU[r.t.u] || { s: 0, n: 0 }; b.n++; if (r.ok) b.s++; });
      (S.exams[m.id] = S.exams[m.id] || []).push({ d: Date.now(), s: score, n: paper.length }); save();
      var need = Math.ceil(CFG.passMark * paper.length), pass = score >= need;
      var wrong = res.filter(function (r) { return !r.ok; });
      show(topbar('Exam result', function () { modScreen(m); }),
        h('div', { class: 'panel hero' }, h('div', { class: 'big' }, score + ' / ' + paper.length), h('div', null, pct(score / paper.length) + ' · pass mark ' + need + ' (' + pct(CFG.passMark) + ')'),
          h('div', { class: 'ready ' + (pass ? 'yes' : '') }, pass ? 'Pass.' : 'Not yet. Use Train me on the weaker units below.')),
        h('h2', null, 'By unit'),
        Object.keys(byU).map(function (u) { var b = byU[u], f = b.s / b.n; return h('div', { class: 'urow' }, h('div', { class: 'uname' }, m.units[u], h('b', null, b.s + ' / ' + b.n)), bar(f, f >= CFG.passMark ? 'good' : f < 0.5 ? 'weak' : '')); }),
        wrong.length ? h('h2', null, 'Review (' + wrong.length + ')') : null,
        wrong.map(function (r) {
          var t = r.t, detail;
          if (t.order) {
            detail = [h('p', { class: 'no' }, 'Your order: ' + (r.given || 'no answer')), h('p', { class: 'ok' }, 'Correct order: ' + t.order.join(' → '))];
          } else {
            // one line per option that matters: right pick, wrong pick, or missed
            var picks = r.picks || [], rows = [], one = t.a.length === 1;
            t.o.forEach(function (text, k) {
              var right = t.a.indexOf(k) >= 0, picked = picks.indexOf(k) >= 0;
              if (right && picked) rows.push(h('li', { class: 'ok' }, h('b', null, '✓ '), text));
              else if (!right && picked) rows.push(h('li', { class: 'no' }, h('b', null, '✗ '), text, h('em', null, one ? ' (your answer)' : ' (should not be selected)')));
              else if (right) rows.push(h('li', { class: 'miss' }, h('b', null, '+ '), text, h('em', null, one ? ' (correct answer)' : ' (missed)')));
            });
            detail = h('ul', { class: 'marks' }, rows);
          }
          return h('div', { class: 'panel rev' }, h('p', { class: 'q' }, t.q), detail, h('small', null, m.units[t.u]));
        }),
        btn('Back to module', 'primary', function () { modScreen(m); }));
    }
    next();
  }

  /* ---------- revision: 7-day exam countdown ---------- */
  // Exam conditions: one paper a day in the IFE online formats, no feedback until the end.
  // Questions are built from the module items (so answers here also move module mastery)
  // plus the Revision-only items in content/revision.js.
  var RV = window.IFE_REVISION || null, RVC = [];
  var FMT = {};
  var NUMRE = /^\d+(\.\d+)?$/;
  var RANKRE = /rank|importance|priority|most|highest|effective|likelihood|challenge|risk/i;
  function ext(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  function rvBuild() {
    RV.formats.forEach(function (f) { FMT[f[0]] = { name: f[1], how: f[2] }; });
    MODS.forEach(function (m) {
      m._items.forEach(function (x) {
        var base = { m: m, u: x.u, id: x.id };
        if (x.type === 'q') {
          if (x.order) RVC.push(ext(base, { fmt: RANKRE.test(x.q) ? 'rank' : 'seq', q: x.q, order: x.order, g: x.g }));
          else RVC.push(ext(base, { fmt: x.a.length > 1 ? 'mr' : 'mc', q: x.q, o: x.o, a: x.a, g: x.g }));
        } else if (x.type === 'fill') {
          if (NUMRE.test(x.a)) RVC.push(ext(base, { fmt: 'num', text: x.text, a: +x.a }));
          else {
            RVC.push(ext(base, { fmt: 'type', text: x.text, a: x.a }));
            RVC.push(ext(base, { fmt: 'select', text: x.text, a: x.a, d: x.d }));
          }
        }
      });
      m.matches.forEach(function (s, i) { RVC.push({ fmt: 'match', kind: 'pairs', m: m, u: s.u, id: m.id + '.p' + i, set: i, q: s.title }); });
      m.diagrams.forEach(function (d, i) { RVC.push({ fmt: 'diagram', m: m, u: d.u, id: m.id + '.d' + i, dg: i, q: d.title }); });
    });
    RV.numeric.forEach(function (n, i) { RVC.push({ fmt: 'num', day: n[0], id: 'rv.n' + i, text: n[1], a: n[2] }); });
    RV.orders.forEach(function (o, i) { RVC.push({ fmt: o.f === 'r' ? 'rank' : 'seq', day: o.d, id: 'rv.o' + i, q: o.q, order: o.order }); });
    RV.sorts.forEach(function (s, i) { RVC.push({ fmt: 'match', kind: 'sort', day: s.d, id: 'rv.s' + i, q: s.q, cats: s.cats, rows: s.rows }); });
  }
  if (RV) rvBuild();

  function rvState() { if (!S.rev) S.rev = { start: null, days: {}, fmt: {} }; return S.rev; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function daysSince(key) {
    var p = key.split('-'), a = new Date(+p[0], +p[1] - 1, +p[2]), n = new Date(), b = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((b - a) / 86400000);
  }
  function rvDayNow() { var r = rvState(); return r.start ? Math.max(1, daysSince(r.start) + 1) : 0; }
  function dayOpen(n) { var r = rvState(); return r.start ? daysSince(r.start) >= n - 1 : n === 1; }
  function inDay(day, c) {
    if (c.day) return c.day === day.n;
    return !!c.m && day.units.some(function (p) { return p[0] === c.m.id && p[1] === c.u; });
  }
  function subIds(c) {
    if (c.fmt === 'match' && c.kind === 'pairs') return c.m.matches[c.set].pairs.map(function (p, j) { return c.id + '.' + j; });
    if (c.fmt === 'diagram') return c.m.diagrams[c.dg].marks.map(function (k, j) { return c.id + '.' + j; });
    return [c.id];
  }
  function cw(c) { var ids = subIds(c), t = 0; ids.forEach(function (id) { t += weight(id); }); return t / ids.length; }

  // Weighted draw towards weak items, never two questions on the same topic tag or the same source item.
  function drawN(list, n, used) {
    var pool = list.map(function (c) { return { c: c, w: cw(c) }; }), out = [];
    function free(c) { return !used.ids[c.id] && (c.g || []).every(function (t) { return !used.tags[t]; }); }
    pool = pool.filter(function (p) { return free(p.c); });
    while (out.length < n && pool.length) {
      var tot = 0, k, r; pool.forEach(function (p) { tot += p.w; });
      r = Math.random() * tot;
      for (k = 0; k < pool.length - 1; k++) { r -= pool[k].w; if (r <= 0) break; }
      var c = pool.splice(k, 1)[0].c;
      if (!free(c)) continue;
      out.push(c); used.ids[c.id] = true; (c.g || []).forEach(function (t) { used.tags[t] = true; });
    }
    return out;
  }
  function rvPaper(day, mock) {
    var mix = mock ? RV.mockMix : RV.paperMix, out = [], used = { ids: {}, tags: {} };
    RV.formats.forEach(function (f) {
      var k = f[0], want = mix[k] || 0;
      var mine = RVC.filter(function (c) { return c.fmt === k && (mock || inDay(day, c)); });
      var got = drawN(mine, want, used);
      // every format appears every day: if today's topics have too few of a format, borrow from other days
      if (got.length < want) {
        got = got.concat(drawN(RVC.filter(function (c) { return c.fmt === k && mine.indexOf(c) < 0; }), want - got.length, used)
          .map(function (c) { return ext(c, { borrowed: true }); }));
      }
      out = out.concat(got);
    });
    return shuffle(out);
  }

  /* revision home */
  function rvHome() {
    var r = rvState(), now = rvDayNow();
    var rows = RV.days.map(function (d) {
      var open = dayOpen(d.n), rec = r.days[d.n], st;
      if (!open) { var wait = d.n - now; st = !r.start ? 'Unlocks ' + (d.n === 2 ? 'the day after you start' : (d.n - 1) + ' days after you start') : 'Unlocks ' + (wait <= 1 ? 'tomorrow' : 'in ' + wait + ' days'); }
      else st = rec ? 'Best ' + pct(rec.best) + ' · ' + rec.tries + ' attempt' + (rec.tries > 1 ? 's' : '') : (d.n === now || (!r.start && d.n === 1) ? 'Today' : 'Ready');
      var topics = d.units.map(function (p) { var m = MODS.filter(function (x) { return x.id === p[0]; })[0]; return m ? 'M' + ({ One: 1, Two: 2, Three: 3 }[m.title.split(' ')[1]] || '') + ' ' + m.units[p[1]].split(':')[0] : ''; }).join(' · ');
      return h('button', { class: 'modcard day' + (open ? '' : ' off') + (rec && rec.best >= CFG.passMark ? ' done' : ''), type: 'button', disabled: !open, onclick: function () { rvStart(d, false); } },
        h('strong', null, 'Day ' + d.n + ': ' + d.title), h('span', null, topics), rec ? bar(rec.best, rec.best >= CFG.passMark ? 'good' : rec.best < 0.5 ? 'weak' : '') : null,
        h('small', null, st + ' · ' + RV.paperLength + ' questions'));
    });
    var d7 = RV.days[6], mockOpen = dayOpen(7), mk = r.days.mock;
    var mock = h('button', { class: 'modcard day mock' + (mockOpen ? '' : ' off'), type: 'button', disabled: !mockOpen, onclick: function () { rvStart(d7, true); } },
      h('strong', null, 'Day 7: Full mock exam'), h('span', null, 'Every module, every format'), mk ? bar(mk.best, mk.best >= CFG.passMark ? 'good' : '') : null,
      h('small', null, (mockOpen ? (mk ? 'Best ' + pct(mk.best) : 'Ready') : 'Unlocks on Day 7') + ' · ' + RV.mockLength + ' questions'));
    var fs = RV.formats.map(function (f) {
      var x = r.fmt[f[0]];
      return h('div', { class: 'urow' }, h('div', { class: 'uname' }, f[1], h('b', null, x ? x.s + ' / ' + x.n : '–')), bar(x ? x.s / x.n : 0, x ? (x.s / x.n >= CFG.passMark ? 'good' : x.s / x.n < 0.5 ? 'weak' : '') : ''));
    });
    show(topbar('Revision', home),
      h('div', { class: 'panel hero' },
        h('div', { class: 'big' }, r.start ? (now > 7 ? 'Done' : 'Day ' + now) : '7 days'),
        h('div', null, r.start ? (now > 7 ? 'All seven days are open. Keep sitting papers.' : 'of 7 · started ' + r.start.split('-').reverse().join('/')) : 'One exam-style paper a day, in the IFE online formats.'),
        h('div', { class: 'ready' }, 'Exam conditions: no feedback until you finish. Modules One to Three stay open for practice at any time.')),
      h('h2', null, 'Your countdown'), rows, mock,
      h('h2', null, 'Score by exam format'), fs,
      h('div', { class: 'panel' }, h('p', null, 'Each day unlocks at midnight after you start Day 1. Days you have reached stay open, so you can sit their papers again.'),
        r.start ? btn('Restart the countdown', '', function () { if (window.confirm('Restart the 7 days from today? Scores are kept.')) { r.start = today(); save(); rvHome(); } }) : null));
  }

  function rvStart(day, mock) {
    var r = rvState();
    if (!r.start) { r.start = today(); save(); }
    var paper = rvPaper(day, mock), i = 0, res = [], title = mock ? 'Full mock exam' : 'Day ' + day.n;
    function leave() { if (window.confirm('Leave this paper? This attempt will not be saved.')) rvHome(); }
    function next() {
      if (i >= paper.length) return rvResult(day, mock, res);
      var c = paper[i], body = h('div', { class: 'task' });
      show(topbar(title, leave, (i + 1) + ' / ' + paper.length), bar(i / paper.length, 'thin'), body);
      add(body, [h('div', { class: 'fmt' }, h('b', null, FMT[c.fmt].name), ' · ', FMT[c.fmt].how),
        h('div', { class: 'utag' }, c.m ? c.m.title + ' · ' + c.m.units[c.u] : 'Day ' + c.day + ': ' + RV.days[c.day - 1].title)]);
      rvRender(c, body, function (out) { out.c = c; res.push(out); i++; next(); });
    }
    next();
  }

  /* one renderer per format; each calls done({ ok, marks: [[id, ok]], given, right }) */
  function norm(s) { return String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().replace(/\.$/, ''); }
  function rvRender(c, body, done) {
    var f = c.fmt;
    if (f === 'mc' || f === 'mr' || f === 'seq' || f === 'rank') {
      var t = c.order ? { q: c.q, order: c.order } : { q: c.q, o: c.o, a: c.a };
      return renderQ(c.m || null, t, body, function (ok, given) {
        done({ ok: ok, marks: [[c.id, ok]], given: given || 'no answer', right: c.order ? c.order.join(' → ') : c.a.map(function (k) { return c.o[k]; }).join('; ') });
      }, true);
    }
    if (f === 'type' || f === 'num') {
      var parts = c.text.split('___');
      var inp = h('input', { class: 'tin' + (f === 'num' ? ' n' : ''), type: 'text', inputmode: f === 'num' ? 'decimal' : 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your answer' });
      var go = btn('Next', 'primary', function () {
        var v = inp.value.trim(), ok;
        if (f === 'num') { var x = v.replace(/,/g, ''); ok = x !== '' && isFinite(+x) && Math.abs(+x - c.a) < 1e-9; }
        else ok = v !== '' && norm(v) === norm(c.a);
        done({ ok: ok, marks: [[c.id, ok]], given: v || 'no answer', right: String(c.a) });
      });
      add(body, [h('div', { class: 'card-q' }, parts[0], inp, parts[1] || ''), h('p', { class: 'hint' }, f === 'num' ? 'Numbers only.' : 'Type the missing word or words.'), go]);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
      return;
    }
    if (f === 'select') {
      var p2 = c.text.split('___');
      var sel = h('select', { class: 'tsel', 'aria-label': 'Choose the answer' }, h('option', { value: '' }, 'Choose…'), shuffle([c.a].concat(c.d)).map(function (o) { return h('option', { value: o }, o); }));
      add(body, [h('div', { class: 'card-q' }, p2[0], sel, p2[1] || ''),
        btn('Next', 'primary', function () { var ok = sel.value === c.a; done({ ok: ok, marks: [[c.id, ok]], given: sel.value || 'no answer', right: c.a }); })]);
      return;
    }
    if (f === 'match') {
      var rows, opts, q;
      if (c.kind === 'pairs') {
        var s = c.m.matches[c.set], all = s.pairs.map(function (p, j) { return { id: c.id + '.' + j, l: p[0], r: p[1] }; });
        rows = pick(all, Math.min(4, all.length));
        var spare = shuffle(all.filter(function (x) { return rows.indexOf(x) < 0; })).slice(0, 1); // one extra answer that matches nothing
        opts = shuffle(rows.concat(spare).map(function (x) { return x.r; })); q = s.title + ': choose the correct match for each item.';
      } else {
        rows = shuffle(c.rows).slice(0, 5).map(function (x) { return { id: c.id, l: x[0], r: c.cats[x[1]] }; });
        opts = c.cats.slice(); q = c.q;
      }
      var sels = rows.map(function (x) {
        var sl = h('select', { class: 'tsel wide', 'aria-label': x.l }, h('option', { value: '' }, 'Choose…'), opts.map(function (o) { return h('option', { value: o }, o); }));
        return { x: x, sl: sl };
      });
      add(body, [h('div', { class: 'card-q small' }, q), h('div', { class: 'mlist' }, sels.map(function (z) { return h('label', { class: 'mrow' }, h('span', null, z.x.l), z.sl); })),
        btn('Next', 'primary', function () {
          var marks = [], n = 0, wrong = [];
          sels.forEach(function (z) { var ok = z.sl.value === z.x.r; if (ok) n++; else wrong.push(z.x.l + ' → ' + z.x.r); if (c.kind === 'pairs') marks.push([z.x.id, ok]); });
          var ok = n === sels.length; if (c.kind === 'sort') marks.push([c.id, ok]);
          done({ ok: ok, marks: marks, given: n + ' of ' + sels.length + ' matched', right: wrong.join('; '), q: q });
        })]);
      return;
    }
    if (f === 'diagram') {
      var d = c.m.diagrams[c.dg], fig = h('div', { class: 'fig' }, h('div', { html: '<svg viewBox="0 0 340 220" role="img" aria-label="' + d.title + '">' + d.svg + '</svg>' }));
      d.marks.forEach(function (k, j) { fig.appendChild(h('span', { class: 'pin still', style: 'left:' + (k.x / 340 * 100) + '%;top:' + (k.y / 220 * 100) + '%' }, String(j + 1))); });
      var ask = shuffle(d.marks.map(function (k, j) { return { k: k, j: j }; })).slice(0, Math.min(3, d.marks.length)).sort(function (a, b) { return a.j - b.j; });
      var labels = shuffle(d.marks.map(function (k) { return k.l; }));
      var ds = ask.map(function (a) { return { a: a, sl: h('select', { class: 'tsel wide', 'aria-label': 'Marker ' + (a.j + 1) }, h('option', { value: '' }, 'Choose…'), labels.map(function (o) { return h('option', { value: o }, o); })) }; });
      add(body, [h('div', { class: 'card-q small' }, d.title + ': what is at each numbered marker?'), fig,
        h('div', { class: 'mlist' }, ds.map(function (z) { return h('label', { class: 'mrow' }, h('span', null, 'Marker ' + (z.a.j + 1)), z.sl); })),
        btn('Next', 'primary', function () {
          var marks = [], n = 0, wrong = [];
          ds.forEach(function (z) { var ok = z.sl.value === z.a.k.l; if (ok) n++; else wrong.push('Marker ' + (z.a.j + 1) + ' → ' + z.a.k.l); marks.push([c.id + '.' + z.a.j, ok]); });
          done({ ok: n === ds.length, marks: marks, given: n + ' of ' + ds.length + ' correct', right: wrong.join('; '), q: d.title });
        })]);
    }
  }

  function rvResult(day, mock, res) {
    var r = rvState(), score = 0, byF = {};
    res.forEach(function (x) {
      x.marks.forEach(function (mk) { mark(mk[0], mk[1]); });
      if (x.ok) score++;
      var b = byF[x.c.fmt] = byF[x.c.fmt] || { s: 0, n: 0 }; b.n++; if (x.ok) b.s++;
      var g = r.fmt[x.c.fmt] = r.fmt[x.c.fmt] || { s: 0, n: 0 }; g.n++; if (x.ok) g.s++;
    });
    var frac = score / res.length, key = mock ? 'mock' : day.n, rec = r.days[key] = r.days[key] || { best: 0, tries: 0 };
    rec.tries++; rec.best = Math.max(rec.best, frac); rec.last = frac; save();
    var need = Math.ceil(CFG.passMark * res.length), pass = score >= need;
    var weakest = RV.formats.filter(function (f) { return byF[f[0]]; }).sort(function (a, b) { return byF[a[0]].s / byF[a[0]].n - byF[b[0]].s / byF[b[0]].n; })[0];
    var wrong = res.filter(function (x) { return !x.ok; });
    show(topbar(mock ? 'Mock result' : 'Day ' + day.n + ' result', rvHome),
      h('div', { class: 'panel hero' }, h('div', { class: 'big' }, score + ' / ' + res.length), h('div', null, pct(frac) + ' · pass mark ' + need + ' (' + pct(CFG.passMark) + ')'),
        h('div', { class: 'ready ' + (pass ? 'yes' : '') }, pass ? 'Pass.' : 'Not yet.' + (weakest && byF[weakest[0]].s < byF[weakest[0]].n ? ' Weakest format: ' + weakest[1] + '.' : ''))),
      h('h2', null, 'By exam format'),
      RV.formats.filter(function (f) { return byF[f[0]]; }).map(function (f) {
        var b = byF[f[0]], x = b.s / b.n;
        return h('div', { class: 'urow' }, h('div', { class: 'uname' }, f[1], h('b', null, b.s + ' / ' + b.n)), bar(x, x >= CFG.passMark ? 'good' : x < 0.5 ? 'weak' : ''));
      }),
      wrong.length ? h('h2', null, 'Review (' + wrong.length + ')') : null,
      wrong.map(function (x) {
        var c = x.c, multi = c.fmt === 'match' || c.fmt === 'diagram';
        return h('div', { class: 'panel rev' }, h('div', { class: 'fmt' }, h('b', null, FMT[c.fmt].name)),
          h('p', { class: 'q' }, x.q || c.q || c.text.replace('___', '_____')),
          h('p', { class: 'no' }, (multi ? 'You got: ' : 'Your answer: ') + x.given),
          h('p', { class: 'ok' }, (multi ? 'Correct: ' : (c.fmt === 'seq' || c.fmt === 'rank' ? 'Correct order: ' : 'Correct answer: ')) + x.right),
          h('small', null, c.m ? c.m.title + ' · ' + c.m.units[c.u] : 'Revision · Day ' + c.day));
      }),
      btn(mock ? 'Sit another mock' : 'Sit this day again', 'primary', function () { rvStart(day, mock); }), btn('Back to countdown', '', rvHome));
  }

  /* ---------- start ---------- */
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  if (MODS.length) cover(); else show(h('p', { class: 'lead' }, 'No module content found.'));
})();
