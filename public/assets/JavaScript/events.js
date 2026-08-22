let globalEventsRegistry = [];
let masterDataset = [];
let timelineInstance = null;
let selectedActiveLanguageCode = 'en';
let activeSelectedEventId = null;

// Ingest both compiled assets and localized glossary matrices asynchronously
Promise.all([
    fetch('generated/events.json').then(res => res.json()),
    fetch('generated/media.json').then(res => res.json()).catch(() => ({})),
    fetch('generated/labels.json').then(res => res.json()).catch(() => ({}))
]).then(([events, media, labels]) => {
    masterDataset.events = events;
    masterDataset.media = media;
    masterDataset.labels = labels;
    //selectedActiveLanguageCode = document.getElementById('langSelector').value;
    const storedLanguageChoice = localStorage.getItem('user-selected-language-code');
    if (storedLanguageChoice) {
        selectedActiveLanguageCode = storedLanguageChoice;
        document.getElementById('langSelector').value = selectedActiveLanguageCode;
    }


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
        filter_label: "Quick filter list rows:",
        zoom_text: "Zoom: ",
        theme_system: "🌗 System Theme",
        theme_light: "☀️ Light High-Contrast",
        theme_dark: "🌙 Dark High-Contrast",
    };
    const getLabel = (key) => (masterDataset.labels[key] && masterDataset.labels[key][selectedActiveLanguageCode]) || fallbackLabels[key];
    //const getLabel = (key, fallback) => (masterDataset.labels[key] && masterDataset.labels[key][selectedActiveLanguageCode]) || fallback;

    const dir = ['ar', 'he'].includes(selectedActiveLanguageCode) ? 'rtl' : 'ltr';
    const isRtl = ['ar', 'he'].includes(selectedActiveLanguageCode);
    
    const getLabelText = (key, defaultFallbackString) => {
        if (masterDataset.labels && masterDataset.labels[key] && masterDataset.labels[key][selectedActiveLanguageCode]) {
            return masterDataset.labels[key][selectedActiveLanguageCode];
        }
        return defaultFallbackString;
    };
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
    const uiZoomLabel = document.getElementById('uiZoomLabel');
    uiZoomLabel.textContent = getLabel('zoom_text');
    // console.log(getLabel('zoom_text'));
    // uiZoomLabel.setAttribute('dir', dir);
    document.getElementById('optThemeSystem').textContent = getLabel('theme_system', "🌗 System Theme");
    document.getElementById('optThemeLight').textContent = getLabel('theme_light', "☀️ Light High-Contrast");
    document.getElementById('optThemeDark').textContent = getLabel('theme_dark', "🌙 Dark High-Contrast");
    document.getElementById('uiTopAttributionBanner').innerHTML = getLabelText('top_attribution', "Ingested directly from Wikipedia under CC-BY-SA terms.");
    document.getElementById('uiFooterLegalText').innerHTML = getLabelText('footer_legal', "Data Attribution & Licensing Notice...");

    
    const localizedTextBoxes = [
        document.getElementById('uiMainHeadline'),
        document.getElementById('uiSubheading'),
        document.getElementById('drawerDesc'),
        document.getElementById('listScrollArea')
    ];
    localizedTextBoxes.forEach(box => {
        if (box) {
            box.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
            box.style.textAlign = isRtl ? 'right' : 'justify';
        }
    });
    //contentBox.setAttribute('dir', ['ar', 'he'].includes(selectedActiveLanguageCode) ? 'rtl' : 'ltr');
    // Redraw Dependent Navigation Panels
    applySidebarFilterPass();
    renderTimelineCanvasView(globalFilteredEventsSubset(), dir);
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
        const localizedBarTitle = (e.titles && e.titles[selectedActiveLanguageCode]) || e.title;
        const itemNode = {
            id: e.id,
            content: localizedBarTitle,
            start: visStart,
            end: visEnd,
            type: e.end ? 'range' : 'point',
            title: `${localizedBarTitle} (${rawStart.substring(0,4)})`, // ◄ Accessible screen-reader tooltip string
            className: rawStart.length === 4 ? 'fuzzy-uncertainty-node' : ''
        };
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
    applyCustomVerticalLines();
    /*
    // 3. Early Ottoman Anchor: 31 August 1876 (Ascension of Abdul Hamid II)
    timelineInstance.addCustomTime('1876-08-31', 'axis_anchor_1876');
    // 2. Ottoman Transition Axis Anchor: 9 December 1917 (Fall of Jerusalem)
    timelineInstance.addCustomTime('1917-12-09', 'axis_anchor_1917');
    // 1. Mandatory Axis Anchor: 14 May 1948 (End of Mandate / Declaration)
    timelineInstance.addCustomTime('1948-05-14', 'axis_anchor_1948');
    // Optional: Ensure researchers cannot accidentally drag or displace your structural milestone lines
    timelineInstance.on('timechange', function (properties) {
        // Reverts any manual drag adjustments instantly back to their true historical coordinates
        if (properties.id === 'axis_anchor_1948') timelineInstance.setCustomTime('1948-05-14', 'axis_anchor_1948');
        if (properties.id === 'axis_anchor_1917') timelineInstance.setCustomTime('1917-12-09', 'axis_anchor_1917');
        if (properties.id === 'axis_anchor_1876') timelineInstance.setCustomTime('1876-08-31', 'axis_anchor_1876');
    });
    */
    timelineInstance.on('select', (props) => {
        if(props.items.length > 0) {
            activeSelectedEventId = props.items[0];
            displayDeepDetailsView(activeSelectedEventId);
            focusAndScrollSidebarListCard(activeSelectedEventId);
        }
    });
}

