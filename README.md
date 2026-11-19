# IFE Level 3 Revision (PWA)

Adaptive revision app. Version 0.3.1 contains Modules One, Two and Three. No AI and no sign-in in this version.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell |
| `app.js` | App logic: activities, adaptive engine, exam |
| `styles.css` | Look and feel (light and dark) |
| `config.js` | Pass mark, exam length, AI tutor switch (off) |
| `content/module1.js` | All Module One content |
| `content/module2.js` | All Module Two content |
| `content/module3.js` | All Module Three content (no Introduction pack: `noIntro: true`) |
| `sw.js` | Offline cache |
| `manifest.webmanifest`, `icons/` | Install-to-home-screen details |

## Put it on GitHub Pages

1. Create a new repository and upload every file and folder here, keeping the folder structure.
2. In the repository: Settings, Pages, deploy from the `main` branch, root folder.
3. Open the address GitHub gives you on your iPhone in Safari, then Share, Add to Home Screen.

A GitHub Pages address is public to anyone who has the link. The course content sits in the `content/` files in plain text. Do not share the link beyond people entitled to the course material until an access gate is in place.

## Updating

- Any change to any file: also change the `CACHE` name in `sw.js` (for example `ife3-v0.1.1`). Otherwise phones keep showing the old version.
- New content: add entries at the END of each list in the content file. Inserting in the middle scrambles saved progress.
- New module: copy `content/module1.js` to `content/module2.js`, change `id` to `m2`, add a script line in `index.html`, and add the file to `FILES` in `sw.js`.

## How the adaptive engine works

Every card, missing word, match pair, diagram label and exam question is tracked on the device.
An item right first time starts at "mostly known"; a wrong one starts at zero. Each later right answer moves it up a step, each wrong answer down a step.
Practice picks weak and unseen items more often. A unit shows green at 85% mastery. Progress is stored in the browser on that device only.

## AI tutor (not active)

`config.js` has an `ai` block. When a proxy exists, set `enabled: true` and `endpoint` to its address.
The app then shows an "Explain this" button after wrong answers and posts the item to that address, expecting `{ "text": "..." }` back.
Never put an AI provider key in these files.
