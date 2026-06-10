# Field Campaign Tracker: an offline-first mobile application for standardized Arctic field data collection and representativeness-aware sampling

**Target journal:** *Methods in Ecology and Evolution* (British Ecological Society / Wiley)
**Article type:** Application
**Running headline:** A mobile app for representativeness-aware field sampling
**Open access:** This is a fully Gold Open Access journal; the article will be published under a Creative Commons Attribution (CC BY) licence. The open-access charge is covered centrally for the Max Planck corresponding author under the Projekt DEAL / Wiley agreement (confirmed in the MPG OA Journal Finder). The corresponding author must therefore be the Max Planck–affiliated author, must state the Max Planck affiliation, and should use a Max Planck e-mail address throughout submission.

---

## Authors

[Author One]^1,*, [Author Two]^2, [Author Three]^1

^1 Max Planck Institute for Biogeochemistry, Hans-Knöll-Straße 10, 07745 Jena, Germany
^2 [Department / Institute, University, City, Country]

\* Correspondence: [name], Max Planck Institute for Biogeochemistry, Jena, Germany ([name]@bgc-jena.mpg.de). *The corresponding author must be the Max Planck–affiliated author for the open-access charge to be covered centrally.*

**ORCID:** [add ORCID identifiers for all authors]

---

## Abstract

1. Field campaigns in Arctic and other remote ecosystems produce diverse, multi-thematic data that must be recorded consistently, georeferenced accurately and stored reliably, often without network coverage. Point measurements are also widely used to represent larger landscapes, yet the spatial representativeness of the sampled points is rarely assessed in the field, when the sampling design can still be adjusted.

2. We present **Field Campaign Tracker (FCT)**, a free, offline-first web application that runs in a standard mobile browser and can be installed as a Progressive Web App. FCT combines a structured digital field diary with two spatial decision-support tools: an analysis of how well the sampled sites cover the distribution of environmental variables across a study area, and an adaptive-sampling planner that proposes new measurement locations targeting under-represented conditions.

3. The data-collection modules cover site description, weather, plant functional-type cover and height, soil profile and active-layer depth, and surface morphology, together with GPS capture (with on-device averaging), geotagged photographs and voice notes. The representativeness module overlays sites on user-supplied raster layers (e.g. vegetation or wetness indices), extracts per-site values within the GPS-accuracy buffer, and compares the sampled distribution with that of the whole study area using overlaid histograms and a coverage score. The planner identifies under-sampled value ranges and generates prioritized candidate coordinates. All records are stored locally and exported in open formats (JSON, text and CSV).

4. FCT lowers the technical barrier to standardized, representativeness-aware sampling. Because it works entirely offline on consumer smartphones and requires no account or server infrastructure, it is suitable for short, logistically constrained expeditions. The application is open source and modular, so the data schema and analysis layers can be adapted to other biomes and monitoring programmes.

**Keywords:** active layer, adaptive sampling, Arctic tundra, data standardization, field data collection, mobile application, Progressive Web App, spatial representativeness, upscaling, vegetation survey

