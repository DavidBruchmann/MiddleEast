# Israel in the Middle East: Historical Conflict Ledger

An interactive, multi-language chronological ledger tracking geopolitical milestones, individual
actors, institutional factions, and historical eras from 1843 to the modern day.

## 🌍 Visitor Overview (Quick Start)

Welcome to the Historical Conflict Ledger. This platform is a static web application designed to
help researchers explore historical timelines through an objective, data-density-driven lens.

### How to Interact with the Site:
*   **The Timeline Track (Top):** Displays historical events organized by their start years.
    The timeline automatically stacks overlapping events vertically so everything remains perfectly
    readable.
*   **Fuzzy Dates (Striped Bars):** Events with uncertain timelines (where only the year is
    historically known) are visually marked with a distinctive diagonal striped pattern.
*   **The Narrative List (Right):** A compact, chronological registry of all recorded milestones.
    Clicking any card in this list will instantly slide and center the top timeline track directly
    onto that event.
*   **The Centered Inspector (Bottom):** Selecting any event loads its full summary description,
    historical photos, and direct links to its original source materials.
*   **Language Dropdown:** Switch between English (EN), German (DE), Arabic (AR), Hebrew (HE),
    Indonesian (ID), French (FR), and Español (ES). Switching to Arabic or Hebrew automatically
    flips the text alignment right-to-left (RTL).
*   **Theme Dropdown:** Hot-swap between Light, Dark, or your operating system's default
    high-contrast theme layout.

---

## 🛠️ Contributor & Developer Guide

This project relies on a two-stage **"Prepare-then-Parse" Static Build Architecture**. It isolates
hand-curated configurations from automatically compiled assets to ensure that no padded dates
(like `-01-01`) or broken translation strings ever leak into the public user interface.

### 📁 The Directory Matrix Layout

Developers must respect the strict boundary boundaries between your raw inputs and automated outputs:

```text
MiddleEast/
├── package.json               # Shorthand terminal execution tasks scripts
├── Build/                     # Scripts and file-cache for downloads from wikipedia.org
│   ├── wikipedia_cache/       # ◄ AUTOMATED file-cache for downloads from wikipedia.org (Never edit manually)
│   ├── download.js            # Contacts Wikipedia text API to cache summaries
│   ├── prepare.js             # Scans cached files and logs data gaps/warnings
│   └── parse.js               # Sorts, merges, and generates public assets
│
└── public/                    # Client-Accessible Static Web Root
    ├── index.html             # Core frontend UI viewport
    ├── styles.css             # WCAG AAA High-Contrast CSS themes
    │
    ├── config/                # ◄ MAINTAINED MANUALLY (Your raw inputs)
    │   ├── groups.json        # Factions, states, and violent mobs
    │   ├── persons.json       # Historical figures & time-bounded roles
    │   ├── events.json        # War milestones, treaties, and phases
    │   └── context.json       # Background concepts (e.g., Aliyah, Nakba)
    │
    └── generated/             # ◄ AUTOMATED DATASETS (Never edit manually)
        ├── events.json        # Chronologically pre-sorted complete ledger
        ├── groups.json        # Unified organizational metadata registry
        ├── persons.json       # Figures with compiled birth/death profiles
        └── context.json       # Enriched macro-historical framework guides
```

### 🧱 1. How to Add or Edit Data (Manual Maintenance)

To grow the timeline database ledger, you only ever touch the files inside `public/config/`.

#### Adding an Event to `public/config/events.json`:

If an exact calendar date is unknown, enter a raw 4-digit year string. To enforce an exact causal
sequence between events that share the same year, use the `sort_anchors` object block:

```json
  {
    "id": "ev_first_aliyah",
    "english_title": "First_Aliyah",
    "start": "1881",
    "end": "1903",
    "context_id": "context_aliyah",
    "bg_image_url": "https://example.com",
    "sort_anchors": {
      "after": "ev_pogroms_wave1"
    }
  }
```

#### Adding a Figure to `public/config/persons.json`:

Do not type birthdates or long summaries; the scripts handle this. Instead, define keywords across
languages for text scanning, and map their shifting, time-bounded historical roles inside the
`affiliations` array:

```json
  {
    "id": "person_ben_gurion",
    "english_title": "David_Ben-Gurion",
    "side": "Israeli",
    "keywords": ["ben-gurion", "بن غوريون", "בן-גוריון"],
    "affiliations": [
      { "group_id": "group_haganah", "role": "Leader", "start": "1935", "end": "1948" },
      { "group_id": "group_israeli_govt", "role": "Prime Minister", "start": "1948", "end": "1963" }
    ]
  }
```

### ⚙️ 2. Running the Data Pipeline (The Workflow)

Whenever you add new topics or modify configurations, run your terminal development lifecycle scripts
sequentially:

#### Step A: Download New Article Data

Add your new English Wikipedia article page slugs directly into the `TARGET_ARTICLES` array at the
top of `download.js`, then execute from the repository-root (no need to change the directory into
the 'Build' folder):

```bash
npm run download
```

This contacts the official MediaWiki API to find matching translation links for all 7 languages and
downloads clean, text-only plain JSON summaries into your local `wikipedia_cache/` folder.

#### Step B: Audit Data & Check Gaps

Execute the preparation validation layer from the repository-root:

```bash
npm run prepare
```

The script will analyze your cached text dumps, automatically cross-reference affiliations, look up
birth/death values, and print explicit error logs and warning alerts to your terminal screen if
properties are missing.

#### Step C: Build the Static Web Assets

Compile and sort your dataset files from the repository-root:

```bash
npm run parse
```

This script reads your raw inputs, extracts descriptions from your text caches across all languages,
maps items to exact mathematical mid-year sorting scores, and compiles the final uncorrupted arrays
cleanly into `public/generated/`.

### 💻 3. Local Testing & Verification

Modern web browsers block loading local data files via `file:///` paths due to secure CORS policies.
To test your changes locally before deploying:

1. Launch your built-in lightweight local development HTTP preview server from the repository-root:

   ```bash
   npm start
   ```

2. Navigate your web browser to: `http://localhost:8080`
3. Verify that changing languages updates your descriptions, check that text direction scales
   correctly, and test that your background graphics scale smoothly above the card panel decks.

### 🚀 4. Deployment

Once your local verification is complete, push your updates to GitHub. Ensure your repository
settings under **Settings ➔ Pages** are configured to deploy from your active branch pointing
directly to the `/public` folder root path.
