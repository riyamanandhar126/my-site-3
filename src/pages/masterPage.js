/**
 * masterPage.js: code for the HEADER that appears on every page.
 * ----------------------------------------------------------------------------
 * In Wix Studio: Code panel (Dev Mode) → Page Code → "Main Pages" →
 * "masterPage.js" (also listed as "Global (masterPage.js)") → paste this file.
 *
 * ELEMENT IDS (all in the site Header)
 *   Search
 *   #siteSearch        Text Input: "Search Continents, Countries or Banknotes"
 *   #searchBox         Container below the search bar (Collapsed on load)
 *   #searchResults     Repeater inside #searchBox
 *   #resultItem        Container inside each repeater item (whole row is clickable)
 *   #resultTitle       Text inside the item: e.g. "Egypt"
 *   #resultSub         Text inside the item: e.g. "Country · Africa"
 *   #searchEmpty       Text inside #searchBox: "No matches" (Collapsed on load)
 *
 *   Continent tabs row
 *   #tabGlobal         Button: Global Edition
 *   #tabAfrica         Button: Africa
 *   #tabAsia           Button: Asia
 *   #tabOceania        Button: Australia/Oceania
 *   #tabEurope         Button: Europe
 *   #tabNorthAmerica   Button: North America
 *   #tabSouthAmerica   Button: South America
 *
 * Logo, top menu and Sign In (Members Login Bar) need no code.
 * ----------------------------------------------------------------------------
 */

import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import {
    COLLECTIONS, PATHS, continentUrl, countryUrl, noteUrl, fetchAll, bySlug,
} from 'public/archive.js';

// Each tab button and the continent slug it opens (slug must match the Continents collection).
const CONTINENT_TABS = [
    { id: '#tabAfrica', slug: 'africa' },
    { id: '#tabAsia', slug: 'asia' },
    { id: '#tabOceania', slug: 'oceania' },
    { id: '#tabEurope', slug: 'europe' },
    { id: '#tabNorthAmerica', slug: 'north-america' },
    { id: '#tabSouthAmerica', slug: 'south-america' },
];
const GLOBAL = 'global';

const TAB_ACTIVE = { backgroundColor: '#D9D9D9', color: '#2A2B29' };
const TAB_IDLE = { backgroundColor: '#FFFFFF', color: '#2A2B29' };

const SEARCH_DELAY_MS = 250;
const MAX_PER_TYPE = 6;

let countriesCache = null;   // slug → country item
let continentsCache = null;  // slug → continent item
let searchTimer = null;
let searchRun = 0;

$w.onReady(function () {
    wireTabs();
    highlightTabForCurrentPage();
    wireSearch();
    // Header stays on screen between pages, so re-highlight after each navigation.
    wixLocationFrontend.onChange(() => highlightTabForCurrentPage());
});

// ---- Continent tabs -----------------------------------------------------------

function wireTabs() {
    $w('#tabGlobal').onClick(() => wixLocationFrontend.to('/'));
    CONTINENT_TABS.forEach(({ id, slug }) => {
        $w(id).onClick(() => wixLocationFrontend.to(continentUrl(slug)));
    });
}

/** Works out which tab to highlight from the URL: /continent/x, /country/y, or home. */
async function highlightTabForCurrentPage() {
    const [section, slug] = wixLocationFrontend.path;
    let active = null;

    if (!section) {
        active = GLOBAL;
    } else if (`/${section}/` === PATHS.continent) {
        active = slug;
    } else if (`/${section}/` === PATHS.country && slug) {
        try {
            const countries = await loadCountries();
            active = countries[slug] ? countries[slug].continent : null;
        } catch (err) {
            active = null; // visitor without permission: just leave tabs plain
        }
    }
    paintTabs(active);
}

function paintTabs(active) {
    const paint = (id, on) => {
        const style = on ? TAB_ACTIVE : TAB_IDLE;
        $w(id).style.backgroundColor = style.backgroundColor;
        $w(id).style.color = style.color;
    };
    paint('#tabGlobal', active === GLOBAL);
    CONTINENT_TABS.forEach(({ id, slug }) => paint(id, slug === active));
}