/**
 * FIXED: Advanced Dynamic Localized Axis Markers Deck
 * Injects vertical milestone threshold boundaries cleanly using automated translation files
 */
/**
 * FIXED: Production-Ready Localized Vertical Milestone Marker System
 * Explicitly locks line paths from manual drift without relying on untriggered events
 */
function applyCustomVerticalLines() {
    if (!timelineInstance || !masterDataset.events || masterDataset.events.length === 0) return;

    // Define the exact group profiles you want to lock as vertical axis lines
    const targetedVerticalLines = [
        { id: "ev_sultan_abdul_hamid_ii_1876", styleClass: "axis_anchor_1876", fallbackText: "31 Aug 1876" },
        { id: "ev_battle_of_jerusalem_1917", styleClass: "axis_anchor_1917", fallbackText: "9 Dec 1917" },
        { id: "ev_israeli_declaration_of_independence", styleClass: "axis_anchor_1948", fallbackText: "14 May 1948" },
    ];

    targetedVerticalLines.forEach(line => {
        const eventData = masterDataset.events.find(e => e.id === line.id);
        if (!eventData) return;

        const localizedMarkerText = (eventData.titles && eventData.titles[selectedActiveLanguageCode]) || eventData.title || line.fallbackText;
        const rawDateString = String(eventData.start).trim();
        const displayLabelString = `${rawDateString.substring(0, 10)}: ${localizedMarkerText}`;

        try {
            // Clean out old tracking IDs cleanly to handle language hot-swaps
            timelineInstance.removeCustomTime(line.id);
        } catch (e) { /* Safe catch for clean overwrites */ }

        let finalTimelineMarkerDate = null;
        const dateMatchPattern = rawDateString.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);

        if (dateMatchPattern) {
            // FIXED: Extracted elements target separate array lookup index indices safely!
            const yearInt  = parseInt(dateMatchPattern[1], 10);
            
            // Group 2 holds Month string (e.g. "08"). Fallback to 0 (Jan) if missing
            const monthInt = dateMatchPattern[2] ? (parseInt(dateMatchPattern[2], 10) - 1) : 0;
            
            // Group 3 holds Day string (e.g. "31"). Fallback to 1 (1st) if missing
            const dayInt   = dateMatchPattern[3] ? parseInt(dateMatchPattern[3], 10) : 1;

            // Force pure UTC instantiation at absolute midnight
            finalTimelineMarkerDate = new Date(Date.UTC(yearInt, monthInt, dayInt, 0, 0, 0));
        } else {
            // Fallback for unparseable entries
            finalTimelineMarkerDate = new Date(Date.UTC(1948, 4, 14, 0, 0, 0));
        }

        // ==========================================================================
        // FIXED: Hardcode Line Stability Inside the Options Parameters Matrix
        // Passing an options block with editable:false locks the line natively!
        // ==========================================================================
        // Lock the line state to prevent dragging entirely, rendering the timechange hook obsolete
        const itemOptions = {
            id: line.id,
            editable: false 
        };
        timelineInstance.addCustomTime(finalTimelineMarkerDate, line.id);
        timelineInstance.setCustomTimeTitle('qqqqqq', line.id); // Clear native floating tooltips
        

        // Inject dynamic attributes into the DOM layer safely
                // Inject dynamic attributes into the DOM layer safely
        setTimeout(() => {
            const axisElementNode = document.querySelector(`.vis-custom-time.${line.id}`);
            if (axisElementNode) {
                axisElementNode.classList.add(line.styleClass);
                
                // 1. FIXED: Remove any old text label remnants to handle language page hot-swaps cleanly
                const oldLabel = axisElementNode.querySelector('.custom-axis-label-card');
                if (oldLabel) oldLabel.remove();

                // 2. FIXED: Construct a true HTML element label box that sits natively inside the view tree
                const labelCardElement = document.createElement('div');
                labelCardElement.className = 'custom-axis-label-card';
                labelCardElement.textContent = displayLabelString;

                // 3. FIXED: Wire the localized click handlers directly to BOTH the line bar and the label text block
                const triggerEventSelectionHandler = (event) => {
                    event.stopPropagation(); // Prevents canvas tracking click scrambling errors
                    activeSelectedEventId = line.id;
                    displayDeepDetailsView(line.id);
                    highlightActiveSidebarListCard(line.id);
                };

                axisElementNode.style.cursor = 'pointer';
                axisElementNode.onclick = triggerEventSelectionHandler;
                
                labelCardElement.style.cursor = 'pointer';
                labelCardElement.onclick = triggerEventSelectionHandler;

                // Nest the clickable text layout box right inside the vertical indicator axis line element
                axisElementNode.appendChild(labelCardElement);
            }
        }, 50);

    });
}

