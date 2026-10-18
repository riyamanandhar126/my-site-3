/**
 * public/archive.js: shared settings and helpers used by every page.
 * ----------------------------------------------------------------------------
 * In Wix Studio: Code panel (Dev Mode) → "Public & Backend" → Public → "+"
 * → "New .js file" → name it  archive.js  → paste this whole file.
 * Pages import from it with:  import { ... } from 'public/archive.js';
 *
 * ELEMENT IDS USED HERE (inside the banknote card on the Country page,
 * all inside the #noteRepeater item; see velo/country-item.js)
 *   #noteStates          Multi-State Box with two states:
 *                          state ID "noteFront"  and  state ID "noteBack"
 *   Front state:
 *   #frontImage          Image: banknote picture
 *   #frontDenomination   Text: "50"
 *   #frontCurrency       Text: "Egyptian pound"
 *   #frontBuilding       Text: building name
 *   #frontSeries         Text: "Series A"
 *   #frontCity           Text: "City"
 *   Back state:
 *   #backEyebrow         Text: "50 EGYPTIAN POUND · SERIES A"
 *   #backTitle           Text: building name
 *   #backLocation        Text: "City, Egypt"
 *   #backArchitect       Text: architect
 *   #backBuilt           Text: year built
 *   #backIssued          Text: year the note was issued
 *   #backInfo            Text: the research text (the "info" field)
 * ----------------------------------------------------------------------------
 */

import wixData from 'wix-data';
import wixAnimationsFrontend from 'wix-animations-frontend';

// ---- Names that must match the CMS and your page URLs ----------------------

// Collection IDs on this site (Wix named them on import; display names in brackets).
export const COLLECTIONS = {
    continents: 'Import1',  // "Continents"
    countries: 'Import3',   // "Countries"
    banknotes: 'Import4',   // "Banknotes"
};

// Dynamic page URL prefixes (set in BUILD-GUIDE step 5).
export const PATHS = {
    continent: '/continents/',
    country: '/countries/',
};

// Multi-State Box state IDs for the flip card.
export const NOTE_FRONT = 'noteFront';
export const NOTE_BACK = 'noteBack';

// ---- Small helpers ----------------------------------------------------------

export const continentUrl = (slug) => `${PATHS.continent}${slug}`;
export const countryUrl = (slug) => `${PATHS.country}${slug}`;
/** Country page with this banknote card opened (flipped) on arrival. */
export const noteUrl = (note) => `${PATHS.country}${note.country}?note=${encodeURIComponent(note.noteId)}`;

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Text for a Text element; never empty (Wix text boxes collapse oddly when empty). */
export const txt = (value, fallback = '—') =>
    (value === undefined || value === null || value === '' ? fallback : String(value));

/** Sets an Image element's picture and alt text, keeping the editor placeholder if src is empty. */
export function setImage(el, src, alt) {
    if (src) el.src = src;
    if (alt) el.alt = alt;
}

/** Reads every item of a collection (pages through results past 1000). */
export async function fetchAll(collection, build = (q) => q) {
    let res = await build(wixData.query(collection)).limit(1000).find();
    const items = [...res.items];
    while (res.hasNext()) {
        res = await res.next();
        items.push(...res.items);
    }
    return items;
}

/** Counts items per value of a field, e.g. countBy('Banknotes', 'country') → { egypt: 9, ... }. */
export async function countBy(collection, field) {
    const res = await wixData.aggregate(collection).group(field).count().limit(1000).run();
    const counts = {};
    res.items.forEach((group) => {
        const key = group[field] !== undefined ? group[field] : group._id;
        counts[key] = group.count;
    });
    return counts;
}

/** Map of slug → item for a list of CMS items. */
export const bySlug = (items) => Object.fromEntries(items.map((i) => [i.slug, i]));

// ---- Banknote flip card -----------------------------------------------------

/** Fills both sides of one banknote card. */
export function fillNoteCard($item, note, countryName) {
    setImage($item('#frontImage'), note.image,
        `${txt(note.denomination, '')} ${txt(note.currency, '')} banknote showing ${txt(note.title, 'a building')}`);
    $item('#frontDenomination').text = txt(note.denomination);
    $item('#frontCurrency').text = txt(note.currency);
    $item('#frontBuilding').text = txt(note.title, 'Untitled building');
    $item('#frontSeries').text = txt(note.series);
    $item('#frontCity').text = txt(note.city);

    $item('#backEyebrow').text = [
        [note.denomination, note.currency].filter(Boolean).join(' '),
        note.series,
    ].filter(Boolean).join(' · ').toUpperCase() || ' ';
    $item('#backTitle').text = txt(note.title, 'Untitled building');
    $item('#backLocation').text = txt([note.city, countryName].filter(Boolean).join(', '));
    $item('#backArchitect').text = txt(note.architect);
    $item('#backBuilt').text = txt(note.yearBuilt);
    $item('#backIssued').text = txt(note.yearIssued);
    $item('#backInfo').text = txt(note.info, 'No research notes yet.');
}

const flipping = new Set(); // item IDs mid-animation (stops double clicks)

/**
 * Flips a card: squeezes it to zero width, swaps the Multi-State Box state,
 * then stretches it back, which looks like a card turning over.
 */
export async function flipCard($item, itemId, toBack) {
    const box = $item('#noteStates');
    const target = toBack ? NOTE_BACK : NOTE_FRONT;
    if (flipping.has(itemId) || (box.currentState && box.currentState.id === target)) return;

    flipping.add(itemId);
    try {
        await animate(box, { scaleX: 0, duration: 160, easing: 'easeInSine' });
        await box.changeState(target);
        await animate(box, { scaleX: 1, duration: 200, easing: 'easeOutSine' });
    } catch (err) {
        console.error('Flip animation failed; switching without animation.', err);
        await box.changeState(target);
        await animate(box, { scaleX: 1, duration: 0 }).catch(() => {});
    } finally {
        flipping.delete(itemId);
    }
}

/** Shows the front instantly (used after filtering). */
export function showFront($item) {
    const box = $item('#noteStates');
    if (box.currentState && box.currentState.id !== NOTE_FRONT) box.changeState(NOTE_FRONT);
}

function animate(element, props) {
    return new Promise((resolve) => {
        const timeline = wixAnimationsFrontend.timeline();
        timeline.add(element, props);
        timeline.onComplete(() => resolve());
        timeline.play();
    });
}
