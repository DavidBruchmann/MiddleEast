const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const https = require('https');

// Define the root target topics (English names) and the specific languages to download
// Just add the exact English title slug below
const TARGET_ARTICLES = [
    "1948_Arab–Israeli_War",
    "Aliyah",
    "Avraham_Stern",
    "Balfour_Declaration",
    // "Cyrus_the_Great",
    "Fatah",
    "Haganah",
    "Irgun",
    // "Jewish_diaspora",
    "Lehi_(militant_group)",
    "Old_Yishuv",
    "Yishuv",
    "Yishuv#New_Yishuv",
    "Zionism",
    "Zionist_movement",
    // Pro Israel
    "Yehuda_Alkalai",
    "Zvi_Hirsch_Kalischer",
    "Moses_Hess",
    "Leon_Pinsker",
    "Theodor_Herzl",
    "Eliezer_Ben-Yehuda",
    "Chaim_Weizmann",
    // Anti Israel
    "Amin_al-Husseini",

    "White_Paper_of_1939",
    "London_Conference_(1939)",
    "Peel_Commission",
    "British_government",
    "Neville_Chamberlain",
    "United_Nations_Partition_Plan_for_Palestine",
    "National_Defence_Party_(Palestine)",
    "Sykes–Picot_Agreement",
    "Mark_Sykes",
    "François_Georges-Picot",
    "Partitioning_of_the_Ottoman_Empire",
    "Menachem_Begin",
];

const BASE_CACHE_DIR = path.join(__dirname, 'wikipedia_cache');
const REGISTRY_FILE = path.join(BASE_CACHE_DIR, 'cache_registry.json');
const TARGET_LANGS =  [
    'en',
    'de',
    'fr',
    'es',
    'ar',
    'he',
    'id'
];
const USER_AGENT = 'HistoricTimelineResearchProject/1.0 (contact: your-email@example.com)';
const OUTPUT_FILE = path.join(__dirname, 'public', 'data.json');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const eventMap = new Map();

function parseCacheToUnifiedStructure() {
    if (!fs.existsSync(BASE_CACHE_DIR)) {
        console.error("✕ Cache directory missing.");
        return;
    }

    // Loading populated multi-language registry asset mapping file
    let registry = {};
    if (fs.existsSync(REGISTRY_FILE)) {
        registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
    } else {
        console.error("✕ cache_registry.json missing! Run npm run download first.");
        return;
    }

    const languages = fs.readdirSync(BASE_CACHE_DIR).filter(item => {
        return fs.statSync(path.join(BASE_CACHE_DIR, item)).isDirectory();
    });

    languages.forEach(lang => {
        const langFolder = path.join(BASE_CACHE_DIR, lang);
        const files = fs.readdirSync(langFolder).filter(f => f.endsWith('.html'));

        files.forEach(file => {
            const filePath = path.join(langFolder, file);
            const htmlContent = fs.readFileSync(filePath, 'utf-8');
            const $ = cheerio.load(htmlContent);

            const slug = file.replace('.html', '');
            const localizedTitle = $('h1').text().trim() || slug.replace(/_/g, ' ');

            // Calculate text length metric cleanly by stripping unnecessary markup tags
            $('script, style, .mw-empty-elt, .navbox, .infobox, footer').remove();
            const textCharacterLength = $.text().replace(/\s+/g, ' ').trim().length;

            // 2. STABLE TOPIC RESOLUTION LOOKUP
            let eventId = `ev_${slug.toLowerCase()}`; // Default row fallback identity slug string
            let universalWikidataId = null;
            let finalRowDisplayTitle = localizedTitle;

            // Scan through registry topics to find out who this file belongs to
            for (const [englishAnchor, meta] of Object.entries(registry)) {
                const translationMappings = meta.translations || {};

                // FIXED: Match by checking if the slug exists inside the translation map variables
                if (translationMappings[lang] === slug) {
                    eventId = `ev_${englishAnchor.toLowerCase()}`;
                    universalWikidataId = meta.wikidata_id; // Universal Wikidata item token tracking e.g., "Q170241"
                    finalRowDisplayTitle = englishAnchor.replace(/_/g, ' '); // Standardize title labels in the UI
                    break;
                }
            }

            let birthDate = $('span.bday');
// console.log(birthDate.text());
            if (birthDate && birthDate.text()) {
// console.log(localizedTitle, birthDate.text());
            } else {
            // 3. INITIALIZE OR APPEND TO UNIFIED DATABASES
                if (!eventMap.has(eventId)) {
                    eventMap.set(eventId, {
                        id: eventId,
                        wikidata_id: universalWikidataId,
                        title: finalRowDisplayTitle,
                        start: "1948-05-15", // Base timeline placeholder (override via overrides.json pattern tracking)
                        end: null,
                        perp_ids: [],
                        source: [] // Your intended collection structural array block
                    });
                }

                // Bundle structural metadata records into the parent array tracking rows element directly
                eventMap.get(eventId).source.push({
                    slug: slug,
                    lang: lang,
                    strlength: textCharacterLength
                });

            }
        });
    });

    // 4. WRITE OUT THE DATA FILE
    const finalPayload = {
        events: Array.from(eventMap.values()),
        perpetrators: [] // Can be populated dynamically later
    };

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalPayload, null, 2));

    console.log(`\n==================================================`);
    console.log(`✓ Success! public/data.json generated seamlessly.`);
    console.log(`✓ Total Reconciled Unified Topics: ${finalPayload.events.length}`);
    console.log(`==================================================`);
}

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, body: data }));
        }).on('error', (err) => reject(err));
    });
}

