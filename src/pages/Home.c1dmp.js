/**
 * home.js: code for the HOME page (Global Edition).
 * ----------------------------------------------------------------------------
 * In Wix Studio: open the Home page → Code panel → Page tab ("Home.js") → paste.
 *
 * ELEMENT IDS ON THIS PAGE
 *   Featured mosaic (1 large tile left, 2 stacked right)
 *   #featuredTile1, #featuredTile2, #featuredTile3       Containers (clickable)
 *   #featuredImage1, #featuredImage2, #featuredImage3    Images inside the tiles
 *   #featuredLabel1, #featuredLabel2, #featuredLabel3    Texts: "Featured : Architecture · …"
 *
 *   "Choose a continent" carousel
 *   #continentRepeater   Repeater (shows 3 / 2 / 1 cards at a time)
 *   #continentCard       Container inside each item (clickable)
 *   #continentImage      Image inside the item
 *   #continentName       Text inside the item: "Africa"
 *   #continentCount      Text inside the item: "12 countries"
 *   #continentPrev       Button: left arrow
 *   #continentNext       Button: right arrow
 *
 *   "Recently Added"
 *   #recentRepeater      Repeater (3 items)
 *   #recentCard          Container inside each item (clickable)
 *   #recentImage         Image inside the item
 *   #recentMeta          Text inside the item: "Egypt · Africa"
 *   #recentTitle         Text inside the item: building name
 *   #recentSub           Text inside the item: "50 Egyptian pound, Series A"
 *
 *   #homeMessage         Text shown only if the archive can't be loaded (Collapsed on load)
 * ----------------------------------------------------------------------------
 */

import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';
import {
    COLLECTIONS, continentUrl, noteUrl, plural, txt, setImage, fetchAll, countBy, bySlug,
} from 'public/archive.js';

const FEATURED_TILES = 3;
const RECENT_COUNT = 3;

let continents = [];
let carouselStart = 0;

$w.onReady(async function () {
    $w('#homeMessage').collapse();
    try {
        const [continentList, countries, countryCounts] = await Promise.all([
            fetchAll(COLLECTIONS.continents, (q) => q.ascending('sortOrder')),
            fetchAll(COLLECTIONS.countries),
            countBy(COLLECTIONS.countries, 'continent'),
        ]);
        continents = continentList.map((c) => ({ ...c, countryCount: countryCounts[c.slug] || 0 }));
        const countryMap = bySlug(countries);
        const continentMap = bySlug(continentList);

        await Promise.all([
            loadFeatured(countryMap),
            loadRecent(countryMap, continentMap),
        ]);
        setupCarousel();
    } catch (err) {
        console.error('Could not load the archive:', err);
        $w('#homeMessage').text = 'Please log in to view the archive.';
        $w('#homeMessage').expand();
    }
});

// ---- Featured mosaic ----------------------------------------------------------

/** Fills the 3 tiles from Banknotes where "featured" is ticked, in featuredOrder. */
async function loadFeatured(countryMap) {
    const res = await wixData.query(COLLECTIONS.banknotes)
        .eq('featured', true)
        .ascending('featuredOrder')
        .limit(FEATURED_TILES)
        .find();

    for (let i = 1; i <= FEATURED_TILES; i++) {
        const note = res.items[i - 1];
        const tile = $w(`#featuredTile${i}`);
        if (!note) { tile.collapse(); continue; }
        const country = countryMap[note.country];
        setImage($w(`#featuredImage${i}`), note.image, `${note.title} on the ${note.denomination} ${note.currency} banknote`);
        $w(`#featuredLabel${i}`).text = `Featured : Architecture · ${note.title}${country ? `, ${country.title}` : ''}`;
        tile.onClick(() => wixLocationFrontend.to(noteUrl(note)));
    }
}

// ---- Continent carousel -------------------------------------------------------

/** Cards per view: 3 on desktop, 2 on tablet, 1 on mobile. */
function cardsPerView() {
    const device = wixWindowFrontend.formFactor;
    if (device === 'Mobile') return 1;
    if (device === 'Tablet') return 2;
    return 3;
}

function setupCarousel() {
    $w('#continentRepeater').onItemReady(($item, c) => {
        setImage($item('#continentImage'), c.image, '');
        $item('#continentName').text = c.title;
        $item('#continentCount').text = plural(c.countryCount, 'country', 'countries');
    });
    $w('#continentCard').onClick((event) => {
        const c = continents.find((x) => x._id === event.context.itemId);
        if (c) wixLocationFrontend.to(continentUrl(c.slug));
    });
    $w('#continentPrev').onClick(() => moveCarousel(-1));
    $w('#continentNext').onClick(() => moveCarousel(1));
    renderCarousel();
}

function moveCarousel(direction) {
    const perView = cardsPerView();
    const maxStart = Math.max(0, continents.length - perView);
    carouselStart = Math.min(maxStart, Math.max(0, carouselStart + direction));
    renderCarousel();
}

function renderCarousel() {
    const perView = cardsPerView();
    $w('#continentRepeater').data = continents.slice(carouselStart, carouselStart + perView);
    toggle($w('#continentPrev'), carouselStart > 0);
    toggle($w('#continentNext'), carouselStart + perView < continents.length);
}

const toggle = (button, enabled) => (enabled ? button.enable() : button.disable());

// ---- Recently added -------------------------------------------------------------

async function loadRecent(countryMap, continentMap) {
    const res = await wixData.query(COLLECTIONS.banknotes)
        .descending('addedDate')
        .limit(RECENT_COUNT)
        .find();

    $w('#recentRepeater').onItemReady(($item, note) => {
        const country = countryMap[note.country];
        const continent = country ? continentMap[country.continent] : null;
        setImage($item('#recentImage'), note.image, `${note.title} on the ${note.denomination} ${note.currency} banknote`);
        $item('#recentMeta').text = [country && country.title, continent && continent.title].filter(Boolean).join('  ·  ') || ' ';
        $item('#recentTitle').text = txt(note.title, 'Untitled building');
        $item('#recentSub').text = [`${note.denomination || ''} ${note.currency || ''}`.trim(), note.series].filter(Boolean).join(', ') || ' ';
    });
    $w('#recentCard').onClick((event) => {
        const note = $w('#recentRepeater').data.find((n) => n._id === event.context.itemId);
        if (note) wixLocationFrontend.to(noteUrl(note));
    });
    $w('#recentRepeater').data = res.items;
}
