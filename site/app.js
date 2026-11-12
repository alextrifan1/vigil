'use strict';

/*
 * Vigil archive page: loads archive.json, groups the posts by year and
 * renders them, with a board filter kept in the URL (#licenta, #master).
 *
 * All post text is inserted with textContent, never innerHTML, so a title
 * containing HTML is shown as text and never executed.
 */

const TIMEZONE = 'Europe/Bucharest';
const NEW_FOR_DAYS = 7;
const BOARD_FILTERS = {
    all: null,
    licenta: 'Licență',
    master: 'Master'
};

const archiveEl = document.getElementById('archive');
const summaryEl = document.getElementById('summary');
const updatedEl = document.getElementById('updated');
const filterButtons = document.querySelectorAll('[data-board]');

let archive = null;

// ---------- Small DOM helper ----------

/** Creates an element with optional class and text. */
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// ---------- Dates ----------

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});

/**
 * Splits a post's `published` value into what the page shows.
 * It is either a full timestamp from the feed ("2026-07-28T08:26:12.000Z"),
 * a plain date from the HTML fallback ("2025-06-15") or null.
 */
function dateInfo(published) {
    if (!published) return null;

    const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(published);
    if (plain) {
        const [, year, month, day] = plain;
        return { year, day: `${day}.${month}`, time: Date.UTC(year, month - 1, day) };
    }

    const date = new Date(published);
    if (Number.isNaN(date.getTime())) return null;

    const parts = {};
    for (const { type, value } of partsFormatter.formatToParts(date)) parts[type] = value;
    return { year: parts.year, day: `${parts.day}.${parts.month}`, time: date.getTime() };
}

function isNew(info) {
    return info !== null && Date.now() - info.time < NEW_FOR_DAYS * 24 * 60 * 60 * 1000;
}

// ---------- Filter ----------

function currentBoard() {
    const key = location.hash.slice(1);
    return key in BOARD_FILTERS ? key : 'all';
}

function updateFilterButtons(board) {
    for (const button of filterButtons) {
        const active = button.dataset.board === board;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('dl-btn-raised', active);
        button.classList.toggle('dl-btn-ghost', !active);
    }
}

for (const button of filterButtons) {
    button.addEventListener('click', () => {
        const board = button.dataset.board;
        history.replaceState(null, '', board === 'all' ? location.pathname : `#${board}`);
        render();
    });
}

window.addEventListener('hashchange', render);

// ---------- Rendering ----------

/** Groups posts by year, keeping the archive's newest-first order. Undated posts go last. */
function groupByYear(posts) {
    const groups = new Map();
    for (const post of posts) {
        const info = dateInfo(post.published);
        const year = info ? info.year : 'Undated';
        if (!groups.has(year)) groups.set(year, []);
        groups.get(year).push({ post, info });
    }

    const undated = groups.get('Undated');
    groups.delete('Undated');
    if (undated) groups.set('Undated', undated);
    return groups;
}

function renderPost({ post, info }) {
    const row = el('a', 'vg-row');
    row.href = post.url;
    row.lang = 'ro';

    const dots = el('span', 'dl-dots');
    dots.setAttribute('role', 'img');
    dots.setAttribute('aria-label', post.boards.length > 1 ? 'Posted on both boards' : 'Posted on one board');
    for (let i = 0; i < post.boards.length; i++) dots.append(el('span', 'dl-dot'));

    const body = el('span', 'vg-row-body');

    const head = el('span', 'vg-row-head');
    head.append(
        el('span', '', info ? info.day : '—'),
        el('span', 'vg-sep', '//'),
        el('span', '', post.boards.join(' + '))
    );
    if (isNew(info)) {
        const badge = el('span', 'vg-new');
        badge.append(el('span', 'dl-dot dl-dot-open'), 'New');
        head.append(badge);
    }

    body.append(head, el('span', 'vg-title', post.title));
    if (post.excerpt) body.append(el('span', 'vg-excerpt', post.excerpt));

    row.append(dots, body);
    return row;
}

function renderYear(year, items) {
    const section = el('section', 'vg-year');
    section.setAttribute('aria-label', year);

    const head = el('div', 'vg-year-head');
    head.append(
        el('h2', year === 'Undated' ? 'vg-undated' : '', year),
        el('span', 'vg-label', items.length === 1 ? '1 offer' : `${items.length} offers`)
    );

    const list = el('div', 'vg-year-posts');
    for (const item of items) list.append(renderPost(item));

    section.append(head, list);
    return section;
}

function showStatus(message) {
    archiveEl.replaceChildren(el('p', 'vg-status', message));
}

function render() {
    const board = currentBoard();
    updateFilterButtons(board);
    if (!archive) return;

    const boardName = BOARD_FILTERS[board];
    const posts = boardName
        ? archive.posts.filter((post) => post.boards.includes(boardName))
        : archive.posts;

    if (posts.length === 0) {
        showStatus('No offers on this board yet.');
        return;
    }

    const sections = [];
    for (const [year, items] of groupByYear(posts)) sections.push(renderYear(year, items));
    archiveEl.replaceChildren(...sections);
}

function renderMeta() {
    summaryEl.textContent =
        `${archive.count} offers from the Licență and Master boards, collected by Vigil and updated every hour.`;

    const generated = new Date(archive.generatedAt);
    if (!Number.isNaN(generated.getTime())) {
        updatedEl.textContent = `updated ${generated.toLocaleString('ro-RO', {
            timeZone: TIMEZONE,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    }
}

// ---------- Start ----------

async function load() {
    try {
        const response = await fetch('archive.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        archive = await response.json();
        renderMeta();
        render();
    } catch (err) {
        console.error('[Vigil] Could not load archive.json:', err);
        showStatus('Could not load the archive. Please try again later.');
    }
}

updateFilterButtons(currentBoard());
load();