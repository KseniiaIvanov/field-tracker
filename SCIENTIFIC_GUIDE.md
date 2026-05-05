# Field Campaign Tracker: Mobile Application for Permafrost Greenhouse Gas Flux Research

## Abstract

The Field Campaign Tracker is a mobile web application designed for field scientists conducting greenhouse gas flux measurements, vegetation surveys, and soil characterization in Arctic/permafrost ecosystems. This document describes the application's scientific framework, data collection methodology, parameter specifications, and integration with automated data logging systems.

---

## 1. Introduction and Scientific Rationale

### 1.1 Research Context

Arctic permafrost regions are critical for understanding global carbon cycling and climate feedback mechanisms. Greenhouse gas fluxes (CO₂, CH₄, N₂O) from permafrost-affected soils are sensitive to:
- Active layer depth (thaw depth)
- Soil moisture and standing water presence
- Vegetation composition and coverage
- Surface disturbances (thermokarst, erosion, trampling)
- Organic matter decomposition rates

Effective field research requires simultaneous measurement of:
1. **Automated data**: Flux rates via data logger devices (±5-20m horizontal accuracy)
2. **Field observations**: Vegetation, soil conditions, landscape context, site-specific disturbances
3. **Spatial context**: Plot representativeness and heterogeneity within remote sensing pixels

### 1.2 Application Design Philosophy

The Field Campaign Tracker implements a **dual-instrument workflow**:
- **Data Logger** (autonomous): Records high-frequency gas flux measurements
- **Mobile App** (manual): Records spatial, vegetation, and soil context
- **Integration**: Site numbers must match between devices; data merged by location during analysis

---

## 2. Data Organization and File Structure

### 2.1 Local Storage Architecture

Data is stored using a hierarchical folder structure for ease of analysis and field reference:

```
Field_Diary_YYYY-MM-DD/
├── YYYY-MM-DD/                          [Survey date]
│   ├── Site_001/
│   │   ├── site_001.json                [Complete site entry]
│   │   ├── photos/
│   │   │   ├── field_photo_001.jpg      [Original resolution, EXIF preserved]
│   │   │   ├── field_photo_001_metadata.json
│   │   │   ├── vegetation_short_001.jpg
│   │   │   └── vegetation_short_001_metadata.json
│   │   └── voice_notes/
│   │       └── voice_note_HH:MM:SS.wav  [Timestamp-labeled recordings]
│   ├── Site_002/
│   └── ...
├── YYYY-MM-DD/                          [Subsequent survey dates]
│   └── ...
```

### 2.2 Data Redundancy

Each site entry is stored in three locations:
1. **IndexedDB** (browser storage): Working copy for app functionality
2. **Device file system** (Android): Permanent storage with folder organization
3. **ZIP archive**: Portable backup with complete metadata and imagery

---

## 3. Step-by-Step Data Collection Protocol

### **STEP 1: Site Information**

#### 3.1.1 Site Number (REQUIRED)
- **Data type**: Integer (001-999)
- **Scientific requirement**: Must match the corresponding data logger device identifier
- **Rationale**: Enables spatial matching of automated flux measurements with manual field observations
- **Field procedure**: 
  - Confirm site number matches datalogger before beginning observations
  - Record in field notebook as backup

#### 3.1.2 Collector Name (REQUIRED)
- **Data type**: Text
- **Purpose**: Identifies observer for data quality assessment and calibration differences
- **Field procedure**: Enter full name; consistent naming across survey season improves data traceability

#### 3.1.3 Date (REQUIRED)
- **Data type**: YYYY-MM-DD format (ISO 8601)
- **Default**: Current date
- **Scientific requirement**: Enables temporal tracking of seasonal changes and data logger synchronization
- **Field procedure**: Verify date before first site entry of the day

#### 3.1.4 Local Time (REQUIRED)
- **Data type**: HH:MM 24-hour format
- **Scientific requirement**: Essential for diurnal gas flux patterns and temperature correlations
- **Field procedure**: Record when site observations begin (not when logger was deployed)
- **Note**: Combined with UTC offset to provide unambiguous temporal reference

#### 3.1.5 UTC Offset (REQUIRED)
- **Data type**: ±HH:MM format (e.g., +02:00 for UTC+2)
- **Default**: Auto-detected from device timezone
- **Scientific requirement**: Ensures global time consistency for multi-site datasets
- **Field procedure**: Verify offset is correct for survey location; update if crossing time zones

#### 3.1.6 GPS Coordinates (REQUIRED)
- **Method**: Continuous averaging over 2 minutes
- **Output**: Latitude, Longitude (WGS84 EPSG:4326)
- **Accuracy requirement**: ±5-20m (typical smartphone GPS)
- **Scientific rationale**: 
  - 2-minute averaging reduces instantaneous positional error
  - ±5-20m matches typical remote sensing pixel size (5-10m resolution)
  - Enables spatial cross-validation with satellite imagery
- **Field procedure**:
  - Select "Start GPS" when arriving at site
  - Keep phone stationary for 2 minutes
  - Do NOT move while GPS averages
  - Record displayed accuracy value
- **Acceptance criteria**: Accuracy ≤30m; reject if >50m (possible multipath interference)

#### 3.1.7 GPS Accuracy (OUTPUT)
- **Data type**: Meters (estimated horizontal error)
- **Interpretation**:
  - <10m: Excellent (clear sky, open site)
  - 10-20m: Good (typical Arctic conditions)
  - 20-30m: Fair (some obstruction, vegetated site)
  - >30m: Poor (dense vegetation, canyon, reject)

#### 3.1.8 Site Notes (OPTIONAL but RECOMMENDED)
- **Data type**: Free text
- **Purpose**: Document site-specific observations not captured by structured fields
- **Examples**:
  - "Permafrost mound 2m NW; visible ice exposure"
  - "Recent thermokarst slumping; water from thaw"
  - "GPS accuracy reduced by dwarf birch overstory"
  - "Instruments damaged by reindeer; relocated 5m"
- **Field procedure**: Record immediately; do not defer

#### 3.1.9 Carbon Flux Measurement Toggle
- **Data type**: Boolean (Yes/No)
- **Purpose**: Flags whether this site has co-deployed automated gas flux measurements
- **Scientific requirement**: Enables filtering for sites with integrated flux data
- **Field procedure**: Check if data logger is present at site

#### 3.1.10 Voice Notes (OPTIONAL)
- **Media type**: WAV audio, full device microphone quality
- **Purpose**: Document complex observations, GPS accuracy issues, or instrument notes
- **Maximum duration**: Limited by device storage (~200 sites at 30 sec each = 100MB)
- **Field procedure**:
  - Press "Record" button
  - Speak clearly: "Site 001, standing water 15cm depth, visible ice at 30cm"
  - Press "Stop" when finished
  - Optional: Play back to verify audio quality
- **Best practices**: One note per critical observation, not continuous narration

---

### **STEP 2: Weather Conditions**

#### 3.2.1 Cloud Cover (%)
- **Data type**: Integer 0-100%
- **Collection method**: Visual estimate
- **Scientific requirement**: Affects incoming solar radiation and evapotranspiration
- **Field procedure**:
  - Estimate visible sky covered by clouds (any altitude)
  - 0% = completely clear
  - 100% = completely overcast
  - Use quick slider for rapid entry (0/10/20.../100)
- **Relevance to gas flux**: Influences surface temperature and vegetation photosynthesis

#### 3.2.2 Precipitation Type (CATEGORICAL)
- **Options**: None, Drizzle, Light Rain, Moderate Rain, Heavy Rain, Snow, Sleet
- **Data type**: Single-select categorical
- **Scientific requirement**: Indicates recent moisture input affecting soil conditions
- **Field procedure**: Observe current conditions; record what is happening at time of observation
- **Note**: Does NOT replace precipitation logger data; merely confirms field conditions
- **Relevance**: 
  - Wet conditions → reduced gas flux measurement quality
  - Surface water → anaerobic conditions → CH₄ production

#### 3.2.3 Wind Speed (m/s)
- **Data type**: Decimal (0.0-30.0 m/s)
- **Collection method**: 
  - Handheld anemometer (preferred, ±0.5 m/s)
  - Visual estimation (Beaufort scale) if instrument unavailable
- **Scientific requirement**: Affects turbulent transport of gases at measurement chambers
- **Field procedure**:
  - If using anemometer: measure at 1.5m height, average 30 seconds
  - If estimating: use visual cues (calm/light/moderate/strong/gale)
  - Record wind speed in tool tip; alternative: use quick buttons
- **Relevance**: High wind (>5 m/s) increases chamber ventilation, reduces flux accuracy

#### 3.2.4 Wind Direction (8-POINT COMPASS + CALM)
- **Options**: Calm, N, NE, E, SE, S, SW, W, NW
- **Data type**: Categorical with visual directional buttons
- **Collection method**: Compass or visual cues (sun position, landscape features)
- **Scientific requirement**: Enables filtering for upwind/downwind measurements (e.g., peat disturbance)
- **Field procedure**:
  - Use compass or visual landmarks
  - Identify direction from which wind is blowing (direction wind comes FROM, not blows TO)
  - If completely calm: select "Calm"
