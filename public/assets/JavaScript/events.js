let globalEventsRegistry = [];
let masterDataset = [];
let timelineInstance = null;
let lethalityGraphInstance = null;
let selectedActiveLanguageCode = 'en';
let activeSelectedEventId = null;
// Ingest both compiled assets and localized glossary matrices asynchronously
Promise.all([
    fetch('generated/events.json').then(res => res.json()),
    fetch('generated/media.json').then(res => res.json()).catch(() => ({})),
    fetch('generated/labels.json').then(res => res.json()).catch(() => ({})),
    fetch('generated/lethality.json').then(res => res.json()).catch(() => [])
]).then(([events, media, labels, lethalityData]) => {
    masterDataset.events = events;
    masterDataset.media = media;
    masterDataset.labels = labels;
    masterDataset.lethality = lethalityData;
    const urlParamsQueryString = new URLSearchParams(window.location.search);
    const rawUrlEventSlugParameter = urlParamsQueryString.get('E'); // e.g. "&E=ev_battle_of_jerusalem_1917"
    masterDataset.events = events;
    masterDataset.media = media;
    // Extract the active language code directly from the current static file name string!
    // Matches patterns like "index_de.html" or "index_ar.html" fluidly
    const fileNameMatchPattern = window.location.pathname.match(/index_([a-z]{2})\.html/);
    if (fileNameMatchPattern && fileNameMatchPattern[1]) {
        selectedActiveLanguageCode = fileNameMatchPattern[1];
    } else {
        // Default baseline configuration if landing on base root index.html
        const cachedChoice = localStorage.getItem('user-selected-language-code');
        selectedActiveLanguageCode = cachedChoice ? cachedChoice : 'en';
    }
    // Keep your working dropdown sync and rendering sequences active below...
    document.getElementById('langSelector').value = selectedActiveLanguageCode;
    // Draw primary dashboard presentation layout
    renderAllInterfaceComponents();
    initInterfaceThemeEngine();
    let resolvedTargetEventId = null;
    if (rawUrlEventSlugParameter) {
        // Clean up incoming url parameters, mapping spacing components safely
        const normalizedUrlSlug = decodeURIComponent(rawUrlEventSlugParameter).replace(/_/g, ' ').toLowerCase().trim();
        // Scan the events array to find the item carrying the localized title match for the ACTIVE language choice!
        const matchedSlugEventNode = masterDataset.events.find(e => {
            // Check if the current language has a matching title entry text string character
            if (e.titles && e.titles[selectedActiveLanguageCode]) {
                return e.titles[selectedActiveLanguageCode].toLowerCase().trim() === normalizedUrlSlug;
            }
            // Fall back to check against the core default english baseline string title properties
            return (e.title && e.title.toLowerCase().trim() === normalizedUrlSlug) || (e.id.toLowerCase() === normalizedUrlSlug);
        });
        if (matchedSlugEventNode) {
            resolvedTargetEventId = matchedSlugEventNode.id;
        }
    }
    // If no localized parameter matched or was found, fall back to check memory placeholders
    if (!resolvedTargetEventId) {
        resolvedTargetEventId = localStorage.getItem('user-active-event-id');
    }
    // TRIGGER VIEW CENTER AND SELECTION MARKS
    if (resolvedTargetEventId) {
        const matchedNode = masterDataset.events.find(e => e.id === resolvedTargetEventId);
        if (matchedNode) {
            activeSelectedEventId = resolvedTargetEventId;
            // Highlight item selectors across columns instantly
            displayDeepDetailsView(activeSelectedEventId);
            focusAndScrollSidebarListCard(activeSelectedEventId);
            // Force Vis.js timeline canvas to center viewport cleanly onto the targeted year
            if (timelineInstance) {
                timelineInstance.setSelection(activeSelectedEventId, { focus: true });
                timelineInstance.moveTo(`${matchedNode.start.substring(0, 4)}-01-01`);
            }
        }
        localStorage.removeItem('user-active-event-id'); // Clear out tracker tokens cleanly
    }
}).catch(err => console.error("Error loading frontend data assets:", err));

/**
 * UNIFIED APP RENDER STATE LOOP: Flushes and completely rewrites all components on language shift
 */
