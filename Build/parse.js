const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const CONFIG_DIR = path.join(__dirname, '../public', 'config');
const CACHE_DIR = path.join(__dirname, 'wikipedia_cache');
const GENERATED_DIR = path.join(__dirname, '../public', 'generated');

const eventMap = new Map();

function standardizeKey(str) {
    if (!str) return "";
    return decodeURIComponent(str).toLowerCase().replace(/[\s\-_–—]/g, '');
}

function parseAndGenerateDataFiles() {
    console.log("Compiling clean multi-language description matrix...");
    fs.mkdirSync(GENERATED_DIR, { recursive: true });

    const configEvents = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'events.json'), 'utf-8'));
    const configGroups = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'groups.json'), 'utf-8'));
    const configPersons = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'persons.json'), 'utf-8'));
    const configContext = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'context.json'), 'utf-8'));

    configEvents.forEach(e => {
        const eventId = `ev_${standardizeKey(e.english_title)}`;

        const eventNode = {
            id: eventId,
            title: e.display_title_override || e.english_title.replace(/_/g, ' '),
            start: e.start,
            end: e.end || null,
            perp_ids: e.perp_ids || [],
            context_id: e.context_id || null,
            bg_image_url: e.bg_image_url || '',
            descriptions: {}, // ◄ FIXED: Structural multi-lang dictionary
            source: []
        };

        const langs = ['en', 'de', 'ar', 'he', 'id', 'es', 'fr'];
        langs.forEach(lang => {
            let filePath = path.join(CACHE_DIR, lang, `${e.english_title}.html`);
            if (!fs.existsSync(filePath)) return;

            const html = fs.readFileSync(filePath, 'utf-8');
            console.log (filePath, html.substring(0, 200));
            let text = '';
            let $ = cheerio.load(html);

            // Extract the first valid paragraph for THIS specific language folder pass
            const p = $('p').filter((i, el) => $(el).text().trim().length > 40).first().text().trim();
            if (p) {
                eventNode.descriptions[lang] = p.substring(0, 450).replace(/\[\d+\]/g, '') + "...";
                //console.log (filePath, p);
            } else {
                filePath = path.join(CACHE_DIR, lang, `${e.english_title}.txt`);
                text = fs.readFileSync(filePath, 'utf-8');
                console.log (filePath, text);
                if (text) {
                    eventNode.descriptions[lang] = text;
                }
            }

            $('script, style, .mw-empty-elt, .navbox, .infobox, footer').remove();
            eventNode.source.push({
                slug: e.english_title,
                lang: lang,
                strlength: (text ? text : $.text().replace(/\s+/g, ' ').length)
            });
        });

        eventMap.set(eventId, eventNode);
    });

    // Year-only mathematical sorting weights execution pass
    let compiledEventsArray = Array.from(eventMap.values());
    compiledEventsArray.forEach(e => {
        const pureYearInt = parseInt(String(e.start).substring(0, 4), 10);
        e._sortWeight = pureYearInt * 10000;
    });

    compiledEventsArray.sort((a, b) => a._sortWeight - b._sortWeight);
    compiledEventsArray.forEach(e => delete e._sortWeight);

    fs.writeFileSync(path.join(GENERATED_DIR, 'events.json'), JSON.stringify(compiledEventsArray, null, 2));
    fs.writeFileSync(path.join(GENERATED_DIR, 'groups.json'), JSON.stringify(configGroups, null, 2));
    fs.writeFileSync(path.join(GENERATED_DIR, 'persons.json'), JSON.stringify(configPersons, null, 2));
    fs.writeFileSync(path.join(GENERATED_DIR, 'context.json'), JSON.stringify(configContext, null, 2));

    console.log("✓ public/generated/ folder completely updated with localized descriptions.");
}

parseAndGenerateDataFiles();