- **Relevance**: Upwind contamination from disturbed areas or source identification

#### 3.2.5 Air Temperature (°C)
- **Data type**: Decimal (-50 to +50°C)
- **Collection method**: Thermometer at 1-2m height, shaded
- **Scientific requirement**: Controls soil microbial respiration rates (Q₁₀ relationship)
- **Field procedure**:
  - Use calibrated field thermometer
  - Avoid direct sunlight (use shade cloth if available)
  - Wait 2 minutes for equilibration if moving from sun to shade
  - Record to 0.1°C precision
- **Acceptance criteria**: 
  - Reasonable for location and season (reject wildly implausible values)
  - Temperature gradient check: compare with previous sites same day
- **Relevance to flux**: Each 10°C increase typically doubles soil respiration rate

---

### **STEP 3: Vegetation - Short Form (Coverage Classes)**

#### 3.3.1 Environment Type (CATEGORICAL)
- **Options**: Terrestrial, Aquatic
- **Data type**: Single-select
- **Purpose**: Distinguishes wet vs. dry ecosystem types
- **Field procedure**: Select based on dominant environment; if mosaic, choose predominant type
- **Note**: Affects interpretation of all vegetation and soil data

#### 3.3.2 Vegetation Categories - Coverage Classes
Pre-defined categories for rapid field assessment (0/1/2 scale):
- **Coverage scale**:
  - 0 = Absent/Trace (<5%)
  - 1 = Present/Sparse (5-50%)
  - 2 = Abundant (>50%)

**Categories and ecological significance:**

| Category | Ecological Role | Relevance to Gas Flux |
|----------|-----------------|----------------------|
| **Shrubs** | Woody perennials >1m | High evapotranspiration; root system affects soil structure |
| **Dwarf Shrubs** | 10-100cm height | Moderate biomass; typical tundra dominant |
| **Grass** | Monocots, tufted | Rapid turnover; litter source |
| **Sedges** | Carex, wetland indicator | Root exudates; waterlogged conditions |
| **Green Mosses** | Active photosynthesis | Insulation layer; moisture retention |
| **Sphagnum Mosses** | Wetland specialist | High decomposition resistance; peat builder |
| **Brown Mosses** | Low activity moss | Decomposing/dead material indicator |
| **Lichens** | Slow-growing crusts | Nitrogen fixation (some species) |
| **Bare Peat** | Exposed organic soil | Thermokarst/erosion indicator |
| **Litter Standing Dead** | Dead plant material | Decomposition stage; carbon pool |

**Field procedure for each category:**
1. Scan the 1m² plot
2. Visually estimate combined coverage of the category
3. Select coverage class (0/1/2)
4. Move to next category

#### 3.3.3 Custom Categories (OPTIONAL)
- **Procedure**: Click "Add custom category" → enter name
- **Example use**: "Lichen-covered rocks", "Bryophytes (unidentified)", "Frost flowers"
- **Coverage scale**: Same 0/1/2 system

#### 3.3.4 Photo Documentation - Vegetation Short
- **Timing**: At end of short form (before moving to Long form)
- **Content**: 
  - Wide overview photo: entire 1m² plot with scale reference
  - Close-ups: indistinct categories, dominant species, damage
- **Technical requirements**:
  - Include scale (ruler, coin, or 1m quadrat)
  - Multiple angles if plot is heterogeneous
  - Metadata preserved: camera model, GPS coordinates (from EXIF)

---

### **STEP 4: Vegetation - Long Form (Species Identification)**

#### 3.4.1 Purpose and Timing
- **When to use**: 
  - Every 3rd-5th site (rotate with short-form only sites)
  - At representative plots (homogeneous vegetation)
  - Never at highly disturbed sites
- **Objective**: Build species composition database for upscaling models
- **Time requirement**: 15-30 minutes per plot

#### 3.4.2 Species List Entry (MANUAL ENTRY - NO PREDEFINED LIST)
- **Important**: You MUST enter each species manually or upload your species list
- **Data structure**: For each plant species observed, enter:
  - **Species name** (scientific name STRONGLY PREFERRED; common name acceptable)
  - **Abundance class** (0/1/2 coverage scale, same as short form)
  - **Height** (cm, typical maximum for that species at plot)
  - **Notes** (e.g., "flowering", "grazed", "diseased", "sterile")

#### 3.4.3 Species List Management
- **No predefined database**: Species list is blank by default
- **Two approaches**:
  
  **Option A: Manual entry each plot**
  - Click "Add species"
  - Type scientific name (e.g., "Eriophorum angustifolium")
  - Select coverage (0/1/2)
  - Enter height (cm)
  - Add notes if relevant
  - Click "Save species"
  - Repeat for each species in plot
  - Advantage: Flexible for different regions/ecosystems
  - Disadvantage: Slower, requires typing in field

  **Option B: Upload your species list once**
  - Prepare CSV file with your species (before field work):
    ```
    scientific_name,common_name,family
    Eriophorum angustifolium,Narrow-leaf cottongrass,Cyperaceae
    Carex bigelowii,Bigelow's sedge,Cyperaceae
    Salix pulchra,Diamond willow,Salicaceae
    Vaccinium uliginosum,Bilberry,Ericaceae
    ```
  - Upload to app (Settings → Upload Species List)
  - During field work: select from your pre-loaded list (faster)
  - Advantage: Fast data entry, standardized taxonomy
  - Disadvantage: Requires preparation before field season

#### 3.4.4 Recommended Nomenclature
- **Always use scientific names** (binomial: Genus species)
- **Format**: Capitalized Genus, lowercase species (e.g., "Eriophorum angustifolium")
- **Include subspecies if known** (e.g., "Salix pulchra subsp. pulchra")
- **Common names**: Acceptable as secondary reference only
- **Unknown species**: Record as "Unknown Cyperaceae" or "Unidentified moss sp."
- **Field typos**: App allows later editing; do not delete incorrect entry during field work (just add correct one)

#### 3.4.5 Long-form Photo Documentation
- **Same requirements as short form**
- **Additional**: Close-up photos of diagnostic features for each species
- **Example**: Leaf arrangement, flower details, growth pattern, stem characteristics
- **Purpose**: Allows later identification if field ID uncertain
- **Best practice**: One close-up photo per unknown or difficult species

#### 3.4.6 Field Identification Strategy
- **Confident ID**: Enter scientific name directly
- **Uncertain ID**: 
  - Record as "Unknown Cyperaceae" or similar family-level ID
  - Add detailed photo with identifying features
  - Add note: "Check leaf shape and reproductive structures after field season"
  - Can be updated later with pressed specimen or herbarium reference
- **Recommended**: Bring identification key or plant guide specific to your study region

---

### **STEP 5: Soil Profile**

#### 3.5.1 Active Layer Depth (cm) (REQUIRED for permafrost sites)
- **Data type**: Integer 0-200cm
- **Definition**: Maximum depth of soil thaw in summer; marks permafrost table
- **Collection method**: 
  - Probe with metal rod: insert until "hard" permafrost encountered
  - Measure depth where resistance increases sharply
  - Take 3 measurements around plot; record average
  - If soil is not frozen: record as 0 or estimate maximum past thaw depth
- **Scientific requirement**: 
  - **Critical control variable** for CO₂/CH₄ production
  - Thinner active layer = less aerobic decomposition = more CH₄
  - Deeper active layer = more root respiration + microbial activity
- **Field accuracy**: ±5cm acceptable

#### 3.5.2 Organic Layer Depth (cm) (REQUIRED)
- **Definition**: Thickness of accumulated organic (peat) material above mineral soil
- **Collection method**:
  - Excavate small pit or auger hole
  - Measure dark/black organic material above brown/gray mineral soil
  - If pure mineral: record as 0
- **Composition types** (select primary type):
  - **Live vegetation**: Roots and rhizomes
  - **Litter**: Recently dead, recognizable plant material
  - **Peat**: Partially decomposed, dark, fibrous
  - **Mixed**: Multiple layers present
- **Scientific requirement**: 
  - Organic layer thickness = **decomposition potential**
  - Deeper peat = older carbon pool = slower decomposition = lower current flux
  - Shallow litter = rapid turnover = higher respiration
- **Field procedure**: Describe layer structure:
  ```
  Example: "5cm live sphagnum over 15cm decomposed brown peat"
  ```

#### 3.5.3 Soil Moisture (CATEGORICAL)
- **Options**: Dry, Moist, Wet, Standing Water
- **Field procedure**:
  - Squeeze soil sample in hand
  - Dry: crumbles, no water released
  - Moist: slightly damp, no visible water
  - Wet: water visible when squeezed, water does not pool
  - Standing water: visible water surface at 0-5cm depth
- **Scientific requirement**: Water presence controls oxygen availability
  - Dry/Moist: aerobic → CO₂ respiration dominant
  - Wet: transition zone → both CO₂ and CH₄
  - Standing water: anaerobic → CH₄ dominant

