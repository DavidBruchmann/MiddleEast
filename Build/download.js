const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const https = require('https');

// Define the root target topics (English names) and the specific languages to download
// Just add the exact English title slug below

const EVENT_ARTICLES = [
    "Petah_Tikva",
    "Pogroms_in_the_Russian_Empire",
    "Judah_Alkalai",
    "Partitioning_of_the_Ottoman_Empire",
    "London_Conference_(1939)",
    "1948_Arab–Israeli_War",
    "Aliyah",
    "First_Aliyah",
    "Second_Aliyah",
    "Third_Aliyah",
    "Fourth_Aliyah",
    "Fifth_Aliyah",
    "Aliyah_Bet",
    "Nakba",
    "Ongoing_Nakba",
    "Zionist_movement",
    "Deir_Yassin_massacre", // Lehi, Irgun
    "King_David_Hotel_bombing",
    "Walter_Guinness,_1st_Baron_Moyne#Assassination",
    "Israeli_Declaration_of_Independence",
    "Suez_Crisis",
    "Six-Day_War",
    "Yom_Kippur_War",
    "Sabra_and_Shatila_massacre",
    "First_Intifada",
    "Oslo_I_Accord",
    "Second_Intifada",
    "First_Zionist_Congress",
    "Sykes–Picot_Agreement",
    "Jaffa_riots",
    "1929_Palestine_riots",
    "1936–1939_Arab_revolt_in_Palestine",
    "United_Nations_Partition_Plan_for_Palestine",
    "Balfour_Declaration",
    "White_Paper_of_1939",
];

const FRAMEWORK_ARTICLES = [
    "Balfour_Declaration",
    "United_Nations_Partition_Plan_for_Palestine",
    "Sykes–Picot_Agreement",
    "White_Paper_of_1939",
];
const PEOPLE_ARTICLES = [

    // --- Pro Israel ---
    "David_Ben-Gurion", // Prime minister of Israel from 1948 to 1953, 1955 to 1963
    "Moshe_Sharett", // Prime minister of Israel from 1954 to 1955
    "Levi_Eshkol", // Prime minister of Israel from 1963 to 1969
    "Yigal Allon", // Prime minister of Israel 1969
    "Golda_Meir", // Prime minister of Israel from 1969 to 1974
    "Yitzhak_Rabin", // Prime minister of Israel from 1974 to 1977
    "Menachem_Begin", // Prime minister of Israel from 1977 to 1983
    "Yitzhak_Shamir", // Prime minister of Israel from 1983 to 1984, 1986 to 1992
    "Shimon_Peres", // Prime minister of Israel from 1984 to 1986, 1995 to 1996
    "Yitzhak_Rabin", // Prime minister of Israel from 1992 to 1995
    "Benjamin_Netanyahu", // Prime minister of Israel from 1996 to 1999, 2009 to 2021, 2022 to now
    "Ehud_Barak", // Prime minister of Israel from 1999 to 2001
    "Ariel_Sharon", // Prime minister of Israel from 2001 to 2006
    "Ehud_Olmert", // Prime minister of Israel from 2006 to 2009
    "Naftali_Bennett", // Prime minister of Israel from 2021 to 2022
    "Yair_Lapid", // Prime minister of Israel 2022


    "Avraham_Stern", // founder of Lehi_(militant_group)
    "Eliyahu_Bet-Zuri", // Lehi
    "Eliyahu_Hakim", //Lehi
    "Zvi_Hirsch_Kalischer",
    "Moses_Hess", // foundational thinker of modern Zionism 1862: book "Rome and Jerusalem: The Last National Question"
    "Leon_Pinsker",
    "Mark_Sykes",
    "François_Georges-Picot",
    "Theodor_Herzl",
    "Eliezer_Ben-Yehuda",
    "Chaim_Weizmann",
    "Amin_al-Husseini",
    // --- Pro Palestine ---
    "Yasser_Arafat",

    // --- Britains ---
    "Neville_Chamberlain", // Prime Minister of the United Kingdom from May 1937 to May 1940 and Leader of the Conservative Party from May 1937 to October 1940
    "Walter_Guinness,_1st_Baron_Moyne", // British minister of state in the Middle East until November 1944, when he was assassinated by the Zionist terrorist group Lehi in Cairo


    "Ezer_Weizman", // President of Israel from 1993 to 2000
    "Judah_Alkalai" // Yehuda_Alkalai"
];
const GROUP_ARTICLES = [
    // --- Pro Israel ---
    // old Jews in Palestinian Area
    "Yishuv",
    "Old_Yishuv",
    "Yishuv#New_Yishuv",
    // Terror Groups
    "Haganah",
    "Irgun",
    "Lehi_(militant_group)",  // founded by Avraham_Stern
    // Israeli political parties
    "Herut", // right-wing party
    "Likud", // right-wing party

    // --- Pro Palestine ---
    "Fatah",
    "National_Defence_Party_(Palestine)",

    // Misc.
    "Peel_Commission",
    "British_government",
];
const IDEALOGICAL_ARTICLES = [
    "Zionism",
];