function focusAndScrollSidebarListCard(eventId) {
    highlightActiveSidebarListCard(eventId);
    const activeTargetCard = document.getElementById(`sidebar_card_${eventId}`);
    if (activeTargetCard) {
        // Auto-scrolls the sidebar pane vertically to snap the selected element right into center focus
        activeTargetCard.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }
}

function highlightActiveSidebarListCard(eventId) {
    document.querySelectorAll('.compact-list-card').forEach(c => c.classList.remove('active'));
    const activeTargetCard = document.getElementById(`sidebar_card_${eventId}`);
    if (activeTargetCard) activeTargetCard.classList.add('active');
}

function renderSidebarList(events) {
    const container = document.getElementById('listScrollArea'); container.innerHTML = '';
    events.forEach(e => {
        const displayYear = e.start.substring(0, 4);
        const card = document.createElement('div');
        card.className = 'compact-list-card';
        card.id = 'sidebar_card_' + e.id;
        // Dynamically map list row card text titles to current language setting
        const localizedCardTitle = (e.titles && e.titles[selectedActiveLanguageCode]) || e.title;
        card.innerHTML = `<span class="date">${displayYear}</span><h4 style="margin:2px 0 0 0; font-size:14px;">${localizedCardTitle}</h4>`;
        card.onclick = () => {
            const allCards = document.querySelectorAll('.compact-list-card');
            allCards.forEach(function(item) {
                item.classList.remove('active')
            })
            card.classList.add('active');
            activeSelectedEventId = e.id;
            displayDeepDetailsView(e.id);
            if (timelineInstance) {
                timelineInstance.setSelection(e.id, { focus: true });
                timelineInstance.moveTo(`${displayYear}-01-01`);
            }
        };
        container.appendChild(card);
    });
}

function applySidebarFilterPass() {
    const subset = globalFilteredEventsSubset();
    renderSidebarList(subset);
    if (timelineInstance) renderTimelineCanvasView(subset);
}

function filterSidebarList() {
    const query = document.getElementById('sidebarSearch').value.toLowerCase();
    renderSidebarList(globalEventsRegistry.filter(e => e.title.toLowerCase().includes(query)));
}

/**
 * Global Language Switching Routing Controller
 * Saves workflow state variables and auto-reloads the page when crossing RTL/LTR boundaries
 */
function changeGlobalInterfaceLanguage() {
    const selectorElement = document.getElementById('langSelector');
    if (!selectorElement) return;

    const previousLanguageCode = selectedActiveLanguageCode; // Old active state
    const nextLanguageCode = selectorElement.value;        // Newly targeted choice
    
    // Evaluate if this language change crosses the RTL/LTR structural line boundary
    const wasRtl = ['ar', 'he'].includes(previousLanguageCode);
    const isRtl  = ['ar', 'he'].includes(nextLanguageCode);

    // Save the new choice into browser memory so it persists across page refreshes
    localStorage.setItem('user-selected-language-code', nextLanguageCode);
    
    // Save the currently active event ID so the visitor doesn't lose their place
    if (activeSelectedEventId) {
        localStorage.setItem('user-active-event-id', activeSelectedEventId);
    }

    // FIXED: If crossing between structural direction boundaries, force a page reload!
    if (wasRtl !== isRtl) {
        window.location.reload(); 
        return; // Stops execution loop immediately to let the browser refresh natively
    }

    // Standard in-memory translation swap if switching between two LTR or two RTL languages
    selectedActiveLanguageCode = nextLanguageCode;
    document.documentElement.setAttribute('lang', selectedActiveLanguageCode);
    // document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');

    // Run your standard sidebar list and canvas filter components redraw passes
    renderAllInterfaceComponents();
}


