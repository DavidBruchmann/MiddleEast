const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
// Safe relative directory steps moving outward from Build/ into public/
const CONFIG_DIR = path.join(__dirname, '..', 'public', 'config');
const CACHE_DIR = path.join(__dirname, 'wikipedia_cache');
const GENERATED_DIR = path.join(__dirname, '..', 'public', 'generated');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'generated');
const eventMap = new Map();
const TEMPLATE_INDEX_PATH = path.join(__dirname, '..', 'public', 'index.html');

let events = [];
let groups = [];
let persons = [];
let contexts = [];
let lethality = [];

/**
 * Check HTML Code Requirement Pre-Flight Validator
 * Force-scans structural code templates before allowing any database processing
 */
function verifyHtmlTemplateCodeRequirements() {
    console.log("🔍 Pre-Flight Check: Auditing HTML source code structural requirements...");
    if (!fs.existsSync(TEMPLATE_INDEX_PATH)) {
        console.error(`\n❌ CRITICAL CRASH: Target template file missing at: ${TEMPLATE_INDEX_PATH}`);
        process.exit(1); // ◄ FAIL-FAST: Kills the process immediately
    }
    const htmlContentString = fs.readFileSync(TEMPLATE_INDEX_PATH, 'utf-8');
    // Define the exact regex/string rules your project requires to compile safely
    const requiredMarkersList = [
        {
            rule: /<html lang="en" dir="ltr" class="no-js">/,
            errorMessage: "Missing or unexpected html-tag"
        },
        {
            rule: /<!-- ##NOSCRIPT_DATA_INJECTION_MARKER## -->/,
            errorMessage: "Missing the opening injection marker comment: <!-- ##NOSCRIPT_DATA_INJECTION_MARKER## -->"
        },
        {
            rule: /<!-- ##\/NOSCRIPT_DATA_INJECTION_MARKER## -->/,
            errorMessage: "Missing the closing injection marker comment: <!-- ##/NOSCRIPT_DATA_INJECTION_MARKER## -->"
        },
        {
            rule: /id="jsonld-seo-schema-block"/,
            errorMessage: "Missing the required static structured data schema anchor: id=\"jsonld-seo-schema-block\""
        },
        {
            rule: /id="listScrollArea"/,
            errorMessage: "Missing the required sidebar lists viewport scrolling node: id=\"listScrollArea\""
        }
    ];
    let baselineValidationPassed = true;
    // Scan each rule aggressively against your raw source file content strings
    requiredMarkersList.forEach(item => {
        if (!item.rule.test(htmlContentString)) {
            console.error(`  ✕ STRUCTURAL HTML ERROR: ${item.errorMessage}`);
            baselineValidationPassed = false;
        }
    });
    if (!baselineValidationPassed) {
        console.error("\n❌ PRE-FLIGHT BLOCK: Compilation aborted! Please fix your public/index.html source code errors before running the parser again.\n");
        process.exit(1); // ◄ FAIL-FAST: Prevents any backend data from being touched or corrupted!
    }
    console.log("  ✓ Pre-flight HTML structure validated successfully. Proceeding with compilation layers.\n");
    console.log("  (TODO: add more Pre-flight checks).\n");
}

function standardizeKey(str) {
    if (!str) return "";
    return decodeURIComponent(str).toLowerCase().replace(/[\s\-_–—]/g, '');
}

/**
 * RESTORED CORE DATA EXTRACTION MACHINE
 * Ingests your manual configurations and crawls the localized multi-format cache files,
 * capturing formatting and preserving multi-paragraph text structures natively.
 */
/**
 * REPAIRED INGESTION ENGINE
 * Maps translations directly from cache_registry.json onto the generated events matrix
 */