const TARGET_ARTICLES = {
    'events': EVENT_ARTICLES,
    'people': PEOPLE_ARTICLES,
    'groups': GROUP_ARTICLES,
    'ideology': IDEALOGICAL_ARTICLES,
};
/*
[
    // "Cyrus_the_Great",
    // "Jewish_diaspora",

];
*/

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
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data.json');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const eventMap = new Map();

// Helper utility to safely convert text month string characters into zero-padded numeric indices
function getMonthByName(monthNameString) {
    const monthsMatrixMap = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
    const cleanLowerKey = String(monthNameString || "").trim().toLowerCase();
    return monthsMatrixMap[cleanLowerKey] || null; // ~~Fallback cleanly to January 1st if unmatched~~
}
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

            // 1. Initialize your data pointer tracking states explicitly as text strings
            let birthDateTextOutput = null;

            const jsonBirthDateMatch = htmlContent.match(/\"birth_date\"\:\{\"wt\"\:\"((\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) ((17|18|19|20)\d{2}))\"}/);
            if (jsonBirthDateMatch) {
                const rawExtractedYearString  = jsonBirthDateMatch[5].trim(); // Group 5: The 4-digit Year (e.g. 1798)
                const rawExtractedMonthString = jsonBirthDateMatch[3].trim(); // Group 3: The Text Month (e.g. October)
                const rawExtractedDayString   = jsonBirthDateMatch[2].trim(); // Group 2: The Numeric Day (e.g. 27)

                // Compile baseline year node anchor
                birthDateTextOutput = rawExtractedYearString;

                if (rawExtractedMonthString) {
                    const calculatedMonthIndex = getMonthByName(rawExtractedMonthString);
                    birthDateTextOutput += '-' + calculatedMonthIndex;

                    if (rawExtractedDayString) {
                        // FIXED: Pad single digit day variables with a leading zero to lock strict ISO formats
                        const cleanPaddedDayValue = rawExtractedDayString.padStart(2, '0');
                        birthDateTextOutput += '-' + cleanPaddedDayValue; // FIXED: Appends the day index variable, NOT a month function!
                    }
                }
            }
            if (!birthDateTextOutput) {
                // Look for standard frontend elements inside the DOM header
                const cheeiroBdayTagElement = $('span.bday').first().attr('datetime');
                birthDateTextOutput = cheeiroBdayTagElement.trim();
                if (!birthDateTextOutput) {
                    console.warn(`  ⚠️  Validation warning: Missing or unparseable birthdate data fields structural context.`);
                }
            }
            // if (birthDateTextOutput) console.log(`  ✓ Successfully processed birthdate profile parameter: ${birthDateTextOutput}`);

// console.log(birthDateTextOutput);
            if (birthDateTextOutput) {
// console.log(localizedTitle, birthDateTextOutput);
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
            res.on('end', () => resolve({
                ok: res.statusCode === 200,
                status: res.statusCode,
                body: data
            }));
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
        if (!response.ok) {
          console.error(`  ✕ ERROR: URL not reached: ${urlObj.toString()} not reached`); //return null;
        }

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

        // Return parameters alongside the true page ID
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

function getFilePath(lang, slug, suffix) {
    const targetFolder = path.join(BASE_CACHE_DIR, lang);
    if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

    const destinationPath = path.join(targetFolder, `${slug}.${suffix}`);
    return destinationPath;
}

async function downloadArticleHtml(lang, slug, force = false) {
    const targetFolder = path.join(BASE_CACHE_DIR, lang);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const destinationPath = getFilePath(lang, slug, `html`);
    // Don't re-download if file exists
    if (fs.existsSync(destinationPath) && !force) return;

    const restUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(slug)}`;
    try {
        const response = await makeRequest(restUrl);
        //console.log(response);
        if (response.ok) {
            const articleHtml = response.body;
            fs.writeFileSync(destinationPath, articleHtml, 'utf-8');
            console.log(`  ✓ [${lang.toUpperCase()}] HTML Cached: ${slug}`);
            return articleHtml;
        }
    } catch (err) {
        console.error(`  ✕ Download failed for ${slug}: ${err.message}`);
    }
}

async function downloadArticleText(lang, slug) {
    const targetFolder = path.join(BASE_CACHE_DIR, lang);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    
    //const destinationPath = path.join(targetFolder, `${slug}.txt`);
    const destinationPath = getFilePath(lang, slug, `txt`);

    // api.php?action=query&prop=extracts&exchars=175&titles=Therion
    const urlObj = new URL(`https://${lang}.wikipedia.org/w/api.php`);

    // 2. Set API query parameters using safe native key/value dictionary sets
    urlObj.searchParams.set('action', 'query');
    urlObj.searchParams.set('prop', 'extracts');
    urlObj.searchParams.set('explaintext', '1');
    urlObj.searchParams.set('exsentences', '10');
    urlObj.searchParams.set('exsectionformat', 'plain');
    urlObj.searchParams.set('titles', `${encodeURIComponent(slug)}`);
    urlObj.searchParams.set('format', 'json');
    urlObj.searchParams.set('redirects', '1');

    try {
        const response = await makeRequest(urlObj.toString());
        if (!response.ok) {
            console.log('Error during download.');
            return null;
        }
// console.log(response);
        const data = JSON.parse(response.body);
        const pages = data?.query?.pages || {};
        const pageId = Object.keys(pages)[0];
        if (!pageId || pageId === "-1") {
            return null;
        }
//console.log(pages[pageId]);
        const articleText = pages[pageId]?.extract || null;
        fs.writeFileSync(destinationPath, articleText, 'utf-8');
        console.log(`  ✓ [${lang.toUpperCase()}] TEXT Cached: ${slug}`);
        return articleText;
    } catch (err) {
        console.error(`  ✕ Download failed for ${slug}: ${err.message}`);
    }
}

async function startPipeline() {
    console.log("Running Multi-Language Wikipedia Sync Engine...\n");

    if (!fs.existsSync(BASE_CACHE_DIR)) fs.mkdirSync(BASE_CACHE_DIR, { recursive: true });

    let registry = {};

    //  for (const englishArticle of TARGET_ARTICLES) {
    Object.keys(TARGET_ARTICLES).forEach(function(key, englishArticle) {
      if (englishArticle.length) {
        const cleanEnglishSlug = englishArticle.replace(/ /g, '_');
        console.log(`Processing Topic: "${cleanEnglishSlug}"`);
//console.log(cleanEnglishSlug + '_1');

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
                const html = await downloadArticleHtml(lang, currentSlug);
                const text = await downloadArticleText(lang, currentSlug);
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
// downloadArticleText('fr', 'Fatah');
