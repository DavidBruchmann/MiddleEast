const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const CONFIG_DIR = path.join(__dirname, 'public', 'config');
const CACHE_DIR = path.join(__dirname, 'wikipedia_cache');
const GENERATED_DIR = path.join(__dirname, 'public', 'generated');

const eventMap = new Map();

function standardizeKey(str) {
    if (!str) return "";
    return decodeURIComponent(str).toLowerCase().replace(/[\s\-_–—]/g, '');
}

function parseAndGenerateDataFiles() {
    console.log("Compiling timeline assets cleanly...");
    fs.mkdirSync(GENERATED_DIR, { recursive: true });

    // Load configs
    const configEvents = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'events.json'), 'utf-8'));
    const configGroups = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'groups.json'), 'utf-8'));
    const configPersons = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'persons.json'), 'utf-8'));
    const configContext = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'context.json'), 'utf-8'));

    // Process Events
    configEvents.forEach(e => {
        const eventId = `ev_${standardizeKey(e.english_title)}`;

        // Reset node cleanly on compilation loop pass to prevent language duplication blocks
        const eventNode = {
            id: eventId,
            title: e.display_title_override || e.english_title.replace(/_/g, ' '),
            start: e.start,
            end: e.end || null,
            perp_ids: e.perp_ids || [],
            context_id: e.context_id || null,
            description: "",
            source: [],
            bg_image_url: e.bg_image_url || "",
        };

        // Gather metrics securely across subdirectories
        const langs = ['en', 'de', 'ar', 'he'];
        langs.forEach(lang => {
            const filePath = path.join(CACHE_DIR, lang, `${e.english_title}.html`);
            if (!fs.existsSync(filePath)) return;

            const html = fs.readFileSync(filePath, 'utf-8');
            const $ = cheerio.load(html);

            if (lang === 'en' || !eventNode.description) {
                const p = $('p').filter((i, el) => $(el).text().trim().length > 40).first().text().trim();
                eventNode.description = p.substring(0, 300).replace(/\[\d+\]/g, '') + "...";
            }
            /*
            if (lang === 'en' || !eventNode.bg_image_url) {
                eventNode.bg_image_url = e.bg_image_url;
            }
            */
//console.log(e);
            $('script, style, .mw-empty-elt, .navbox, .infobox').remove();
            eventNode.source.push({
                slug: (e.bg_image_url ? '✅ ' : '❌ ') + e.english_title,
                lang: lang,
                strlength: $.text().replace(/\s+/g, ' ').length
            });
        });

        eventMap.set(eventId, eventNode);
    });

    //const sortedEvents = Array.from(eventMap.values()).sort((a,b) => a.start.localeCompare(b.start));
        // Convert your event map back into a flat array structure
    //let compiledEventsArray = Array.from(eventMap.values());

    /*
    // STAGE 1: Standardize incomplete fuzzy dates to safe fallback ISO formats for Vis.js rendering
    compiledEventsArray.forEach(e => {
        e.display_date_text = e.start; // Preserve the original fuzzy text (e.g. "1881") for the UI

        // Ensure string definitions are safely extracted
        const rawStart = String(e.start);
        const rawEnd = String(e.end || "");

        if (rawStart.length === 4) {
            e.start = `${rawStart}-01-01`;
        }
        if (rawEnd.length === 4) {
            e.end = `${rawEnd}-12-31`;
        }
    });

    let listOrderChanged;
    let maximumPermittedIterations = 10;
    let iterationCounter = 0;
    */

        // Convert your event map back into a flat array structure
        // Convert your event map back into a flat array structure
        // Convert your event map back into a flat array structure
    let compiledEventsArray = Array.from(eventMap.values());

    // STAGE 1: Extract year-only baseline weights, leaving your text untouched
    compiledEventsArray.forEach(e => {
        const rawStart = String(e.start).trim();

        // Base sorting weight calculation relies purely on the first 4 characters of the year number
        const pureYearInt = parseInt(rawStart.substring(0, 4), 10);
        e._sortWeight = pureYearInt * 10000;
    });

    // STAGE 2: APPLY RELATIONAL ANCHOR SHIFTS
    let dataSwappedOnThisPass;
    let loopTracker = 0;
    do {
        dataSwappedOnThisPass = false;
        loopTracker++;
        for (let i = 0; i < compiledEventsArray.length; i++) {
            const eventNode = compiledEventsArray[i];
            if (eventNode.sort_anchors) {
                if (eventNode.sort_anchors.after) {
                    const targetNode = compiledEventsArray.find(x => x.id === eventNode.sort_anchors.after);
                    if (targetNode && eventNode._sortWeight <= targetNode._sortWeight) {
                        eventNode._sortWeight = targetNode._sortWeight + 1;
                        dataSwappedOnThisPass = true;
                    }
                }
                if (eventNode.sort_anchors.before) {
                    const targetNode = compiledEventsArray.find(x => x.id === eventNode.sort_anchors.before);
                    if (targetNode && eventNode._sortWeight >= targetNode._sortWeight) {
                        eventNode._sortWeight = targetNode._sortWeight - 1;
                        dataSwappedOnThisPass = true;
                    }
                }
            }
        }
    } while (dataSwappedOnThisPass && loopTracker < 10);

    // STAGE 3: EXECUTE INDEPENDENT ABSOLUTE MATH SORT
    compiledEventsArray.sort((a, b) => a._sortWeight - b._sortWeight);

    // STAGE 4: CLEANUP METADATA PROPERTIES
    compiledEventsArray.forEach(e => delete e._sortWeight);

    // Save out the perfectly organized dataset assets completely free of padding
    fs.writeFileSync(path.join(GENERATED_DIR, 'events.json'), JSON.stringify(compiledEventsArray, null, 2));

    /*


    // STAGE 2: RELATIONAL POSITIONAL SORTING ENGINE
    // This loop runs up to 3 passes to dynamically re-order rows based on your after/before anchors
    for (let pass = 0; pass < 3; pass++) {
        compiledEventsArray.sort((a, b) => {
            // Check implicit "after" structural dependencies
            if (a.sort_anchors && a.sort_anchors.after === b.id) return 1;
            if (b.sort_anchors && b.sort_anchors.after === a.id) return -1;

            // Check implicit "before" structural dependencies
            if (a.sort_anchors && a.sort_anchors.before === b.id) return -1;
            if (b.sort_anchors && b.sort_anchors.before === a.id) return 1;

            // Fallback default: chronological comparison of clean timestamp boundaries
            return (a.start || "").localeCompare(b.start || "");
        });
    }
    */

console.log(compiledEventsArray);
    fs.writeFileSync(path.join(GENERATED_DIR, 'events.json'), JSON.stringify(compiledEventsArray, null, 2));
    fs.writeFileSync(path.join(GENERATED_DIR, 'groups.json'), JSON.stringify(configGroups, null, 2));
    fs.writeFileSync(path.join(GENERATED_DIR, 'persons.json'), JSON.stringify(configPersons, null, 2));
    fs.writeFileSync(path.join(GENERATED_DIR, 'context.json'), JSON.stringify(configContext, null, 2));

    console.log("✓ public/generated/ folder rebuilt successfully.");
}

parseAndGenerateDataFiles();