function loadAndExtractCacheDataFiles() {
    console.log("📥 Extracting local records and parsing Wikipedia text caches...");
    try {
        // 1. Load configuration files
        const rawEvents = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'events.json'), 'utf-8'));
        const rawGroups = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'groups.json'), 'utf-8'));
        const rawPersons = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'persons.json'), 'utf-8'));
        const rawLethality = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'lethality.json'), 'utf-8'));
        // FIXED: Read your newly corrected cache registry file into memory!
        const REGISTRY_PATH = path.join(CACHE_DIR, 'cache_registry.json');
        let cacheRegistry = {};
        if (fs.existsSync(REGISTRY_PATH)) {
            cacheRegistry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
        }
        groups = rawGroups;
        persons = rawPersons;
        lethality = rawLethality;
        const targetLanguagesArray = ['en', 'de', 'ar', 'he', 'id', 'fr', 'es'];
        // 2. Loop through specified events
        rawEvents.forEach(e => {
            const eventId = e.id || `ev_${Date.now()}`;
            const englishSlugKey = e.english_title.replace(/ /g, '_');
            const eventNode = {
                id: eventId,
                title: e.display_title_override || e.english_title.replace(/_/g, ' '),
                start: e.start,
                end: e.end || null,
                perp_ids: e.perp_ids || [],
                context_id: e.context_id || null,
                bg_image_url: e.bg_image_url || '',
                anchor_target: e.anchor_target || null,
                media_id: e.media_id || null,
                titles: {},
                descriptions: {},
                source: []
            };
            // 3. Process translations across your 7 active languages
            targetLanguagesArray.forEach(lang => {
                let fallbackTitleTextString = e.display_title_override
                    ? e.display_title_override
                    : e.english_title.replace(/_/g, ' ');
                let localizedTitle = fallbackTitleTextString;
                let localizedFileNameSlug = englishSlugKey;
                if (cacheRegistry[englishSlugKey] && cacheRegistry[englishSlugKey].translations) {
                    if (cacheRegistry[englishSlugKey].translations[lang]) {
                        localizedFileNameSlug = cacheRegistry[englishSlugKey].translations[lang];
                        localizedTitle = e.display_title_override
                            ? e.display_title_override
                            : localizedFileNameSlug.replace(/_/g, ' ');
                    }
                }
                eventNode.titles[lang] = localizedTitle;
                // Compute safe system paths targeting the localized file slug name
                const safeCacheFileName = localizedFileNameSlug.replace(/\//g, '___');
                const textCachePath = path.join(CACHE_DIR, lang, `${safeCacheFileName}.json`);
                let msg = '';
                let overlayTitle = '';
                if (fs.existsSync(textCachePath)) {
                    try {
                        const cachePayload = JSON.parse(fs.readFileSync(textCachePath, 'utf-8'));
                        let rawExtractText = cachePayload.extract || "";
                        // ==========================================================================
                        // TRIPLE LINE-BREAK SECTOR SPLIT ENGINE
                        // Splits raw text files into discrete paragraph blocks by mapping \n\n\n
                        // ==========================================================================
                        if (e.wikipedia_section_overrides && e.wikipedia_section_overrides[lang] && e.wikipedia_section_overrides[lang].length) {
                            // Target section string name (e.g., "Die zweite Alija")
                            const targetSectionHeaderStr = e.wikipedia_section_overrides[lang].replace(/_/g, ' ').trim();
/*
console.log({
  'e.wikipedia_section_overrides[lang]': e.wikipedia_section_overrides[lang],
  'e.wikipedia_title_overrides[lang]:': e.wikipedia_title_overrides[lang],
  'eventNode': eventNode
});
*/
                            // Split the entire plain-text body into discrete blocks by triple line breaks
                            const rawParagraphBlocksArray = rawExtractText.split(/\n\n\n+/);
//console.log({rawParagraphBlocksArray:rawParagraphBlocksArray});
                            let collectedContentBlocksArray = [];
                            let insideTargetSectionTrackingFlag = false;
                            for (let i = 0; i < rawParagraphBlocksArray.length; i++) {
                                const currentBlockText = rawParagraphBlocksArray[i].trim();
                                if (currentBlockText.length === 0) continue;
                                // Wikipedia plain-text files often hold headings on their own line 
                                // followed by a single line break (\n) before paragraph text starts.
                                // Split the current block to safely scan its first text line.
                                const blockLines = currentBlockText.split('\n');
                                const potentialHeadingLine = blockLines[0].trim();
                                // Normalize lines to clean up formatting shifts or dashes fluidly
                                const normHeading = potentialHeadingLine.toLowerCase().replace(/[\s\-\–\—\=\:]/g, '');
                                const normTarget  = targetSectionHeaderStr.toLowerCase().replace(/[\s\-\–\—\=\:]/g, '');
                                // Check if we have hit a heading block boundary
                                const isHeadingBlock = normHeading === normTarget && (potentialHeadingLine.length < 60 && /^[A-ZА-Яمט]/.test(potentialHeadingLine));
                                if (isHeadingBlock) {
                                    eventNode.titles[lang] = e.wikipedia_section_overrides[lang];
// console.log({'eventNode.titles[lang]': eventNode.titles[lang] });
// console.log({normHeading: normHeading, normTarget: normTarget, targetSectionHeaderStr: targetSectionHeaderStr});
                                    // If we are currently collecting text and hit a NEW heading block, stop immediately!
                                    if (insideTargetSectionTrackingFlag) {
                                        break;
                                    }
                                    // Check if this block matches your target subsection title name
                                    if (normHeading === normTarget || normHeading.includes(normTarget)) {
                                        insideTargetSectionTrackingFlag = true;
                                        // If this block contains paragraph text right below the heading line, capture it
                                        if (blockLines.length > 1) {
                                            const paragraphContentLines = blockLines.slice(1).join('\n').trim();
                                            if (paragraphContentLines.length > 10) {
                                                collectedContentBlocksArray.push(paragraphContentLines);
                                            }
                                        }
                                        continue;
                                    }
                                }
                                // Accumulate subsequent paragraph text blocks if inside target boundaries
                                if (insideTargetSectionTrackingFlag) {
                                    collectedContentBlocksArray.push(currentBlockText);
                                }
                            }
                            if (collectedContentBlocksArray.length > 0) {
                                rawExtractText = collectedContentBlocksArray.join('\n\n');
                            } else {
                                // Fallback option: if the section can't be matched, slice the top abstract context
                                rawExtractText = rawExtractText.substring(0, 1200);
                            }
                        }
                        // Clean structural syntax fragments and apply standard description constraints
                        let cleanedTextProse = rawExtractText
                            .replace(/&lt;[^&>]+&gt;/gi, ' ')
                            .replace(/<\/?[^>]+>/g, ' ')
                            .replace(/\[\d+\]/g, '')
                            .trim();

                        if (cleanedTextProse.length > 15) {
                            // eventNode.titles[lang] = targetSectionHeaderStr;
                            // overlayTitle = targetSectionHeaderStr;
                            eventNode.descriptions[lang] = cleanedTextProse.substring(0, 1600).trim() + "...";
                        } else {
                            msg = "❌ Historical documentation details pending compilation pass.";
                            eventNode.descriptions[lang] = msg;
                            console.log(localizedTitle, msg);
                        }
                    } catch (fileErr) {
                        msg = "❌ Text summary extraction unavailable.";
                        eventNode.descriptions[lang] = msg;
                        console.log(localizedTitle, msg);
                    }
                } else {
                    // FIXED: Checks if a localized override file is actually missing or if it's just a routing map error
                    msg = `❌ Missing local asset payload cache file target: /${lang}/${safeCacheFileName}.json`;
                    eventNode.descriptions[lang] = msg
                    console.log(localizedTitle, msg);
                }
                let outputSectionAnchor = "";
                if (e.wikipedia_section_overrides && e.wikipedia_section_overrides[lang]) {
                    // if (overlayTitle) eventNode.titles[lang] = overlayTitle;
                    outputSectionAnchor = `#${e.wikipedia_section_overrides[lang]}`;
                }
                eventNode.source.push({
                    lang: lang,
                    slug: localizedFileNameSlug + outputSectionAnchor,
                    strlength: eventNode.descriptions[lang].length
                });
            });
            events.push(eventNode);
        });
        console.log(`  ✓ Data Extraction Done: Compiled ${events.length} historical events rows.`);
    } catch (err) {
        console.error("❌ CRITICAL INGESTION FAULT:", err.message);
        throw err;
    }
}



