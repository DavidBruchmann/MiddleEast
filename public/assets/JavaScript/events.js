let globalEventsRegistry = [];
let masterDataset = [];
let timelineInstance = null;
let selectedActiveLanguageCode = 'en';
let activeSelectedEventId = null;

// Ingest both compiled assets and localized glossary matrices asynchronously
Promise.all([
    fetch('generated/events.json').then(res => res.json()),
    fetch('generated/labels.json').then(res => res.json()).catch(() => ({}))
]).then(([events, labels]) => {
console.log(events);
    masterDataset.events = events;
    masterDataset.labels = labels;
    selectedActiveLanguageCode = document.getElementById('langSelector').value;

    // Execute unified application render block
    renderAllInterfaceComponents();
    initInterfaceThemeEngine();
}).catch(err => console.error("Error loading frontend data assets:", err));

/**
 * UNIFIED APP RENDER STATE LOOP: Flushes and completely rewrites all components on language shift
 */
function renderAllInterfaceComponents() {
    // 1. Resolve UI Global Label Strings Translation
    const fallbackLabels = {
        headline: "Historical Conflict Ledger",
        subheading: "Side-by-side verification interface. Select entries to reveal language source trees.",
        filter_label: "Quick filter list rows:"
    };
    const getLabel = (key) => (masterDataset.labels[key] && masterDataset.labels[key][selectedActiveLanguageCode]) || fallbackLabels[key];

    const dir = ['ar', 'he'].includes(selectedActiveLanguageCode) ? 'rtl' : 'ltr';
    const uiMainHeadline = document.getElementById('uiMainHeadline');
    uiMainHeadline.textContent = getLabel('headline');
    uiMainHeadline.parentNode.setAttribute('dir', dir);
    const uiSubheading = document.getElementById('uiSubheading');
    uiSubheading.textContent = getLabel('subheading');
    uiSubheading.setAttribute('dir', dir);
    const sidebarSearch = document.getElementById('sidebarSearch');
    sidebarSearch.placeholder = getLabel('filter_label');
    sidebarSearch.setAttribute('dir', dir);
    const langSelector = document.getElementById('langSelector')
    langSelector.setAttribute('dir', dir);

    //contentBox.setAttribute('dir', ['ar', 'he'].includes(selectedActiveLanguageCode) ? 'rtl' : 'ltr');

    // Redraw Dependent Navigation Panels
    applySidebarFilterPass();
    let r = globalFilteredEventsSubset();
    console.log(r);
    renderTimelineCanvasView(r, dir);

    // Keep open description cards sync'd
    if (activeSelectedEventId) {
        displayDeepDetailsView(activeSelectedEventId);
    }
}

function globalFilteredEventsSubset() {
    const query = document.getElementById('sidebarSearch').value.toLowerCase().trim();
    return masterDataset.events.filter(e => {
        const currentLocalizedTitle = (e.titles && e.titles[selectedActiveLanguageCode]) || e.title || "";
        return currentLocalizedTitle.toLowerCase().includes(query);
    });
}

function renderTimelineCanvasView(eventsToRender, dir) {
    const container = document.getElementById('timelineContainer');
    //const container = document.getElementById('timelineWrapperFrame');
    if (timelineInstance) {
        timelineInstance.destroy();
        timelineInstance = null;
    }
    container.innerHTML = '';

    const items = eventsToRender.map(e => {
        const rawStart = String(e.start).trim();
        const rawEnd = e.end ? String(e.end).trim() : "";

        // Dynamic on-the-fly range calculation padding
        let visStart = rawStart;
        if (rawStart.length === 4) {
            // TODO
            visStart = `${rawStart}-01-01`;
        }
        let visEnd = e.end ? (rawEnd.length === 4 ? `${rawEnd}-12-31` : rawEnd) : null;

        const itemNode = {
            id: e.id,
            content: e.title,
            start: visStart,
            end: visEnd,
            type: e.end ? 'range' : 'point'
        };

        // If start date is a fuzzy inexact year, inject striped uncertainty class pattern
        if (rawStart.length === 4) {
            // itemNode.className = 'fuzzy-uncertainty-node';
        }
        return itemNode;
    });

    const options = {
        stack: true,
        margin: {
            item: 10,
            axis: 10
        },
        showCurrentTime: false,
        zoomable: false,
        orientation: {
            axis: 'top',
            item: 'bottom'
        },
        start: '1850-01-01',
        end: '2030-01-01',
        autoResize: true
    };
    options.rtl = dir == 'rtl' ? true : false;

    timelineInstance = new vis.Timeline(container, items, options);
    timelineInstance.on('select', (props) => {
        if(props.items.length > 0) {
            activeSelectedEventId = props.items;
            displayDeepDetailsView(activeSelectedEventId);
        }
    });
}

