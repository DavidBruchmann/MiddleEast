const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Define strict path pointers mapping directly to the public directory architecture
const CONFIG_DIR = path.join(__dirname, '..', 'public', 'config');
const CACHE_DIR = path.join(__dirname, 'wikipedia_cache');

function runPreparationEngine() {
    console.log("==================================================");
    console.log("Executing Multi-Stage Self-Enriching Preparation...");
    console.log("==================================================\n");

    // Load source configurations
    const persons = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'persons.json'), 'utf-8'));
    const groups = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'groups.json'), 'utf-8'));
    const events = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'events.json'), 'utf-8'));
    let context = {};
    if (fs.readFileSync(path.join(CONFIG_DIR, 'context.json'))) {
        context = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'context.json'), 'utf-8'));
    }

    // STAGE A & B: Scan Events and Context to discover associated Persons & Groups automatically
    console.log("[STAGE A & B] Scanning Events & Context text files for entity extraction...");
    events.forEach(ev => scanTextForImplicitEntities(ev, 'en', persons, groups));
    if (context.length) {
        context.forEach(ctx => scanTextForImplicitEntities(ctx, 'en', persons, groups));
    }

    // STAGE C: Cross-reference Groups to extract dynamic historical member associations
    console.log("\n[STAGE C] Validating Person-to-Group structural affiliations...");
    persons.forEach(person => {
        // Look up birth and death data properties natively from the HTML text dumps
        extractAndValidateVitalDates(person);

        // Check if their declared group affiliations match your valid master groups registry
        if (person.affiliations) {
            person.affiliations.forEach(aff => {
                const groupExists = groups.some(g => g.id === aff.group_id);
                if (!groupExists) {
                    console.warn(`  ⚠️  WARNING: Person "${person.english_title}" references unknown Group ID: "${aff.group_id}"`);
                }
            });
        }
    });

    console.log("\nPreparation complete. You are clear to execute 'npm run parse'.");
}

/**
 * Searches downloaded HTML text archives for keywords to discover entities automatically
 */
function scanTextForImplicitEntities(sourceNode, lang, persons, groups) {
    const filePath = path.join(CACHE_DIR, lang, `${sourceNode.english_title}.html`);
    if (!fs.existsSync(filePath)) return;

    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(htmlContent);
    const bodyTextLower = $.text().toLowerCase();

    // Scan for hidden persons mentioned inside this event/context text dump
    persons.forEach(p => {
        const isMentioned = p.keywords.some(kw => {
            return bodyTextLower.includes(kw.toLowerCase())
        });
        if (isMentioned) {
            // Log the relationship discovery gracefully
            console.log(`  💡 DISCOVERY: Found Person "${p.english_title}" active inside Topic: "${sourceNode.english_title}"`);
        }
    });
}

