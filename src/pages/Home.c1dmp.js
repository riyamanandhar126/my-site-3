/**
 * Home page code: runs the finished template inside ONE Embed HTML element.
 * ----------------------------------------------------------------------------
 * Page: Home (the URL keeps the view, e.g.  /?country=egypt  or  /?continent=africa)
 *
 * ELEMENT ID ON THIS PAGE (the only one)
 *   #archiveFrame   Embed HTML element (Add → Embed & Social → Embed HTML → Code)
 *                   containing wix-embed/archive-embed.html
 *
 * What it does
 *   1. Reads the three CMS collections. Collection permissions apply, so only
 *      logged-in members (or admins) get data.
 *   2. Turns Wix image values into Wix media links the frame can show.
 *   3. Sends everything into the frame; the template draws Home, Continent and
 *      Country views, search, tabs and flip cards.
 *   4. Keeps the page URL in sync, so every view can be bookmarked and shared.
 * ----------------------------------------------------------------------------
 */

import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';
import { authentication } from 'wix-members-frontend';

const FRAME = '#archiveFrame';

// Collection IDs on this site (the names Wix gave them when the CSVs were imported).
const COLLECTIONS = {
    continents: 'Import1', // "Continents"
    countries: 'Import3',  // "Countries"
    banknotes: 'Import4',  // "Banknotes"
};

// URL query keys that describe the current view.
const ROUTE_KEYS = ['continent', 'country', 'view', 'note'];

let payload = null;          // { data } or { error }
let frameWaiting = false;    // the frame said "ready" before the data was loaded
let ignoreUrlChangeUntil = 0;

$w.onReady(function () {
    $w(FRAME).onMessage((event) => handleFrameMessage(event.data || {}));

    loadArchive().then((result) => {
        payload = result;
        if (frameWaiting) sendInit();
    });

    // Browser Back/Forward: show the matching view inside the frame.
    wixLocationFrontend.onChange(() => {
        if (Date.now() < ignoreUrlChangeUntil) return;
        $w(FRAME).postMessage({ type: 'route', query: currentRoute() });
    });

    // After logging in, reload so the private data can be read.
    authentication.onLogin(() => wixLocationFrontend.to(wixLocationFrontend.url));
});

// ---- Messages from the frame ------------------------------------------------

function handleFrameMessage(msg) {
    if (msg.type === 'ready') {
        frameWaiting = true;
        if (payload) sendInit();
    } else if (msg.type === 'navigate') {
        updateUrl(msg.query || {});
        wixWindowFrontend.scrollTo(0, 0);
    } else if (msg.type === 'auth') {
        if (authentication.loggedIn()) {
            authentication.logout();
        } else {
            authentication.promptLogin().catch(() => {});
        }
    }
}

function sendInit() {
    $w(FRAME).postMessage({
        type: 'init',
        data: payload.data,
        error: payload.error,
        query: currentRoute(),
        member: { loggedIn: authentication.loggedIn() },
    });
}

// ---- URL <-> view ---------------------------------------------------------------

function currentRoute() {
    const query = wixLocationFrontend.query || {};
    const route = {};
    ROUTE_KEYS.forEach((key) => { if (query[key]) route[key] = String(query[key]); });
    return route;
}

/** Writes the view into the page URL without reloading (e.g. ?country=egypt). */
function updateUrl(route) {
    ignoreUrlChangeUntil = Date.now() + 800;
    const clean = {};
    ROUTE_KEYS.forEach((key) => { if (route[key]) clean[key] = String(route[key]); });
    const remove = ROUTE_KEYS.filter((key) => !clean[key]);
    if (remove.length) wixLocationFrontend.queryParams.remove(remove);
    if (Object.keys(clean).length) wixLocationFrontend.queryParams.add(clean);
}

// ---- CMS -> template data -------------------------------------------------------

async function fetchAll(collection, sortField) {
    let res = await wixData.query(collection).ascending(sortField).limit(1000).find();
    const items = [...res.items];
    while (res.hasNext()) {
        res = await res.next();
        items.push(...res.items);
    }
    return items;
}

/** wix:image://v1/<file>/<name>#... → https://static.wixstatic.com/media/<file> */
function mediaUrl(value) {
    if (!value || typeof value !== 'string') return '';
    if (value.startsWith('wix:image://')) {
        const file = value.split('/')[3];
        return file ? `https://static.wixstatic.com/media/${file}` : '';
    }
    if (value.startsWith('https://static.wixstatic.com/')) return value;
    return '';
}

const text = (value) => (value === undefined || value === null ? '' : String(value));

async function loadArchive() {
    try {
        const [continents, countries, banknotes] = await Promise.all([
            fetchAll(COLLECTIONS.continents, 'sortOrder'),
            fetchAll(COLLECTIONS.countries, 'title'),
            fetchAll(COLLECTIONS.banknotes, 'sortOrder'),
        ]);

        return {
            data: {
                continents: continents.map((c) => ({
                    slug: text(c.slug),
                    name: text(c.title),
                    intro: text(c.intro),
                    image: mediaUrl(c.image),
                    mapImage: mediaUrl(c.mapImage),
                })),
                countries: countries.map((c) => ({
                    slug: text(c.slug),
                    name: text(c.title),
                    continent: text(c.continent),
                    currency: text(c.currency),
                    authority: text(c.authority),
                    image: mediaUrl(c.image),
                    sources: text(c.sources),
                })),
                banknotes: banknotes.map((n) => ({
                    id: text(n.noteId || n._id),
                    country: text(n.country),
                    denomination: text(n.denomination),
                    currency: text(n.currency),
                    building: text(n.title) || 'Untitled building',
                    series: text(n.series),
                    city: text(n.city),
                    architect: text(n.architect),
                    yearBuilt: text(n.yearBuilt),
                    yearIssued: text(n.yearIssued),
                    added: n.addedDate ? new Date(n.addedDate).toISOString().slice(0, 10) : '',
                    image: mediaUrl(n.image),
                    info: text(n.info),
                })),
                featured: banknotes
                    .filter((n) => n.featured)
                    .sort((a, b) => (Number(a.featuredOrder) || 99) - (Number(b.featuredOrder) || 99))
                    .map((n) => text(n.noteId || n._id)),
            },
        };
    } catch (err) {
        console.error('Could not load the archive:', err);
        return { error: 'Please log in to view the archive.' };
    }
}