#### 3.5.4 Standing Water (YES/NO) with Depth
- **Presence**: Is there visible free water at soil surface or shallow depth?
- **If YES**: **Depth to water surface (cm)**
  - 0cm = water at surface
  - 1-5cm = shallow water table
  - >5cm = perched water or seepage
- **Scientific requirement**: 
  - **Standing water = anaerobic conditions**
  - Direct indicator of CH₄ production zone
  - Changes seasonally; record current state only
- **Field procedure**:
  - Look for visible water; do not assume based on color
  - If uncertain, dig small hole and observe water ingress
  - Record time to water accumulation if digging

#### 3.5.5 Soil Temperature (°C)
- **Data type**: Decimal (-50 to +50°C)
- **Collection method**: 
  - Soil thermometer at 5cm depth (below surface)
  - Insert perpendicular to slope
  - Wait 2 minutes for equilibration
  - Record to 0.1°C
- **Scientific requirement**: Controls microbial respiration rate
- **Relationship to air temperature**: Typically 1-3°C cooler than air temp due to surface insulation

#### 3.5.6 Organic Matter Type (CATEGORICAL) (REQUIRED)
- **Primary decomposition type in organic layer**:
  - **Live vegetation**: Active roots; rapid nutrient cycling
  - **Litter**: Recognizable plant fragments; rapid decomposition (k = 0.1-0.3 yr⁻¹)
  - **Peat**: Highly decomposed; very slow turnover (k = 0.01-0.05 yr⁻¹)
  - **Mixed**: Multiple stages present in profile
- **Scientific requirement**: 
  - Decomposition rate controls CO₂ flux potential
  - k values estimate residence time of carbon
  - Peat = ancient carbon store; litter = contemporary flux
- **Field procedure**: Examine soil pit; select dominant type by thickness

#### 3.5.7 Surface Disturbances (QUICK-PICK BUTTONS)
- **Purpose**: Flag sites affected by physical/biological processes that alter conditions
- **Severity threshold**: Record if visible at plot scale (not microscopic)

**Disturbance types and indicators:**

| Disturbance | Visual Indicator | Gas Flux Impact | Field Sign |
|------------|------------------|-----------------|-----------|
| **None** | Intact vegetation cover | Baseline | Smooth, undisturbed surface |
| **Thermokarst** | Ground subsidence, irregular hummocks | Increased CH₄ (water exposure); increased CO₂ (thawed area) | Pits, mounds, tilted trees |
| **Solifluction** | Downslope soil creep, terrace features | Increased CO₂ (mixed layers, aeration) | Lobate features, stepped terrain |
| **Erosion** | Surface material removal, gullies | Increased CO₂ (mineral exposure); decreased organic litter | Bare patches, headcuts, gullies |
| **Trampling** | Vegetation bruising, soil compaction | Complex: compaction reduces flux; litter disturbance increases it | Footprints, crushed vegetation, ruts |
| **Other** | Free text field | Context-dependent | User-defined description |

**Field procedure**:
1. Walk around 2m radius of plot center
2. Identify visible disturbances
3. Select all that apply (multiple selections allowed)
4. If "Other": describe briefly ("animal burrows", "snowmelt scouring")

#### 3.5.8 Soil Profile Photo
- **Timing**: After disturbance assessment
- **Content**: Soil pit or auger hole showing:
  - Active layer transition (if visible)
  - Organic layer thickness
  - Color changes indicating decomposition
  - Water content (wet vs. dry appearance)
- **Scale**: Include ruler or measuring tape
- **Multiple angles**: Pit wall, close-up of organic layer, hand sample

---

### **STEP 6: Morphology**

#### 3.6.1 Slope Angle (degrees)
- **Data type**: Integer 0-90°
- **Collection method**:
  - Clinometer (hand-held device; ±1° accuracy)
  - Smartphone clinometer app
  - Visual estimation: 0°=flat, 45°=steep, 90°=vertical cliff
- **Measurement**: Downslope direction from plot center
- **Scientific requirement**: Controls water routing and soil stability
- **Field procedure**: Point meter downslope; record angle

#### 3.6.2 Aspect (8-POINT COMPASS)
- **Options**: N, NE, E, SE, S, SW, W, NW
- **Definition**: Direction downslope faces (compass direction of steepest descent)
- **Collection method**: 
  - Compass + clinometer
  - Smartphone compass
  - Terrain map interpretation
- **Scientific requirement**: 
  - Affects solar insolation (S-facing = warmer, more thaw)
  - Influences permafrost distribution
  - Controls moisture transport
- **Field procedure**: Identify direction of maximum slope descent

#### 3.6.3 Landscape Type (CATEGORICAL) (REQUIRED)
- **Options** (customizable list):
  - Wet polygon (patterned ground, ice-wedge)
  - Dry ridge (elevated tundra)
  - Low-centered polygon (pond/water-filled)
  - High-centered polygon (drained peat mound)
  - Thermokarst depression
  - Stream floodplain
  - Eroding bluff
  - Other
- **Scientific requirement**: 
  - Landscape type predicts water availability and decomposition rates
  - Critical for **upscaling and remote sensing validation**
  - Links field observations to satellite imagery classification
- **Field procedure**: 
  - Assess plot context within larger landscape
  - Wet polygon: visible ice-wedge polygon structure, central water
  - Dry ridge: elevated, well-drained, sparse vegetation
  - Thermokarst: obvious subsidence features
  - Select best-fit category

#### 3.6.4 Patch Homogeneity (FREE TEXT) (RECOMMENDED)
- **Purpose**: Assess plot representativeness for upscaling
- **Format**: Describe patch size and distinctness
- **Examples**:
  - "Homogeneous wet polygon, ~40m × 60m, typical of area"
  - "Patch transition zone: 50% wet, 50% dry ridge (not representative)"
  - "High-center polygon ~80m diameter; distinct from surroundings"
  - "Unique thermokarst depression; not typical of broader landscape"
- **Scientific requirement**: 
  - **Critical for remote sensing validation**
  - Distinguishes representative vs. anomalous plots
  - Informs pixel-level extrapolation decisions (5-10m pixels may contain multiple landscape types)
- **Field procedure**:
  - Step back; observe plot in context of surrounding area
  - Estimate visible patch extent and homogeneity
  - Record if this patch is typical or distinct

#### 3.6.5 Morphology Photo
- **Content**: 
  - Landscape overview showing slope direction
  - Terrain context (is this typical, transitional, or anomalous?)
  - Aspect indicators (sun position, shadowing)
- **Timing**: Last photo of the Site before exiting form

---

### **STEP 7: Review & Save**

#### 3.7.1 Data Validation
- **Automatic checks**:
  - All required fields completed?
  - Temperature values within reasonable range (-50 to +50°C)?
  - GPS accuracy acceptable (<50m)?
  - Active layer depth < 300cm?
- **Warnings** (non-blocking, user can override):
  - Missing optional fields (voice notes, morphology photos)
  - GPS accuracy >20m (but acceptable)
  - Site number mismatch with expected logger

#### 3.7.2 Photo Review
- **All site photos displayed**:
  - Vegetation short & long
  - Soil profile
  - Morphology
- **Action**: Delete or add photos if needed
- **Total data size**: 5-20 MB per full site (depending on photo count)

#### 3.7.3 Save Site Entry
- **Local save**: Stored in device storage (Android) or app cache (iPhone)
- **File output**: 
  - site_###.json (complete data structure)
  - Folder structure created: YYYY-MM-DD/Site_###/
- **Backup**: Auto-download ZIP archive to Downloads folder
- **Confirmation**: Large visual notification ("✅ Site 001 saved!")
- **Reset**: Form resets for next site; Site # increments (+1)

---

## 4. Quick Entry Mode

### 4.1 Purpose and Workflow
- **Target audience**: Rapid surveys with minimal detail needed
- **Time per site**: ~30 seconds
- **Fields included** (only 7):
  1. Site #
  2. Date
  3. Time
  4. GPS (2-min average)
  5. Landscape
  6. Standing water (Y/N + depth)
  7. Vegetation coverage (0/1/2 only)
  8. Surface disturbance (buttons)

### 4.2 When to Use Quick Mode
- Repeat visits to same sites (rapid comparison)
- Reconnaissance surveys
- High-density site grid
- Limited time in field

### 4.3 Limitations
- No species-level vegetation data
- No soil depth measurements
- No weather conditions
- No photos (unless added manually)

---

## 5. Data Logger Integration

### 5.1 Site Number Synchronization (CRITICAL)
- **Requirement**: Site # in mobile app MUST match data logger device ID
- **Workflow**:
  1. Deploy logger at site with known ID (e.g., Logger_001)
  2. Record that ID in mobile app as Site # (001)
  3. Logger records flux data with ID metadata
  4. After survey: merge datasets by matching Site # = Logger ID
- **Data merging example**:
  ```
  Mobile app:        Data logger:
  Site 001           Logger_001 → flux_CO2, flux_CH4, T_soil
  └─ GPS: 70.40°N    └─ timestamp, chamber venting time
  └─ Active layer: 45cm
  └─ Standing water: YES, 5cm depth
  
  Combined dataset for analysis:
  Site 001: GPS + active layer + water + flux rates + temperature
  ```

