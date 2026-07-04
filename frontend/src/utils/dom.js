/**
 * DOM utility helpers — pure functions, no side effects.
 * All manipulation goes through these to keep other files clean.
 */

/** @param {string} sel @param {Element|Document} ctx */
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/**
 * Create an element with optional props and children.
 * @param {string} tag
 * @param {object} [props]  - attributes / classList / dataset / textContent
 * @param {...(Node|string)} children
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(props)) {
    if (key === 'class' || key === 'className') {
      if (Array.isArray(val)) node.classList.add(...val.filter(Boolean));
      else node.className = val;
    } else if (key === 'dataset') {
      Object.assign(node.dataset, val);
    } else if (key === 'style') {
      Object.assign(node.style, val);
    } else if (key.startsWith('on') && typeof val === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (key === 'html') {
      node.innerHTML = val;
    } else {
      node.setAttribute(key, val);
    }
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** Append multiple children to a parent. Returns parent. */
export function append(parent, ...children) {
  const frag = document.createDocumentFragment();
  for (const c of children) {
    if (c == null) continue;
    frag.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  parent.appendChild(frag);
  return parent;
}

/** Clear all children of an element. */
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Show / hide elements via display. */
export const show = (el) => { el.style.display = ''; };
export const hide = (el) => { el.style.display = 'none'; };

/** Toggle a CSS class by condition. */
export function toggleClass(el, cls, force) {
  if (force === undefined) el.classList.toggle(cls);
  else force ? el.classList.add(cls) : el.classList.remove(cls);
}

/** Escape HTML for safe innerHTML insertion. */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Simple event bus. */
class EventBus {
  constructor() { this._map = new Map(); }
  on(event, fn)  { (this._map.get(event) || this._map.set(event, new Set()).get(event)).add(fn); }
  off(event, fn) { this._map.get(event)?.delete(fn); }
  emit(event, data) { this._map.get(event)?.forEach(fn => fn(data)); }
}

export const bus = new EventBus();
