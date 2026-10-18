/**
 * country-item.js: code for the dynamic page "Countries (Item)".
 * ----------------------------------------------------------------------------
 * URL: /countries/{slug}             e.g. /countries/egypt
 *      /countries/{slug}?note={noteId} opens with that banknote card flipped
 * In Wix Studio: open the "Countries (Item)" page → Code panel → Page tab → paste.
 *
 * ELEMENT IDS ON THIS PAGE
 *   #dynamicDataset      Dataset Wix adds automatically to every dynamic page
 *
 *   Country header
 *   #countryThumb        Image: small picture left of the name
 *   #countryContinent    Text: "Africa" (clickable, goes to the continent page)
 *   #countryTitle        Text: "Egypt"
 *   #statCurrency        Text: currency name
 *   #statAuthority       Text: issuing authority
 *   #statNotes           Text: number of banknotes researched
 *   #statBuildings       Text: number of different buildings
 *
 *   Tabs (Buttons) and their panels (Containers stacked under the tabs)
 *   #tabBanknotes   → #panelBanknotes
 *   #tabBuildings   → #panelBuildings
 *   #tabTimeline    → #panelTimeline
 *   #tabSources     → #panelSources
 *   #seriesDropdown      Dropdown: "All" + each series
 *
 *   Inside #panelBanknotes: the flip cards
 *   #noteRepeater        Repeater: 3 / 2 / 1 columns
 *   #noteStates          Multi-State Box in each item, states "noteFront" and "noteBack"
 *   #frontBox            Container filling the front state (clickable)
 *   #frontImage, #frontDenomination, #frontCurrency, #frontBuilding,
 *   #frontSeries, #frontCity, #frontRead      (front state elements)
 *   #backEyebrow, #backTitle, #backLocation, #backArchitect, #backBuilt,
 *   #backIssued, #backInfo, #flipBackButton   (back state elements)
 *   #noNotes             Text: "No banknotes yet" (Collapsed on load)
 *
 *   Inside #panelBuildings
 *   #buildingRepeater    Repeater (list)
 *   #buildingImage, #buildingName, #buildingMeta, #buildingAppears, #buildingRead
 *
 *   Inside #panelTimeline
 *   #timelineRepeater    Repeater (list)
 *   #timelineYear, #timelineTitle, #timelineSub, #timelineRead
 *
 *   Inside #panelSources
 *   #sourcesText         Text: filled from the country's "sources" rich-text field
 * ----------------------------------------------------------------------------
 */

import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import {
    COLLECTIONS, continentUrl, txt, setImage, fetchAll,
    fillNoteCard, flipCard, showFront,
} from 'public/archive.js';

const TABS = [
    { id: 'banknotes', button: '#tabBanknotes', panel: '#panelBanknotes' },
    { id: 'buildings', button: '#tabBuildings', panel: '#panelBuildings' },
    { id: 'timeline', button: '#tabTimeline', panel: '#panelTimeline' },
    { id: 'sources', button: '#tabSources', panel: '#panelSources' },
];
const TAB_ACTIVE = { color: '#2A2B29', backgroundColor: '#F2F1EB' };
const TAB_IDLE = { color: '#8B8A85', backgroundColor: '#FFFFFF' };
const ALL_SERIES = 'all';

let country = null;
let notes = [];          // all banknotes of this country
let currentSeries = ALL_SERIES;

$w.onReady(async function () {
    $w('#noNotes').collapse();
    wireCards();
    wireTabs();

    await $w('#dynamicDataset').onReadyAsync();
    country = $w('#dynamicDataset').getCurrentItem();
    if (!country) return;

    await fillHeader();

    try {
        notes = await fetchAll(COLLECTIONS.banknotes, (q) => q.eq('country', country.slug).ascending('sortOrder'));
    } catch (err) {
        console.error('Could not load banknotes:', err);
        notes = [];
    }

    const buildings = new Set(notes.map((n) => n.title));
    $w('#statNotes').text = String(notes.length);
    $w('#statBuildings').text = String(buildings.size);
    $w('#sourcesText').html = country.sources || '<p>No sources listed yet.</p>';

    setupSeriesDropdown();
    selectTab('banknotes');
    renderAll();

    // ?note=egypt-50 → open that card
    const noteId = wixLocationFrontend.query.note;
    if (noteId) {
        const note = notes.find((n) => n.noteId === noteId);
        if (note) openNote(note._id);
    }
});

// ---- Header ---------------------------------------------------------------------

async function fillHeader() {
    $w('#countryTitle').text = txt(country.title);
    setImage($w('#countryThumb'), country.image, '');
    $w('#statCurrency').text = txt(country.currency);
    $w('#statAuthority').text = txt(country.authority);

    $w('#countryContinent').text = ' ';
    try {
        const res = await wixData.query(COLLECTIONS.continents).eq('slug', country.continent).limit(1).find();
        const continent = res.items[0];
        $w('#countryContinent').text = continent ? continent.title : txt(country.continent);
    } catch (err) {
        $w('#countryContinent').text = txt(country.continent);
    }
    $w('#countryContinent').onClick(() => wixLocationFrontend.to(continentUrl(country.continent)));
}