/**
 * Fetches language links AND the universal Wikidata Q-Number for a topic
 */
async function fetchUniversalTopicMetadata(englishTitle) {
        // 1. Establish the clean baseline endpoint address URL instance safely
        const urlObj = new URL('https://en.wikipedia.org/w/api.php');

        // 2. Set API query parameters using safe native key/value dictionary sets
        urlObj.searchParams.set('action', 'query');
        urlObj.searchParams.set('prop', 'langlinks');
        urlObj.searchParams.set('titles', englishTitle.replace(/ /g, '_'));
        urlObj.searchParams.set('lllimit', '500');
        urlObj.searchParams.set('format', 'json');
        urlObj.searchParams.set('redirects', '1');

    try {
        const response = await makeRequest(urlObj.toString());
        //const url = `https://${src.lang}.wikipedia.org/wiki/${src.slug}`;
        if (!response.ok) console.error(`  ✕ ERROR: URL not reached: ${urlObj.toString()} not reached`); //return null;

        const data = JSON.parse(response.body);
        const pages = data?.query?.pages || {};
        const pageIds = Object.keys(pages);
//console.log(pageIds);
        if (pageIds.length === 0 || pageIds[0] === "-1") {
            console.error(`  ✕ Article not found on English Wikipedia: ${englishTitle}`);
            return null;
        }

        // FIXED: Extract the raw string element ("49090") out of the array key list ([ "49090" ])
        const targetStringKey = pageIds[0];
        const pageData = pages[targetStringKey];
// console.log(pageData);
        if (!pageData) {
            console.error(`  ✕ Failed to extract page properties layout data object.`);
            return null;
        }

        // Extract universal identity metadata strings safely
        const wikidataQNumber = pageData?.pageprops?.wikibase_item || null;
        const langLinksArray = pageData.langlinks || [];

        const mappings = { en: englishTitle.replace(/ /g, '_') };
        langLinksArray.forEach(link => {
            if (TARGET_LANGS.includes(link.lang)) {
                mappings[link.lang] = link['*'].replace(/ /g, '_');
            }
        });

        //return { wikidataId: wikidataQNumber, mappings };        // Return both parameters alongside the true page ID
        return {
            pageId: targetStringKey,
            wikidataId: wikidataQNumber,
            mappings
        };
    } catch (err) {
        console.error(`  ✕ Metadata fetch failed: ${err.message}`);
        return null;
    }
}

/**
 * Split Request 1: Dedicated translation finder
 */