/**
 * Priority-Enforced Multi-Format Cache Sieve Engine
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
            const purifiedContentText = $.text().replace(/\s+/g, ' ').trim();
            return purifiedContentText;
        }
    } catch (err) {
        return null;
    }
    return null;
}

/**
 * CORE EXECUTION ARBITRATOR
 * Orchestrates the compilation pipeline by delegating tasks to dedicated sub-processors.
 */
async function runParserPipeline() {
    // 1. Enforce strict pre-flight code requirement checks before anything else touches disk
    verifyHtmlTemplateCodeRequirements();
    loadAndExtractCacheDataFiles();
    try {
        console.log("⚙️ Starting data extraction and compilation sequence...");
        // Assume compiledEventsArray, configGroups, configPersons, configContext, CONFIG_DIR, and GENERATED_DIR 
        // have been safely collected/processed out of your cache directory folders earlier in your script files loop.
        const runtimeContextPayload = {
            events: events,
            groups: groups,
            persons: persons,
            context: contexts,
            lethality: lethality,
            configDir: CONFIG_DIR,
            generatedDir: OUTPUT_DIR
        };
        // 2. Delegate Operation A: Compile baseline client-side database registries
        generateCoreJsonFiles(runtimeContextPayload);
        // 3. Delegate Operation B: Build partitioned language-specific JSON-LD graphs
        generateSegmentedSeoSchemas(runtimeContextPayload);
        // 4. Delegate Operation C: Generate distinct static HTML lang views
        hydrateMultiPageStaticHtml(runtimeContextPayload);
        console.log("\n🚀 SUCCESS: Full delegated parser pipeline executed flawlessly.");
    } catch (pipelineError) {
        console.error("\n❌ PIPELINE CRASH: Delegated compiler pass failed:", pipelineError.message);
        process.exit(1);
    }
}