function renderSidebarList(events) {
    const container = document.getElementById('listScrollArea'); container.innerHTML = '';
    events.forEach(e => {
        const displayYear = e.start.substring(0, 4);
        const card = document.createElement('div'); card.className = 'compact-list-card';

        // FIXED: Dynamically map list row card text titles to current language setting
        const localizedCardTitle = (e.titles && e.titles[selectedActiveLanguageCode]) || e.title;
// console.log(selectedActiveLanguageCode, localizedCardTitle);
        card.innerHTML = `<span class="date">${displayYear}</span><h4 style="margin:2px 0 0 0; font-size:14px;">${localizedCardTitle}</h4>`;

        card.onclick = () => {
            activeSelectedEventId = e.id;
            displayDeepDetailsView(e.id);
            if (timelineInstance) { timelineInstance.setSelection(e.id, { focus: true }); timelineInstance.moveTo(`${displayYear}-01-01`); }
        };
        container.appendChild(card);
    });
}
function applySidebarFilterPass() {
    const q = document.getElementById('sidebarSearch').value.toLowerCase();
    renderSidebarList(masterDataset.events.filter(e => e.title.toLowerCase().includes(q)));
}
function filterSidebarList() {
    const query = document.getElementById('sidebarSearch').value.toLowerCase();
    renderSidebarList(globalEventsRegistry.filter(e => e.title.toLowerCase().includes(query)));
}

function changeGlobalInterfaceLanguage() {
    selectedActiveLanguageCode = document.getElementById('langSelector').value;
    renderAllInterfaceComponents();
    // timelineInstance.redraw();
}

function initInterfaceThemeEngine() {
    const saved = localStorage.getItem('user-theme') || 'system';
    document.getElementById('themeSelector').value = saved;
    applyThemeStyles(saved);
}

function applyUserThemeChoiceSelection() {
    const choice = document.getElementById('themeSelector').value;
    localStorage.setItem('user-theme', choice);
    applyThemeStyles(choice);
}

function applyThemeStyles(theme) {
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
}

function displayDeepDetailsView(rawSelectionId) {
    if (!rawSelectionId) return;
    
    const cleanEventId = Array.isArray(rawSelectionId) ? rawSelectionId[0] : rawSelectionId;
    const matched = masterDataset.events.find(e => e.id === cleanEventId);
    if (!matched) {
      console.log('eventId not found');
      return;
    }
// console.log('matched', matched);
    const contentBox = document.getElementById('inspectorContent');
    const lang = document.getElementById('langSelector').value;
    contentBox.setAttribute('dir', ['ar', 'he'].includes(selectedActiveLanguageCode) ? 'rtl' : 'ltr');

    const startYear = matched.start.substring(0, 4);
    const endYear = matched.end ? matched.end.substring(0, 4) : '';
    const timeframeDisplay = endYear ? `${startYear} to ${endYear}` : startYear;
// console.log('matched.descriptions', matched.descriptions);
    const hasText = matched.descriptions && matched.descriptions[lang];
    const textSummaryOutput = hasText ? matched.descriptions[lang] : (matched.descriptions['en'] || 'Text summary unavailable.');
    const warning = hasText ? '' : ' (Displaying EN baseline)';
    
    const activeTitleDisplay = (matched.titles && matched.titles[lang]) || matched.title;

    document.getElementById('drawerTitle').innerHTML = `${activeTitleDisplay}${warning} <br><span style="font-size:13px; font-weight:normal; color:var(--text-muted);">📅 Timeline Period: ${startYear}</span>`;
    document.getElementById('drawerDesc').textContent = textSummaryOutput;

    const img = document.getElementById('drawerHeroImg');
    if (matched.bg_image_url) {
        img.src = matched.bg_image_url;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
    }

    const linksBox = document.getElementById('drawerLinks');
    linksBox.innerHTML = '';

    if (matched.source && matched.source.length > 0) {
        matched.source.forEach(src => {
            // If an anchor target exists, append it using the hash modifier
            // Otherwise, leave the URL pointing straight to the main root article page
            const anchorHashSuffix = matched.anchor_target ? `#${encodeURIComponent(matched.anchor_target)}` : '';
            const url = `https://${src.lang}.wikipedia.org/wiki/${src.slug}${anchorHashSuffix}`;
            
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.className = 'wiki-badge';
            a.innerHTML = `<strong>${src.lang.toUpperCase()} Record</strong> (${(src.strlength/1000).toFixed(0)}k) ↗`;
            linksBox.appendChild(a);
        });
    } else {
        linksBox.innerHTML = '<span style="font-size:12px; color:var(--text-muted); font-style:italic;">No active verification badges discovered.</span>';
    }
}

document.querySelector('#zoom-in').onclick = () => {if(timelineInstance) timelineInstance.zoomIn(0.4)};
document.querySelector('#zoom-out').onclick = () => {if(timelineInstance) timelineInstance.zoomOut(0.4)};