async function fetchLangLinks(englishTitle) {
    const urlObj = new URL('https://en.wikipedia.org/w/api.php');
    urlObj.searchParams.set('action', 'query');
    urlObj.searchParams.set('prop', 'langlinks');
    urlObj.searchParams.set('titles', englishTitle.replace(/ /g, '_'));
    urlObj.searchParams.set('lllimit', '500');
    urlObj.searchParams.set('format', 'json');
    urlObj.searchParams.set('redirects', '1');

    try {
        const response = await makeRequest(urlObj.toString());
        if (!response.ok) return {};

        const data = JSON.parse(response.body);
        const pages = data?.query?.pages || {};
        const pageId = Object.keys(pages)[0];

        if (!pageId || pageId === "-1") return {};

        const mappings = { en: englishTitle.replace(/ /g, '_') };
        const langLinksArray = pages[pageId].langlinks || [];

        langLinksArray.forEach(link => {
            if (TARGET_LANGS.includes(link.lang)) {
                mappings[link.lang] = link['*'].replace(/ /g, '_');
            }
        });
        return mappings;
    } catch {
        return {};
    }
}

/**
 * Split Request 2: Dedicated Wikidata Q-Number finder
 */
async function fetchWikidataId(englishTitle) {
    const urlObj = new URL('https://en.wikipedia.org/w/api.php');
    urlObj.searchParams.set('action', 'query');
    urlObj.searchParams.set('prop', 'pageprops');
    urlObj.searchParams.set('titles', englishTitle.replace(/ /g, '_'));
    urlObj.searchParams.set('format', 'json');
    urlObj.searchParams.set('redirects', '1');

    try {
        const response = await makeRequest(urlObj.toString());
        if (!response.ok) return null;

        const data = JSON.parse(response.body);
        const pages = data?.query?.pages || {};
        const pageId = Object.keys(pages)[0];

        if (!pageId || pageId === "-1") return null;

        return pages[pageId]?.pageprops?.wikibase_item || null;
    } catch {
        return null;
    }
}

async function downloadArticleHtml(lang, slug) {
    const targetFolder = path.join(BASE_CACHE_DIR, lang);
    if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

    const destinationPath = path.join(targetFolder, `${slug}.html`);
    //if (fs.existsSync(destinationPath)) return; // Don't re-download if file exists

    const restUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(slug)}`;
    try {
        const response = await makeRequest(restUrl);
        //console.log(response);
        if (response.ok) {
            fs.writeFileSync(destinationPath, response.body, 'utf-8');
            console.log(`  ✓ [${lang.toUpperCase()}] Cached: ${slug}`);
        }
    } catch (err) {
        console.error(`  ✕ Download failed for ${slug}: ${err.message}`);
    }
}

async function startPipeline() {
    console.log("Running Multi-Language Wikipedia Sync Engine...\n");

    if (!fs.existsSync(BASE_CACHE_DIR)) fs.mkdirSync(BASE_CACHE_DIR, { recursive: true });

    let registry = {};

    for (const englishArticle of TARGET_ARTICLES) {
      if (englishArticle.length) {
        const cleanEnglishSlug = englishArticle.replace(/ /g, '_');
        console.log(`Processing Topic: "${cleanEnglishSlug}"`);
//console.log(cleanEnglishSlug + '_1');
        // const result = await fetchUniversalTopicMetadata(cleanEnglishSlug);
        // if (!result) continue;

        // Execute split requests back-to-back safely
        const translations = await fetchLangLinks(cleanEnglishSlug);
        await delay(150);
        const qNumber = await fetchWikidataId(cleanEnglishSlug);
        if (Object.keys(translations).length === 0) {
            console.log(`  ✕ Skipping topic: mapping empty.`);
            continue;
        }
//console.log(cleanEnglishSlug + '_2');

        // Populate our internal structural tracking map memory cleanly
        registry[cleanEnglishSlug] = {
            wikidata_id: qNumber, //result.wikidataId, // Store standard root key e.g., "Q170241"
            translations: translations //result.mappings
        };
//console.log(registry,cleanEnglishSlug);
        for (const lang of TARGET_LANGS) {
            const currentSlug = translations[lang]; //result.mappings[lang];

//console.log(currentSlug);
            if (currentSlug) {
                await downloadArticleHtml(lang, currentSlug);
                await delay(300);
            }
        }
        console.log(`  ✓ Topic successfully mapped: ` + cleanEnglishSlug);
      }
    }

    // Write file cleanly onto disk drive space
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
    console.log("\n✓ Execution complete! cache_registry.json successfully populated.");

}

startPipeline();
parseCacheToUnifiedStructure();
