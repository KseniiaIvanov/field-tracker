# Methods in Ecology and Evolution — Code checklist

**Manuscript:** Field Campaign Tracker: an offline-first mobile application for standardized Arctic field data collection and representativeness-aware sampling
**Article type:** Application
**Date completed:** ___________

> This checklist accompanies the manuscript and is uploaded as a **“File for editors.”** It follows the items in the MEE *Applications* code-availability policy. Before submission, download the current official checklist from the MEE Applications page and confirm the wording, because the journal updates it from time to time. Replace every `[ … ]` below with the real value.

---

## 1. Source code availability

- [x] The complete source code is available in an open repository that can be viewed **without a login (anonymously)**.
  - Repository URL: `[https://github.com/USER/REPO]`
  - Branch / tag documented in this paper: `[vX.Y.Z]` (commit `[hash]`)
- [x] A live demonstration instance is available: `[https://USER.github.io/field-tracker/]`

## 2. Installation and running instructions

- [x] The repository contains a `README` describing how to install and run the software.
  - Build/run: `npm install` then `npm run dev` (development) or `npm run build` (production bundle).
- [x] The software runs in a standard web browser; no app-store installation, account or server is required.
- [x] Minimum instructions to reproduce are present (clone → install dependencies → run).

## 3. Language(s) and version(s)

- [x] Programming language(s) and version(s) specified:
  - JavaScript / JSX, **React 19**, built with **Vite 8** (Node.js ≥ 18 to build).
- [x] Target runtime specified: any current Chromium-based browser (Chrome/Edge) for full functionality, including direct-to-folder export; Safari/WebKit (iOS) supported for all features except direct-to-folder export.

## 4. Dependencies

- [x] All dependencies and versions are declared in `package.json` and resolved by the npm package manager. Key runtime dependencies:
  - geotiff (^3.0.5), leaflet (^1.9.4), leaflet-draw (^1.0.4), proj4 (^2.20.8), shpjs (^6.2.0), turf (^3.0.14), localforage (^1.10.0), papaparse (^5.5.3), xlsx (^0.18.5), piexifjs (^1.0.6), jszip (^3.10.1), react / react-dom (^19), react-hook-form (^7.73.1).
- [x] No dependence on non-bundled external binaries beyond Node.js/npm for building.
- [ ] If the worked-example figures are regenerated from Python, note the figure-generation dependencies (matplotlib, numpy, Pillow) in the repository `figures/README`.

## 5. Licence

- [ ] An open-source licence file is present in the repository. Licence chosen: `[MIT / GPL-3.0]`.

## 6. Example / test data

- [x] Example data are provided so a reviewer can run the worked example: the Inuvik (Mackenzie Delta) campaign raster and a small set of example site records.
- [ ] Example data archived with the release (see item 7).

## 7. Archiving at acceptance

- [ ] At acceptance, a tagged release of the source code will be deposited in a permanent archive with a citable DOI: **Zenodo** DOI `[10.5281/zenodo.XXXXXXX]`.
- [ ] The archived version matches the version described in the manuscript (`[vX.Y.Z]`, commit `[hash]`).

## 8. Support and issues

- [x] An issue tracker is available for bug reports and questions: `[https://github.com/USER/REPO/issues]`.
- [x] A contact for correspondence is given in the manuscript.

---

### Summary statement (copy into the manuscript “Data and code for peer review” line)

> Field Campaign Tracker is open source (JavaScript/JSX, React 19, Vite). The source can be inspected anonymously at `[repo URL]`; a live instance runs at `[demo URL]`. Dependencies are declared in `package.json` and resolved by npm. At acceptance the release will be archived on Zenodo with a citable DOI.
