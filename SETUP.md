# Wawona Brewing Tap Room — Setup

## How it works

The site fetches beer data live from a Google Sheet. Update the sheet, refresh the page, and the tap list updates automatically. Ratings are saved locally in the browser.

---

## Google Sheet

The sheet is already configured. Sheet ID:

```
1a-l80qcKPBaGRXWX0ODP_8REFvYlEc7q9XbAUj06ljg
```

Sheet URL:
```
https://docs.google.com/spreadsheets/d/1a-l80qcKPBaGRXWX0ODP_8REFvYlEc7q9XbAUj06ljg/edit
```

---

## Column headers (Row 1)

| Column | Header | Notes |
|--------|--------|-------|
| A | `beer_name` | Required — the beer's full name |
| B | `brewery` | e.g. "Wawona Brewing" |
| C | `style` | IPA, Porter, Saison, etc. |
| D | `abv` | Just the number, e.g. `6.3` |
| E | `origin` | Optional location |
| F | `notes` | Tasting notes / description |
| G | `bjcp_category` | e.g. "13C — Brown British Beer" |
| H | `ibu` | Bitterness units |
| I | `og` | Original gravity, e.g. `1.056` |
| J | `fg` | Final gravity, e.g. `1.012` |
| K | `fermentables` | One per line: `Name \| Amount` |
| L | `hops` | One per line: `Name \| Amount` |
| M | `yeast` | Yeast strain name |
| N | `brewers_notes` | Process notes |

**Fermentables / Hops format** — each ingredient on its own line, name and amount separated by `|`:
```
Pale Malt 2-Row|10 lb
Crystal 60L|1 lb
```

---

## Publishing the sheet (required for the app to load data)

1. In Google Sheets: **File → Share → Publish to web**
2. Select **Sheet1** and **Comma-separated values (.csv)**
3. Click **Publish**

> This makes the sheet readable by the app. Ratings stay local in your browser only.

---

## Updating the tap list

- **Add a beer**: add a new row
- **Remove a beer**: use the "Off Tap" button in the app (admin mode), or delete the row from the sheet
- **Update info**: edit any cell — changes appear on next page refresh

---

## Admin mode

Tap the 🔒 icon on the splash screen. Default PIN: `1234`

Change it in `index.js` line 6:
```js
const ADMIN_PIN = '1234';
```

Admin features:
- **Off Tap** — moves a beer to the History screen
- **Restore** — brings it back to the active tap list

---

## Running locally

```bash
cd "/Users/scottsimons/Dev/Wawona Brewing"
python3 -m http.server 8003
```

Then open [http://localhost:8003](http://localhost:8003).

---

## Adding a logo

Place `logo.png` in the `Images/` folder. It will appear on the splash screen automatically (mix-blend-mode: multiply, so transparent backgrounds work best).

---

## Architecture

| File | Purpose |
|------|---------|
| `index.html` | App shell (4 screens: splash, tap list, scorecard, history) |
| `index.css` | All styles — forest green / amber theme |
| `index.js` | All app logic — data fetch, rating UI, scorecard |
| `SETUP.md` | This file |

**Data flow:**
- Beer data: Google Sheets CSV → fetched at page load → displayed as tap list
- Ratings: stored in browser `localStorage` under key `wb2026`
- No backend, no database, no accounts — pure static site
