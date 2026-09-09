# Architectural Discovery Questionnaire

When the user requests an ultra-high-quality image without full architectural specifications, present this targeted questionnaire.

---

## The 5 Core Questions

### Question 1: Building Typology & Structural Form
* **Prompt:** *"What type of building and architectural form are we visualizing?"*
* **Options:**
  1. Contemporary Single-Story Residential (e.g. Homestead / Pavilion with carport & pitched roof)
  2. Multi-Story Modern Residence (e.g. 2-3 story geometric villa, flat roof, cantilevered balcony)
  3. Commercial / High-Rise Tower (e.g. Glass curtain wall, concrete facade, balconies)
  4. Industrial / Warehouse Facility (e.g. Portal frame, metal cladding, loading docks)
  5. Custom / Provide specific CAD model or sketch plan

### Question 2: Primary Exterior Materials
* **Prompt:** *"What are the primary exterior finishes and facade materials?"*
* **Options:**
  1. Kiln-fired brick veneer with dressed sandstone corner quoins & corrugated Colorbond metal roof
  2. Off-form / board-marked architectural concrete with timber battens & standing-seam zinc roof
  3. Rendered white masonry with black steel framing & low-profile concrete roof tiles
  4. Composite aluminium panels with reflective double-glazed curtain wall
  5. Other (specify exact textures and colors)

### Question 3: Site, Environment & Landscape
* **Prompt:** *"What is the site context and landscape environment?"*
* **Options:**
  1. Australian native bushland (sloping block, eucalyptus/gum trees with peeling bark, native grasses)
  2. Manicured suburban garden (flat block, paved driveway with expansion joints, neat turf, lavender/shrubs)
  3. Coastal / Waterfront setting (sandstone retaining walls, coastal banksia, sea breeze atmosphere)
  4. Dense urban streetscape (concrete footpaths, street trees, neighboring buildings)

### Question 4: Lighting & Atmospheric Mood
* **Prompt:** *"What time of day and lighting mood do you want?"*
* **Options:**
  1. Late-afternoon Golden Hour (warm directional sunlight, long soft shadows, ambient bounce)
  2. Crisp Morning Daylight (bright, neutral, clean architectural editorial look)
  3. Overcast / Diffuse Soft-Box (soft shadowless lighting, pure material colors, zero harsh contrast)
  4. Twilight / Dusk (deep blue sky, glowing warm interior lighting, landscape up-lights)

### Question 5: Camera Angle & Aspect Ratio
* **Prompt:** *"What camera perspective and aspect ratio do you prefer?"*
* **Options:**
  1. 16:9 Wide Hero View (eye-level 35mm architectural two-point perspective, showing house + driveway + landscape)
  2. 4:3 Standard Architectural Plate (balanced editorial framing)
  3. 9:16 Vertical / Mobile Facade (focused on entry, vertical proportions)
  4. 1:1 Square (portfolio / social feed presentation)

---

## Interactive Execution with `ask_question`

When running in an interactive session, group the questions into an `ask_question` tool call, or ask sequentially in chat if the user prefers freeform responses.