// ---- Search -------------------------------------------------------------------

function wireSearch() {
    $w('#searchBox').collapse();
    $w('#searchEmpty').collapse();

    $w('#searchResults').onItemReady(($item, item) => {
        $item('#resultTitle').text = item.title;
        $item('#resultSub').text = item.sub;
    });
    // Repeated-item click: event.context.itemId is the clicked result.
    $w('#resultItem').onClick((event) => {
        const item = $w('#searchResults').data.find((r) => r._id === event.context.itemId);
        if (item) goTo(item.url);
    });

    $w('#siteSearch').onInput(() => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(runSearch, SEARCH_DELAY_MS);
    });
    $w('#siteSearch').onKeyPress((event) => {
        if (event.key === 'Enter') {
            const first = ($w('#searchResults').data || [])[0];
            if (first && !$w('#searchBox').collapsed) goTo(first.url);
        }
        if (event.key === 'Escape') closeSearch();
    });
}

async function runSearch() {
    const q = ($w('#siteSearch').value || '').trim();
    if (q.length < 2) { closeSearch(); return; }
    const run = ++searchRun; // ignore answers from older, slower searches

    try {
        const [continents, countries] = await Promise.all([loadContinents(), loadCountries()]);
        const notesQuery = wixData.query(COLLECTIONS.banknotes);
        const notes = await notesQuery.contains('title', q)
            .or(wixData.query(COLLECTIONS.banknotes).contains('country', q))
            .or(wixData.query(COLLECTIONS.banknotes).contains('currency', q))
            .limit(MAX_PER_TYPE)
            .find();
        if (run !== searchRun) return;

        const lower = q.toLowerCase();
        const results = [
            ...Object.values(continents)
                .filter((c) => c.title.toLowerCase().includes(lower))
                .slice(0, MAX_PER_TYPE)
                .map((c) => ({ _id: `ct-${c._id}`, title: c.title, sub: 'Continent', url: continentUrl(c.slug) })),
            ...Object.values(countries)
                .filter((c) => c.title.toLowerCase().includes(lower))
                .slice(0, MAX_PER_TYPE)
                .map((c) => ({
                    _id: `co-${c._id}`,
                    title: c.title,
                    sub: `Country · ${continents[c.continent] ? continents[c.continent].title : ''}`,
                    url: countryUrl(c.slug),
                })),
            ...notes.items.map((n) => ({
                _id: `bn-${n._id}`,
                title: n.title,
                sub: [`${n.denomination || ''} ${n.currency || ''}`.trim(), n.series,
                    countries[n.country] ? countries[n.country].title : n.country].filter(Boolean).join(' · '),
                url: noteUrl(n),
            })),
        ];
        showResults(results, 'No matches');
    } catch (err) {
        console.error('Search failed:', err);
        if (run === searchRun) showResults([], 'Log in to search the archive');
    }
}

function showResults(results, emptyMessage) {
    $w('#searchResults').data = results;
    if (results.length) {
        $w('#searchEmpty').collapse();
        $w('#searchResults').expand();
    } else {
        $w('#searchEmpty').text = emptyMessage;
        $w('#searchEmpty').expand();
        $w('#searchResults').collapse();
    }
    $w('#searchBox').expand();
}

function closeSearch() {
    $w('#searchBox').collapse();
}

function goTo(url) {
    closeSearch();
    $w('#siteSearch').value = '';
    wixLocationFrontend.to(url);
}

// ---- Cached lookups -------------------------------------------------------------

async function loadCountries() {
    if (!countriesCache) countriesCache = bySlug(await fetchAll(COLLECTIONS.countries));
    return countriesCache;
}

async function loadContinents() {
    if (!continentsCache) continentsCache = bySlug(await fetchAll(COLLECTIONS.continents));
    return continentsCache;
}
