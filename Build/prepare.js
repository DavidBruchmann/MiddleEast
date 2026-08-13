const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Define strict path pointers mapping directly to the public directory architecture
const CONFIG_DIR = path.join(__dirname, '../public', 'config');
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
        const isMentioned = p.keywords.some(kw => bodyTextLower.includes(kw.toLowerCase()));
        if (isMentioned) {
            // Log the relationship discovery gracefully
            console.log(`  💡 DISCOVERY: Found Person "${p.english_title}" active inside Topic: "${sourceNode.english_title}"`);
        }
    });
}

/**
 * Searches the English Wikipedia file to extract vital dates, logging warnings if missing
 */
function extractAndValidateVitalDates(person) {
    const filePath = path.join(CACHE_DIR, 'en', `${person.english_title}.html`);
    if (!fs.existsSync(filePath)) {
        console.warn(`  ⚠️  WARNING: Local text cache missing for Person: "${person.english_title}"`);
        return;
    }

    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(htmlContent);

    // Search for Wikipedia's standard ISO birthday metadata tags
    let birthDate = $('.bday').first().attr('datetime') || $('.bday').first().text().trim();
    let deathDate = $('.dday').first().attr('datetime') || null;

    // Fallback: search infobox table rows if the standard microformat classes are missing
    if (!birthDate) {
        $('.infobox tr').each((i, el) => {
            const th = $(el).find('th').text().toLowerCase();
            const td = $(el).find('td').text().trim();
            if (th.includes('born')) {
                // Use a basic regex to grab a 4-digit year string out of the text block as a fallback
                const yearMatch = td.match(/\b(18|19|20)\d{2}\b/);
                if (yearMatch) birthDate = `${yearMatch[0]}-01-01`;
            }
            if (th.includes('died')) {
                const yearMatch = td.match(/\b(18|19|20)\d{2}\b/);
                if (yearMatch) deathDate = `${yearMatch[0]}-01-01`;
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
}

runPreparationEngine();
