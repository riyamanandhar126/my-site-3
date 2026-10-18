# Dynamic page code (waiting for the pages to exist)

Wix only creates page code files for pages that exist in the editor, and it
ignores page files created anywhere else. So this code waits here until the
two dynamic pages are added in Wix Studio (BUILD-GUIDE step 5).

| File | Goes into |
|---|---|
| `continent-item.js` | the **Continents (Item)** page code, e.g. `src/pages/Continents (Item).xxxxx.js` |
| `country-item.js` | the **Countries (Item)** page code, e.g. `src/pages/Countries (Item).xxxxx.js` |

After you create the dynamic pages in the editor, Wix adds their code files to
`src/pages/` (the `xxxxx` part is an ID Wix chooses). Paste each file's
contents into the matching page file, either in the Wix code panel or by
replacing the file in this repo, then delete this folder.

Both files import from `public/archive.js`, which is already in `src/public/`.