### 5.2 Recommended Integration Procedure
1. **Pre-deployment**: Create site list with matching numbering scheme
2. **Deployment day**: 
   - Place logger at plot center
   - Record site # in mobile app (matching logger ID)
   - Take reference photo (logger + mobile device + GPS receiver for verification)
3. **Post-deployment**: 
   - Download flux data from logger (USB or wireless)
   - Export mobile app data as CSV/JSON
   - Match datasets by Site # in R/Python/Excel
4. **QA/QC**: 
   - Verify GPS coordinates are within ±20m
   - Check timestamps are synchronized (within ±1 hour)
   - Flag any mismatches for field notes review

### 5.3 Logger Data Compatibility
- **Supported logger types**: Any device that outputs CSV/JSON with site identifier
- **Required logger fields**: Site ID, timestamp, flux measurement, chamber info
- **App output formats**: CSV (simplified), JSON (complete structure with metadata)

---

## 6. Remote Sensing Integration and Upscaling

### 6.1 Purpose
- **Link field observations to satellite imagery** (5-10m resolution)
- **Validate remote sensing classifications** with ground truth
- **Quantify plot representativeness** within pixels

### 6.2 GeoTIFF Analysis Workflow (Built-in Feature)
- **Supported rasters**: GeoTIFF format, any band structure
- **CRS handling**: Automatic detection and conversion (UTM ↔ lat/lon)
- **Colormaps**: Viridis, RdYlBu for visual interpretation
- **Analysis tools**:
  - Draw polygon(s) around plot
  - Upload shapefile boundaries
  - Extract histogram of raster values within polygons
  - Compare heterogeneity vs. adjacent areas

### 6.3 Patch Documentation Requirements
- **When collecting**: Record landscape patch characteristics
- **Information needed**:
  - Patch size (estimate in meters, e.g., "~50m × 30m")
  - Homogeneity (is vegetation/topography uniform?)
  - Distinctness from surroundings (typical or anomalous?)
  - NDVI/EVI typical values for this patch type
- **Field entry**: Use "Patch Homogeneity" free-text field in Morphology section

### 6.4 Upscaling Strategy (for analysis phase)
1. **Classify remote sensing image**: Identify patch types
2. **Sample strategically**: Distribute field sites across patch types
3. **Quantify representativeness**: What fraction of the study area does each site represent?
4. **Build upscaling model**: Relate field measurements to remote sensing spectral indices
5. **Extrapolate**: Estimate fluxes across unsampled pixels

---

## 7. Data Export Formats

### 7.1 Organized ZIP Archive
- **File name**: Field_Diary_YYYY-MM-DD.zip
- **Contents**: Complete folder structure with original-resolution photos
- **Metadata**: Photo EXIF data and site JSON files included
- **Use case**: Portable, complete backup with all media

### 7.2 CSV Export
- **Format**: Flat table, one row per site
- **Columns**:
  - Site Number, Date, Local Time, UTC Offset
  - Latitude, Longitude, GPS Accuracy
  - Landscape, Slope Angle, Aspect
  - Cloud Cover, Precipitation, Wind Speed, Wind Direction, Air Temperature
  - Active Layer Depth, Organic Layer Depth, Soil Temperature, Soil Moisture, Standing Water, Standing Water Depth
  - Vegetation categories (coverage 0/1/2)
  - Organic Matter Type, Disturbance flags
  - Notes, Collector
- **Use case**: Excel, R, Python analysis; merge with logger data
- **Limitations**: 
  - Species-level vegetation data lost (use JSON instead)
  - Photos not embedded
  - Voice notes not included

### 7.3 JSON Export
- **Format**: Complete nested data structure
- **Includes**: All fields, vegetation species data, voice note metadata, embedded photo EXIF
- **File structure**:
  ```json
  {
    "siteNumber": 1,
    "date": "2026-05-04",
    "collector": "Researcher Name",
    "coordinates": {
      "latitude": 70.40,
      "longitude": 24.56,
      "accuracy": 12
    },
    "weather": {
      "cloudCover": 30,
      "precipitation": "none",
      "windSpeed": 3.5,
      "windDirection": "NE",
      "temperature": 8.2
    },
    "soil": {
      "activeLayerDepth": 45,
      "organicLayerDepth": 18,
      "soilTemperature": 6.1,
      "soilMoisture": "moist",
      "standingWater": true,
      "standingWaterDepth": 5,
      "organicMatterType": "peat"
    },
    "vegetation": {
      "terrestrialAquatic": "terrestrial",
      "short": {
        "shrubs": 1,
        "dwarfShrubs": 2,
        "grass": 1,
        ...
      },
      "long": [
        {
          "species": "Eriophorum angustifolium",
          "coverage": 2,
          "height": 35,
          "notes": "flowering"
        }
      ]
    },
    "morphology": {
      "slopeAngle": 8,
      "aspect": "NE",
      "landscape": "low-centered polygon",
      "patchHomogeneity": "Homogeneous wet polygon, ~40m × 60m"
    },
    "disturbances": ["thermokarst", "trampling"],
    "voiceNotes": [
      {
        "timestamp": "2026-05-04T12:45:30Z",
        "duration": 25,
        "metadata": "WAV, 16-bit, 44.1kHz"
      }
    ],
    "photos": {
      "entryPhotos": [
        {
          "fileName": "site_001_landscape.jpg",
          "fileSize": 2145000,
          "exif": {
            "camera": "iPhone 16",
            "timestamp": "2026-05-04T12:35:00Z",
            "gps": [70.4012, 24.5625]
          }
        }
      ]
    }
  }
  ```
- **Use case**: Complete data preservation, R/Python scripting, database ingestion

---

## 8. Data Quality and Validation

### 8.1 Required Fields (Site cannot be saved without)
- Site Number
- Date
- GPS coordinates
- Landscape type
- Active layer depth (if permafrost site)
- Organic matter type

### 8.2 Recommended Completeness
- Voice notes: ≥1 per site (documents anomalies)
- Photos: ≥1 vegetation + ≥1 soil profile + ≥1 landscape (minimum 3)
- GPS accuracy: <20m preferred; <30m acceptable
- All weather fields: enables environmental correlation

### 8.3 Post-Survey QA/QC Checklist
- [ ] All site numbers match between app and data logger
- [ ] GPS coordinates fall within expected study area (map check)
- [ ] Temperature values reasonable for season and location
- [ ] Active layer depth progression logical (gradual changes between sites)
- [ ] Vegetation coverage classes sum to reasonable total (not all "2"s)
- [ ] Disturbance patterns consistent with observed landscape
- [ ] Photo file counts reasonable (~5-15 per site)
- [ ] Metadata complete (all sites have collector name, correct dates)

### 8.4 Data Flagging System
- **Green flag** ✅: Complete, high-quality data; ready for analysis
- **Yellow flag** ⚠️: Minor issues (GPS >20m, incomplete photos, missing optional field); use with caution
- **Red flag** 🚩: Major issues (GPS >50m, missing required field, anomalous values); exclude or investigate

---

## 9. Offline Operation and Data Security

### 9.1 Offline Capability
- **Internet requirement**: NONE (except initial app download)
- **GPS**: Works offline (native device GPS)
- **Storage**: All data stored locally on device
- **No cloud dependency**: Data does not leave device during field work

### 9.2 Data Redundancy
- **Primary storage**: Device file system (Android) or IndexedDB (iPhone)
- **Backup**: Local ZIP archive auto-downloaded after each save
- **Tertiary**: Manual export via USB or email when returning to connectivity

### 9.3 Device Specifications
- **Minimum**: Android 8.0+ or iOS 14+
- **Storage required**: ~1-2 GB for 100-200 complete sites (with photos)
- **Battery life**: Full day field work with typical smartphone (8-10 hours)
- **GPS accuracy**: ±5-20m (standard smartphone)

---

## 10. Analysis Workflow Example

### 10.1 Data Processing Steps (Post-field)
1. **Export data**: 
   - Download ZIP from device storage
   - Export CSV for statistics
   - Export JSON for detailed analysis

2. **Data merging**:
   ```R
   # R example
   mobile_data <- read.csv("field-diary.csv")
   logger_data <- read.csv("logger_fluxes.csv")
   
   # Merge by Site #
   merged <- merge(mobile_data, logger_data, 
                   by.x = "siteNumber", by.y = "loggerID")
   ```

3. **Quality filtering**:
   ```R
   # Remove GPS errors
   merged <- subset(merged, gpsAccuracy < 30)
   
   # Validate temperatures
   merged <- subset(merged, airTemp > -50 & airTemp < 50)
   ```

4. **Exploratory analysis**:
   ```R
   # Correlation: standing water vs. CH4 flux
   cor(merged$standingWaterDepth, merged$flux_CH4)
   
   # Active layer effect on respiration
   plot(merged$activeLayerDepth, merged$flux_CO2)
   ```

5. **Upscaling**:
   - Classify remote sensing image
   - Train model: field observations vs. spectral indices
   - Predict fluxes across unsampled pixels