// ==========================================================================
// DELEGATE WORKERS MATRIX (Single-Responsibility Patterns)
// ==========================================================================

/**
 * DELEGATE A: Generates the core web database tracking registries.
 */
function generateCoreJsonFiles(payload) {
    console.log("📂 Compiler Task: Writing core client JSON database ledgers...");
    fs.writeFileSync(path.join(payload.generatedDir, 'events.json'), JSON.stringify(payload.events, null, 2));
    fs.writeFileSync(path.join(payload.generatedDir, 'groups.json'), JSON.stringify(payload.groups, null, 2));
    fs.writeFileSync(path.join(payload.generatedDir, 'persons.json'), JSON.stringify(payload.persons, null, 2));
    fs.writeFileSync(path.join(payload.generatedDir, 'context.json'), JSON.stringify(payload.context, null, 2));
    fs.writeFileSync(path.join(payload.generatedDir, 'lethality.json'), JSON.stringify(payload.lethality, null, 2));
    console.log("  ✓ Core json registries deployed successfully.");
}

/**
 * DELEGATE B: Generates partitioned language-specific JSON-LD graphs for GEO/SEO optimization.
 */
function generateSegmentedSeoSchemas(payload) {
    console.log("🛠️ Compiler Task: Building isolated language JSON-LD SEO schemas...");
    const operationalSchemaLangs = ['en', 'de', 'ar', 'he', 'id', 'fr', 'es'];
    operationalSchemaLangs.forEach(langCode => {
        const isDefaultIndexRoot = langCode === 'en';
        const pageFileNameTarget = isDefaultIndexRoot ? 'index.html' : `index_${langCode}.html`;
        const isolatedLanguageSchemaGraph = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebSite",
                    "@id": `https://github.io{pageFileNameTarget}#website`,
                    "url": `https://github.io{isDefaultIndexRoot ? '' : pageFileNameTarget}`,
                    "name": "Hotspot Israel in the Middle East",
                    "description": "An interactive chronological ledger mapping geopolitical milestones from 1843 onward.",
                    "inLanguage": langCode
                }
            ]
        };
        payload.events.forEach(e => {
            const localizedTitleText = (e.titles && e.titles[langCode]) || e.title || e.id;
            const targetLanguageDescription = e.descriptions && e.descriptions[langCode];
            const validatedDescriptionCopy = (targetLanguageDescription && targetLanguageDescription.trim().length > 15)
                ? targetLanguageDescription
                : ((e.descriptions && e.descriptions['en']) || "Geopolitical timeline milestone documentation details.");
            const safeUrlSlug = encodeURIComponent(localizedTitleText.replace(/ /g, '_'));
            const singleLocalizedEventSchemaNode = {
                "@type": "HistoricalEvent",
                "@id": `https://github.io{pageFileNameTarget}?E=${safeUrlSlug}`,
                "name": localizedTitleText,
                "inLanguage": langCode,
                "startDate": e.start,
                "endDate": e.end || e.start,
                "description": validatedDescriptionCopy.replace(/\.\.\./g, '').trim(),
                "location": {
                    "@type": "Place",
                    "name": "Israel / Palestine / Middle East Coordinate Domain",
                    "geo": {
                        "@type": "GeoCoordinates",
                        "latitude": "31.7683",
                        "longitude": "35.2137"
                    }
                }
            };
            isolatedLanguageSchemaGraph["@graph"].push(singleLocalizedEventSchemaNode);
        });
        fs.writeFileSync(
            path.join(payload.generatedDir, `schema_${langCode}.json`), 
            JSON.stringify(isolatedLanguageSchemaGraph, null, 2), 
            'utf-8'
        );
    });
    console.log("  ✓ All 7 partitioned schema assets successfully written to disk.");
}