function getMonthByName(monthNameString) {
    const monthsMatrixMap = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
    const cleanLowerKey = String(monthNameString || "").trim().toLowerCase();
    return monthsMatrixMap[cleanLowerKey] || null; // ~~Fallback cleanly to January 1st if unmatched~~
}
function findAndParseDate(dateType = 'birth', htmlContent) {
    let parsedDate = null;
    // const jsonBirthDateMatch = htmlContent.match(/\"birth_date\"\:\{\"wt\"\:\"((\d{1,2})\s?(January|February|March|April|May|June|July|August|September|October|November|December)?\s?((17|18|19|20)\d{2})?)\"}/);
    const jsonBirthDateMatch = htmlContent.match(/\"birth_date\"\:\{\"wt\"\:\"((?:(\d{1,2})\s+)?(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?((?:17|18|19|20)\d{2}))\"}/i);
    const jsonDeathDateMatch = htmlContent.match(/\"death_date\"\:\{\"wt\"\:\"((?:(\d{1,2})\s+)?(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?((?:17|18|19|20)\d{2}))\"}/i);
    jsonDateMatch = dateType == 'birth' ? jsonBirthDateMatch : jsonDeathDateMatch;
    if (jsonDateMatch) {
    // jsonDateMatch[8] = null;
    console.log(jsonDateMatch);
        const rawExtractedYearString  = jsonDateMatch[4] ? jsonDateMatch[4].trim() : null; // Group 4: The 4-digit Year (e.g. 1798)
        const rawExtractedMonthString = jsonDateMatch[3] ? jsonDateMatch[3].trim() : null; // Group 3: The Text Month (e.g. October)
        const rawExtractedDayString   = jsonDateMatch[2] ? jsonDateMatch[2].trim() : null; // Group 2: The Numeric Day (e.g. 27)
        parsedDate = rawExtractedYearString;
        if (rawExtractedMonthString) {
            const calculatedMonthIndex = getMonthByName(rawExtractedMonthString);
            parsedDate += '-' + calculatedMonthIndex;
            if (rawExtractedDayString) {
                // FIXED: Pad single digit day variables with a leading zero to lock strict ISO formats
                const cleanPaddedDayValue = rawExtractedDayString.padStart(2, '0');
                parsedDate += '-' + cleanPaddedDayValue; // FIXED: Appends the day index variable, NOT a month function!
            }
        }
    }
    if (!parsedDate) {
        const $ = cheerio.load(htmlContent);
        const elm = dateType == 'birth' ? 'span.bday' : 'span.dday';
        let cheeiroTagElement = $(elm).first().attr('datetime');
        parsedDate = cheeiroTagElement?.trim();
        if (!parsedDate) {
            // console.warn(`  ⚠️  Validation warning: Missing or unparseable ${dateType}date data fields structural context.`);
        }
    }
    // if (parsedDate) console.log(`  ✓ Successfully processed ${dateType}date profile parameter: ${parsedDate}`);
    return parsedDate;
}

/**
 * Searches the English Wikipedia file to extract vital dates, logging warnings if missing
 */
function extractAndValidateVitalDates(person) {
    const filePath = path.join(CACHE_DIR, 'en', `${person.english_title}.html`);
    if (!fs.existsSync(filePath)) {
        console.log(filePath);
        console.warn(`  ⚠️  WARNING: Local text cache missing for Person: "${person.english_title}"`);
        return;
    }

    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(htmlContent);

    // Search for Wikipedia's standard ISO birthday metadata tags
    let birthDate = findAndParseDate('birth', htmlContent);
    let deathDate = findAndParseDate('death', htmlContent);
    // Fallback: search infobox table rows if the standard microformat classes are missing
    if (!birthDate || !deathDate) {
        $('.infobox tr').each((i, el) => {
            const th = $(el).find('th').text().toLowerCase();
            const td = $(el).find('td').text().trim();
            if (!birthDate && th.includes('born')) {
                // Use a basic regex to grab a 4-digit year string out of the text block as a fallback
                const yearMatch = td.match(/\b(17|18|19|20)\d{2}\b/);
                if (yearMatch) birthDate = `${yearMatch[0]}`;
            }
            if (!deathDate && th.includes('died')) {
                const yearMatch = td.match(/\b(17|18|19|20)\d{2}\b/);
                if (yearMatch) deathDate = `${yearMatch[0]}`;
            }
        });
    }

    // LOGGING AND WARNING PASS
    if (!birthDate) {
        console.warn(`  ❌ MISSING DATA: Could not extract valid Birth Date for figure: "${person.english_title}"`);
    } else {
        person.extracted_birth = birthDate;
        if (deathDate) person.extracted_death = deathDate;
    }
    // LOGGING AND WARNING PASS
    if (!deathDate) {
        console.warn(`  ❌ MISSING DATA: Could not extract valid Death Date for figure: "${person.english_title}"`);
    } else {
        person.extracted_death = deathDate;
    }
}

runPreparationEngine();