### 10.2 Recommended Analysis Tools
- **Statistics**: R (packages: dplyr, ggplot2)
- **Geospatial**: QGIS, ArcGIS, R (sf, raster packages)
- **Data exploration**: Python (pandas, matplotlib)
- **Remote sensing**: SNAP, Google Earth Engine

---

## 11. Troubleshooting and Technical Notes

### 11.1 GPS Accuracy Issues
- **Problem**: GPS accuracy >50m
- **Causes**: Dense vegetation, tree/cliff overstory, multipath interference
- **Solutions**:
  - Move to more open area
  - Wait longer (use 3-4 minute average instead of 2)
  - Record in voice note: "GPS uncertain; vegetation overstory"
  - Accept reduced accuracy and flag in QA/QC

### 11.2 Temperature Validation
- **Implausible values** (e.g., soil temp 45°C in Arctic autumn)
- **Causes**: Direct sunlight (shade issue), calibration error
- **Solutions**:
  - Use calibrated thermometer
  - Shade bulb during measurement
  - Cross-check with adjacent sites

### 11.3 Voice Note Audio Quality
- **Issue**: Garbled, wind noise, or inaudible recordings
- **Prevention**:
  - Speak clearly, 20cm from microphone
  - Protect from wind (cup hand, use windscreen if available)
  - Test recording before critical notes
  - Limit notes to <1 minute (allows playback during data review)

### 11.4 File Storage Limits
- **Storage capacity**: Device dependent (typical: 64-256 GB)
- **Data size**: ~1-5 MB per site (depending on photo count)
- **Maximum sites**: 100-200 per season before reaching storage limit
- **Solution**: Export to external USB or cloud weekly during long survey season

---

## 12. References and Further Reading

### 12.1 Greenhouse Gas Flux Methodology
- IPCC AR6, Chapter 5: Biogeochemistry (soil CO₂, CH₄ processes)
- Marushchak et al. (2021): Arctic methane: background and context
- Walker et al. (1998): Permafrost characteristics (active layer depth significance)

### 12.2 Remote Sensing Upscaling
- Friedl & Sulla-Menashe (2019): MODIS/Landsat upscaling methodology
- Gorelick et al. (2017): Google Earth Engine (satellite data access)

### 12.3 Vegetation Classification
- Raunkiaer (1934): Life forms (dwarf shrub, herb, moss classification)
- IPCC AR5: Arctic tundra vegetation (carbon storage role)

### 12.4 Permafrost Research Standards
- IPA (International Permafrost Association): Active layer measurement protocols
- GCOS (Global Climate Observing System): Essential climate variables including active layer

---

## 13. Appendices

### Appendix A: Parameter Quick Reference Table

| Section | Parameter | Type | Units | Range | Required |
|---------|-----------|------|-------|-------|----------|
| **Site Info** | Site Number | Integer | - | 1-999 | ✅ |
| | Date | Date | YYYY-MM-DD | - | ✅ |
| | GPS Latitude | Decimal | degrees | -90 to +90 | ✅ |
| | GPS Longitude | Decimal | degrees | -180 to +180 | ✅ |
| | GPS Accuracy | Integer | meters | 1-100 | Auto |
| **Weather** | Cloud Cover | Integer | % | 0-100 | ⚠️ |
| | Temperature | Decimal | °C | -50 to +50 | ⚠️ |
| | Wind Speed | Decimal | m/s | 0-30 | ⚠️ |
| **Vegetation** | Vegetation Coverage | Integer | 0/1/2 | 3 classes | ✅ |
| **Soil** | Active Layer Depth | Integer | cm | 0-300 | ✅ |
| | Soil Temperature | Decimal | °C | -50 to +50 | ⚠️ |
| | Standing Water | Boolean | Yes/No | - | ✅ |
| | Standing Water Depth | Integer | cm | 0-50 | Conditional |
| | Organic Matter Type | Categorical | - | 4 types | ✅ |
| **Morphology** | Landscape Type | Categorical | - | 8+ types | ✅ |
| | Slope Angle | Integer | degrees | 0-90 | ⚠️ |

### Appendix B: Field Protocol Checklist

**Before departing base:**
- [ ] Mobile device fully charged (use power bank)
- [ ] Data logger(s) deployed or ready to deploy
- [ ] Thermometer, clinometer, anemometer functional
- [ ] GPS receiver (if using external) operational
- [ ] Site list and numbering scheme printed or loaded
- [ ] Field notebook for backup notes

**At each site:**
- [ ] Site # matches logger ID
- [ ] Start GPS averaging (2 min)
- [ ] Record air temperature (shaded)
- [ ] Assess and record vegetation coverage
- [ ] Excavate soil pit: measure active layer, organic depth
- [ ] Record soil temperature, moisture, disturbances
- [ ] Take photos (vegetation, soil, landscape)
- [ ] Record voice notes if issues encountered
- [ ] Save site entry; verify file was created
- [ ] Increment to next site number

**Before vegetation long form:**
- [ ] Have species identification guide available (printed or digital)
- [ ] Know scientific names for your study region
- [ ] OR have uploaded your custom species list to app (Option B)

**End of field day:**
- [ ] Export ZIP backup
- [ ] Verify file count (should equal number of sites entered)
- [ ] Upload backup to cloud/email if internet available
- [ ] Charge all devices overnight
- [ ] Review vegetation species names - correct any typos before next day

---

## 14. Hardware Requirements and Device Recommendations

### 14.1 Minimum Requirements
- **Android**: Version 8.0+ (2017 or later devices)
- **iOS**: Version 14+ (iPhone 6s or newer)
- **RAM**: Minimum 2GB; 4GB+ recommended
- **Storage**: 2-4 GB free space for field season (~100-200 sites)
- **GPS**: Built-in smartphone GPS (accuracy ±5-20m)
- **Camera**: Any; multi-megapixel preferred (high-res photos)
- **Microphone**: For voice notes

### 14.2 Recommended Devices for Field Work
**Android (STRONGLY RECOMMENDED for this application):**
- Redmi Note 13 / Poco X6 (~$150-200)
- Samsung Galaxy A series (A54, A55)
- Google Pixel 6a / 7a
- Any device with: 
  - ≥6" screen (easier field entry)
  - ≥5000 mAh battery
  - Android 10+
  - IP65+ water resistance (dust/splash proof)

**iPhone (functional but with limitations):**
- iPhone 12+ (better battery, A16+ processor)
- Larger models (Pro Max) preferred for readability
- Note: File organization limitations documented in Section 9

### 14.3 Accessories Strongly Recommended
| Accessory | Purpose | Notes |
|-----------|---------|-------|
| **Power bank 20000 mAh** | Field power | Essential for 8-10 hour field days |
| **USB-C / Lightning cable** | Charging | Bring 2 (backup) |
| **Protective case** | Ruggedness | Waterproof IP65+ recommended |
| **Screen protector** | Durability | Touchscreen sensitive to dirt/frost |
| **External GPS receiver** | Accuracy | Optional; improves accuracy to ±2-5m |
| **Portable SSD/flash drive** | Backup | 256GB+ for seasonal data archive |
| **Field thermometer** | Temperature | ±0.1°C calibrated mercury or digital |
| **Clinometer** | Slope angle | Hand-held, ±1° accuracy |
| **Handheld anemometer** | Wind speed | Cup type, 0.5-30 m/s range |

### 14.4 Pre-Field Device Setup
1. **Update OS**: Install latest Android or iOS version
2. **Install app**: Download Field Campaign Tracker
3. **Test offline mode**: Verify all functions work without internet
4. **Calibrate GPS**: Test GPS accuracy at known location (compare with map)
5. **Calibrate thermometer**: Compare with reference; adjust if >0.5°C error
6. **Test camera**: Take sample photos; verify focus and resolution
7. **Test microphone**: Record voice note; replay to check audio quality
8. **Set timezone**: Verify UTC offset is correct for study location
9. **Backup contact list**: Save researcher names, emergency numbers to device
10. **Format storage**: Clear unnecessary files; ensure 4GB+ free space

---

## 15. Pre-Season Preparation and Researcher Training

### 15.1 Minimum Training Requirements (Before field season)
- **Theoretical**: 4-6 hours
  - Review this scientific guide (Sections 1-7)
  - Understand permafrost processes and gas flux mechanisms
  - Study regional vegetation identification
  - Watch instructional videos (if available)
  
- **Practical**: 8-16 hours
  - Practice with application in office (mock data entry)
  - Field trial: enter 5-10 mock sites with actual equipment
  - Soil pit excavation technique (active layer measurement)
  - GPS accuracy assessment
  - Photo documentation standards
  - Species identification exercise with field guide

### 15.2 Researcher Checklist Before Departure
**Knowledge verification:**
- [ ] Can identify ≥15 dominant vegetation species by sight
- [ ] Know standard permafrost terminology (active layer, thermokarst, solifluction, etc.)
- [ ] Understand significance of each data field (not just how to enter)
- [ ] Can measure active layer depth correctly
- [ ] Know how to operate all field instruments (thermometer, clinometer, anemometer)