// ---- Tabs + series filter -------------------------------------------------------

function wireTabs() {
    TABS.forEach((tab) => $w(tab.button).onClick(() => selectTab(tab.id)));
}

function selectTab(id) {
    TABS.forEach((tab) => {
        const on = tab.id === id;
        const style = on ? TAB_ACTIVE : TAB_IDLE;
        $w(tab.button).style.color = style.color;
        $w(tab.button).style.backgroundColor = style.backgroundColor;
        if (on) $w(tab.panel).expand(); else $w(tab.panel).collapse();
    });
}

function setupSeriesDropdown() {
    const series = [...new Set(notes.map((n) => n.series).filter(Boolean))].sort();
    $w('#seriesDropdown').options = [
        { label: 'All', value: ALL_SERIES },
        ...series.map((s) => ({ label: s, value: s })),
    ];
    $w('#seriesDropdown').value = ALL_SERIES;
    $w('#seriesDropdown').onChange((event) => {
        currentSeries = event.target.value || ALL_SERIES;
        renderAll();
    });
}

const visibleNotes = () =>
    notes.filter((n) => currentSeries === ALL_SERIES || n.series === currentSeries);

function renderAll() {
    const list = visibleNotes();
    renderBanknotes(list);
    renderBuildings(list);
    renderTimeline(list);
}

// ---- Banknotes tab: flip cards ----------------------------------------------------

function wireCards() {
    $w('#noteRepeater').onItemReady(($item, note) => {
        fillNoteCard($item, note, country ? country.title : '');
    });

    // Repeated-item events: $w.at(event.context) is the clicked card's own $item.
    const open = (event) => flipCard($w.at(event.context), event.context.itemId, true);
    const close = (event) => flipCard($w.at(event.context), event.context.itemId, false);
    ['#frontBox', '#frontImage', '#frontBuilding', '#frontRead'].forEach((id) => $w(id).onClick(open));
    $w('#flipBackButton').onClick(close);

    $w('#buildingRepeater').onItemReady(($item, row) => {
        setImage($item('#buildingImage'), row.image, row.title);
        $item('#buildingName').text = row.title;
        $item('#buildingMeta').text = row.meta;
        $item('#buildingAppears').text = row.appears;
    });
    $w('#timelineRepeater').onItemReady(($item, row) => {
        $item('#timelineYear').text = row.year;
        $item('#timelineTitle').text = row.title;
        $item('#timelineSub').text = row.sub;
    });

    $w('#buildingRead').onClick((event) => {
        const row = $w('#buildingRepeater').data.find((b) => b._id === event.context.itemId);
        if (row) openNote(row.noteItemId);
    });
    $w('#timelineRead').onClick((event) => {
        const row = $w('#timelineRepeater').data.find((t) => t._id === event.context.itemId);
        if (row) openNote(row.noteItemId);
    });
}

function renderBanknotes(list) {
    $w('#noteRepeater').data = list;
    // Cards that stay on screen keep their side; reset them to the front.
    $w('#noteRepeater').forEachItem(($item) => showFront($item));
    if (list.length) {
        $w('#noNotes').collapse();
        $w('#noteRepeater').expand();
    } else {
        $w('#noteRepeater').collapse();
        $w('#noNotes').expand();
    }
}

/** Switches to the Banknotes tab, flips the card for this item and scrolls to it. */
function openNote(itemId) {
    if (!visibleNotes().some((n) => n._id === itemId)) {
        currentSeries = ALL_SERIES;
        $w('#seriesDropdown').value = ALL_SERIES;
        renderAll();
    }
    selectTab('banknotes');
    $w('#noteRepeater').forEachItem(($item, note) => {
        if (note._id === itemId) {
            $item('#noteStates').scrollTo();
            flipCard($item, itemId, true);
        }
    });
}

// ---- Buildings tab ------------------------------------------------------------------

function renderBuildings(list) {
    const groups = new Map();
    list.forEach((n) => {
        const key = n.title || 'Untitled building';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(n);
    });

    $w('#buildingRepeater').data = [...groups.entries()].map(([title, group], i) => ({
        _id: `building-${i}`,
        title,
        image: group[0].image,
        meta: `${txt(group[0].city)} · Architect: ${txt(group[0].architect)}`,
        appears: `Appears on: ${group.map((n) => `${n.denomination} ${n.currency} (${n.series})`).join(', ')}`,
        noteItemId: group[0]._id,
    }));
}

// ---- Timeline tab -------------------------------------------------------------------

function renderTimeline(list) {
    $w('#timelineRepeater').data = list
        .slice()
        .sort((a, b) => (Number(a.yearIssued) || 0) - (Number(b.yearIssued) || 0))
        .map((n) => ({
            _id: `t-${n._id}`,
            year: txt(n.yearIssued),
            title: [`${n.denomination || ''} ${n.currency || ''}`.trim(), n.series].filter(Boolean).join(' · ') || ' ',
            sub: [n.title, n.city].filter(Boolean).join(', ') || ' ',
            noteItemId: n._id,
        }));
}