**Data and code for peer review:** Field Campaign Tracker is open source. The full source code can be inspected anonymously (no login required) at [https://github.com/USER/REPO], and a live demonstration instance is available at [URL]. The language (JavaScript/JSX), build system (Vite) and all dependencies are listed in the repository. The completed MEE code checklist is provided as a separate file for the editors. No empirical dataset underlies the methodological description; the example data used for the worked example and figures will be archived on Zenodo at acceptance.

---

## 1 | Introduction

Ecological understanding of high-latitude ecosystems depends on field observations that are collected under difficult logistical conditions: short field seasons, limited or absent network connectivity, cold weather that constrains the use of paper forms and laptops, and study areas that are large and spatially heterogeneous relative to the number of plots that can be measured (Walker et al., 2005; Brown et al., 2000). These constraints have two practical consequences. First, data are often recorded on paper and transcribed later, which is time-consuming and error-prone and which discourages the use of controlled vocabularies and standardized units. Second, sampling designs are usually fixed before fieldwork and are rarely evaluated against the actual environmental variability of the study area while the team is still in the field.

The second point is particularly important for upscaling. Point and plot measurements—of greenhouse-gas fluxes, vegetation cover, soil temperature or active-layer depth—are routinely used to characterize areas that are orders of magnitude larger than the measured footprint (Chu et al., 2021; Virkkala et al., 2021). If the sampled points do not span the range of conditions present in the landscape, area estimates derived from them can be biased in ways that are difficult to detect after the campaign has ended. Assessing representativeness *in situ*, against readily available remote-sensing or terrain layers, allows the team to fill gaps in environmental coverage before leaving the site.

Mobile devices are now capable of supporting both needs (Teacher et al., 2013). Several general-purpose platforms exist for digital data collection, including Open Data Kit (Hartung et al., 2010), EpiCollect (Aanensen et al., 2009), KoboToolbox and commercial products such as Esri Survey123. These tools are powerful and configurable, but they are primarily designed for form-based data capture and typically assume some connectivity for project setup or synchronization. They do not provide domain-specific support for permafrost and tundra variables, and—most relevant here—they do not include built-in analysis of the spatial representativeness of the data being collected.

We developed **Field Campaign Tracker (FCT)** to address this gap. FCT is an offline-first application that integrates (i) a structured, permafrost- and tundra-oriented field diary, (ii) an interactive assessment of how well the sampled sites represent the environmental gradients of the study area, and (iii) an adaptive-sampling planner that suggests where to measure next. The application is intended for individual researchers and small teams who need a lightweight tool that works on a personal smartphone without any server, account or internet connection. In this paper we describe the design and implementation of FCT, its data model and analytical methods, an illustrative deployment in the Inuvik region of the western Canadian Arctic, and its relationship to existing tools.

## 2 | Description

### 2.1 | Design principles and implementation

FCT was developed following four design principles: (1) *offline-first*, so that all core functionality is available without connectivity; (2) *standardization*, through controlled vocabularies, fixed units and a documented data schema; (3) *low barrier to entry*, requiring no installation from an app store, no account and no specialized hardware; and (4) *open and interoperable output*, so that data are not locked into a proprietary format.

An overview of the application interface and its offline data flow is shown in Figure 1. The application is a client-side single-page web application built with React (v19) and bundled with Vite. It is delivered as a Progressive Web App and can be added to the home screen of Android or iOS devices, after which it launches and runs like a native application. Geospatial functionality is provided by open-source libraries: Leaflet and Leaflet.draw for mapping and polygon digitizing, geotiff.js for reading raster files, proj4js for coordinate-reference-system transformations, shpjs for shapefile import, Turf.js for geometric operations, and Papa Parse and SheetJS for tabular import/export. The full dependency list and source code are available in the repository (see *Software availability*).

Data are stored on the device using two complementary layers. A *working store* in the browser's IndexedDB database (through the localForage library) receives every change automatically and continuously, so a record is preserved even if the application is closed or the device is switched off mid-entry; this layer requires no setup and is available on every device. In addition, an optional *durable-export* layer lets the user select a destination folder once, using the File System Access API; the application remembers this folder between sessions and writes self-documenting files (see Section 2.6 and Appendix S1) directly into it. No data ever leave the device: there is no server, no user account and no background transmission, which keeps the application simple to deploy and avoids the data-governance and privacy obligations associated with cloud storage.

Offline operation is achieved with a service worker that caches the application on the first visit. After that initial load, all core functionality—data capture, local storage, the representativeness analysis and the sampling planner—runs with no network connection, because the analysis operates on user-supplied raster files rather than online services. A network connection is needed only for the first installation, for receiving application updates, and for displaying the optional online basemap in the map view. Two platform differences are worth noting for users: on Apple iOS, every browser is built on WebKit and the File System Access API is unavailable, so iPhone and iPad users rely on the working store together with manual export and sharing rather than direct-to-folder saving; and installation to the home screen is automatic on Android (Chrome) but is performed manually on iOS through the browser's *Share → Add to Home Screen* action. The full matrix of platform capabilities is given in Appendix S2.

### 2.2 | Data model and workflow

A field record (a "site") is the central object of the data model. The user can complete a record through a guided five-step wizard (Site information → Weather → Vegetation → Soil and morphology → Review and save) or through a compact single-screen "quick entry" mode for rapid logging. Site numbers auto-increment, and the date, time and coordinated universal time (UTC) offset are pre-filled and editable. All changes are auto-saved continuously, so an interrupted record is never lost. A "copy from previous" function reduces repeated typing when consecutive sites share attributes.

### 2.3 | Field data modules

The following thematic modules are implemented, each using controlled options and fixed units where appropriate:

- **Site information:** landscape type (free text with autocomplete), disturbance class (e.g. thermokarst, solifluction, erosion, trampling), organic-matter type, terrestrial/aquatic setting, and an optional experimental-treatment field (shading-net layers) for manipulation studies.
- **Position:** latitude, longitude and reported accuracy. A "Get GPS" function averages successive device readings over a fixed interval to improve positional stability, which is valuable under tree or shrub canopy and in conditions of poor satellite geometry.
- **Weather:** air temperature, relative humidity, cloud cover, precipitation class, wind speed and wind direction (including a "calm" state).
- **Vegetation (rapid):** ten default plant functional types (e.g. shrubs, dwarf shrubs, graminoids, *Sphagnum* and other mosses, lichens, bare peat, litter), each scored with a three-level cover-abundance class (0 = absent, 1 = present < 50 %, 2 = dominant > 50 %) following the logic of cover-abundance estimation (Braun-Blanquet, 1932), together with canopy height. Custom categories can be added.
- **Vegetation (detailed):** a species list with percentage cover and notes, drawing on a user-managed species library that can be imported from CSV or Excel.
- **Soil:** soil temperature, soil moisture and moisture class, organic-layer description, standing-water depth, and active-layer (thaw) depth recorded as repeated probe measurements, consistent with active-layer monitoring practice (Brown et al., 2000).
- **Morphology:** topographic position, aspect and surface water features.

Each module supports geotagged photographs (with embedded EXIF metadata preserved) and voice notes, which are useful for capturing qualitative observations quickly in cold conditions.

### 2.4 | Spatial representativeness analysis

To assess how well a set of sampled sites represents the environmental variability of a study area, the user supplies one or more georeferenced raster layers in GeoTIFF format (for example a vegetation index such as NDVI, a water index such as NDWI, or a topographic wetness index). The study-area boundary is defined either by digitizing a polygon on an interactive map or by importing a shapefile. The application reads the embedded coordinate reference system from the GeoTIFF and reprojects between projected (e.g. UTM) and geographic coordinates as required, so that field sites and rasters are correctly co-registered.

For each field site, FCT extracts a representative raster value (the median of pixels within a buffer scaled to the recorded GPS accuracy). It then extracts the full distribution of pixel values inside the study-area polygon. The two distributions—sampled sites versus whole area—are displayed as overlaid histograms (Figure 2a, b), and a qualitative coverage score (from "excellent" to "poor") summarizes how completely the sampled sites span the area's value range. This makes gaps in environmental coverage immediately visible: for example, if all sites fall in dry, high-index pixels while a substantial fraction of the area is wet and low-index, the histogram comparison reveals the imbalance.

### 2.5 | Adaptive-sampling planner

The representativeness analysis feeds an adaptive-sampling planner. For each raster layer, the planner identifies value ranges that are under-represented by the existing sites relative to their frequency in the study area. It converts these ranges into binary "priority" masks (under-sampled = 1), resamples the masks of all layers to a common grid, and sums them, so that locations that are under-sampled in several variables simultaneously receive the highest priority. The result is a ranked list of candidate coordinates, shown both in a table (latitude, longitude, priority, contributing variables) and as graduated markers on the map (Figure 2c). Candidates can be exported to CSV for navigation in the field. This turns the representativeness assessment into a concrete, prioritized plan for the next measurements, supporting a simple form of adaptive, gap-filling sampling.

### 2.6 | Data management, export and interoperability

All records can be browsed, filtered and exported. Each saved site produces a machine-readable JSON file (the complete record), a human-readable text summary, and any associated photographs and audio files, organized in a transparent date/site folder hierarchy with descriptive, self-documenting file names (the full folder layout and naming scheme are given in Appendix S1). Tabular export to CSV is provided for analysis in standard statistical software. Because the export formats are open and the field names are documented, records can be mapped to community data standards such as Darwin Core (Wieczorek et al., 2012) and are consistent with the FAIR principles for reusable research data (Wilkinson et al., 2016). Additional utilities include import of pre-planned sites from CSV, Excel or shapefile; management of vegetation categories and species lists; a repeat-visit view that clusters records by location to support temporal comparison at re-measured plots; and summary statistics by landscape type.

## 3 | Illustrative application: Inuvik region, western Canadian Arctic

We deployed FCT during a field campaign of the Max Planck Institute for Biogeochemistry in the Inuvik region of the Mackenzie Delta, Northwest Territories, Canada, in July–August 2026. The area lies in the zone of continuous to discontinuous permafrost and spans a mosaic of upland tundra, forest–tundra transition with open spruce stands, ice-wedge polygon terrain and thermokarst features, making it well suited to demonstrating representativeness-aware sampling across a heterogeneous landscape. [Describe the campaign briefly: number of sites, dates, team size.] Field staff recorded site descriptions, vegetation cover, soil temperature and moisture, and active-layer depth directly on personal smartphones, with no network coverage at the plots. [Report a concrete efficiency or data-quality observation, e.g. average time per record, reduction in transcription, completeness of mandatory fields.]

To illustrate the representativeness workflow, we uploaded a [NDVI / topographic wetness] raster of the study area and compared the distribution of values at the sampled sites with the distribution across the whole polygon (Figure 2a, b). The comparison showed that [state the result, e.g. the sampled sites under-represented the wettest part of the gradient]. The planner proposed [n] candidate locations targeting the under-sampled range (Figure 2c), which were [used to add new plots / exported for the following day]. [If available, report whether adding the suggested points improved the coverage score.]

*Note to authors: Figure 2 is generated from a synthetic but realistic raster (see `figures/make_figures.py`); regenerate it from the real campaign raster and replace the bracketed text with the actual results before submission.*

## 4 | Discussion

### 4.1 | Relation to existing tools

FCT is complementary to, rather than a replacement for, general data-collection platforms such as Open Data Kit (Hartung et al., 2010), EpiCollect (Aanensen et al., 2009), KoboToolbox and Survey123. Those platforms excel at configurable, institution-scale data capture and centralized synchronization. FCT instead targets the individual researcher or small expedition that needs a domain-specific, zero-infrastructure tool, and it adds a capability that these platforms do not provide out of the box: in-field assessment of spatial representativeness and adaptive-sampling support based on raster layers. By coupling data capture with a lightweight representativeness analysis, FCT helps close the loop between sampling design and sampling execution while the team is still able to act on the information.

### 4.2 | Limitations

FCT has several limitations. First, the representativeness analysis is only as good as the supplied raster layers; coarse, cloud-contaminated or temporally mismatched imagery will weaken the assessment. Second, the current coverage score and under-sampling threshold are deliberately simple and qualitative; they are intended as a field heuristic rather than a formal statistical test of representativeness. Third, browser storage quotas and the maturity of the File System Access API differ between devices and browsers (see Appendix S2): direct-to-folder saving is unavailable on Apple iOS, and iOS may reclaim the storage of a Progressive Web App that has not been opened for an extended period, so very large raster files should be down-sampled before upload and users should export and back up data regularly. Fourth, GPS accuracy on consumer devices limits the precision of value extraction in fine-grained landscapes; the GPS-accuracy buffer mitigates but does not eliminate this. We discuss these constraints transparently so that users can judge the tool's suitability for their application.

### 4.3 | Future directions

Planned developments fall into three groups. In *analysis*, we plan a configurable, statistically grounded representativeness metric to replace the current qualitative score; clustering of candidate points to avoid redundant nearby suggestions, with travel cost incorporated into prioritization; and export of planned points to GeoJSON and shapefile. In *data integration*, we plan direct connection to field instruments through the Web Bluetooth and Web Serial interfaces, so that readings from external sensors—for example soil temperature and moisture probes, an external GPS receiver, or light (PAR) sensors—can be captured automatically, timestamped and written into the relevant fields without manual transcription; because these browser interfaces are currently available only on Chromium-based platforms, this feature will follow the platform pattern summarized in Appendix S2. In *longitudinal monitoring*, we will extend the existing repeat-visit view into a guided re-measurement mode that navigates the user back to the exact coordinates of a previous plot, pre-loads the earlier values, and highlights large changes for in-field verification—supporting the kind of repeated sampling required for active-layer and vegetation-change monitoring. Finally, we plan optional, opt-in synchronization to a shared repository for multi-team campaigns, and a documented mapping of the data schema to Darwin Core (Appendix S3) and relevant permafrost-monitoring conventions. We welcome contributions through the public code repository.

## 5 | Conclusions

Field Campaign Tracker shows that a single, freely available mobile web application can support standardized field data collection *and* in-field evaluation of how representative that data are of the surrounding landscape, entirely offline and on consumer hardware. By making representativeness visible at the moment when the sampling design can still be changed, FCT supports more defensible upscaling from points to areas—an issue of particular importance in heterogeneous Arctic ecosystems. The application is open source and extensible, and we hope it will be useful both as a practical field tool and as a template for representativeness-aware sampling in other biomes.

---

## Acknowledgements

We thank [field station / staff / funders]. This work was supported by [grant numbers]. We acknowledge the developers of the open-source libraries on which FCT depends.

## Conflict of interest

The authors declare no conflict of interest.

## Author contributions

[Author One] conceived and developed the application and led the writing; [Author Two] contributed to the field data model and tested the application in the field; [Author Three] contributed to the spatial-analysis methods. All authors contributed critically to the drafts and gave final approval for publication. *(Adjust to reflect actual contributions; MEE uses the CRediT taxonomy.)*

## Data availability statement

No empirical dataset underlies the methodological description in this article. The example dataset used to generate the figures, if included, will be archived at [Zenodo/Dryad DOI] upon acceptance.

## Software availability

Field Campaign Tracker is released under the [MIT / GPL-3.0 — choose] license. Source code is available at [https://github.com/USER/REPO], and a permanently archived version of the release described here is deposited at [Zenodo DOI]. A live demonstration instance is available at [URL]. The version documented in this paper is [vX.Y.Z / commit hash]. This software licence applies to the application source code and is independent of the article's Creative Commons Attribution (CC BY) licence.

---

## Supporting Information

The following Supporting Information is provided as an online appendix and as part of the user documentation in the code repository.

### Appendix S1 | Folder structure and file naming

When the durable-export layer is enabled, each saved site is written to disk as a transparent, self-documenting hierarchy. Records are grouped first by date and then by site, and every file name encodes the site number, date, time and content type, so that files remain interpretable after they have been copied off the device:

```
<chosen folder>/
└── 2025-07-15/                                       (date folder, YYYY-MM-DD)
    └── Site_001/                                     (zero-padded site number)
        ├── Site_001_2025-07-15_14-32_general.json    (complete machine-readable record)
        ├── Site_001_2025-07-15_14-32_general.txt     (human-readable summary)
        ├── photos/
        │   ├── Site_001_2025-07-15_14-32_photo_1.jpg
        │   ├── Site_001_2025-07-15_14-32_photo_1_metadata.json   (preserved EXIF)
        │   ├── Site_001_2025-07-15_14-32_vegetation_short_1.jpg
        │   └── Site_001_2025-07-15_14-32_vegetation_long_1.jpg
        └── voice_notes/
            └── Site_001_2025-07-15_14-32_voice_note_1.webm       (.m4a on iOS)
```

The general naming pattern is `Site_{NNN}_{YYYY-MM-DD}_{HH-MM}_{type}`. This convention sorts chronologically by default, pairs each record with its media, and allows a complete campaign to be archived simply by copying the top-level folder.

### Appendix S2 | Platform support

Field Campaign Tracker runs in any modern browser, but a small number of capabilities depend on the underlying platform. The most important difference is that direct-to-folder saving (the File System Access API) is available on Chromium-based browsers but not on Apple iOS, where the in-app working store with manual export is used instead.

| Capability | Android (Chrome) | Apple iOS (any browser) | Desktop (Chrome / Edge) |
| --- | --- | --- | --- |
| Offline use after first load | Yes | Yes | Yes |
| Continuous auto-save to in-app store | Yes | Yes | Yes |
| Install to home screen | Automatic prompt | Manual (Share → Add to Home Screen) | Yes |
| Save directly to a chosen folder | Yes | No (use export / share) | Yes |
| Audio-note file format | .webm / .ogg | .m4a | .webm |
| Direct sensor connection (planned) | Yes | No | Yes |

### Appendix S3 | Data dictionary

A complete, machine-readable description of every field—its name, data type, unit, controlled vocabulary and, where applicable, the corresponding Darwin Core term—is maintained in the code repository and distributed with each release. The principal thematic groups are summarized below; the repository version is authoritative.

| Group | Example fields | Unit / vocabulary |
| --- | --- | --- |
| Site information | site number, date, local time, UTC offset, collector | integer / ISO 8601 / free text |
| Position | latitude, longitude, accuracy | decimal degrees (WGS 84) / metres |
| Site description | landscape, disturbance, organic-matter type, terrestrial/aquatic | controlled vocabularies |
| Weather | air temperature, humidity, cloud cover, precipitation, wind speed, wind direction | °C / % / % / class / m s⁻¹ / class |
| Vegetation (rapid) | plant functional type, cover-abundance (0–2), canopy height | class / cm |
| Vegetation (detailed) | species, percentage cover, notes | % / free text |
| Soil | soil temperature, soil moisture, moisture class, active-layer depth (repeated probes), standing-water depth | °C / % / class / cm / cm |
| Morphology | topographic position, aspect, surface water features | controlled vocabularies |
| Media | geotagged photographs (EXIF preserved), voice notes | JPEG / audio |

### Appendix S4 | Quick start and system requirements

A new user can begin recording in five steps: (1) open the application URL in a mobile browser and, optionally, add it to the home screen; (2) on first use while online, allow the application to cache itself for offline use; (3) optionally select a destination folder for direct file export (Chromium browsers only); (4) create a site, capture GPS coordinates and complete the relevant modules, allowing auto-save to preserve the record; and (5) review and save, then export the campaign to JSON, text, CSV and media when convenient.

*System requirements:* a current version of a mainstream mobile or desktop browser; a few tens of megabytes of free storage for a typical campaign (more if large rasters are uploaded for analysis); and a one-time online connection to install the application. Because some platforms may reclaim the storage of an application that has not been used for an extended period, users are advised to export and back up their data regularly.

---

## Figures

**Figure 1.** Overview of Field Campaign Tracker. (a) The guided site-information screen of the digital field diary, showing auto-incrementing site number, date/time, averaged GPS coordinates and controlled site-description fields. (b) The rapid vegetation screen, in which plant functional types are scored with a three-level cover-abundance class (0–2) and canopy height. (c) The offline data flow: field data are captured on-device, auto-saved to browser storage and a user-selected folder, exported in open formats (JSON, text, CSV and media), and passed to the two spatial decision-support tools; the representativeness assessment and sampling planner provide adaptive feedback to subsequent data capture. *(File: `figures/Figure1_application.png` / `.pdf`.)*

**Figure 2.** Representativeness-aware sampling, illustrated with a synthetic wetness-index raster for a study area near Inuvik, Canada. (a) The raster layer with the existing sampled sites (white circles) overlaid. (b) Comparison of the distribution of raster values across the whole study area (grey) with the distribution at the sampled sites (purple outline); the shaded band marks a value range that is well represented in the area but under-sampled by the existing sites. (c) The adaptive sampling planner: prioritized candidate points (stars, coloured by priority) are proposed within the under-represented range (red shading), given the existing sites (grey). *(File: `figures/Figure2_representativeness.png` / `.pdf`.)*

---

## References

Aanensen, D.M., Huntley, D.M., Feil, E.J., al-Own, F. & Spratt, B.G. (2009) EpiCollect: linking smartphones to web applications for epidemiology, ecology and community data collection. *PLoS ONE*, 4, e6968.

Braun-Blanquet, J. (1932) *Plant Sociology: The Study of Plant Communities*. McGraw-Hill, New York.

Brown, J., Hinkel, K.M. & Nelson, F.E. (2000) The Circumpolar Active Layer Monitoring (CALM) program: research designs and initial results. *Polar Geography*, 24, 166–258.

Chu, H., Luo, X., Ouyang, Z., Chan, W.S., Dengel, S., Biraud, S.C. et al. (2021) Representativeness of eddy-covariance flux footprints for areas surrounding AmeriFlux sites. *Agricultural and Forest Meteorology*, 301–302, 108350.

Hartung, C., Lerer, A., Anokwa, Y., Tseng, C., Brunette, W. & Borriello, G. (2010) Open Data Kit: tools to build information services for developing regions. *Proceedings of the 4th ACM/IEEE International Conference on Information and Communication Technologies and Development (ICTD '10)*, Article 18. ACM, New York.

Teacher, A.G.F., Griffiths, D.J., Hodgson, D.J. & Inger, R. (2013) Smartphones in ecology and evolution: a guide for the app-rehensive. *Ecology and Evolution*, 3, 5268–5278.

Virkkala, A.-M., Aalto, J., Rogers, B.M., Tagesson, T., Treat, C.C., Natali, S.M. et al. (2021) Statistical upscaling of ecosystem CO2 fluxes across the terrestrial tundra and boreal domain: regional patterns and uncertainties. *Global Change Biology*, 27, 4040–4059.

Walker, D.A., Raynolds, M.K., Daniëls, F.J.A., Einarsson, E., Elvebakk, A., Gould, W.A. et al. (2005) The Circumpolar Arctic Vegetation Map. *Journal of Vegetation Science*, 16, 267–282.

Wieczorek, J., Bloom, D., Guralnick, R., Blum, S., Döring, M., Giovanni, R. et al. (2012) Darwin Core: an evolving community-developed biodiversity data standard. *PLoS ONE*, 7, e29715.

Wilkinson, M.D., Dumontier, M., Aalbersberg, I.J., Appleton, G., Axton, M., Baak, A. et al. (2016) The FAIR Guiding Principles for scientific data management and stewardship. *Scientific Data*, 3, 160018.

*Software references (cite per MEE style or in a footnote):* React (Meta Open Source); Vite; Leaflet and Leaflet.draw (V. Agafonkin and contributors); geotiff.js; proj4js; Turf.js; shpjs; Papa Parse; SheetJS; localForage.

---

### Submission checklist (remove before submission)

- [ ] Fill author names, affiliations, ORCIDs and corresponding-author details.
- [ ] Choose and apply an open-source license; deposit a tagged release at Zenodo for a citable DOI.
- [ ] Add the live-demo URL and public code-repository URL.
- [ ] Insert the Inuvik (Mackenzie Delta) campaign specifics and quantitative results in Section 3 after the July–August 2026 fieldwork.
- [x] Figure 1 (interface + data flow) and Figure 2 (representativeness + planner) generated at 300 dpi PNG and vector PDF in `figures/` via `make_figures.py`. **Before submission:** regenerate Figure 2 from the real campaign raster, and optionally replace the Figure 1 mock-ups with real device screenshots.
- [ ] Verify every reference's volume, pages and DOI against the publisher record before submission.
- [ ] Confirm word counts against current MEE *Applications* limits (abstract and main text) on the journal website.
- [ ] Prepare a plain-language summary if requested by the journal.
- [ ] Have the English checked by a fluent colleague or a language-editing service.