**Equipment verification:**
- [ ] Device fully functional with app installed
- [ ] All calibrations completed and recorded
- [ ] Power bank fully charged
- [ ] Backup cables and batteries
- [ ] Printed species identification guide
- [ ] Printed site numbering scheme
- [ ] Field notebook for backup observations
- [ ] Soil auger or probe for active layer measurement
- [ ] Measuring tape (for active layer and morphology)
- [ ] Compass or GPS receiver
- [ ] Data logger devices with known IDs (if used)

**Data management:**
- [ ] Upload custom species list to app (if using Option B)
- [ ] Backup app data before departure
- [ ] Synchronize device clock with authoritative time source
- [ ] Set up cloud backup account (Google Drive, Dropbox, etc.)
- [ ] Know file transfer procedure to base computer

### 15.3 Multi-Year Study Continuity Protocol
For studies spanning multiple field seasons (>1 year):

1. **Maintain consistent numbering**: Site numbers do NOT reset between seasons
   - Year 1: Sites 001-050
   - Year 2: Sites 051-100
   - OR: Use spatial grid (never revisit same #)

2. **Document methods documentation**: Record any changes to protocol between years
   - If vegetation categories changed: note date of change
   - If researcher changed: ensure consistent identification standards
   - If instruments replaced: record calibration comparison

3. **Seasonal consistency**: Collect data at similar time-of-year if possible
   - July ± 2 weeks = peak summer vegetation
   - July ± 2 weeks = maximum active layer thaw
   - Allows comparison across years

4. **Reference sites**: Establish 3-5 permanent reference plots
   - Revisit at same time each year
   - Monitor consistency (vegetation change, thermokarst progression, etc.)
   - Validate remote sensing classification year-to-year

---

## 16. Seasonal Considerations and Phenology

### 16.1 Timing Within Growing Season
**Spring (May-June: thaw onset)**
- Active layer incomplete; ice still present
- Record "active layer incomplete" if cannot reach frozen layer
- Vegetation just emerging; difficult to identify
- Standing water abundant (snowmelt, ice thaw)
- Note thaw stage: "ice-out", "surface water draining", "soil consolidating"

**Summer (July-August: peak growth)**
- ✅ **OPTIMAL for data collection**
- Active layer fully developed
- Vegetation mature; easy identification
- Weather conditions stable
- Maximum comparability between years (July ± 2 weeks)

**Autumn (September-October: freezing begins)**
- Active layer decreasing (refrozen from top)
- Vegetation senescing (yellowing, dormancy)
- Document senescence stage (green, yellow, red, brown, abscised)
- Standing water decreasing
- Note early freezing indicators (frost flowers, ice lenses)

### 16.2 Vegetation Phenology Recording
Add to voice notes or disturbance field if notable:
- **Vegetative stage**: Dormant, emerging, expanding, mature, senescing
- **Reproductive stage**: Pre-flowering, flowering, early seed, mature seed, post-seed
- **Stress indicators**: Herbivory, disease, frost damage, drought stress

---

## 17. Data Transfer and File Management

### 17.1 Daily Backup Procedure
**End of each field day (in camp):**
1. Export ZIP archive through app ("📦 Backup" button)
2. Files created: `Field_Diary_YYYY-MM-DD.zip`
3. Move ZIP to USB drive or external SSD
4. Verify file size (~50-200 MB depending on photos)
5. Delete original ZIP from phone (to free storage)
6. Store USB in waterproof bag

### 17.2 Weekly Consolidation
**Every 7 days (or when returning to base):**
1. Connect Android to computer via USB-C cable
2. Copy entire folder: `/storage/emulated/0/Documents/Field_Diary/`
3. To computer: `C:/Field_Data/2026_ArcticSurvey/`
4. Verify all dates/sites present
5. Create secondary backup on external drive (2TB+)
6. Upload to cloud (Google Drive, Dropbox, OneDrive)
7. Document file count: "Week 1: 47 sites; Week 2: 52 sites"

### 17.3 Data Structure After Field Season
```
Field_Data_2026/
├── Raw_Data/
│   ├── Field_Diary_2026-05-04.zip
│   ├── Field_Diary_2026-05-05.zip
│   ├── Field_Diary_2026-05-06.zip
│   └── ...
├── Processed/
│   ├── field-diary_combined.csv (all sites, flattened)
│   ├── field-diary_complete.json (all sites, full structure)
│   ├── species_list.csv (unique species identified)
│   └── logger_data_merged.csv (app data + flux logger data)
├── Photos/
│   ├── 2026-05-04_Site_001_vegetation.jpg
│   ├── 2026-05-04_Site_001_soil_profile.jpg
│   ├── 2026-05-04_Site_001_landscape.jpg
│   └── ...
└── Metadata/
    ├── researcher_log.txt (who collected what, when)
    ├── equipment_calibration.csv (thermometer, GPS, anemometer checks)
    ├── protocol_modifications.txt (any deviations from standard)
    └── data_quality_assessment.txt (flags, issues, solutions)
```

---

## 18. Calibration and Quality Assurance Procedures

### 18.1 Pre-Season Instrument Calibration

**Thermometer (Air and Soil):**
- Compare with reference thermometer ±0.5°C
- Test at 0°C (ice bath) and 37°C (body temperature)
- Record correction factor if systematic error exists
- Example: "Field thermometer reads +0.2°C high; subtract 0.2 from all readings"

**GPS (Smartphone built-in):**
- Test at known location (survey benchmark, marked point)
- Compare with map: should be <10m from reference
- If >20m error: check for obstructions, multipath interference
- Record datum: all locations should be WGS84 (EPSG:4326)

**Clinometer (Slope angle):**
- Test on known angle (45° angle iron, building corner)
- Verify ±1° accuracy
- Check bubble level before each day's use

**Anemometer (Wind speed):**
- Calibrate against reference standard if available
- Test rotation smoothness (no sticking)
- Verify battery (if electronic)
- Record manufacturer calibration date

### 18.2 In-Season Quality Control
**Daily GPS accuracy check:**
- At start of each day: record GPS at same location (camp)
- Accuracy should be ±5-15m and consistent
- If accuracy suddenly >30m: likely solar activity or atmospheric interference

**Temperature consistency check:**
- After every 10 sites: measure temperature at reference location
- Should be within ±1°C of trend (gradual change acceptable)
- Large jump = possible thermometer damage or operator error

**Species identification verification:**
- End of week: review photo archive for species
- Compare with field notes; flag any uncertain IDs
- Discuss with co-researcher to validate difficult species

### 18.3 Post-Season Data Quality Assessment
**Completeness check:**
- [ ] All required fields filled (Site #, Date, GPS, Landscape, Active layer, Organic matter type, Standing water)
- [ ] No "NA" or "unknown" in critical fields
- [ ] Photo count: ≥3 per site (vegetation, soil, landscape)
- [ ] Voice notes for problem sites

**Consistency checks:**
- [ ] GPS accuracy: no more than 10% of sites >30m accuracy
- [ ] Temperature values: reasonable for season (no -50°C in July)
- [ ] Active layer: gradual change across landscape (no wild jumps)
- [ ] Vegetation coverage: reasonable within plot context

**Spatial checks:**
- [ ] GPS coordinates fall within expected study area
- [ ] No duplicate coordinates (unless intentional repeat visit)
- [ ] Spatial distribution reasonable (not all clustered)

**Temporal checks:**
- [ ] Dates sequential (no days skipped unintentionally)
- [ ] Times reasonable (between sunrise/sunset)
- [ ] UTC offset correct for study location

---

## 19. Custom Disturbance Types and Categories

### 19.1 Adding Custom Disturbance Types
**If standard disturbances don't capture site condition:**
1. Select "Other" disturbance type
2. Enter free-text description (50-character limit)
3. Examples:
   - "Animal den (ground squirrel)"
   - "Lichen-covered bedrock"
   - "Wildfire burn scarification"
   - "Wind-toppled dwarf birch"
   - "Herbivory damage (musk ox)"

### 19.2 Disturbance Interpretation for Gas Flux
| Disturbance | CO₂ Effect | CH₄ Effect | N₂O Effect | Recommended Actions |
|------------|-----------|-----------|-----------|-------------------|
| **Thermokarst** | ↑↑ (thaw zone) | ↑↑ (exposed water) | ↑ | Mark site; revisit yearly to monitor subsidence |
| **Solifluction** | ↑ (mixing) | → (no change) | ↑ (disturbed) | Note direction of flow; measure creep rate |
| **Erosion** | ↑ (mineral exposed) | ↓ (litter removed) | ↑ (gully water) | Document headcut position; estimate volume lost |
| **Trampling** | ↓ (compaction) | ↑ (water pooling) | ↑ (anaerobic) | Map extent; count animal tracks if possible |
| **Fire scars** | ↑ (labile C exposed) | ↑ (char layer) | ↑ (ash) | Estimate burn severity; char layer thickness |
| **Animal burrows** | ↑ (exposed peat) | ↑ (subsurface water) | ↑ (excavated) | Identify species; measure hole diameter |

---

## 20. Data Publication and Citation Guidelines

### 20.1 Recommended Data Publication Workflow
1. **Archive data**: Submit complete dataset to data repository
   - Zenodo (CERN): Free, citable, open-access
   - DataDryad: For published papers
   - Arctic Data Integration: Specialized Arctic data portal
   
2. **Create metadata**: Include:
   - Study area description and coordinates
   - Researcher names and affiliations
   - Collection dates and duration
   - Instrument specifications and calibration data
   - Data dictionary (what each field means)
   - Known limitations and quality flags

3. **Assign DOI**: Digital Object Identifier ensures permanent access

### 20.2 Citation Format Examples

**Citing the Field Campaign Tracker application:**
> Kseniia Ivanova. (2026). Field Campaign Tracker: Mobile application for permafrost greenhouse gas flux research (Version 1.0) [Software]. Retrieved from [GitHub/repository URL]

**Citing field data collected:**
> Ivanova, K., et al. (2026). Arctic tundra field survey data: Site-based vegetation, soil, and gas flux measurements, May-August 2026. Zenodo. https://doi.org/10.5281/zenodo.XXXXXXX

**Data statement in paper methods:**
> Field observations were collected using Field Campaign Tracker, a mobile application designed for permafrost research (Ivanova, 2026). Data include 247 site observations covering 15 landscape types across the Abisko region. All data are available at [DOI/URL]; raw photos and voice notes are archived with metadata in the supplementary materials.

---

## 21. Limitations, Edge Cases, and Troubleshooting (Expanded)

### 21.1 Known Limitations
| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| **No internet offline** | Cannot sync to cloud during field work | Use USB backup; sync when returning to base |
| **GPS accuracy ±5-20m** | Cannot pinpoint exact measurement chamber location | Use external GPS receiver or reference photos |
| **2-minute GPS averaging** | Takes time at each site | Accept time cost for accuracy; prioritize location over speed |
| **File system access (iOS)** | Cannot organize files into folders; all in Downloads | Use Android for primary field device; use ZIP backup for structure |
| **Photo file size** | ~2-5 MB per high-res photo; limits total sites per device | Empty Downloads folder frequently; use external storage |
| **Voice note length limit** | Practical limit ~1 minute per note (attention in field) | Keep notes brief and focused; don't use for continuous narration |
| **Temperature measurement** | Requires ~2 min equilibration time at each depth | Accept time cost; plan fieldwork schedule accordingly |
| **Species identification** | Difficult to identify all species in field; may require herbarium | Photograph diagnostic features; defer ID to lab work |
| **Active layer depth** | Cannot measure if soil frozen at surface (early season, high elevations) | Record as "incomplete"; estimate from regional data if necessary |

### 21.2 Edge Cases and Solutions

**Scenario: GPS accuracy suddenly drops to >50m**
- Possible causes: Dense vegetation overstory, rock canyon, solar activity
- Solution: Move 10-20m to open area; retry GPS averaging
- Record in voice note: "GPS poor quality due to [reason]; accepted ±50m uncertainty"
- Flag in QA/QC: Mark site as "GPS quality: poor"

**Scenario: Cannot excavate soil pit (rock, ice, permafrost)**
- Use soil auger or probe instead of full pit
- Record: "Auger to 45cm; frozen at 45cm depth" instead of "organic layer depth"
- Document difficulty in voice note

**Scenario: Species completely unknown; cannot identify**
- Record as "Unknown dicot" or "Unidentified moss sp."
- Photograph leaves, stem, reproductive organs
- Collect pressed specimen (if permitted) for later ID
- Add note: "ID pending herbarium consultation"

**Scenario: Device battery dies mid-entry**
- Entry is lost (app does not auto-save while entry open)
- Quickly re-enter Site # and critical fields only (GPS, Active layer, Standing water)
- Complete optional fields later
- Note in voice record: "Abbreviated entry due to battery failure"

**Scenario: Standing water present but frozen (spring, autumn)**
- Record "Standing water: Yes, Depth: ice layer visible"
- Add to voice note: "Water frozen; ice layer 3cm thick"
- For flux interpretation: treat as present (O₂ limitation)

**Scenario: Multiple researchers collecting data**
- Assign each researcher a numerical code (R1, R2, etc.)
- Record "Collector: R1" or "R1/R2" if co-collection
- In post-analysis: check for systematic differences between researchers
- Use reference sites to validate consistency

### 21.3 Data Recovery Procedures
**If app crashes during data entry:**
- Data entered so far is LOST (auto-save not enabled)
- Restart app
- Re-enter lost data from field notebook
- Do NOT skip sites; re-enter with same Site # (sequential numbering is critical)

**If device is lost or stolen:**
- All field data is lost unless backed up
- CRITICAL: Daily ZIP export and offsite backup prevents total loss
- Recovery procedure: Use most recent ZIP archive; re-collect missing days

**If photos are corrupted:**
- EXIF metadata may be inaccessible but photos likely recoverable
- Use photo recovery software (PhotoRec, Recuva)
- If no recovery possible: Use printed field photos or re-photograph site if possible

---

## 22. Statistical Considerations for Study Design

### 22.1 Sample Size Recommendations
**For landscape classification (remote sensing validation):**
- Minimum: 3-5 sites per landscape type
- Recommended: 10-15 sites per type (for robust statistics)
- Example: 8 landscape types × 10 sites = 80 total sites

**For flux-vegetation correlation:**
- Minimum: 30 sites for correlation (r, p-value)
- Recommended: 50-100 sites for robust relationships
- Accounts for: spatial autocorrelation, ecosystem heterogeneity

**For spatial extrapolation (upscaling):**
- Minimum: 1 site per 2-4 Landsat pixels (30m × 30m)
- Recommended: 1 site per pixel or better
- Study area: 10km × 10km = coverage of 100-200 sites ideally

### 22.2 Spatial Distribution Strategy
**Systematic grid:**
- Advantages: Unbiased, captures gradient, easy to describe
- Method: Regular grid (e.g., 1km spacing)
- Sites per day: ~5-8 (depends on terrain)

**Stratified random:**
- Advantages: Balanced coverage of landscape types
- Method: Divide area into strata (landscape types); randomly select within
- Best for: Heterogeneous areas with distinct landscape patches

**Adaptive sampling:**
- Advantages: Efficient; focuses on undersampled areas
- Method: Initial survey → identify gaps → targeted infill
- Best for: Large areas; limited time/budget

**Repeat visits (temporal study design):**
- Return to same sites yearly to detect change
- Minimum: 5-10 permanent reference sites
- Tracks: thermokarst progression, vegetation change, carbon budget

### 22.3 Pseudoreplication Avoidance
**Common mistake: Multiple measurements at single site reported as independent data**
- Example: 3 flux measurements at Site 001 = NOT 3 independent samples
- Solution: Treat site-level averages as units, or use mixed-effects models

**Proper approach:**
- Each Site = 1 spatial sample
- Within-site replicates (multiple measurements) = temporal/instrumental replicates
- Report as: n=100 sites; m=3 flux measurements per site; N=300 total measurements
- Analyze: Site-level averages for spatial patterns; within-site variance for measurement error

---

## 23. Comparison with Standard Protocols and Validation

### 23.1 How Field Campaign Tracker Differs from Standard IPA Protocol

| Aspect | IPA Standard | This App |
|--------|-------------|---------|
| **Active layer measurement** | Single point per site | Single point (same method) |
| **GPS accuracy requirement** | ±5m (survey-grade) | ±5-20m (smartphone) |
| **Vegetation method** | Species abundance (0-100%) | Coverage classes (0/1/2) + species list |
| **Photos** | Optional | Mandatory (with EXIF) |
| **Data logger integration** | Separate workflow | Built-in, site-number matched |
| **Time per site** | 60-90 minutes (full) | 30 seconds (Quick Mode) or 45 minutes (full) |
| **Offline capability** | Requires field notebook | Complete offline digital |
| **Data export** | Manual to spreadsheet | Automated (CSV, JSON, ZIP) |

### 23.2 Validation Strategy
**To verify app accuracy:**
1. **Duplicate measurements**: 10% of sites measured by two independent researchers
   - Compare: Active layer depth, temperatures, vegetation coverage
   - Acceptable agreement: <5cm active layer; <0.5°C temperature

2. **GPS comparison**: Compare app GPS with external survey-grade GPS
   - Acceptable agreement: <10m difference

3. **Photo archive review**: Second researcher reviews species IDs
   - Target: >90% agreement on species identification

4. **Data logger crosscheck**: Compare air temperature from app with logger
   - Should be within ±1°C (if instruments measured simultaneously)

---

## 24. Troubleshooting Extended (Complete Error Resolution Guide)

### 24.1 Application Errors

**Error: "Failed to save site" or data lost after save**
- Check: Device storage not full (needs >100MB free)
- Solution: Delete old ZIP backups from Downloads folder
- Workaround: Exit app; restart; re-enter site

**Error: GPS not locking; accuracy stuck at 999m**
- Cause: Weak signal; too many trees/rock overstory
- Solution: Move to more open area; wait additional 2 minutes
- If persistent: Use external GPS receiver or accept reduced accuracy (flag in notes)

**Error: Photos not saving or corrupted**
- Check: Storage space available (1 photo = 2-5MB)
- Solution: Delete unnecessary files; compress images in settings
- Workaround: Restart app; retry photo upload

**Error: Voice note recording fails or silent**
- Check: Microphone permission granted to app
- Solution: Settings → Permissions → allow app microphone access
- Test: Record test note before next site

**Error: Species name field won't accept entry**
- Cause: Character limit reached or special characters blocked
- Solution: Use abbreviated scientific name (e.g., "Eroph. ang." instead of "Eriophorum angustifolium")
- Workaround: Enter in voice note; type full name in post-processing

### 24.2 Device/Hardware Issues

**Device freezes or crashes during data entry**
- Force restart device (hold power + volume down for 10 seconds)
- Clear app cache: Settings → Apps → Field Campaign Tracker → Clear Cache
- Last entry is lost; re-enter from field notebook

**Touchscreen becomes unresponsive in cold**
- Common at <-15°C with thin gloves
- Solutions:
  - Bring device into insulated pocket frequently
  - Use thick gloves with touchscreen-compatible fingertips
  - Pre-load data entry screens before going out
  - Accept slower data entry; take breaks to warm device

**GPS drifts significantly between morning and afternoon**
- Cause: Ionospheric activity; device warming up
- Solution: This is normal; accept ±5-20m accuracy range
- Record in metadata: "Morning GPS ±8m; afternoon GPS ±15m"

**Battery drains faster than expected**
- GPS averaging, WiFi/Bluetooth, screen brightness consume battery
- Solutions:
  - Reduce screen brightness
  - Disable WiFi/Bluetooth if not needed
  - Bring secondary power bank
  - Limit GPS averaging sessions per day

### 24.3 Troubleshooting Workflow Decision Tree

```
Data entry problem?
├─ App-related (won't save, won't open)
│  ├─ Restart app
│  ├─ Clear cache
│  ├─ Reinstall app
│  └─ Use field notebook backup
│
├─ Data quality issue (unrealistic values)
│  ├─ Check instrument calibration
│  ├─ Check if operator error (e.g., thermometer in sun)
│  ├─ Take duplicate measurement
│  └─ Flag for post-processing QA/QC
│
└─ Hardware issue (frozen screen, dead battery)
   ├─ Force restart device
   ├─ Move indoors to warm device
   ├─ Use power bank
   └─ Continue with field notebook; transcribe later
```

---

## 25. Future Development Roadmap

### 25.1 Planned Features (Version 2.0)
- **Automated data logger integration**: Bluetooth or wireless sync with flux logger
- **Offline raster analysis**: GeoTIFF analysis without internet
- **Real-time data sharing**: Sync between multiple researchers' devices
- **Improved species database**: Machine vision for photo-based species ID
- **Advanced export**: Direct integration with R/Python for analysis
- **Dark mode**: For night field work
- **Augmented reality**: AR-assisted disturbance identification

### 25.2 Long-term Vision (Version 3.0+)
- **Native iOS app**: Full file system access for iPhone users
- **AI-assisted photo annotation**: Automatic photo classification (vegetation type, disturbance)
- **Real-time flux prediction**: ML model to estimate CO₂/CH₄ from field observations
- **Global study registry**: Connect with other permafrost research teams
- **Mobile app ecosystem**: Plugins for specialized measurement types (N₂O, CH₄ from surface, etc.)

---

## 26. Appendices (Continued)

### Appendix C: Equipment Manufacturer Specifications

**Thermometers:**
- Analog: ±0.1°C, -50 to +50°C range
- Digital: ±0.5°C, typically -20 to +70°C
- Recommended: Alcohol (better Arctic performance) over mercury

**Clinometers:**
- Hand-held analog: ±1°, 0-90° range
- Smartphone apps: ±2-3° (less accurate)
- Recommended: Field-grade analog clinometer

**Anemometers:**
- Cup type: 0.5-30 m/s range; ±0.5 m/s accuracy
- Accuracy: ±3% of reading
- Recommended: Calibrated field-grade, NOT smartphone app

**GPS Receivers (external, if available):**
- Smartphone built-in: ±5-20m accuracy, DGPS ±2-5m
- Survey-grade: ±2-5m; requires external hardware (~$2000+)
- Cost-effective: Use smartphone + external antenna (~$100)

### Appendix D: Regional Vegetation Key for Arctic Regions
**Quick identification guide for common tundra plants:**

| Life Form | Common Arctic Taxa | Field Identification |
|-----------|-------------------|-------------------|
| **Dwarf shrubs <30cm** | Empetrum nigrum, Vaccinium uliginosum, Arctostaphylos | Prostrate; leathery leaves; berries |
| **Shrubs 0.3-1m** | Salix pulchra, Betula glandulosa | Taller stems; shrub form; tiny leaves |
| **Graminoids** | Festuca vivipara, Deschampsia alpina | Grass-like leaves; tufted growth |
| **Sedges** | Carex spp., Eriophorum spp. | Triangular stems; sedge culms; cotton-like heads (E. angustifolium) |
| **Forbs/Herbs** | Bistorta vivipara, Saxifraga, Dryas | Herbaceous; flowers in summer |
| **Bryophytes** | Sphagnum, Hylocomium, Polytrichum | Green mosses (active), brown (dead/senescent) |
| **Lichens** | Cladonia, Cetraria, crustose types | Slow-growing crusts; gray/orange/green colors |

### Appendix E: Voice Note Best Practices and Examples

**Example 1: Good voice note (specific, brief, actionable)**
> "Site 001 note: Standing water depth appears to be 8-10 centimeters based on auger insertion. Water table is very close to surface at this low polygon. GPS accuracy was degraded by dense shrub canopy; accepted ±20 meter uncertainty. Thermokarst visible at plot margins."
Duration: 22 seconds

**Example 2: Poor voice note (vague, rambling)**
> "Uh, site uh site number... let me see... okay so site 001... the water is like kind of wet I guess, and the vegetation is... well it's hard to see... anyway we might want to come back here."
Duration: 35 seconds; unclear, less useful

**Best practices:**
- Speak clearly and slowly (especially if strong accent)
- Lead with site number: "Site 001 note: [observation]"
- Use specific measurements and descriptions
- One topic per note (don't mix multiple observations)
- Keep to <30 seconds when possible
- Record immediately after observation (memory is fresh)

---

## 27. Glossary of Terms

**Active layer**: Seasonally thawed soil above permafrost; controls gas fluxes
**EXIF**: Embedded image metadata (camera, GPS, timestamp, settings)
**Geotransform**: Coordinate transformation from pixel to map coordinates
**Heterogeneity**: Spatial variability; how similar/different landscape patches are
**Permafrost**: Soil remaining <0°C for ≥2 consecutive years
**Phenology**: Timing of plant life stages (emergence, flowering, senescence)
**Piezometer**: Device to measure groundwater depth (same as auger/probe in field use)
**Solifluction**: Slow downslope movement of soil
**Tephigram**: Not used in this app; irrelevant (thermodynamic diagram)
**Thermokarst**: Ground subsidence caused by permafrost thaw
**Tundra**: Treeless vegetation type dominated by shrubs, grasses, mosses
**UTC offset**: Time zone difference from Coordinated Universal Time (e.g., UTC+02:00)
**Vegetative cover**: Percentage of ground covered by live plant material

---

## Version and Change Log (Updated)

- **Version 1.0**: Initial release (May 2026)
  - Quick Entry Mode (~30 sec/site)
  - Complete 7-step wizard
  - Voice notes with timestamp
  - EXIF photo metadata extraction
  - Organized ZIP export with folder structure
  - Device file system storage (Android only)
  - Remote sensing GeoTIFF analysis
  - Complete offline operation
  - Persistent storage (IndexedDB + device files)

- **Version 1.1** (Planned): Enhanced usability
  - Dark mode for night field work
  - Improved species database (user-uploaded CSV)
  - Disturbance type custom entries
  - Advanced photo compression options
  - Real-time data validation with tooltips

- **Version 2.0** (Planned): Data logger integration
  - Bluetooth sync with flux loggers
  - Automated site matching
  - Real-time data merge
  - Mobile sync between researchers' devices

---



- **Version 1.0**: Initial release (May 2026)
  - Quick Entry Mode
  - Complete wizard (Steps 1-7)
  - Voice notes
  - Photo metadata extraction (EXIF)
  - Organized ZIP export
  - Device file system storage (Android)
  - Remote sensing GeoTIFF analysis
  - Offline operation

---

## Document Metadata

- **Authors**: Field Campaign Tracker Development Team
- **Date**: May 4, 2026
- **Study System**: Arctic Permafrost, Tundra Ecosystems
- **Primary Use**: Greenhouse Gas Flux Research + Vegetation Dynamics + Spatial Upscaling
- **Recommended Citation**: 
  > Field Campaign Tracker: Mobile Application for Permafrost Greenhouse Gas Flux Research. Version 1.0. May 2026.

---

**End of Scientific Guide**
