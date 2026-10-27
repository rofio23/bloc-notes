(function () {
  'use strict';

  var NOTES_KEY = 'carnet.notes';
  var THEME_KEY = 'carnet.theme';

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var app = $('app'), list = $('list'), pane = $('pane'), empty = $('empty');
  var titleEl = $('title'), bodyEl = $('body'), metaEl = $('meta');
  var delBtn = $('delBtn'), searchEl = $('search');

  var notes = [];
  var currentId = null;
  var query = '';
  var saveTimer = null;
  var confirmTimer = null;

  /* ---------- Stockage ---------- */
  function load() {
    try { notes = JSON.parse(localStorage.getItem(NOTES_KEY)) || []; }
    catch (e) { notes = []; }
  }

  function save() {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch (e) {}
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 250);
  }

  /* ---------- Thème : clair / sombre / auto ---------- */
  var mq = window.matchMedia('(prefers-color-scheme: dark)');

  function getMode() {
    try { return localStorage.getItem(THEME_KEY) || 'auto'; }
    catch (e) { return 'auto'; }
  }

  function applyTheme(mode) {
    var dark = mode === 'dark' || (mode === 'auto' && mq.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('#theme button').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.mode === mode));
    });
  }

  function setMode(mode) {
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
    applyTheme(mode);
  }

  $('theme').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-mode]');
    if (btn) setMode(btn.dataset.mode);
  });

  mq.addEventListener('change', function () {
    if (getMode() === 'auto') applyTheme('auto');
  });

  /* ---------- Utilitaires ---------- */
  function formatDate(ts) {
    var d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    var opts = { day: 'numeric', month: 'short' };
    if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('fr-FR', opts);
  }

  function countWords(text) {
    var t = text.trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function byId(id) {
    for (var i = 0; i < notes.length; i++) if (notes[i].id === id) return notes[i];
    return null;
  }

  /* ---------- Affichage ---------- */
  function renderList() {
    var q = query.trim().toLowerCase();
    var shown = notes
      .filter(function (n) {
        return !q || (n.title + ' ' + n.body).toLowerCase().indexOf(q) !== -1;
      })
      .sort(function (a, b) { return b.updated - a.updated; });

    list.textContent = '';

    if (!shown.length) {
      var li = document.createElement('li');
      li.className = 'list-empty';
      li.textContent = q ? 'Aucune note ne correspond à cette recherche.' : 'Aucune note pour le moment.';
      list.appendChild(li);
      return;
    }

    shown.forEach(function (n) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item';
      btn.dataset.id = n.id;
      if (n.id === currentId) btn.setAttribute('aria-current', 'true');

      var top = document.createElement('span');
      top.className = 'item-top';

      var title = document.createElement('span');
      title.className = 'item-title' + (n.title.trim() ? '' : ' untitled');
      title.textContent = n.title.trim() || 'Sans titre';

      var date = document.createElement('span');
      date.className = 'item-date';
      date.textContent = formatDate(n.updated);

      top.appendChild(title);
      top.appendChild(date);

      var prev = document.createElement('span');
      prev.className = 'item-preview';
      prev.textContent = n.body.replace(/\s+/g, ' ').trim() || 'Note vide';

      btn.appendChild(top);
      btn.appendChild(prev);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function updateMeta(n) {
    var w = countWords(n.body);
    metaEl.textContent = 'Modifiée à ' + formatDate(n.updated) + ' · ' + w + (w > 1 ? ' mots' : ' mot');
  }

  function resetDeleteButton() {
    clearTimeout(confirmTimer);
    delBtn.textContent = 'Supprimer';
    delBtn.classList.remove('confirm');
  }

  function openNote(id, focus) {
    var n = byId(id);
    resetDeleteButton();
    currentId = n ? n.id : null;

    if (!n) {
      pane.hidden = true;
      empty.hidden = false;
      app.dataset.view = 'list';
    } else {
      titleEl.value = n.title;
      bodyEl.value = n.body;
      updateMeta(n);
      empty.hidden = true;
      pane.hidden = false;
      app.dataset.view = 'editor';
      if (focus) (n.title ? bodyEl : titleEl).focus();
    }
    renderList();
  }

  /* ---------- Actions ---------- */
  function newNote() {
    var n = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: '',
      body: '',
      created: Date.now(),
      updated: Date.now()
    };
    notes.push(n);
    save();
    query = '';
    searchEl.value = '';
    openNote(n.id, true);
  }

  function onEdit() {
    var n = byId(currentId);
    if (!n) return;
    n.title = titleEl.value;
    n.body = bodyEl.value;
    n.updated = Date.now();
    updateMeta(n);
    renderList();
    scheduleSave();
  }

  function deleteNote() {
    if (!delBtn.classList.contains('confirm')) {
      delBtn.textContent = 'Confirmer';
      delBtn.classList.add('confirm');
      confirmTimer = setTimeout(resetDeleteButton, 3000);
      return;
    }
    notes = notes.filter(function (n) { return n.id !== currentId; });
    save();
    openNote(null);
  }

  /* ---------- Événements ---------- */
  $('newBtn').addEventListener('click', newNote);
  $('emptyNew').addEventListener('click', newNote);
  delBtn.addEventListener('click', deleteNote);
  titleEl.addEventListener('input', onEdit);
  bodyEl.addEventListener('input', onEdit);

  titleEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); bodyEl.focus(); }
  });

  searchEl.addEventListener('input', function () {
    query = searchEl.value;
    renderList();
  });

  list.addEventListener('click', function (e) {
    var item = e.target.closest('.item');
    if (item) openNote(item.dataset.id, false);
  });

  $('backBtn').addEventListener('click', function () {
    app.dataset.view = 'list';
  });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      newNote();
    }
  });

  window.addEventListener('beforeunload', function () { clearTimeout(saveTimer); save(); });

  /* ---------- Démarrage ---------- */
  applyTheme(getMode());
  load();
  renderList();
  if (notes.length && window.innerWidth > 760) {
    var latest = notes.slice().sort(function (a, b) { return b.updated - a.updated; })[0];
    openNote(latest.id, false);
  }
})();

