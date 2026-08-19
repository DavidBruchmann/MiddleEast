const fs = require('fs');
const path = require('path');

// Safe relative directory steps moving outward from Build/ into public/
const CONFIG_DIR = path.join(__dirname, '..', 'public', 'config');
const CACHE_DIR = path.join(__dirname, 'wikipedia_cache');
const GENERATED_DIR = path.join(__dirname, '..', 'public', 'generated');

const eventMap = new Map();

function standardizeKey(str) {
    if (!str) return "";
    return decodeURIComponent(str).toLowerCase().replace(/[\s\-_–—]/g, '');
}

/**
 * FIXED: Advanced Multi-Format File Reader Sieve Pass
 * Searches for an article using any available extension and extracts pure text.
 */
function extractTextContentFromCacheFile(lang, localizedSlug) {
    const baseSlugName = localizedSlug.replace(/ /g, '_');

    // Define the three possible paths our downloader might have used
    const jsonPath = path.join(CACHE_DIR, lang, `${baseSlugName}.json`);
    const txtPath  = path.join(CACHE_DIR, lang, `${baseSlugName}.txt`);
    const htmlPath = path.join(CACHE_DIR, lang, `${baseSlugName}.html`);

    // Case-Sensitivity Sieve Pass for Linux Systems:
    // If the exact file is missing, look through the directory for a case-insensitive match
    const langFolder = path.join(CACHE_DIR, lang);
    let finalPathToRead = null;
    let foundExtension = '';

    if (fs.existsSync(langFolder)) {
        const filesOnDisk = fs.readdirSync(langFolder);
        const lowerTargetJson = `${baseSlugName.toLowerCase()}.json`;
        const lowerTargetTxt  = `${baseSlugName.toLowerCase()}.txt`;
        const lowerTargetHtml = `${baseSlugName.toLowerCase()}.html`;

        for (const file of filesOnDisk) {
            const lowerFile = file.toLowerCase();
            if (lowerFile === lowerTargetJson) { finalPathToRead = path.join(langFolder, file); foundExtension = 'json'; break; }
            if (lowerFile === lowerTargetTxt)  { finalPathToRead = path.join(langFolder, file); foundExtension = 'txt'; break; }
            if (lowerFile === lowerTargetHtml) { finalPathToRead = path.join(langFolder, file); foundExtension = 'html'; break; }
        }
    }

    if (!finalPathToRead) return null; // No file variant found on disk

    try {
        const rawContent = fs.readFileSync(finalPathToRead, 'utf-8');

        // FORMAT 1: Standard structured JSON summary
        if (foundExtension === 'json') {
            const parsed = JSON.parse(rawContent);
            return parsed.extract || "";
        }

        // FORMAT 2: Clean plain text summary file
        if (foundExtension === 'txt') {
            return rawContent.trim();
        }

        // FORMAT 3: Raw Wikipedia HTML page content snapshot dump
        if (foundExtension === 'html') {
            // Basic lightweight regex sieve strips tags away cleanly without needing cheerio overhead
            return rawContent
                .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
                .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }
    } catch (err) {
        return null;
    }
    return null;
}

function parseAndGenerateDataFiles() {
    console.log("Executing Staged Parse with Multi-Format Cache Sieve Engine...\n");
    fs.mkdirSync(GENERATED_DIR, { recursive: true });

    const configEvents = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'events.json'), 'utf-8'));
    const configGroups = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'groups.json'), 'utf-8'));
    const configPersons = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'persons.json'), 'utf-8'));
    const configContext = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'context.json'), 'utf-8'));

    const REGISTRY_FILE = path.join(CACHE_DIR, 'cache_registry.json');
    let cacheRegistry = fs.existsSync(REGISTRY_FILE) ? JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8')) : {};

    configEvents.forEach(e => {
        const eventId = e.id;
        const registryMatch = cacheRegistry[e.english_title] || {};
        const translationsMap = registryMatch.translations || {};

        const eventNode = {
            id: eventId,
            title: e.display_title_override || e.english_title.replace(/_/g, ' '),
            start: e.start,
            end: e.end || null,
            perp_ids: e.perp_ids || [],
            context_id: e.context_id || null,
            bg_image_url: e.bg_image_url || '',
            anchor_target: e.anchor_target || null,
            titles: {},
            descriptions: {},
            source: []
        };

        const langs = ['en', 'de', 'he', 'ar', 'id', 'fr', 'es'];
        langs.forEach(lang => {
            const localizedSlug = translationsMap[lang];
            if (!localizedSlug) return;

            eventNode.titles[lang] = decodeURIComponent(localizedSlug).replace(/_/g, ' ');

            // FIXED: Invoke our format-adaptive extractor engine cleanly
            const cleanTextExtract = extractTextContentFromCacheFile(lang, localizedSlug);

            if (cleanTextExtract) {
                // Slice text to keep the frontend inspector card panels clean and snappy
                eventNode.descriptions[lang] = cleanTextExtract.substring(0, 450) + "...";
                eventNode.source.push({
                    slug: localizedSlug.replace(/ /g, '_'),
                    lang: lang,
                    strlength: cleanTextExtract.length
                });
            }
        });

        eventMap.set(eventId, eventNode);
    });

    // Run safe math sort weights execution pass
    let compiledEventsArray = Array.from(eventMap.values());
    compiledEventsArray.forEach(e => {
        const pureYearInt = parseInt(String(e.start).substring(0, 4), 10);
        e._sortWeight = pureYearInt * 10000;
    });

    let listOrderSwapped;
    let loopIterations = 0;
    do {
        listOrderSwapped = false;
        loopIterations++;
        for (let i = 0; i < compiledEventsArray.length; i++) {
            const node = compiledEventsArray[i];
            if (node.sort_anchors && node.sort_anchors.after) {
                const target = compiledEventsArray.find(x => x.id === node.sort_anchors.after);
                if (target && node._sortWeight <= target._sortWeight) {
                    node._sortWeight = target._sortWeight + 1;
                    listOrderSwapped = true;
                }
            }
        }
    } while (listOrderSwapped && loopIterations < 10);

    compiledEventsArray.sort((a, b) => a._sortWeight - b._sortWeight);
    compiledEventsArray.forEach(e => delete e._sortWeight);

    // Save final compiled datasets securely into public/generated/
    fs.writeFileSync(path.join(GENERATED_DIR, 'events.json'), JSON.stringify(compiledEventsArray, null, 2));
    fs.writeFileSync(path.join(GENERATED_DIR, 'groups.json'), JSON.stringify(configGroups, null, 2));
    fs.writeFileSync(path.join(GENERATED_DIR, 'persons.json'), JSON.stringify(configPersons, null, 2));
    fs.writeFileSync(path.join(GENERATED_DIR, 'context.json'), JSON.stringify(configContext, null, 2));

    console.log("✓ Success! Rebuilt datasets across all formats smoothly into public/generated/");
}

parseAndGenerateDataFiles();

