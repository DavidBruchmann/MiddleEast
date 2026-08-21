const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

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
 * Advanced Multi-Format File Reader Sieve Pass
 * Searches for an article using any available extension and extracts pure text.
 */
 /**
 * FIXED: Priority-Enforced Multi-Format Cache Sieve Engine
 * Scans the entire folder cache, prioritizing JSON and TXT over HTML files.
 */
function extractTextContentFromCacheFile(lang, localizedSlug) {
    const langFolder = path.join(CACHE_DIR, lang);
    if (!fs.existsSync(langFolder)) return null;
    
    const normalizedTargetSlug = localizedSlug.replace(/\//g, '___');
    const targetSignature = standardizeKey(normalizedTargetSlug);
    const filesOnDisk = fs.readdirSync(langFolder);

    // Track matching formats found for this specific title slug
    const matchedFileVariants = {
        json: null,
        txt: null,
        html: null
    };

    // 1. Gather ALL available file formats on disk without breaking prematurely
    for (const file of filesOnDisk) {
        const ext = path.extname(file).toLowerCase();
        const baseNameWithoutExt = path.basename(file, ext);

        if (standardizeKey(baseNameWithoutExt) === targetSignature) {
            const cleanExt = ext.substring(1); // 'json', 'txt', or 'html'
            if (matchedFileVariants.hasOwnProperty(cleanExt)) {
                matchedFileVariants[cleanExt] = path.join(langFolder, file);
            }
        }
    }

    // 2. ENFORCE PRIORITY QUEUE: Select the cleanest available format strictly
    let finalPathToRead = null;
    let detectedExtension = '';

    if (matchedFileVariants.json) {
        finalPathToRead = matchedFileVariants.json;
        detectedExtension = 'json';
    } else if (matchedFileVariants.txt) {
        finalPathToRead = matchedFileVariants.txt;
        detectedExtension = 'txt';
    } else if (matchedFileVariants.html) {
        finalPathToRead = matchedFileVariants.html;
        detectedExtension = 'html';
    }

    if (!finalPathToRead) return null; // No cache variant exists on disk

    // 3. READ AND EXTRACT PURE TEXT DATA
    try {
        const rawContent = fs.readFileSync(finalPathToRead, 'utf-8');

        if (detectedExtension === 'json') {
            const parsed = JSON.parse(rawContent);
            return parsed.extract || "";
        }

        if (detectedExtension === 'txt') {
            // keep linebreaks
            return rawContent.trim().replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n\n');
        }

        if (detectedExtension === 'html') {
            // Strict Cheerio-like extraction filters out image thumbnails and captions
            const $ = cheerio.load(rawContent);
            $(
                'script, style, link, meta, ' +
                '.infobox, table.infobox, .navbox, .metadata, ' + // Strips dense table boxes entirely
                '.thumb, .thumbcaption, figcaption, ' +           // Strips image metadata and captions
                '.mw-empty-elt, .ambox, .mbox-small, ' +          // Strips cleanup notices and disclaimers
                'div[role="note"], .mw-references-wrap, ' +       // Strips navigation notes and references
                '.shortdescription' // '.shortdescription.nomobile.noexcerpt.noprint'
            ).remove();
            return $.text();
            // TARGET PROSE ONLY: Locate all standard narrative text paragraphs
            let paragraphCollectionText = "";
            let paragraphArray = [];
            $('p').each((i, el) => {
                const textSnippet = $(el).text().trim()
                    .replace(/\[\d+\]/g, '') // Strip citations
                    .replace(/\s+/g, ' ');   // Collapse double spaces
                
                if (textSnippet.length > 20) {
                    paragraphArray.push(textSnippet);
                }
            });
            return paragraphArray.join('\n\n');
            /*
            // FALLBACK: If Wikipedia structure wraps the intro inside structural divs instead of <p> tags
            if (paragraphCollectionText.trim().length ]+&gt;/gi, ' ')  // Strip escaping codes
                .replace(/<\/?[^>]+>/g, ' ')       // Strip stray tag remnants
                .replace(/\[\d+\]/g, '')           // Strip Wikipedia citation brackets like [1]
                .replace(/\s+/g, ' ')              // Collapse formatting gaps into neat single spaces
                .trim();
            */
            const purifiedContentText = $.text().replace(/\s+/g, ' ').trim();
            return purifiedContentText;
            /*
            return rawContent
                .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
                .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
                .replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, '')
                .replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, '') // Strips messy Infoboxes completely
                .replace(/<div class="[^"]*thumbcaption[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '') // Strips image captions
                .replace(/<div class="[^"]*shortdescription[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '') // Strips image captions
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            */
        }
        if (foundExtension === 'html') {
            // Basic lightweight regex sieve strips tags away cleanly without needing cheerio overhead
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
    const configLabels = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'labels.json'), 'utf-8'));
    
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
            source: [],
            media_id: e.media_id || null, 
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
                eventNode.descriptions[lang] = cleanTextExtract; //.substring(0, 800) + "...";
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
    fs.writeFileSync(path.join(GENERATED_DIR, 'labels.json'), JSON.stringify(configLabels, null, 2));

    console.log("✓ Success! Rebuilt datasets across all formats smoothly into public/generated/");
}

parseAndGenerateDataFiles();