/**
 * DELEGATE C: Compiles and hydrates the static cross-language front-end web presentation files.
 */
function hydrateMultiPageStaticHtml(payload) {
    console.log("📂 Compiler Task: Compiling static multi-page HTML language sheets...");
    const targetForeignProductionLangsArray = ['de', 'ar', 'he', 'id', 'fr', 'es'];
    const templateIndexPath = path.join(__dirname, '..', 'public', 'index.html');
    const masterIndexHtmlTemplate = fs.readFileSync(templateIndexPath, 'utf-8');
    // Process foreign language files first
    targetForeignProductionLangsArray.forEach(langCode => {
        let languagePrebakedListCards = "";
        const isRtl = ['ar', 'he'].includes(langCode);

        payload.events.forEach(e => {
            const displayYear = e.start.substring(0, 4);
            const localizedTitleText = (e.titles && e.titles[langCode]) || e.title || e.id;
            const safeUrlSlug = encodeURIComponent(localizedTitleText.replace(/ /g, '_'));
            const localizedHrefTarget = `index_${langCode}.html?E=${safeUrlSlug}`;
            /*
if (langCode=='de') console.log({
  title: e.titles.de,
  description: e.descriptions.de
});
*/
            languagePrebakedListCards += `
        <a class="compact-list-card" id="sidebar_card_${e.id}" href="${localizedHrefTarget}" aria-label="Go to event: ${localizedTitleText} (${displayYear})">
            <span class="date">${displayYear}</span>
            <h4 style="margin:2px 0 0 0; font-size:14px; display:inline-block;">${localizedTitleText}</h4>
        </a>`;
        });
        let localizedPageContentString = masterIndexHtmlTemplate;
        // Apply HTML core parameters
        localizedPageContentString = localizedPageContentString.replace('<html lang="en">', `<html lang="${langCode}" dir="${isRtl ? 'rtl' : 'ltr'}">`);
        localizedPageContentString = localizedPageContentString.replace('src="generated/seo_schema.json"', `src="generated/schema_${langCode}.json"`);
        const dataMarkerRegex = /<!-- ##NOSCRIPT_DATA_INJECTION_MARKER## -->([\s\S]*?)<!-- ##\/NOSCRIPT_DATA_INJECTION_MARKER## -->|<!-- ##NOSCRIPT_DATA_INJECTION_MARKER## -->/;
        const hydratedListBlockToken = `<!-- ##NOSCRIPT_DATA_INJECTION_MARKER## -->\n${languagePrebakedListCards}\n        <!-- ##/NOSCRIPT_DATA_INJECTION_MARKER## -->`;
        localizedPageContentString = localizedPageContentString.replace(dataMarkerRegex, hydratedListBlockToken);
        fs.writeFileSync(path.join(__dirname, '..', 'public', `index_${langCode}.html`), localizedPageContentString, 'utf-8');
    });

    // Hydrate default English baseline list inside main public/index.html to finish
    let englishPrebakedListCards = "";
    payload.events.forEach(e => {
        const displayYear = e.start.substring(0, 4);
        const englishTitleText = (e.titles && e.titles['en']) || e.title || e.id;
        const safeUrlSlug = encodeURIComponent(englishTitleText.replace(/ /g, '_'));
        englishPrebakedListCards += `
        <a class="compact-list-card" id="sidebar_card_${e.id}" href="index.html?E=${safeUrlSlug}" aria-label="Go to event: ${englishTitleText} (${displayYear})">
            <span class="date">${displayYear}</span>
            <h4 style="margin:2px 0 0 0; font-size:14px; display:inline-block;">${englishTitleText}</h4>
        </a>`;
    });

    let defaultIndexContent = masterIndexHtmlTemplate;
    const dataMarkerRegex = /<!-- ##NOSCRIPT_DATA_INJECTION_MARKER## -->([\s\S]*?)<!-- ##\/NOSCRIPT_DATA_INJECTION_MARKER## -->|<!-- ##NOSCRIPT_DATA_INJECTION_MARKER## -->/;
    const hydratedEnglishBlockToken = `<!-- ##NOSCRIPT_DATA_INJECTION_MARKER## -->\n${englishPrebakedListCards}\n        <!-- ##/NOSCRIPT_DATA_INJECTION_MARKER## -->`;
    defaultIndexContent = defaultIndexContent.replace(dataMarkerRegex, hydratedEnglishBlockToken);
    fs.writeFileSync(templateIndexPath, defaultIndexContent, 'utf-8');
    console.log("  ✓ Standalone multi-page HTML distributions verified.");
}