/*
function changeGlobalInterfaceLanguage() {    
    selectedActiveLanguageCode = document.getElementById('langSelector').value;
    renderAllInterfaceComponents();
    // timelineInstance.redraw();
}
*/

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
    const contentBox = document.getElementById('inspectorContent');
    const lang = document.getElementById('langSelector').value;
    contentBox.setAttribute('dir', ['ar', 'he'].includes(selectedActiveLanguageCode) ? 'rtl' : 'ltr');
    const startYear = matched.start.substring(0, 4);
    const endYear = matched.end ? matched.end.substring(0, 4) : '';
    const timeframeDisplay = endYear ? `${startYear} to ${endYear}` : startYear;
    const hasText = matched.descriptions && matched.descriptions[lang];
    const textSummaryOutput = hasText ? matched.descriptions[lang] : (matched.descriptions['en'] || 'Text summary unavailable.');
    const warning = hasText ? '' : ' (Displaying EN baseline)';
    const activeTitleDisplay = (matched.titles && matched.titles[lang]) || matched.title;
    document.getElementById('drawerTitle').innerHTML = `${activeTitleDisplay}${warning} <br><span style="font-size:13px; font-weight:normal; color:var(--text-muted);">📅 Timeline Period: ${startYear}</span>`;
    const drawerDescElement = document.getElementById('drawerDesc');
    drawerDescElement.style.whiteSpace = 'pre-wrap';
    drawerDescElement.style.textAlign = 'justify';
    drawerDescElement.textContent = textSummaryOutput;
    const imgContainer = document.getElementById('inspectorImageContainer');
    //const img = document.getElementById('drawerHeroImg');
    const heroImg = document.getElementById('drawerHeroImg');
    if (matched.media_id && masterDataset.media && masterDataset.media[matched.media_id]) {
        const mediaMeta = masterDataset.media[matched.media_id];
        heroImg.style.opacity = '0';
        imgContainer.style.display = 'block';
        setTimeout(() => {
            heroImg.src = mediaMeta.url;
            heroImg.style.opacity = '1';
            // Populate our overlay caption parameters cleanly
            document.getElementById('captionText').textContent = mediaMeta.title || matched.title;
            document.getElementById('captionAuthor').textContent = mediaMeta.author || 'Archive Record';
            document.getElementById('captionLicense').textContent = mediaMeta.license || 'Unspecified';
            document.getElementById('captionSourceLink').href = mediaMeta.source_url || '#';
        }, 100);
    } else {
        imgContainer.style.display = 'none'; // Hide completely if no media token is assigned
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

/**
 * Lightbox Interaction Lifecycle Engines
 */
function openImageLightboxViewport() {
    const heroImg = document.getElementById('drawerHeroImg');
    const lightboxModal = document.getElementById('globalLightboxModal');
    const lightboxMainImg = document.getElementById('lightboxMainImg');
    const lightboxCaptionDeck = document.getElementById('lightboxCaptionDeck');
    if (!heroImg.src) return;
    // Copy source URL and descriptive metadata blocks into the hidden modal window elements
    lightboxMainImg.src = heroImg.src;
    lightboxCaptionDeck.innerHTML = `
        <strong>${document.getElementById('captionText').textContent}</strong><br>
        <span style="font-size:12px; opacity:0.85;">📸 ${document.getElementById('captionAuthor').textContent} | ${document.getElementById('captionLicense').textContent}</span>
    `;
    lightboxModal.style.display = 'flex'; // Activates modal instantly via flex centering
}

function closeImageLightboxViewport() {
    document.getElementById('globalLightboxModal').style.display = 'none';
}

document.querySelector('#zoom-in').onclick = () => {if(timelineInstance) timelineInstance.zoomIn(0.4)};
document.querySelector('#zoom-out').onclick = () => {if(timelineInstance) timelineInstance.zoomOut(0.4)};

