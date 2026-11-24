/* PAUSA — mini-runtime em JavaScript puro (sem React, sem servidor, sem build).
   Lê <template id="dc-template"> + <script type="text/x-dc"> e renderiza em #dc-root. */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var EV = { onclick: 'click', onsubmit: 'submit', oninput: 'input', onchange: 'change', onkeydown: 'keydown' };

  function lookup(expr, scope) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    var neg = false;
    if (expr.charAt(0) === '!') { neg = true; expr = expr.slice(1).trim(); }
    var parts = expr.split('.'), v = scope[parts[0]];
    for (var i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
    return neg ? !v : v;
  }
  var WHOLE = /^\s*\{\{([^}]*)\}\}\s*$/;
  function interp(str, scope) {
    return str.replace(/\{\{([^}]*)\}\}/g, function (_, e) { var v = lookup(e, scope); return v == null ? '' : String(v); });
  }

  function renderNode(node, scope, out) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'sc-if') {
      var m = WHOLE.exec(node.getAttribute('value') || '');
      if (m && lookup(m[1], scope)) renderKids(node, scope, out);
      return;
    }
    if (tag === 'sc-for') {
      var lm = WHOLE.exec(node.getAttribute('list') || ''), as = node.getAttribute('as') || 'item';
      var list = (lm && lookup(lm[1], scope)) || [];
      for (var i = 0; i < list.length; i++) {
        var s = Object.create(scope); s[as] = list[i]; s.index = i;
        renderKids(node, s, out);
      }
      return;
    }
    var el = node.namespaceURI === SVGNS ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
    el.__h = {};
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a], name = at.name, val = at.value;
      if (name.indexOf('hint-') === 0) continue;
      var ev = EV[name.toLowerCase()];
      if (ev) { var hm = WHOLE.exec(val); var fn = hm && lookup(hm[1], scope); if (typeof fn === 'function') el.__h[ev] = fn; continue; }
      el.setAttribute(name, interp(val, scope));
    }
    renderKids(node, scope, el);
    out.appendChild(el);
  }
  function renderKids(node, scope, out) {
    for (var c = node.firstChild; c; c = c.nextSibling) renderNode(c, scope, out);
  }

  function sync(oldEl, newEl) {
    // atributos
    var i, at;
    for (i = oldEl.attributes.length - 1; i >= 0; i--) {
      at = oldEl.attributes[i]; if (!newEl.hasAttribute(at.name)) oldEl.removeAttribute(at.name);
    }
    for (i = 0; i < newEl.attributes.length; i++) {
      at = newEl.attributes[i]; if (oldEl.getAttribute(at.name) !== at.value) oldEl.setAttribute(at.name, at.value);
    }
    // eventos
    oldEl.__h = newEl.__h || {};
    oldEl.__l = oldEl.__l || {};
    Object.keys(oldEl.__h).forEach(function (ev) {
      if (oldEl.__l[ev]) return;
      oldEl.__l[ev] = true;
      oldEl.addEventListener(ev, function (e) {
        if (ev === 'submit') e.preventDefault();
        var f = oldEl.__h[ev]; if (f) f(e);
      });
    });
    morphKids(oldEl, newEl);
  }
  function adopt(el) { // liga eventos em nós novos inseridos
    var h = el.__h || {}; el.__l = {};
    Object.keys(h).forEach(function (ev) {
      el.__l[ev] = true;
      el.addEventListener(ev, function (e) { if (ev === 'submit') e.preventDefault(); var f = el.__h[ev]; if (f) f(e); });
    });
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) adopt(c);
  }
  function morphKids(oldP, newP) {
    var o = oldP.firstChild, n = newP.firstChild;
    while (n) {
      var nextN = n.nextSibling;
      if (!o) { oldP.appendChild(n); if (n.nodeType === 1) adopt(n); }
      else if (o.nodeType === 3 && n.nodeType === 3) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; o = o.nextSibling; }
      else if (o.nodeType === 1 && n.nodeType === 1 && o.nodeName === n.nodeName && o.namespaceURI === n.namespaceURI) { sync(o, n); o = o.nextSibling; }
      else { oldP.replaceChild(n, o); if (n.nodeType === 1) adopt(n); o = n.nextSibling; }
      n = nextN;
    }
    while (o) { var nx = o.nextSibling; oldP.removeChild(o); o = nx; }
  }

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (p) {
    var patch = typeof p === 'function' ? p(this.state) : p;
    this.state = Object.assign({}, this.state, patch);
    this.__schedule && this.__schedule();
  };

  function start() {
    var tpl = document.getElementById('dc-template'), root = document.getElementById('dc-root');
    var sc = document.querySelector('script[type="text/x-dc"]');
    if (!tpl || !root) return;
    var Comp;
    if (sc) {
      try { Comp = new Function('DCLogic', sc.textContent + '\n;return typeof Component!=="undefined"?Component:null;')(DCLogic); }
      catch (e) { console.error('PAUSA: erro no script da página', e); }
    }
    var inst = Comp ? new Comp({}) : new DCLogic({});
    if (!inst.renderVals) inst.renderVals = function () { return {}; };
    var queued = false;
    function render() {
      queued = false;
      var out = document.createElement('div');
      renderKids(tpl.content, inst.renderVals(), out);
      if (!root.__init) { root.__init = true; while (out.firstChild) { root.appendChild(out.firstChild); } adopt(root); }
      else morphKids(root, out);
    }
    inst.__schedule = function () { if (!queued) { queued = true; Promise.resolve().then(render); } };
    render();
    if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
