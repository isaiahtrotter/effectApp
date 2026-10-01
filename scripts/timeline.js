(function () {
  const root = document.querySelector('[data-timeline]');
  if (!root) return;

  let pps = 270;        // px per second, changed by the zoom control
  const MIN_PPS = 40;
  const MAX_PPS = 1000;
  const FPS = 25;
  const EDGE = 12;      // px, matches --tl-edge: right padding of the timing UI and rows
  const INSET = 4;      // px, matches --tl-inset: left inset of timing UI + rows, and each band's right padding
  const ORIGIN = 2 * INSET; // time 0 in playhead-layer coordinates: viewport inset + 4px padding
  const MAX_DURATION = 120;
  let duration = 5;     // seconds, editable
  const SUBDIV = 5;     // intervals per half second, i.e. 4 ticks between labels
  const MIN_LEN = 0.1;  // seconds
  // A track with an easing icon needs room for both 8px-wide handle zones (4px inset + 4px handle),
  // the 16px icon and a 2px gap on each side: 8 + 2 + 16 + 2 + 8.
  const CURVE_MIN_PX = 36;
  const SNAP = 1 / FPS;
  const SNAP_PX = 6;    // magnet distance to other clip edges / the playhead

  // easing icons all run bottom-left to top-right in a 10x10 box
  const CURVES = {
    linear: 'M1 9L9 1',
    in: 'M1 9C5.5 9 8 6 9 1',          // ease in: slow start, fast finish
    out: 'M1 9C2 4 4.5 1 9 1',         // ease out: fast start, slow finish
    inout: 'M1 9C5 9 5 1 9 1',         // ease in + ease out
  };
  const CURVE_ORDER = ['inout', 'in', 'out']; // linear is the default, so it isn't offered
  const curveSvg = (name, size = 10) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 10 10" fill="none"><path d="${CURVES[name]}" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`;

  // Every track animates its setting from one value to another (defaults 0 -> 100). The right-click
  // menu edits both with sliders.
  const VALUE_MIN = 0;
  const VALUE_MAX = 100;
  const fromOf = (c) => (c.from == null ? VALUE_MIN : c.from);
  const toOf = (c) => (c.to == null ? VALUE_MAX : c.to);
  const EASE_FN = {
    linear: (u) => u,
    in: (u) => u * u,
    out: (u) => 1 - (1 - u) * (1 - u),
    inout: (u) => u * u * (3 - 2 * u),
  };

  const GROUPS = [
    { name: 'Elastic grid', bar: '#7B35B5', rows: [
      { label: 'stretch amount', clips: [{ s: 0, e: 0.78, curve: 'inout' }] },
      { label: 'noise size', clips: [{ s: 0.22, e: 5 }] },
    ] },
    { name: 'Reeded glass', bar: '#3B4FB8', rows: [
      { label: 'reflection scale', clips: [{ s: 0, e: 0.5 }] },
      { label: 'pattern type', clips: [{ s: 0.38, e: 0.88 }] },
      { label: 'shift loop (sec)', clips: [{ s: 0.69, e: 2.54 }] },
    ], eye: true },
    { name: 'Morph grid', bar: '#A53A20', rows: [
      { label: 'stretch amount', clips: [{ s: 0, e: 0.5 }] },
      { label: 'seed pattern', clips: [{ s: 0, e: 1.68, curve: 'out' }] },
      { label: 'noise', clips: [{ s: 0, e: 1.11, curve: 'in' }] },
    ], collapsed: true },
    { name: 'Motion blur', bar: '#2F9A4A', rows: [
      { label: 'opacity', clips: [{ s: 0.49, e: 1.69 }, { s: 1.7, e: 5 }] },
      { label: 'angle', clips: [{ s: 0, e: 0.78 }] },
    ], collapsed: true },
    { name: 'Cubify', bar: '#2E9BAA', rows: [
      { label: 'cube stretch', clips: [{ s: 0, e: 1.75 }] },
      { label: 'rotation angle', clips: [{ s: 0, e: 0.85 }] },
    ], collapsed: true },
  ];

  const CHEVRON = '<svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const EYE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8C3 5.5 5.3 4.3 8 4.3C10.7 4.3 13 5.5 14.5 8C13 10.5 10.7 11.7 8 11.7C5.3 11.7 3 10.5 1.5 8Z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg>';
  const EYE_OFF = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8C3 5.5 5.3 4.3 8 4.3C10.7 4.3 13 5.5 14.5 8C13 10.5 10.7 11.7 8 11.7C5.3 11.7 3 10.5 1.5 8Z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><path d="M3 13L13 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  const CLOSE = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

  const scroll = root.querySelector('[data-tl-scroll]');
  const body = root.querySelector('[data-tl-body]');
  const rulerWrap = root.querySelector('[data-tl-rulerwrap]');
  const ruler = root.querySelector('[data-tl-ruler]');
  const rowsEl = root.querySelector('[data-tl-rows]');
  const labelsEl = root.querySelector('[data-tl-labels]');
  const playhead = root.querySelector('[data-tl-playhead]');
  const flag = root.querySelector('[data-tl-flag]');
  const playBtn = root.querySelector('[data-tl-play]');
  const durInput = root.querySelector('[data-tl-duration]');

  root.style.setProperty('--tl-dur', duration);
  root.style.setProperty('--tl-pps', pps + 'px');
  const xOf = (t) => INSET + t * pps; // ruler: its box starts INSET in, so t=0 lines up with the tracks

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const snapFrame = (t) => Math.round(t / SNAP) * SNAP;
  const clone = (v) => JSON.parse(JSON.stringify(v));

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html) n.innerHTML = html;
    return n;
  }

  // ---------- state ----------
  const entries = []; // one per setting row: { row, rowEl, labEl, removed, group }
  const groupEntries = []; // one per section: { side, main, removed }
  let selected = null; // the most recently selected track: { clip, node, entry }
  let multi = [];      // every selected track (selected is the last of these)
  let time = 9 / FPS;

  // the first section that's still showing gets the top spacing (a plain :first-child would still
  // point at a deleted section)
  function updateFirstGroup() {
    const first = groupEntries.find((g) => !g.removed);
    groupEntries.forEach((g) => {
      const on = g === first;
      g.side.classList.toggle('is-first', on);
      g.main.classList.toggle('is-first', on);
    });
  }

  const visibleEntries = () => entries.filter((e) => !e.removed && !e.group.removed);

  // ---------- history (undo / redo) ----------
  const undoStack = [];
  const redoStack = [];
  const snapshot = () => JSON.stringify({
    duration,
    rows: entries.map((e) => ({ clips: e.row.clips, removed: e.removed })),
    groups: groupEntries.map((g) => g.removed),
  });

  function commit(before) {
    if (before === snapshot()) return;
    undoStack.push(before);
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  }

  function restore(json) {
    const snap = JSON.parse(json);
    select(null);
    duration = snap.duration;
    durInput.value = duration;
    fitDurWidth();
    root.style.setProperty('--tl-dur', duration);
    snap.groups.forEach((removed, i) => {
      groupEntries[i].removed = removed;
      groupEntries[i].side.hidden = removed;
      groupEntries[i].main.hidden = removed;
    });
    updateFirstGroup();
    snap.rows.forEach((r, i) => {
      entries[i].row.clips = r.clips;
      entries[i].removed = r.removed;
      entries[i].labEl.hidden = r.removed;
      entries[i].rowEl.hidden = r.removed;
      rebuildRow(entries[i]);
    });
    time = Math.min(time, duration);
    buildRuler();
    if (fitMode) fitWidth(); else relayout();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
  }

  // ---------- ruler ----------
  // One labelled major tick every `step` seconds (wide enough that labels never touch),
  // with exactly 4 minor ticks between majors.
  const LABEL_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60];
  const LABEL_MIN_PX = 72;

  function fmt(t) {
    if (t >= 60 && Number.isInteger(t / 60)) return `${t / 60}m`;
    return (Number.isInteger(t) ? t : t.toFixed(1)) + 's';
  }

  function buildRuler() {
    ruler.textContent = '';
    const step = LABEL_STEPS.find((v) => v * pps >= LABEL_MIN_PX) || LABEL_STEPS[LABEL_STEPS.length - 1];
    const minor = step / 5;
    const frag = document.createDocumentFragment();
    const count = Math.floor(duration / minor + 1e-6);
    for (let i = 0; i <= count; i++) {
      const t = i * minor;
      const isMajor = i % 5 === 0;
      const tick = el('i', 'tl-tick' + (isMajor ? ' major' : ''));
      tick.style.left = xOf(t) + 'px';
      frag.appendChild(tick);
      if (!isMajor) continue;
      const lab = el('span', 'tl-tick-label');
      lab.textContent = fmt(t);
      lab.style.left = xOf(t) + 'px';
      // the label at the very end sits to the left of its tick so it never runs off the ruler
      if (Math.abs(t - duration) < 1e-6 && i > 0) lab.classList.add('is-last');
      frag.appendChild(lab);
    }
    ruler.appendChild(frag);
  }
  buildRuler();

  // ---------- clips ----------
  function setSelection(list) {
    multi.forEach((m) => m.node.classList.remove('is-selected'));
    multi = list;
    selected = list.length ? list[list.length - 1] : null;
    multi.forEach((m) => m.node.classList.add('is-selected'));
    updateEaseButtons();
  }
  function select(sel) { setSelection(sel ? [sel] : []); }

  // the easing shared by every selected track: a name, null (none set), or undefined (they differ)
  function commonCurve() {
    if (!multi.length) return undefined;
    const first = multi[0].clip.curve || null;
    return multi.every((m) => (m.clip.curve || null) === first) ? first : undefined;
  }

  // ---------- easing buttons (toolbar) ----------
  const easeBtns = Array.from(root.querySelectorAll('[data-ease]'));

  function updateEaseButtons() {
    const current = commonCurve() || null; // no easing set (or a mix) = nothing highlighted
    easeBtns.forEach((b) => {
      b.disabled = !selected;
      b.classList.toggle('is-active', b.dataset.ease === current);
      b.setAttribute('aria-pressed', String(b.dataset.ease === current));
    });
  }

  // name = easing to set, or null to remove it from the selected track
  function applyEase(name) {
    if (!multi.length) return;
    const before = snapshot();
    multi.forEach(({ clip, node }) => {
      if (!name) {
        delete clip.curve;
        node.querySelectorAll('.tl-curve-line, .tl-curve').forEach((n) => n.remove());
      } else {
        clip.curve = name;
        renderCurve(clip, node);
      }
    });
    updateEaseButtons();
    commit(before);
  }

  // clicking an easing sets it; clicking the one that's already active removes it from the track
  function setEase(name) {
    if (!multi.length) return;
    applyEase(commonCurve() === name ? null : name);
  }

  easeBtns.forEach((b) => {
    b.innerHTML = curveSvg(b.dataset.ease, 16);
    b.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus (and selection) where it was
    b.addEventListener('click', () => setEase(b.dataset.ease));
  });

  function layoutClip(clip, node) {
    // rows start at the timeline origin (the band's 4px padding)
    node.style.left = clip.s * pps + 'px';
    node.style.width = (clip.e - clip.s) * pps + 'px';
    // zoomed out, or split, a track can end up too narrow for its icon: hide the icon rather than overlap the handles
    node.classList.toggle('is-narrow', !!clip.curve && (clip.e - clip.s) * pps < CURVE_MIN_PX - 0.5);
    if (clip.mid != null) node.querySelector('.tl-key').style.left = clip.mid * 100 + '%';
  }

  function cycleEase(clip, node) {
    const i = CURVE_ORDER.indexOf(clip.curve);
    clip.curve = CURVE_ORDER[(i + 1) % CURVE_ORDER.length];
    renderCurve(clip, node);
    updateEaseButtons();
  }

  function renderCurve(clip, node) {
    node.querySelectorAll('.tl-curve-line, .tl-curve').forEach((n) => n.remove());
    node.insertBefore(el('i', 'tl-curve-line'), node.firstChild);
    const btn = el('button', 'tl-curve', curveSvg(clip.curve || 'linear'));
    btn.type = 'button';
    btn.title = 'Easing (click to change)';
    // A mouse press on the icon starts dragging the whole track (see startDrag); if the press ends
    // without moving, startDrag cycles the easing. This click only handles the keyboard (Enter/Space).
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.detail !== 0) return;
      const before = snapshot();
      cycleEase(clip, node);
      commit(before);
    });
    node.appendChild(btn);
  }

  // neighbours bound how far a clip can move without overlapping
  function bounds(row, clip, skip) {
    let lo = 0, hi = duration;
    row.clips.forEach((c) => {
      if (c === clip || (skip && skip.has(c))) return;
      if (c.e <= clip.s + 1e-6) lo = Math.max(lo, c.e);
      else if (c.s >= clip.e - 1e-6) hi = Math.min(hi, c.s);
    });
    return [lo, hi];
  }

  // magnets: other clips' edges, the playhead, 0 and the end
  function snapPoints(except) {
    const pts = [0, duration, time];
    visibleEntries().forEach((en) => en.row.clips.forEach((c) => {
      if (c !== except && !(except instanceof Set && except.has(c))) pts.push(c.s, c.e);
    }));
    return pts;
  }

  function snapTo(t, pts, free) {
    if (free) return t;
    const reach = SNAP_PX / pps;
    let best = null;
    pts.forEach((p) => {
      const d = Math.abs(p - t);
      if (d <= reach && (best === null || d < Math.abs(best - t))) best = p;
    });
    return best !== null ? best : snapFrame(t);
  }

  function startDrag(e, mode, clip, node, entry) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Shift / Cmd / Ctrl + click adds a track to the selection or takes it out again
    if (mode === 'move' && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      const me = multi.find((m) => m.clip === clip);
      setSelection(me ? multi.filter((m) => m !== me) : [...multi, { clip, node, entry }]);
      return;
    }

    // pressing a track that's part of a multi-selection drags the whole selection
    const group = mode === 'move' && multi.length > 1 && multi.some((m) => m.clip === clip) ? multi.slice() : null;
    if (!group) select({ clip, node, entry });
    node.setPointerCapture(e.pointerId);
    node.classList.add('is-dragging');

    const before = snapshot();
    const startX = e.clientX;
    // shortest the track may get: with an easing icon it needs room for the icon between the handles
    const need = clip.curve ? Math.max(MIN_LEN, CURVE_MIN_PX / pps) : MIN_LEN;
    const onCurveIcon = !!e.target.closest('.tl-curve'); // pressed on the easing icon in the middle
    let moved = false;
    const s0 = clip.s, e0 = clip.e, m0 = clip.mid;
    const selectedClips = group ? new Set(group.map((m) => m.clip)) : null;
    const [lo, hi] = bounds(entry.row, clip, selectedClips);
    const pts = snapPoints(group ? selectedClips : clip);

    // group move: how far the whole group may travel before any member hits a neighbour or an end
    let dmin = -Infinity, dmax = Infinity;
    const starts = group ? group.map((m) => {
      const [l, h] = bounds(m.entry.row, m.clip, selectedClips);
      dmin = Math.max(dmin, l - m.clip.s);
      dmax = Math.min(dmax, h - m.clip.e);
      return { m, s: m.clip.s, e: m.clip.e };
    }) : null;

    const move = (ev) => {
      if (ev.buttons === 0) { up(); return; } // released out of sight: end the drag
      if (Math.abs(ev.clientX - startX) > 3) moved = true;
      const dt = (ev.clientX - startX) / pps;
      const free = ev.altKey; // hold Alt to drag without magnets
      if (mode === 'move') {
        const len = e0 - s0;
        let s = s0 + dt;
        const a = snapTo(s, pts, free);
        const b = snapTo(s + len, pts, free) - len;
        s = Math.abs(a - s) <= Math.abs(b - s) ? a : b;
        if (group) {
          const delta = clamp(s - s0, dmin, dmax);
          starts.forEach(({ m, s: ms, e: me }) => {
            m.clip.s = ms + delta;
            m.clip.e = me + delta;
            layoutClip(m.clip, m.node);
          });
          return;
        }
        s = clamp(s, lo, hi - len);
        clip.s = s;
        clip.e = s + len;
      } else if (mode === 'l') {
        clip.s = clamp(snapTo(s0 + dt, pts, free), lo, Math.max(lo, e0 - need));
      } else if (mode === 'r') {
        clip.e = clamp(snapTo(e0 + dt, pts, free), Math.min(hi, s0 + need), hi);
      } else if (mode === 'key') {
        const abs = (m0 * (e0 - s0) + s0) + dt;
        clip.mid = clamp((abs - clip.s) / (clip.e - clip.s), 0.05, 0.95);
      }
      layoutClip(clip, node);
    };
    const up = () => {
      node.classList.remove('is-dragging');
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      if (onCurveIcon && !moved && mode === 'move' && !group) cycleEase(clip, node); // a plain click on the icon changes the easing
      commit(before);
      if (moved) select(null);                              // letting go after dragging or resizing deselects
      else if (group) select({ clip, node, entry });        // a plain click on one of several selected tracks keeps just that one
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  }

  function buildClip(clip, entry) {
    const node = el('div', 'tl-clip');
    node._clip = clip;
    node.tabIndex = -1;
    const l = el('i', 'tl-edge l');
    const r = el('i', 'tl-edge r');
    node.append(l, r);
    node.addEventListener('pointerdown', (e) => startDrag(e, 'move', clip, node, entry));
    l.addEventListener('pointerdown', (e) => startDrag(e, 'l', clip, node, entry));
    r.addEventListener('pointerdown', (e) => startDrag(e, 'r', clip, node, entry));
    if (clip.curve) renderCurve(clip, node);
    if (clip.mid != null) {
      const k = el('i', 'tl-key');
      k.addEventListener('pointerdown', (e) => startDrag(e, 'key', clip, node, entry));
      node.appendChild(k);
    }
    layoutClip(clip, node);
    return node;
  }

  function rebuildRow(entry) {
    entry.rowEl.textContent = '';
    entry.row.clips.forEach((c) => entry.rowEl.appendChild(buildClip(c, entry)));
  }

  function allNodes() {
    return entries.flatMap((en) => Array.from(en.rowEl.querySelectorAll('.tl-clip')));
  }

  function addClipAt(entry, t) {
    const before = snapshot();
    const len = 0.5;
    const s = clamp(snapFrame(t - len / 2), 0, duration - len);
    const clip = { s, e: s + len };
    const [lo, hi] = bounds(entry.row, clip);
    if (hi - lo < MIN_LEN) return;
    clip.s = clamp(s, lo, hi - MIN_LEN);
    clip.e = Math.min(clip.s + len, hi);
    entry.row.clips.push(clip);
    const node = buildClip(clip, entry);
    entry.rowEl.appendChild(node);
    select({ clip, node, entry });
    commit(before);
  }

  // Deleting a setting row: hides its label and track row; if it was the last row in its section,
  // the whole section goes too. (Hidden, not removed, so undo can bring everything back.)
  function removeRow(entry) {
    if (multi.some((m) => m.entry === entry)) select(null);
    entry.removed = true;
    entry.labEl.hidden = true;
    entry.rowEl.hidden = true;
    const group = entry.group;
    if (group.entries.every((en) => en.removed)) {
      group.removed = true;
      group.side.hidden = true;
      group.main.hidden = true;
      updateFirstGroup();
    }
  }

  function deleteSelected() {
    if (!multi.length) return;
    const before = snapshot();
    const touched = new Set();
    multi.forEach(({ clip, entry }) => {
      entry.row.clips.splice(entry.row.clips.indexOf(clip), 1);
      touched.add(entry);
    });
    setSelection([]);
    touched.forEach((entry) => {
      rebuildRow(entry);
      // that was the last track in its row: remove the row (and its section, if it was the last row)
      if (entry.row.clips.length === 0) removeRow(entry);
    });
    commit(before);
  }

  // razor: split the selected clip (or every clip under the playhead) at the playhead
  function splitAtPlayhead() {
    const t = snapFrame(time);
    const chosen = new Set(multi.map((m) => m.clip));
    const targets = multi.length
      ? [...new Set(multi.map((m) => m.entry))]
      : visibleEntries();
    const before = snapshot();
    let changed = false;
    targets.forEach((entry) => {
      const next = [];
      entry.row.clips.forEach((c) => {
        const hit = multi.length ? chosen.has(c) : true;
        if (hit && t > c.s + MIN_LEN && t < c.e - MIN_LEN) {
          const a = { s: c.s, e: t };
          const b = { s: t, e: c.e };
          // keep the animation continuous: the value at the cut is where one half ends and the other starts
          const u = (t - c.s) / (c.e - c.s);
          const mid = Math.round(fromOf(c) + (toOf(c) - fromOf(c)) * (EASE_FN[c.curve || 'linear'](u)));
          a.from = fromOf(c); a.to = mid;
          b.from = mid; b.to = toOf(c);
          if (c.curve) { a.curve = c.curve; b.curve = c.curve; }
          next.push(a, b);
          changed = true;
        } else {
          next.push(c);
        }
      });
      entry.row.clips = next;
    });
    if (!changed) return;
    select(null);
    targets.forEach(rebuildRow);
    commit(before);
  }

  // ---------- collapsed-section hints ----------
  // A collapsed section keeps a keyframe summary: a diamond at the start and end of every
  // track inside it, joined by a thin line wherever tracks overlap in time.
  function renderSummary(group) {
    if (!group.side.classList.contains('is-collapsed')) return;
    group.barStrip.textContent = '';
    const spans = group.entries
      .filter((en) => !en.removed)
      .flatMap((en) => en.row.clips.map((c) => [c.s, c.e]))
      .sort((a, b) => a[0] - b[0]);
    if (!spans.length) return;

    const merged = [];
    spans.forEach(([a, b]) => {
      const last = merged[merged.length - 1];
      if (last && a <= last[1] + 1e-6) last[1] = Math.max(last[1], b);
      else merged.push([a, b]);
    });
    const x = (t) => INSET + t * pps; // the bar starts INSET in, like the rows' band
    // diamonds are ~11px across when rotated, so keep their points inside the bar's 4px side padding
    const DIAMOND = 6;
    const xKf = (t) => INSET + clamp(t * pps, DIAMOND, duration * pps - DIAMOND);
    merged.forEach(([a, b]) => {
      const line = el('i', 'tl-kf-line');
      line.style.left = x(a) + 'px';
      line.style.width = (b - a) * pps + 'px';
      group.barStrip.appendChild(line);
    });
    const times = new Set();
    spans.forEach(([a, b]) => { times.add(Math.round(a * 1000)); times.add(Math.round(b * 1000)); });
    times.forEach((ms) => {
      const kf = el('i', 'tl-kf');
      kf.style.left = xKf(ms / 1000) + 'px';
      group.barStrip.appendChild(kf);
    });
  }
  const refreshSummaries = () => groupEntries.forEach(renderSummary);

  // ---------- groups / rows ----------
  GROUPS.forEach((g) => {
    const side = el('div', 'tl-group');
    const main = el('div', 'tl-group');
    const group = { side, main, removed: false, entries: [], bar: null, barStrip: null };
    groupEntries.push(group);
    [side, main].forEach((n) => n.style.setProperty('--bar', g.bar));
    if (g.collapsed) { side.classList.add('is-collapsed'); main.classList.add('is-collapsed'); }

    const head = el('div', 'tl-group-head');
    const name = el('button', 'tl-group-name', `${g.name}${CHEVRON}`);
    name.type = 'button';
    head.appendChild(name);
    const eye = el('button', 'tl-hover-icon tl-eye',
      `<span class="eye-on">${EYE}</span><span class="eye-off">${EYE_OFF}</span>`);
    eye.type = 'button';
    eye.setAttribute('aria-label', `Hide ${g.name}`);
    eye.setAttribute('aria-pressed', 'false');
    eye.addEventListener('click', () => {
      const muted = !side.classList.contains('is-muted');
      side.classList.toggle('is-muted', muted);
      main.classList.toggle('is-muted', muted);
      eye.setAttribute('aria-pressed', String(muted));
      eye.setAttribute('aria-label', `${muted ? 'Show' : 'Hide'} ${g.name}`);
    });
    head.appendChild(eye);

    // X next to the eye deletes the whole section (undoable)
    const del = el('button', 'tl-hover-icon tl-group-del', CLOSE);
    del.type = 'button';
    del.setAttribute('aria-label', `Delete ${g.name}`);
    del.addEventListener('click', () => {
      const before = snapshot();
      if (multi.some((m) => m.entry.group === group)) select(null);
      group.removed = true;
      side.hidden = true;
      main.hidden = true;
      updateFirstGroup();
        commit(before);
    });
    head.appendChild(del);
    side.appendChild(head);

    const sideBody = el('div', 'tl-group-body');
    main.appendChild(el('div', 'tl-group-head'));
    const track = el('div', 'tl-group-body tl-group-body-track');
    const strip = el('div', 'tl-strip'); // scrolls horizontally; the band behind it never moves
    track.appendChild(strip);

    g.rows.forEach((r) => {
      const labEl = el('div', 'tl-row-label', `<span>${r.label}</span>`);
      const rowEye = el('button', 'tl-hover-icon tl-eye',
        `<span class="eye-on">${EYE}</span><span class="eye-off">${EYE_OFF}</span>`);
      rowEye.type = 'button';
      rowEye.setAttribute('aria-label', `Hide ${r.label}`);
      rowEye.setAttribute('aria-pressed', 'false');
      const x = el('button', 'tl-hover-icon tl-row-del', CLOSE);
      x.type = 'button';
      x.setAttribute('aria-label', `Remove ${r.label}`);
      labEl.append(rowEye, x);
      sideBody.appendChild(labEl);

      const rowEl = el('div', 'tl-track-row');
      // the eye grays this setting's tracks out (same dark gray as a hidden section)
      rowEye.addEventListener('click', () => {
        const muted = !labEl.classList.contains('is-muted');
        labEl.classList.toggle('is-muted', muted);
        rowEl.classList.toggle('is-muted', muted);
        rowEye.setAttribute('aria-pressed', String(muted));
        rowEye.setAttribute('aria-label', `${muted ? 'Show' : 'Hide'} ${r.label}`);
      });
      const entry = { row: r, rowEl, labEl, removed: false, group };
      entries.push(entry);
      group.entries.push(entry);
      rebuildRow(entry);
      rowEl.addEventListener('dblclick', (e) => {
        if (e.target !== rowEl) return;
        addClipAt(entry, (e.clientX - rowEl.getBoundingClientRect().left) / pps);
      });
      rowEl.addEventListener('pointerdown', (e) => { if (e.target === rowEl) select(null); });
      strip.appendChild(rowEl);

      // X removes this setting's label and its whole track row (undoable)
      x.addEventListener('click', () => {
        const before = snapshot();
        removeRow(entry);
        commit(before);
      });
    });

    side.appendChild(sideBody);
    main.appendChild(track);
    group.bar = el('div', 'tl-collapsed-bar');
    group.barStrip = el('div', 'tl-strip');
    group.bar.appendChild(group.barStrip);
    main.appendChild(group.bar);

    name.addEventListener('click', () => {
      side.classList.toggle('is-collapsed');
      main.classList.toggle('is-collapsed');
      renderSummary(group);
      name.blur(); // no stray focus ring when you keep using the keyboard shortcuts
    });
    if (g.collapsed) renderSummary(group);

    labelsEl.appendChild(side);
    rowsEl.appendChild(main);
  });

  updateFirstGroup();

  // ---------- marquee: drag over empty space to select several tracks ----------
  scroll.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.tl-clip')) return;
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const base = additive ? multi.slice() : [];
    const box = el('div', 'tl-marquee');
    document.body.appendChild(box);
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;

    const entryOf = (node) => entries.find((en) => en.rowEl === node.parentElement);
    const hitTest = (r) => {
      const hits = [];
      allNodes().forEach((node) => {
        const en = entryOf(node);
        if (!en || en.removed || en.group.removed || !node.offsetParent) return;
        const nr = node.getBoundingClientRect();
        const band = node.closest('.tl-group-body-track').getBoundingClientRect(); // only what's actually visible
        const left = Math.max(nr.left, band.left), right = Math.min(nr.right, band.right);
        const top = Math.max(nr.top, band.top), bottom = Math.min(nr.bottom, band.bottom);
        if (right <= left || bottom <= top) return;
        if (left < r.right && right > r.left && top < r.bottom && bottom > r.top) hits.push({ clip: node._clip, node, entry: en });
      });
      return hits;
    };

    const onMove = (ev) => {
      if (ev.buttons === 0) { stop(); return; }
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      moved = true;
      const r = {
        left: Math.min(x0, ev.clientX), right: Math.max(x0, ev.clientX),
        top: Math.min(y0, ev.clientY), bottom: Math.max(y0, ev.clientY),
      };
      Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.right - r.left + 'px', height: r.bottom - r.top + 'px', display: 'block' });
      const hits = hitTest(r);
      const keep = base.filter((b) => !hits.some((h) => h.clip === b.clip));
      setSelection([...keep, ...hits]);
    };
    const stop = () => {
      box.remove();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      if (!moved && !additive) setSelection([]);  // a plain click on empty space just deselects
    };
    box.style.display = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
  });

  // ---------- time + playhead ----------
  const pad = (n, l = 2) => String(n).padStart(l, '0');

  function render() {
    const x = ORIGIN + time * pps - scroll.scrollLeft;
    playhead.style.transform = `translateX(${x}px)`;
    const total = Math.round(time * FPS);
    const f = total % FPS;
    const s = Math.floor(total / FPS) % 60;
    const m = Math.floor(total / FPS / 60);
    flag.textContent = `${m}:${pad(s)}:${pad(f)}`;

    // the timer pill stays fully inside the timing UI; the line and handle keep moving past its edges
    const w = flag.offsetWidth;
    const rulerRight = playhead.parentElement.clientWidth - EDGE; // the layer also covers the right padding
    const left = clamp(x - w / 2, INSET, Math.max(INSET, rulerRight - w));
    flag.style.left = left - x + 'px';
    // only the part of the timeline that's actually in view shows the playhead
    playhead.style.visibility = x >= INSET && x <= rulerRight ? '' : 'hidden';
  }

  function setTime(t) {
    time = clamp(t, 0, duration);
    render();
  }

  function timeFromEvent(e) {
    const rect = rulerWrap.getBoundingClientRect();
    return (e.clientX - rect.left + rulerWrap.scrollLeft - INSET) / pps;
  }

  ruler.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const scrub = (ev) => {
      if (ev.buttons === 0) { stop(); return; } // the button was released somewhere we never heard about
      setTime(snapFrame(timeFromEvent(ev)));
    };
    // listen on the window so letting go outside the ruler (or the window) always ends the drag
    const stop = () => {
      window.removeEventListener('pointermove', scrub);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      ruler.removeEventListener('lostpointercapture', stop);
    };
    setTime(snapFrame(timeFromEvent(e)));
    ruler.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', scrub);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    ruler.addEventListener('lostpointercapture', stop);
  });

  let raf = null;
  let last = 0;
  let loop = false;
  function tick(now) {
    time += (now - last) / 1000;
    last = now;
    if (time >= duration) {
      if (loop) {
        time = 0;               // loop on: start over from the beginning and keep going
      } else {
        time = duration;        // loop off: stop at the end
        render();
        setPlaying(false);
        return;
      }
    }
    render();
    raf = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    root.classList.toggle('is-playing', on);
    cancelAnimationFrame(raf);
    if (on) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  playBtn.addEventListener('click', () => setPlaying(!root.classList.contains('is-playing')));
  const loopBtn = root.querySelector('[data-tl-loop]');
  loopBtn.addEventListener('click', () => {
    loop = !loop;
    loopBtn.classList.toggle('is-on', loop);
    loopBtn.setAttribute('aria-pressed', String(loop));
    loopBtn.blur(); // keep Space for play / pause
  });
  root.querySelector('[data-tl-rewind]').addEventListener('click', () => { setTime(0); scroll.scrollLeft = 0; });

  // ---------- zoom / scroll pill ----------
  const zoom = root.querySelector('[data-tl-zoom]');
  const thumb = root.querySelector('[data-tl-zoomthumb]');
  const ZOOM_PAD = 2;   // px between the handle and the pill it sits in
  const ZOOM_MIN_W = 28;
  let fitMode = true; // until the user zooms, the whole timeline fits the visible width

  function updateThumb() {
    const trackW = zoom.clientWidth - 2 * ZOOM_PAD;
    const t0 = scroll.scrollLeft / pps;
    const vt = scroll.clientWidth / pps;
    const left = clamp(t0 / duration, 0, 1);
    const width = clamp(vt / duration, 0, 1 - left);
    thumb.style.left = ZOOM_PAD + left * trackW + 'px';
    thumb.style.width = Math.max(width * trackW, ZOOM_MIN_W) + 'px';
  }

  function relayout() {
    root.style.setProperty('--tl-pps', pps + 'px');
    allNodes().forEach((node) => layoutClip(node._clip, node));
    refreshSummaries();
    buildRuler();
    render();
    updateThumb();
  }

  function fitWidth() {
    const w = scroll.clientWidth;
    if (!w) return;
    pps = (w - 2 * INSET) / duration;
    relayout();
    scroll.scrollLeft = 0;
    rulerWrap.scrollLeft = 0;
    render();
    updateThumb();
  }

  function setZoom(nextPps, t0) {
    const fit = Math.max(MIN_PPS, (scroll.clientWidth - 2 * INSET) / duration);
    pps = clamp(nextPps, Math.min(fit, MAX_PPS), MAX_PPS);
    fitMode = pps <= fit + 0.5;
    relayout();
    scroll.scrollLeft = t0 * pps;
    rulerWrap.scrollLeft = scroll.scrollLeft;
    render();
    updateThumb();
  }

  // the colored bands stay put (so their rounded edges always show); only what's inside them scrolls
  const syncScrollVars = () => {
    root.style.setProperty('--tl-sl', scroll.scrollLeft + 'px');
    root.style.setProperty('--tl-view-w', scroll.clientWidth + 'px');
  };
  syncScrollVars();

  scroll.addEventListener('scroll', () => {
    syncScrollVars();
    rulerWrap.scrollLeft = scroll.scrollLeft;
    render();
    updateThumb();
  });

  // ctrl / cmd + wheel (or trackpad pinch) zooms around the pointer
  scroll.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const rect = scroll.getBoundingClientRect();
    const tAt = (scroll.scrollLeft + e.clientX - rect.left - INSET) / pps;
    const next = pps * Math.exp(-e.deltaY * 0.01);
    setZoom(next, tAt - (e.clientX - rect.left - INSET) / next);
  }, { passive: false });

  function dragThumb(e, mode) {
    e.preventDefault();
    e.stopPropagation();
    thumb.setPointerCapture(e.pointerId);
    thumb.classList.add('is-dragging');
    const trackW = zoom.clientWidth - 2 * ZOOM_PAD;
    const startX = e.clientX;
    const l0 = thumb.offsetLeft - ZOOM_PAD;
    const w0 = thumb.offsetWidth;
    const MIN_W = ZOOM_MIN_W;

    const move = (ev) => {
      if (ev.buttons === 0) { up(); return; } // released out of sight: end the drag
      const dx = ev.clientX - startX;
      if (mode === 'move') {
        const left = clamp(l0 + dx, 0, trackW - w0);
        scroll.scrollLeft = (left / trackW) * duration * pps;
        return;
      }
      let left = l0, width = w0;
      if (mode === 'l') {
        left = clamp(l0 + dx, 0, l0 + w0 - MIN_W);
        width = l0 + w0 - left;
      } else {
        width = clamp(w0 + dx, MIN_W, trackW - l0);
      }
      const vt = (width / trackW) * duration;
      setZoom(scroll.clientWidth / vt, (left / trackW) * duration);
    };
    const up = () => {
      thumb.classList.remove('is-dragging');
      thumb.removeEventListener('pointermove', move);
      thumb.removeEventListener('pointerup', up);
      thumb.removeEventListener('pointercancel', up);
    };
    thumb.addEventListener('pointermove', move);
    thumb.addEventListener('pointerup', up);
    thumb.addEventListener('pointercancel', up);
  }

  thumb.addEventListener('pointerdown', (e) => dragThumb(e, 'move'));
  thumb.querySelector('.l').addEventListener('pointerdown', (e) => dragThumb(e, 'l'));
  thumb.querySelector('.r').addEventListener('pointerdown', (e) => dragThumb(e, 'r'));
  zoom.addEventListener('pointerdown', (e) => {
    if (e.target !== zoom) return;
    const rect = zoom.getBoundingClientRect();
    const t = ((e.clientX - rect.left - ZOOM_PAD) / (zoom.clientWidth - 2 * ZOOM_PAD)) * duration;
    scroll.scrollLeft = t * pps - scroll.clientWidth / 2;
  });
  window.addEventListener('resize', updateThumb);
  new ResizeObserver(() => { syncScrollVars(); if (fitMode) fitWidth(); else updateThumb(); }).observe(scroll);

  // ---------- duration ----------
  const fitDurWidth = () => {}; // the field has a fixed width now (text is right-aligned inside it)
  durInput.addEventListener('input', fitDurWidth);

  function setDuration(next) {
    next = clamp(Math.round(next * 100) / 100, 1, MAX_DURATION);
    if (next === duration) { durInput.value = duration; fitDurWidth(); return; }
    const before = snapshot();
    const prev = duration;
    duration = next;
    root.style.setProperty('--tl-dur', duration);

    entries.forEach((entry) => {
      const kept = [];
      entry.row.clips.forEach((clip) => {
        if (clip.e >= prev - 1e-6) clip.e = duration;   // clips that ran to the end keep running to the end
        clip.e = Math.min(clip.e, duration);
        if (clip.s > clip.e - MIN_LEN) {
          if (clip.s <= duration - MIN_LEN) clip.s = clip.e - MIN_LEN;
          else return;                                   // fully past the new end: trimmed
        }
        kept.push(clip);
      });
      entry.row.clips = kept;
      rebuildRow(entry);
    });
    select(null);
    buildRuler();
    if (fitMode) fitWidth(); else relayout();
    time = Math.min(time, duration);
    durInput.value = duration;
    fitDurWidth();
    render();
    updateThumb();
    commit(before);
  }

  durInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); // keep editor shortcuts from firing while typing
    if (e.key === 'Enter') durInput.blur();
    if (e.key === 'Escape') { durInput.value = duration; fitDurWidth(); durInput.blur(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      setDuration((parseFloat(durInput.value) || duration) + (e.key === 'ArrowUp' ? step : -step));
    }
  });
  durInput.addEventListener('focus', () => durInput.select());
  durInput.addEventListener('blur', () => {
    const v = parseFloat(durInput.value);
    setDuration(Number.isFinite(v) ? v : duration);
  });

  // ---------- bottom fade ----------
  function updateFade() {
    const more = body.scrollHeight - body.scrollTop - body.clientHeight > 2;
    root.classList.toggle('has-more', more);
    root.classList.toggle('has-more-above', body.scrollTop > 2);
  }
  body.addEventListener('scroll', updateFade);
  const fadeObserver = new ResizeObserver(updateFade);
  fadeObserver.observe(body);
  fadeObserver.observe(labelsEl);
  fadeObserver.observe(rowsEl);
  updateFade();

  // ---------- vertical resize ----------
  const handle = root.querySelector('[data-tl-resize]');
  const MIN_H = 86; // 12px padding + 42px toolbar + 20px ruler + 12px: just the timeline head
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    root.classList.add('is-resizing');
    const startY = e.clientY;
    const startH = root.getBoundingClientRect().height;
    const maxH = () => window.innerHeight - 24;
    const move = (ev) => {
      if (ev.buttons === 0) { up(); return; } // released out of sight: end the drag
      const h = clamp(startH + (startY - ev.clientY), MIN_H, maxH());
      root.style.height = h + 'px';
      root.classList.toggle('is-head-only', h <= MIN_H + 12);
    };
    const up = () => {
      root.classList.remove('is-resizing');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });

  // ---------- right-click easing menu ----------
  const EASE_ITEMS = [
    ['inout', 'Ease in + ease out'],
    ['in', 'Ease in'],
    ['out', 'Ease out'],
  ];
  let menu = null;

  function closeMenu() {
    if (!menu) return;
    menu.remove();
    menu = null;
    window.removeEventListener('blur', closeMenu);
    window.removeEventListener('resize', closeMenu);
    document.removeEventListener('pointerdown', onMenuOutside, true);
    document.removeEventListener('keydown', onMenuKey, true);
    scroll.removeEventListener('scroll', closeMenu);
    body.removeEventListener('scroll', closeMenu);
  }
  function onMenuOutside(e) { if (menu && !menu.contains(e.target)) closeMenu(); }
  function onMenuKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); } }

  // the app's own slider (same markup and styling as the Sliders panel), wired by its setupSlider()
  function buildSlider(label, value, onChange) {
    const item = el('div', 'slider-item');
    item.setAttribute('data-no-elastic', ''); // no rubber-band spring when dragging past the ends
    item.innerHTML = `
      <div class="row">
        <span class="label-group"><span class="label"></span></span>
        <span class="value"><input class="value-num" type="text" inputmode="decimal" maxlength="3" size="3" /></span>
      </div>
      <div class="track-wrap">
        <div class="gray-bar"><div class="gray-fill before"></div><div class="gray-fill after"></div></div>
        <div class="thumb"></div>
        <input class="range-input" type="range" min="${VALUE_MIN}" max="${VALUE_MAX}" step="1" value="${value}" />
      </div>`;
    item.querySelector('.label').textContent = label;
    item.querySelector('.value-num').value = value;
    if (typeof setupSlider === 'function') setupSlider(item);
    const input = item.querySelector('.range-input');
    const num = item.querySelector('.value-num');
    // dragging, arrow keys on the number, typing a number: whatever changed, report the slider's value
    const report = () => onChange(Number(input.value));
    input.addEventListener('input', report);
    num.addEventListener('keydown', () => setTimeout(report, 0)); // after the slider's own handler ran
    num.addEventListener('blur', report);
    return item;
  }

  function openMenu(x, y) {
    closeMenu();
    const many = multi.length > 1;
    const current = commonCurve();
    menu = el('div', 'tl-menu');
    menu.setAttribute('role', 'menu');

    if (!many) {
      // one track: two quick sliders for the setting it animates (its start and end value)
      menu.appendChild(el('div', 'tl-menu-title', selected.entry.row.label));
      const clip = selected.clip;
      let before = null;
      const edit = (key) => (v) => {
        if (clip[key] === v) return;
        if (before === null) before = snapshot();           // one undo step per slider gesture
        clip[key] = v;
      };
      const finish = () => { if (before !== null) { commit(before); before = null; } };
      const sliders = el('div', 'tl-menu-sliders');
      sliders.append(buildSlider('From', fromOf(clip), edit('from')), buildSlider('To', toOf(clip), edit('to')));
      sliders.addEventListener('pointerup', finish);
      sliders.addEventListener('change', finish);
      sliders.addEventListener('focusout', finish);
      sliders.addEventListener('keyup', finish);
      menu.appendChild(sliders);
      menu.appendChild(el('div', 'tl-menu-sep'));
      menu.appendChild(el('div', 'tl-menu-title', 'Easing'));
    } else {
      // several tracks: only the easing, applied to all of them at once
      menu.appendChild(el('div', 'tl-menu-title', `${multi.length} tracks \u00b7 Easing`));
    }

    const add = (name, label) => {
      const b = el('button', 'tl-menu-item' + (name === current ? ' is-active' : ''),
        `<span class="tl-menu-icon">${name ? curveSvg(name, 16) : ''}</span><span>${label}</span>`);
      b.type = 'button';
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('aria-checked', String(name === current));
      b.addEventListener('click', () => { applyEase(name); closeMenu(); });
      menu.appendChild(b);
    };
    EASE_ITEMS.forEach(([name, label]) => add(name, label));
    menu.appendChild(el('div', 'tl-menu-sep'));
    add(null, 'No easing');

    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + 'px';

    window.addEventListener('blur', closeMenu);
    window.addEventListener('resize', closeMenu);
    document.addEventListener('pointerdown', onMenuOutside, true);
    document.addEventListener('keydown', onMenuKey, true);
    scroll.addEventListener('scroll', closeMenu);
    body.addEventListener('scroll', closeMenu);
  }

  root.addEventListener('contextmenu', (e) => {
    const node = e.target.closest('.tl-clip');
    if (!node) { closeMenu(); return; }
    e.preventDefault();
    const entry = entries.find((en) => en.rowEl === node.parentElement);
    // right-clicking one of several selected tracks keeps the selection (the menu then edits all of them)
    if (!(multi.length > 1 && multi.some((m) => m.node === node))) select({ clip: node._clip, node, entry });
    openMenu(e.clientX, e.clientY);
  });

  // clicking anywhere that isn't a track deselects (tracks stop their own pointerdown from reaching here)
  document.addEventListener('pointerdown', (e) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) return; // those add to the selection
    if (selected && !e.target.closest('.tl-clip, .tl-ease, .tl-menu')) select(null); // the easing buttons act on the selection
  });

  // ---------- keyboard ----------
  const isSpace = (e) => e.code === 'Space' || e.key === ' ';
  const keysApply = (e) => {
    if (root.closest('[hidden]')) return false;
    if (e.altKey) return false;
    const a = document.activeElement;
    return !(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable));
  };

  document.addEventListener('keydown', (e) => {
    if (!keysApply(e)) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    if (isSpace(e) && !mod) {                       // play / pause
      e.preventDefault();
      if (e.repeat) return;
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
      if (!root.classList.contains('is-playing') && time >= duration - 1e-6) setTime(0);
      setPlaying(!root.classList.contains('is-playing'));
    } else if (mod && key === 'z') {                // undo / redo
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (mod && key === 'y') {
      e.preventDefault();
      redo();
    } else if (mod && key === 'a') {                // select every track that's showing
      e.preventDefault();
      closeMenu();
      setSelection(allNodes()
        .filter((node) => node.offsetParent)       // skips tracks in collapsed, hidden or deleted rows and sections
        .map((node) => ({ clip: node._clip, node, entry: entries.find((en) => en.rowEl === node.parentElement) })));
    } else if (mod) {
      return;
    } else if (key === 'delete' || key === 'backspace') {
      if (!selected) return;
      e.preventDefault();
      deleteSelected();
    } else if (key === 's') {                       // split at the playhead
      e.preventDefault();
      splitAtPlayhead();
    } else if (key === 'arrowleft' || key === 'arrowright') {   // step by a frame (Shift: a second)
      e.preventDefault();
      const step = e.shiftKey ? 1 : SNAP;
      setTime(snapFrame(time) + (key === 'arrowright' ? step : -step));
    } else if (key === 'home') {
      e.preventDefault();
      setTime(0);
      scroll.scrollLeft = 0;
    } else if (key === 'end') {
      e.preventDefault();
      setTime(duration);
    } else if (key === 'escape') {
      select(null);
    }
  });
  document.addEventListener('keyup', (e) => {
    if (isSpace(e) && keysApply(e)) e.preventDefault(); // stop a focused button from also "clicking"
  });

  render();
  updateThumb();
})();
