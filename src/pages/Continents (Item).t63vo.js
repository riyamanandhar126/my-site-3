/**
 * continent-item.js: code for the dynamic page "Continents (Item)".
 * ----------------------------------------------------------------------------
 * URL: /continents/{slug}   e.g. /continents/africa
 * In Wix Studio: open the "Continents (Item)" page → Code panel → Page tab → paste.
 *
 * ELEMENT IDS ON THIS PAGE
 *   #dynamicDataset      Dataset Wix adds automatically to every dynamic page
 *   #continentEyebrow    Text: "CONTINENT" (static, no code needed; listed for completeness)
 *   #continentTitle      Text: "Africa"
 *   #continentIntro      Text: short introduction
 *   #continentMap        Image: map of the continent
 *   #mapLabel            Text on the map: "Map of Africa"
 *
 *   "Choose a country" grid
 *   #countryCountText    Text: "12 countries"
 *   #countryRepeater     Repeater: 3 / 2 / 1 columns
 *   #countryCard         Container inside each item (clickable)
 *   #countryImage        Image inside the item
 *   #countryName         Text inside the item: "Egypt"
 *   #countryNoteCount    Text inside the item: "9 Banknotes"
 *   #showMoreCountries   Button: "Show more countries"
 *   #noCountries         Text: "No countries yet" (Collapsed on load)
 * ----------------------------------------------------------------------------
 */

import wixLocationFrontend from 'wix-location-frontend';
import {
    COLLECTIONS, countryUrl, plural, txt, setImage, fetchAll, countBy,
} from 'public/archive.js';

const PAGE_SIZE = 9; // countries shown before "Show more countries"

let countries = [];
let shown = 0;

$w.onReady(async function () {
    $w('#noCountries').collapse();
    $w('#showMoreCountries').collapse();

    await $w('#dynamicDataset').onReadyAsync();
    const continent = $w('#dynamicDataset').getCurrentItem();
    if (!continent) return;

    // Header block
    $w('#continentTitle').text = txt(continent.title);
    $w('#continentIntro').text = txt(continent.intro, ' ');
    setImage($w('#continentMap'), continent.mapImage, `Map of ${continent.title}`);
    $w('#mapLabel').text = `Map of ${continent.title}`;

    // Countries in this continent, A–Z, with their banknote counts
    try {
        const [list, noteCounts] = await Promise.all([
            fetchAll(COLLECTIONS.countries, (q) => q.eq('continent', continent.slug).ascending('title')),
            countBy(COLLECTIONS.banknotes, 'country'),
        ]);
        countries = list.map((c) => ({ ...c, noteCount: noteCounts[c.slug] || 0 }));
    } catch (err) {
        console.error('Could not load countries:', err);
    }

    $w('#countryCountText').text = plural(countries.length, 'country', 'countries');
    if (!countries.length) {
        $w('#countryRepeater').collapse();
        $w('#noCountries').expand();
        return;
    }

    $w('#countryRepeater').onItemReady(($item, c) => {
        setImage($item('#countryImage'), c.image, '');
        $item('#countryName').text = c.title;
        $item('#countryNoteCount').text = plural(c.noteCount, 'Banknote');
    });
    $w('#countryCard').onClick((event) => {
        const c = countries.find((x) => x._id === event.context.itemId);
        if (c) wixLocationFrontend.to(countryUrl(c.slug));
    });
    $w('#showMoreCountries').onClick(showMore);
    showMore();
});

/** Adds the next 9 countries to the grid. */
function showMore() {
    shown = Math.min(countries.length, shown + PAGE_SIZE);
    $w('#countryRepeater').data = countries.slice(0, shown);
    if (shown < countries.length) {
        $w('#showMoreCountries').expand();
    } else {
        $w('#showMoreCountries').collapse();
    }
}