function renderAllInterfaceComponents() {
    // Resolve UI Global Label Strings Translation
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
    const lethalityGraphContainer = document.getElementById('lethalityGraphContainer');
    if (timelineInstance) {
        timelineInstance.destroy();
        timelineInstance = null;
    }
    if (lethalityGraphInstance) {
      lethalityGraphInstance.destroy();
      lethalityGraphInstance = null;
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
    // ==========================================================================
    // Strict Int-Parsed Graph2d Mapping Engine
    // Transforms text parameters into mathematical integers to render curves cleanly
    // ==========================================================================
    const graphItems = [];
    if (masterDataset.lethality && masterDataset.lethality.length > 0) {
    // console.log("masterDataset.lethality", masterDataset.lethality);
        masterDataset.lethality.forEach(point => {
            // Ensure the data coordinates exist before mapping them
            const israeliCount = point.israeli_side !== undefined ? parseInt(point.israeli_side, 10) : 0;
            const palestinianCount = point.palestinian_side !== undefined ? parseInt(point.palestinian_side, 10) : 0;

            // Only push coordinates to the canvas loop if the year parsing is clean
            if (point.time) {
                graphItems.push({
                    x: String(point.time).trim(),
                    y: isNaN(israeliCount) ? 0 : israeliCount, 
                    group: 0
                });
                graphItems.push({
                    x: String(point.time).trim(),
                    y: isNaN(palestinianCount) ? 0 : palestinianCount,
                    group: 1
                });
            }
        });
    }

    const groupDataset = new vis.DataSet([
        { id: 0, content: 'Israeli Factions Casualties', options: { drawPoints: { style: 'square' }, shaded: { orientation: 'bottom' } }},
        { id: 1, content: 'Palestinian Factions Casualties', options: { drawPoints: { style: 'circle' }, shaded: { orientation: 'bottom' } }}
    ]);
    const initialStartWindow = '1915-01-01';
    const initialEndWindow = '1950-01-01';
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
    //applyCustomVerticalLines();
    timelineInstance.on('select', (props) => {
        if(props.items.length > 0) {
            activeSelectedEventId = props.items[0];
            displayDeepDetailsView(activeSelectedEventId);
            focusAndScrollSidebarListCard(activeSelectedEventId);
        }
    });
    lethalityGraphInstance = new vis.Graph2d(lethalityGraphContainer, graphItems, groupDataset, {
        start: initialStartWindow,
        end: initialEndWindow,
        zoomable: false,
        moveable: true,
        sampling: false,
        graphHeight: '110px',
        showCurrentTime: false,
        legend: { left: { position: 'top-left' } }
    });
    lethalityGraphInstance.rtl = dir == 'rtl' ? true : false;
    timelineInstance.on('rangechange', (props) => {
        lethalityGraphInstance.setWindow({ start: props.start, end: props.end, animation: false });
    });
    lethalityGraphInstance.on('rangechange', (props) => {
        timelineInstance.setWindow({ start: props.start, end: props.end, animation: false });
    });
    if (typeof applyCustomVerticalLines === "function") applyCustomVerticalLines();
}

/**
 * Localized Vertical Milestone Marker System
 * RE-ENTRANT VERTICAL AXIS ENGINE
 * Employs absolute Event Delegation to protect click listeners from viewport zoom repaints
 */
function applyCustomVerticalLines() {
    if (!timelineInstance || !masterDataset.events || masterDataset.events.length === 0) return;

    const targetedVerticalLines = [
        { id: "ev_israeli_declaration_of_independence", styleClass: "axis_anchor_1948", fallbackText: "14 May 1948" },
        { id: "ev_battle_of_jerusalem_1917", styleClass: "axis_anchor_1917", fallbackText: "9 Dec 1917" },
        { id: "ev_sultan_abdul_hamid_ii_1876", styleClass: "axis_anchor_1876", fallbackText: "31 Aug 1876" }
    ];

    targetedVerticalLines.forEach(line => {
        const eventData = masterDataset.events.find(e => e.id === line.id);
        if (!eventData) return;

        const localizedMarkerText = (eventData.titles && eventData.titles[selectedActiveLanguageCode]) || eventData.title || line.fallbackText;
        const rawDateString = String(eventData.start).trim();
        const displayLabelString = `${rawDateString.substring(0, 10)}: ${localizedMarkerText}`;

        try {
            timelineInstance.removeCustomTime(line.id);
        } catch (e) {}

        let finalTimelineMarkerDate = null;
        const dateMatchPattern = rawDateString.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);

        if (dateMatchPattern) {
            const yearInt  = parseInt(dateMatchPattern[1], 10);
            const monthInt = dateMatchPattern[2] ? (parseInt(dateMatchPattern[2], 10) - 1) : 0;
            const dayInt   = dateMatchPattern[3] ? parseInt(dateMatchPattern[3], 10) : 1;
            finalTimelineMarkerDate = new Date(Date.UTC(yearInt, monthInt, dayInt, 0, 0, 0));
        } else {
            finalTimelineMarkerDate = new Date(Date.UTC(1948, 4, 14, 0, 0, 0));
        }

        timelineInstance.addCustomTime(finalTimelineMarkerDate, line.id, { editable: false });
        timelineInstance.setCustomTimeTitle('', line.id);

        setTimeout(() => {
            const axisElementNode = document.querySelector(`.vis-custom-time.${line.id}`);
            if (axisElementNode) {
                axisElementNode.classList.add(line.styleClass);

                const oldLabel = axisElementNode.querySelector('.custom-axis-label-card');
                if (oldLabel) oldLabel.remove();

                const labelCardElement = document.createElement('div');
                labelCardElement.className = 'custom-axis-label-card';
                labelCardElement.textContent = displayLabelString;
                labelCardElement.style.cursor = 'pointer';

                axisElementNode.appendChild(labelCardElement);
                axisElementNode.style.cursor = 'pointer';
            }
        }, 50);
    });

    // ==========================================================================
    // Global Event Delegation Click Listener Core Hook
    // Captures click event sweeps safely, ensuring zoom levels never break actions!
    // ==========================================================================
    const masterTimelineFrameBox = document.getElementById('timelineContainer');
    // Remove any previously bound delegation instances to avoid double click stack bugs
    if (masterTimelineFrameBox.getAttribute('data-listener-active') !== 'true') {
        masterTimelineFrameBox.addEventListener('click', function(event) {
            // Find if the clicked component or its parents carry a vertical line tracking token class
            const targetLineNode = event.target.closest('.vis-custom-time');
            if (!targetLineNode) return;
            // Match against our explicit marker database lines list
            const matchedLineConfig = targetedVerticalLines.find(line => targetLineNode.classList.contains(line.id));
            if (matchedLineConfig) {
                event.stopPropagation();
                activeSelectedEventId = matchedLineConfig.id;
                displayDeepDetailsView(matchedLineConfig.id);
                highlightActiveSidebarListCard(matchedLineConfig.id);
                if (timelineInstance) {
                    timelineInstance.setSelection(matchedLineConfig.id, { focus: true });
                }
            }
        });
        masterTimelineFrameBox.setAttribute('data-listener-active', 'true');
    }
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

/**
 * Accessible Semantic List Renderer
 * Generates true HTML anchor href elements using localized URL deep-link query structures
 * Streamlined Evolutionary Sidebar List Hydrator
 * Re-uses pre-baked HTML code elements on boot to maximize execution performance and SEO scores
 */
function renderSidebarList(events) {
    const container = document.getElementById('listScrollArea'); 
    // CAPTURE TRANSITION STATE: If we are viewing English baseline, and the DOM elements are
    // already pre-baked inside the file container, just select them and hook up their interactions!
    const preExistingAnchorElements = container.querySelectorAll('a.compact-list-card');
    if (selectedActiveLanguageCode === 'en' && preExistingAnchorElements.length === events.length && container.getAttribute('data-lang-loaded') !== 'en') {
        console.log("⚡ Re-using pre-baked index.html semantic markup cards for maximum load performance.");
        events.forEach(e => {
            const anchorElementNode = document.getElementById(`sidebar_card_${e.id}`);
            if (anchorElementNode) {
                const displayYear = e.start.substring(0, 4);
                // Map the interactive left-click interception parameters without recreating strings
                anchorElementNode.onclick = (event) => {
                    if (event.metaKey || event.ctrlKey || event.button === 1) return;
                    event.preventDefault();
                    activeSelectedEventId = e.id;
                    displayDeepDetailsView(e.id, anchorElementNode.getAttribute('href'));
                    highlightActiveSidebarListCard(e.id);
                    if (timelineInstance) {
                        timelineInstance.setSelection(e.id, { focus: true });
                        timelineInstance.moveTo(`${displayYear}-01-01`);
                    }
                };
            }
        });
        container.setAttribute('data-lang-loaded', 'en');
        if (activeSelectedEventId) highlightActiveSidebarListCard(activeSelectedEventId);
        return; // Break out of function early to skip performance-heavy innerHTML rebuilding loops!
    }
    // FALLBACK TRACK: Rebuild the strings natively if they choose another language dropdown target (DE, AR, HE, etc.)
    container.innerHTML = '';
    container.setAttribute('data-lang-loaded', selectedActiveLanguageCode);
    events.forEach(e => {
        const displayYear = e.start.substring(0, 4);
        const localizedCardTitle = (e.titles && e.titles[selectedActiveLanguageCode]) || e.title;
        const safeUrlSlug = encodeURIComponent(localizedCardTitle.replace(/ /g, '_'));
        // const trueDeepLinkUrlAddress = `?L=${selectedActiveLanguageCode}&E=${safeUrlSlug}`;
        const trueDeepLinkUrlAddress = `?E=${safeUrlSlug}`;
        const anchorCardElement = document.createElement('a'); 
        anchorCardElement.className = 'compact-list-card';
        anchorCardElement.id = `sidebar_card_${e.id}`;
        anchorCardElement.href = trueDeepLinkUrlAddress;
        anchorCardElement.innerHTML = `
            <span class="date">${displayYear}</span>
            <h4 style="margin:2px 0 0 0; font-size:14px; display:inline-block;">${localizedCardTitle}</h4>
        `;
        anchorCardElement.onclick = (event) => {
            if (event.metaKey || event.ctrlKey || event.button === 1) return;
            event.preventDefault();
            activeSelectedEventId = e.id; 
            displayDeepDetailsView(e.id, anchorCardElement.getAttribute('href'));
            highlightActiveSidebarListCard(e.id);
            if (timelineInstance) { 
                timelineInstance.setSelection(e.id, { focus: true }); 
                timelineInstance.moveTo(`${displayYear}-01-01`); 
            } 
        };
        container.appendChild(anchorCardElement);
    });
    if (activeSelectedEventId) highlightActiveSidebarListCard(activeSelectedEventId);
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
 * Streamlined Multi-Page Language Routing Handler
 * Transitions visitors directly to the absolute pre-baked language sub-file instantly
 */
function changeGlobalInterfaceLanguage() {
    const selectorElement = document.getElementById('langSelector');
    if (!selectorElement) return;
    const targetedLanguageCode = selectorElement.value; // e.g. "de" or "ar"
    localStorage.setItem('user-selected-language-code', targetedLanguageCode);
    let activeEventUrlParamSuffix = '';
    if (activeSelectedEventId) {
        localStorage.setItem('user-active-event-id', activeSelectedEventId);
        const activeNode = masterDataset.events.find(e => e.id === activeSelectedEventId);
        if (activeNode) {
            const localizedTitle = (activeNode.titles && activeNode.titles[targetedLanguageCode]) || activeNode.title;
            activeEventUrlParamSuffix = `?E=${encodeURIComponent(localizedTitle.replace(/ /g, '_'))}`;
        }
    }
    // Performs an instantaneous native routing jump directly to the target static page!
    // window.location.href = `index_${targetedLanguageCode}.html${activeEventUrlParamSuffix}`;
    if (targetedLanguageCode === 'en') {
        window.location.href = `index.html${activeEventUrlParamSuffix}`;
    } else {
        window.location.href = `index_${targetedLanguageCode}.html${activeEventUrlParamSuffix}`;
    }
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

function displayDeepDetailsView(eventId, targetHref = null) {
    const matched = masterDataset.events.find(e => e.id === eventId); 
    if (!matched) {
        console.log('eventId not found');
        return;
    }
    if (targetHref) {
        window.history.replaceState({ id: eventId }, '', targetHref);
    }
    const activeLocalizedTitle = (matched.titles && matched.titles[selectedActiveLanguageCode]) || matched.title;
    const safeLiveUrlSlug = encodeURIComponent(activeLocalizedTitle.replace(/ /g, '_'));
    //const updatedShareUrl = `?L=${selectedActiveLanguageCode}&E=${safeLiveUrlSlug}`;
    const updatedShareUrl = `?E=${safeLiveUrlSlug}`;
    window.history.replaceState({ id: eventId }, '', updatedShareUrl);
    const cleanEventId = Array.isArray(eventId) ? eventId[0] : eventId;
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