// Fire the pipeline loop
runParserPipeline();


/*
function parseAndGenerateDataFiles() {
    verifyHtmlTemplateCodeRequirements();
    console.log("Executing Staged Parse with Multi-Format Cache Sieve Engine...\n");
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
    const configEvents = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'events.json'), 'utf-8'));
    const configGroups = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'groups.json'), 'utf-8'));
    const configPersons = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'persons.json'), 'utf-8'));
    const configContext = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'context.json'), 'utf-8'));
    const configLabels = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'labels.json'), 'utf-8'));
    const REGISTRY_FILE = path.join(CACHE_DIR, 'cache_registry.json');
    const langs = ['en', 'de', 'he', 'ar', 'id', 'fr', 'es'];
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
        langs.forEach(lang => {
            const localizedSlug = translationsMap[lang];
            if (!localizedSlug) return;
            eventNode.titles[lang] = decodeURIComponent(localizedSlug).replace(/_/g, ' ');
            // Invoke our format-adaptive extractor engine cleanly
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
    // ==========================================================================
    // language specific JSON-LD Semantic SEO Schema Generator Pass
    // Loops through all 7 active languages to generate unique historical graph entities
    // ==========================================================================
    console.log("🛠️ Building isolated, split language JSON-LD SEO schemas...");
    langs.forEach(langCode => {
        const isDefaultIndexRoot = langCode === 'en';
        // Resolve filename destination markers cleanly
        const pageFileNameTarget = isDefaultIndexRoot ? 'index.html' : `index_${langCode}.html`;
        const isolatedLanguageSchemaGraph = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebSite",
                    "@id": `https://davidbruchmann.github.io/MiddleEast/${pageFileNameTarget}`, // #website
                    "url": `https://davidbruchmann.github.io/MiddleEast/${isDefaultIndexRoot ? '' : pageFileNameTarget}`,
                    "name": "Hotspot Israel in the Middle East",
                    "description": "An interactive chronological ledger mapping geopolitical milestones from 1843 onward.",
                    "inLanguage": langCode
                }
            ]
        };
        compiledEventsArray.forEach(e => {
            const localizedTitleText = (e.titles && e.titles[langCode]) || e.title || e.id;
            const targetLanguageDescription = e.descriptions && e.descriptions[langCode];
            // Fall back gracefully to English abstract description block if localized cache data string is empty
            const validatedDescriptionCopy = (targetLanguageDescription && targetLanguageDescription.trim().length > 15)
                ? targetLanguageDescription
                : ((e.descriptions && e.descriptions['en']) || "Geopolitical timeline milestone documentation details.");
            const safeUrlSlug = encodeURIComponent(localizedTitleText.replace(/ /g, '_'));
            const singleLocalizedEventSchemaNode = {
                "@type": "HistoricalEvent",
                "@id": `https://davidbruchmann.github.io/MiddleEast/${pageFileNameTarget}?E=${safeUrlSlug}`,
                "name": localizedTitleText,
                "inLanguage": langCode,
                "startDate": e.start,
                "endDate": e.end || e.start,
                "description": validatedDescriptionCopy.replace(/\.\.\./g, '').trim(),
                "location": {
                    "@type": "Place",
                    "name": "Israel / Palestine / Middle East Coordinate Domain",
                    "geo": {
                        "@type": "GeoCoordinates",
                        "latitude": "31.7683",
                        "longitude": "35.2137"
                    }
                }
            };
            isolatedLanguageSchemaGraph["@graph"].push(singleLocalizedEventSchemaNode);
        });
        // Write the clean, isolated language schema file directly to your public generated folder
        try {
            const outputSchemaPath = path.join(GENERATED_DIR, `schema_${langCode}.json`);
            fs.writeFileSync(outputSchemaPath, JSON.stringify(isolatedLanguageSchemaGraph, null, 2), 'utf-8');
            console.log(`  ✓ Successfully split schema file written: generated/schema_${langCode}.json`);
        } catch (err) {
            console.error(`  ✕ Error writing schema_${langCode}.json:`, err.message);
        }
    });
    console.log("📝 Pre-baking accessible HTML list cards directly into index.html layout...");
    let prebakedHtmlListCards = "";
    console.log("📂 Initiating Multi-Page Static HTML Multi-Language Compiler pass...");
    // Add this multi-language file writer block to the absolute end of Build/parse.js:
    // Inside Build/parse.js - Overwrite your multi-page loop array:
    const templateIndexPath = path.join(__dirname, '..', 'public', 'index.html');
    const masterIndexHtmlTemplate = fs.readFileSync(templateIndexPath, 'utf-8');
    langs.forEach(langCode => {
        // exclude 'en', it's the template and NEVER shall be created as index_en.html 
        if (langCode != 'en') {
          let languagePrebakedListCards = "";
          const isRtl = ['ar', 'he'].includes(langCode);
          // Build the localized HTML list markup strings strictly for this language
          compiledEventsArray.forEach(e => {
              const displayYear = e.start.substring(0, 4);
              const localizedTitleText = (e.titles && e.titles[langCode]) || e.title || e.id;
              const safeUrlSlug = encodeURIComponent(localizedTitleText.replace(/ /g, '_'));
              // Build the static link referencing this specific language page file natively
              const localizedHrefTarget = `index_${langCode}.html?E=${safeUrlSlug}`;
              languagePrebakedListCards += `
          <a class="compact-list-card" id="sidebar_card_${e.id}" href="${localizedHrefTarget}" aria-label="Go to event: ${localizedTitleText} (${displayYear})">
              <span class="date">${displayYear}</span>
              <h4 style="margin:2px 0 0 0; font-size:14px; display:inline-block;">${localizedTitleText}</h4>
          </a>`;
          });
          // Hydrate the master layout template strings with this language's assets
          let localizedPageContentString = masterIndexHtmlTemplate;
          // Force structural orientation attributes directly into the root html open tag parameters
          localizedPageContentString = localizedPageContentString.replace(
              '<html lang="en" dir="ltr" class="no-js">', 
              `<html lang="${langCode}" dir="${isRtl ? 'rtl' : 'ltr'}" class="no-js">`
          );
          localizedPageContentString = localizedPageContentString.replace(
            'src="generated/seo_schema.json"',
            `src="generated/schema_${langCode}.json"`
          );
          // Inject the localized list cards inside our shared code boundaries
          const dataMarkerRegex = /<!-- ##NOSCRIPT_DATA_INJECTION_MARKER## -->([\s\S]*?)<!-- ##\/NOSCRIPT_DATA_INJECTION_MARKER## -->|<!-- ##NOSCRIPT_DATA_INJECTION_MARKER## -->/;
          const hydratedListBlockToken = `<!-- ##NOSCRIPT_DATA_INJECTION_MARKER## -->\n${languagePrebakedListCards}\n        <!-- ##/NOSCRIPT_DATA_INJECTION_MARKER## -->`;
          localizedPageContentString = localizedPageContentString.replace(dataMarkerRegex, hydratedListBlockToken);
          // Write out the completed independent static language page file
          const outputLanguagePagePath = path.join(__dirname, '..', 'public', `index_${langCode}.html`);
          fs.writeFileSync(outputLanguagePagePath, localizedPageContentString, 'utf-8');
          console.log(`  ✓ Standalone language page built: public/index_${langCode}.html`);
        }
    });
}

parseAndGenerateDataFiles();
*/
