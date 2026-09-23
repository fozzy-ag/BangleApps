# Bangle.js 2 Development Reference

Living document — update as new discoveries are made. Last updated: v0.55 (2026-08-08). Corrected against the canonical BANGLEJS2-REFERENCE.md and the current implementation.

---

## 1. Hardware & Display

- **Screen**: 176×176 pixels
- **Display type**: Transflective LCD (LPM013M126A) — **NOT OLED**
  - Pixel colors do NOT affect power draw directly
  - Power savings come from backlight reduction, not dark pixels
  - Lighter/white backgrounds reflect ambient light → less backlight needed → better battery
  - Therefore **light theme is the battery-saving choice** on this display
- **Widget bar**: Top of screen, approximately 24px tall
  - Use `Bangle.appRect.y` and `Bangle.appRect.h` for actual usable area (don't hardcode 24/152)
  - `Bangle.appRect` is available after `Bangle.setUI()` is called

## 2. Graphics API Gotchas

- **`g.reset()`** resets ALL state: font, color, fontAlign, etc. You must re-set everything after calling it
  - **Since v0.54 this is the recommended FIRST line of `draw()`** — cheap, and the structural guard against widget/app state pollution (see Section 19)
- **`g.setColor(color)`** uses 16-bit RGB565 format on 16bpp graphics, BUT see Section 16 for icon gotcha:
  - `0xF800` = red, `0x07E0` = green, `0x001F` = blue
  - `0xFFFF` = white, `0x0000` = black, `0xC618` = grey (battery bar empty)
  - `0xFE60` = yellow (battery bar low)
  - **WARNING**: `Graphics.createArrayBuffer(w,h,8)` uses 8bpp RGB332, NOT 16-bit. Values like `0x07E0` get truncated to `0xE0` which is red in RGB332, not green. Use correct 8bpp values or use 16bpp buffers.
- **`g.fillRect(x1, y1, x2, y2)`** — coords are inclusive corners, not width/height
- **`g.clearRect()`** may not use background color — use `g.setColor(0xFFFF); g.fillRect(...)` for reliable fill
- **`g.drawString(text, x, y, true)`** — 4th param `true` draws a solid background behind text (prevents bleed-through from previous draws)
- **`g.getWidth()` / `g.getHeight()`** return screen dimensions (176×176)

## 3. Font Metrics & Alignment

- **`"6x8"` font**: 6px wide, 8px tall per character at scale 1
  - Scale 2: 12×16px per char
  - Scale 4: 24×32px per char
- **`g.getFontHeight()`**: Returns actual pixel height of current font — **use this, don't hardcode**
- **`g.setFontAlign(x, y)`**:
  - x: `-1` = left, `0` = center, `1` = right
  - y: `-1` = top, `0` = middle, `1` = bottom
  - With `setFontAlign(0, -1)`: text center-horizontally, y coord = TOP of text
- **Width calculation**: `g.stringWidth(text)` returns pixel width if needed

## 4. Layout & Centering

- **Never hardcode Y positions** — calculate dynamically:
  ```js
  var appTop = Bangle.appRect ? Math.max(Bangle.appRect.y, 24) : 24;
  var appH = Bangle.appRect ? Math.min(Bangle.appRect.h, H - 24) : H - 24;
  var totalH = th + sh + sh + bh + (hasWeather ? sh : 0) + sh + gap * (hasWeather ? 5 : 4);
  var y = appTop + (appH - totalH) / 2;
  ```
- **Gap count must match element count**: 6 elements (weather) = 5 gaps, 5 elements (no weather) = 4 gaps. A hardcoded `gap * 5` is wrong without weather — it made `totalH` 8px over-tall and shifted content up 4px (fixed v0.55)
- **The old `+16` manual offset was removed** — with the correct gap count, dynamic centering is accurate on its own
- **Horizontal centering**: Use `g.setFontAlign(0, -1)` then draw at `x = W/2` (or `W >> 1`)
- **Weather icons extend ~8px above text position** — account for this in total height calculation (add 8 to weather section height)
- **Group centering**: When icon + text are a group (e.g., weather), center the group as a whole, not individually
- **Battery bar centering**: 10 segments × 10px wide + 9 gaps × 2px = 118px total. Center offset = 59px from center

## 5. Timer & Update Behavior

- **Recommended (v0.51+): `queueDraw()`** — a self-requeueing `setTimeout` aligned to the minute boundary:
  ```js
  let drawTimeout;
  function queueDraw() {
    if (drawTimeout) clearTimeout(drawTimeout);
    drawTimeout = setTimeout(function() {
      drawTimeout = undefined;
      draw();
    }, Math.max(1, 60000 - (Date.now() % 60000)));
  }
  ```
- **Why `setTimeout` over `setInterval`**: `setInterval` drifts; a timeout aligned to `Date.now() % 60000` fires exactly at each minute change
- **`Math.max(1, ...)` guard**: prevents a 0ms timeout edge case exactly on the minute
- **Re-queuing from inside `draw()` is intentional** — `queueDraw()` is called at the end of `draw()`, so the redraw stays locked to the minute. The older "never touch the timer from draw()" advice applied to `setInterval` only
- **Keep running while the LCD is off** — the timer must NOT be cleared on `lcdPower(false)`; otherwise the shown minute goes stale during idle (v0.51 root cause). `onLcdPower` only needs to trigger an immediate full redraw on wake
- **`lcdPower` / `lock` handlers do fire on this firmware** — they are used (wake → redraw), but the timer is the reliable driver
- **Always cancel before re-queue**: `clearTimeout(drawTimeout)` prevents duplicate timers

## 6. Initialization Order

The correct order matters:

```js
// 1. Disable sensors to save power
if (Bangle.setHRMPower) Bangle.setHRMPower(0, "appname");

// 2. Set UI mode BEFORE draw() and setInterval
Bangle.setUI({mode:"clock", remove:function() { clearInterval(drawInterval); }});

// 3. Initial clear
g.setColor(0xFFFF);
g.fillRect(0, 0, g.getWidth(), g.getHeight());

// 4. Load and draw widgets
Bangle.loadWidgets();
Bangle.drawWidgets();

// 5. First draw
draw();

// 6. Start interval AFTER first draw
drawInterval = setInterval(draw, 60000);
```

- `Bangle.setUI({mode:"clock"})` tells the system this is a clock app (keeps screen on, handles button, etc.)
- Must be called **before** `draw()` and `setInterval`

## 7. Storage & Data Reading

- **`require("Storage").readJSON()` can throw** — always wrap in try/catch
- **Cache storage reads** — don't read the same file twice in one draw cycle
- **Cache `require()` calls** — store `require("locale")` result in a variable at init, not per-draw
- **Use TTL caching for infrequent data** — flash reads cost 10-50ms; don't re-read every 60s if data changes hourly
- **Weather data** (from owmweather app): `require("Storage").readJSON("weather.json")`
  - Structure: `wd.weather.temp` (Kelvin), `wd.weather.code` (OWM code)
  - Changes ~every 30 min from phone companion — cache with a **60-minute TTL** (matches the external update frequency)

```js
var lc = require("locale");
var cachedWeather = null;
var cachedWeatherTime = 0;

function getWeather() {
  var now = Date.now();
  if (cachedWeather !== null && now - cachedWeatherTime < 3600000) return cachedWeather;
  var wd = null;
  try { wd = require("Storage").readJSON("weather.json"); } catch(e) {}
  var w = wd && wd.weather ? wd.weather : null;
  cachedWeather = w && w.temp !== undefined ? w : null;
  cachedWeatherTime = now;
  return cachedWeather;
}
```

## 8. Locale Formatting

- `require("locale")` provides time/date formatting
- **Use `1` parameter for short format**:
  - `lc.time(date, 1)` → short time (e.g., "14:30")
  - `lc.date(date, 1)` → short date (e.g., "17/07")
  - `lc.dow(date, 1)` → short day name (e.g., "Fri")
- **Without `1`**: returns LONG format — can overflow screen width on 176px display

## 9. Weather (owmweather)

- **owmweather** app stores data in `weather.json` via `require("Storage")`
- **Temps in Kelvin**: `temp - 273.15` for Celsius
- **OWM weather codes** (NOT WMO — different ranges):
  - 200–232: Storm/thunderstorm
  - 300–531: Rain/drizzle
  - 600–622: Snow
  - 701–741: Fog/mist
  - 800: Clear/sun
  - 801–804: Cloudy
- **Weather section**: hide gracefully if owmweather not installed or no data (try/catch returns nothing)
- **`Math.round(w.temp - 273.15)`** for clean integer display with °C

## 10. Step Counter

- **`Bangle.getStepCount()`** — total steps since boot, **never resets**
- **`Bangle.getHealthStatus("day").steps`** — daily step count, **resets at midnight** — this is what minwatch displays
- **Throttle the read** — `onStep` fires on every pedometer event (1.6+/sec while walking); read `getHealthStatus("day").steps` at most once per second (v0.55)
- Guard with `sc = sc || 0` — returns 0 if health tracking not enabled
- No setup required — hardware pedometer runs independently

## 11. Charging Detection

- **`Bangle.isCharging()`** — returns boolean, can be polled
- **`Bangle.on('charging', function(charging) {...})`** — event-based, fires on state change
- Event-driven is preferred: zero overhead when not charging
- Guard both with existence checks for emulator compatibility
- Clean up with `Bangle.removeListener('charging', onCharging)` in the remove handler (NOT `removeAllListeners` — that nukes other apps' handlers)
- Note: This is only available on Bangle.js smartwatches (not emulator)
- **Call `isCharging()` AFTER `Bangle.setUI()`** — firmware may not have charging state ready before then
- **Always draw charging icon OUTSIDE the outer try/catch** — if any content error occurs, the icon still renders
- **Position icon in empty space** — below all content, avoid overlap with weather/steps text

## 12. Battery

- `E.getBattery()` returns percentage (0–100)
- Battery bar: 10 segments, 10px wide, 2px gap between segments
- Color coding: red (≤20%), yellow (≤40%), green (>40%)
- Grey (`0xC618`) for empty segments

```js
let filled = Math.round(E.getBattery() / 10);
for (let i = 0; i < 10; i++) {
  g.setColor(i < filled ? (filled <= 2 ? 0xF800 : filled <= 4 ? 0xFE60 : 0x07E0) : 0xC618);
  let x = cx - 59 + i * 12;
  g.fillRect(x, y, x + 9, y + 6);
}
```

## 13. HRM (Heart Rate Monitor)

- **Disable explicitly** to save power: `if (Bangle.setHRMPower) Bangle.setHRMPower(0, "appname")`
- **Guard with existence check** — `Bangle.setHRMPower` may not exist in emulator
- Similarly guard `Bangle.on(...)` calls that may not be available in all contexts

## 14. Emulator Compatibility

- Set `"allow_emulator": true` in metadata.json
- **Guard all hardware-specific APIs** with existence checks:
  ```js
  if (Bangle.setHRMPower) Bangle.setHRMPower(0, "minwatch");
  ```
- **Wrap Storage reads in try/catch** — emulator may not have all files
- `Bangle.appRect` may not be available — provide fallback (e.g., `var appTop = Bangle.appRect ? Bangle.appRect.y : 24;`)

## 15. Code Style & Performance

- **Cache everything**: locale, storage reads, font height measurements
- **TTL caching**: for data that changes rarely (weather: 5min, week number: by day), avoid repeated flash reads
- **Per-section try/catch**: one element failure shouldn't hide others
- **Always restore graphics state in catch blocks** — if a section changes `g.setFontAlign()`, restore it in `catch` so downstream sections aren't affected:
  ```js
  try {
    g.setFontAlign(-1, -1);
    g.drawString(text, x, y, true);
    g.setFontAlign(0, -1);  // restore
  } catch(e) {
    g.setFontAlign(0, -1);  // restore even on error
  }
  ```
- **Use `g.stringWidth()` for text overflow checks** — not magic numbers:
  ```js
  if (g.stringWidth(dateStr) > W - 10) dateStr = fallback;
  ```
- **Reduce redundant calls** — don't call `setFont`/`setColor`/`setFontAlign` more than needed — only reset when switching contexts
- **Remove unused variables** — reduces memory footprint
- **Cache `W >> 1` as `cx`** — single variable instead of repeated bit shifts
- **Week number only changes once per day** — cache by date, skip calculation if same day
- **Cache font heights at init** — `g.setFont()` + `getFontHeight()` is expensive; measure once, store in variables
- **Cache static values at init**: `W`, `H`, `cx`, `gap`, `bh` — never recalculate in draw(). `appTop`/`appH` are cached after `setUI()` via a `cacheAppRect()` helper (v0.55)

### Redraw Strategy — partial-redraw pattern SUPERSEDED (v0.49–v0.50)
The v0.19 "partial redraw" approach (track last values, clear only changed regions) was **abandoned**. On-device testing showed:
- A **partial-band LCD flush** after a ~60s static period left a visible bar artifact; full-area clears were immune
- A full content-area clear + redraw once per minute is cheap (~10KB SPI/min) and reliable
- Current implementation: clear the content area + the steps strip each minute, redraw everything, refresh the charging icon — no last-value diffing

The old pattern is kept below for historical reference only:

1. ~~Track last-drawn values~~ — SUPERSEDED, see note above
2. ~~Clear only the affected region~~ — SUPERSEDED, see note above
3. ~~Skip `g.reset()` — it resets all graphics state and is expensive~~ — **SUPERSEDED in v0.54**: `g.reset()` at the top of `draw()` is now the recommended structural guard (see Section 19)

```js
var lastTimeStr = "";
var lastDay = -1;
var lastBattery = -1;
var lastSteps = -1;

function draw() {
  var date = new Date();
  var timeStr = lc.time(date, 1);

  g.setFontAlign(0, -1);
  g.setColor(0);

  // Only redraw time if it changed
  if (timeStr !== lastTimeStr) {
    g.setFont("6x8", 4);
    g.setColor(0xFFFF); g.fillRect(0, y-1, W, y+th+1);  // clear only this line
    g.setColor(0);
    g.drawString(timeStr, cx, y, true);
    lastTimeStr = timeStr;
  }
  y += th + gap;

  // Only redraw date/CW if day changed
  if (day !== lastDay) {
    // ... redraw date and CW ...
    lastDay = day;
  } else {
    y += sh + gap;  // skip past unchanged sections
    y += sh + gap;
  }

  // Only redraw battery if percentage changed
  var filled = Math.round(E.getBattery() / 10);
  if (filled !== lastBattery) {
    // ... clear and redraw bar ...
    lastBattery = filled;
  }
}
```

**Redraw frequency by element**:
| Element | Redraw trigger | Cost |
|---------|---------------|------|
| Time | Every minute (string change) | Medium — only 1 line |
| Date/CW | Once per day | Zero after first draw |
| Battery | When % changes (rarely) | Zero most draws |
| Weather | When temp string changes | Zero most draws |
| Steps | When count changes | Low — usually changes often |
| Charging | Event-driven only | Zero overhead |

**What NOT to do**:
- ~~`g.reset()` on every draw — resets all state, expensive~~ — **SUPERSEDED in v0.54**: `g.reset()` at the top of `draw()` is the recommended structural guard; the cost is negligible
- `g.fillRect(0, appTop, W, H)` on every draw — clears 176×152 pixels for nothing
- `g.setFont("6x8", 4); g.setFont("6x8", 2)` on every draw — cache font heights, set font only when switching
- Per-section try/catch when sections don't throw — consolidate into outer catch

## 16. App Loader & Distribution

### File Structure
```
minwatch/
  app.js            Main watchface code
  metadata.json     App metadata (version, dependencies, storage mapping)
  app-icon.js       Icon — MUST use heatshrink-compressed format (see below)
  app.png           48×48 PNG icon (for App Loader preview on web)
  ChangeLog         BangleApps-format changelog (newest first, NO extension)
  CHANGELOG.md      Human-readable changelog (optional, for repo)
```

### App Icon Format — CRITICAL
The icon stored on the watch (`minwatch.img`) must be in **heatshrink-compressed binary format**. This is the standard used by every app in BangleApps:

```js
require("heatshrink").decompress(atob("mEwghC/AFeg...base64data..."))
```

**DO NOT** use `Graphics.createArrayBuffer()` + `g.asImage()`:
- 8bpp buffers (`createArrayBuffer(48,48,8)`) use RGB332 palette, NOT RGB565
- `setColor(0x07E0)` truncates to `0xE0` = **bright red**, not green
- This produces a broken/empty icon in the watch menu
- Minwatch was the only app in BangleApps using this pattern — it never worked correctly

**How to generate**: Use the BangleApps `webtools/imageconverter.js`:
```js
const imageconverter = require("BangleApps/webtools/imageconverter.js");
const heatshrink = require("BangleApps/webtools/heatshrink.js");
imageconverter.setHeatShrink(heatshrink);
const result = imageconverter.RGBAtoString(rgbaData, {
  width: 48, height: 48,
  mode: "4bit", transparent: true, compression: true, output: "string"
});
// result = 'require("heatshrink").decompress(atob("..."))'
```

**metadata.json storage entry** for the icon:
```json
{"name": "minwatch.img", "url": "app-icon.js", "evaluate": true}
```
The `evaluate: true` flag tells the App Loader to execute the JS on the watch and store the return value.

### apps.json Is a Jekyll Template — NOT Valid JSON
The upstream BangleApps repo's `apps.json` is a **Liquid/Jekyll template**, not parseable JSON:
```
---
{%- include_relative {{ apps.first }} -%}
...
---
```
**You CANNOT serve this directly.** Generate proper JSON by running:
```bash
cd BangleApps
bash bin/create_apps_json.sh           # generates apps.json
bash bin/create_apps_json.sh apps.local.json  # generates apps.local.json
```
This concatenates all `apps/*/metadata.json` files into a single JSON array.

### Version Sync — CRITICAL
Version must match across ALL of these files:
1. `metadata.json` → `"version": "X.YZ"`
2. `apps.json` → generated from metadata.json files (run `create_apps_json.sh`)
3. **`apps.local.json`** → generated from metadata.json files — **THIS is what the App Loader actually reads**

**Two directories must be updated — forget one and the loader shows stale version:**
- `minwatch/metadata.json`, `minwatch/apps.json`, `minwatch/apps.local.json` (repo copies, gitignored)
- `BangleApps/apps/minwatch/metadata.json` (synced copy)
- `BangleApps/apps.json`, `BangleApps/apps.local.json` (served by the loader on localhost:8080)

**`apps.json` / `apps.local.json` are generated files** — `bin/create_apps_json.sh` concatenates every `apps/*/metadata.json`; run it after any metadata change (the per-app directory must NOT contain its own `apps.json` copies — those go stale and are not read)

### `apps.local.json` vs `apps.json`
- `loader.js` line 10: `Const.APPS_JSON_FILE = "apps.local.json";`
- The App Loader reads **`apps.local.json`**, NOT `apps.json`
- Running `create_apps_json.sh` without args generates both files
- **You must regenerate after ANY metadata.json change**, or the App Loader shows stale version
- Closing and reopening the browser tab may still be needed (JS memory cache persists even with no-cache headers)

### Dependency Format in metadata.json
The key is the **app/module name**, the value is the **type**:
```json
"dependencies": {
  "owmweather": "app"
}
```
**NOT** `"app": "owmweather"` — that causes: `"Dependency type 'owmweather' not supported"`

Valid dependency types: `"app"`, `"module"`, `"widget"`, `"type"`

### ChangeLog Format
```
0.12: Description of what changed
0.11: Previous version description
...
0.01: Initial release
```
- Newest first
- No file extension
- Clicking the version number in the App Loader opens this file

### Local HTTP Server for Testing
- **Must serve from BangleApps root directory** — the App Loader UI (index.html, loader.js) lives there
- **Must set no-cache headers**: `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- Serve on `0.0.0.0:8080` to allow phone access over WiFi
- Access from phone: `http://<termux-ip>:8080` (not `localhost`)
- Browser JS cache persists even with no-cache headers — **close tab and reopen** to see changes
- Python example: `serve.py` in app directory

### Submitting to Official App Loader
1. Fork `espruino/BangleApps` on GitHub
2. Create branch from `upstream/master`
3. Copy app files to `apps/<appid>/`
4. Run `bash bin/create_apps_json.sh apps.local.json` to verify
5. Commit only app files (NOT apps.json — it's auto-generated by GitHub Pages)
6. Push branch, open PR to `espruino/BangleApps:master`
7. Token needs `repo` + `workflow` scopes for push (workflow files in .github/)

## 17. Dependencies

- **Format**: `"appname": "type"` in metadata.json (NOT `"type": "appname"`)
- **owmweather** (for weather data) — `"owmweather": "app"`
- **No other external dependencies** — all other APIs are built into Bangle.js firmware
- Weather gracefully degrades: if owmweather not installed, weather section is simply not drawn
- Valid types: `"app"` (installed app), `"module"` (JS module), `"widget"`, `"type"`

## 18. Power Saving Checklist

1. Light/white background (transflective LCD efficiency)
2. Disable HRM with `Bangle.setHRMPower(0, "appname")`
3. Don't poll sensors unnecessarily; throttle event-driven storage reads (steps: max 1/s)
4. Use `queueDraw()` — `setTimeout` aligned to the minute boundary (not `setInterval`, not continuous loops)
5. Cache all reads — minimize Storage/require() calls per draw
6. Use TTL caching for infrequent data (weather: 60min, week num: by day)
7. Keep the per-minute clear scoped to the content area + steps strip — don't clear the widget bar or the charging-icon zone
8. Short/efficient locale format (`1` parameter)
9. Event-driven state detection (charging) instead of polling
10. Draw overlays (charging icon) outside main try/catch so they always render
11. ~~Partial redraws~~ — **SUPERSEDED**: a full content-area clear + redraw per minute (~10KB SPI/min) is cheaper and avoids partial-band LCD-flush artifacts
12. ~~Never `g.reset()` in draw()~~ — **SUPERSEDED in v0.54**: `g.reset()` as the first line of `draw()` is the recommended structural guard (cheap)
13. **Cache font heights at init** — don't call `g.setFont()`/`getFontHeight()` per draw
14. **Cache static geometry** — `W`, `H`, `cx`, `gap`, `bh` at init; `appTop`/`appH` via `cacheAppRect()` after `setUI()`

## 19. Deep Code Review Findings (2026-08-08)

Full review pass comparing minwatch against the official `apps/_example_clock/app.js`, `apps/antonclk/app.js`, `apps/widbat/widget.js`, the Espruino Widgets docs and Discussion #1800 ("Widget affecting screen positioning"). No visual change at default geometry.

1. **Hardcoded clear/icon rects (Medium → FIXED v0.55)** — `clearRect(0, appTop, W-1, 157)` + `clearRect(0, 158, W-22, 175)` and `drawChargingIcon`'s `fillRect(W-22, 158, W, 175)` hardcoded `157/158/175`. If `appRect` differs (bottom widgets, different widget-bar height) the clears misplace and can overwrite widgets. Fix: `appBottom = appTop + appH` cached once after `setUI()` via `cacheAppRect()`; clears become `(0, appTop, W-1, appBottom-19)` + `(0, appBottom-18, W-23, appBottom-1)`; icon zone x `W-22`–`W`, y `appBottom-18`–`appBottom-1`. Never hardcode these values.
2. **Step-count text can invade the icon zone (Medium → FIXED v0.55)** — `cachedSteps + " steps"` at `"6x8"` scale 2 is 12px/char. "99999 steps" = 11 chars = 132px → x22–153 (fits). 6 digits = 144px → x16–160 (over the protected margin x154–160); 7 digits = 156px → x10–166 (over the bolt at x166–176). Fix: clamp the **displayed** value to `Math.min(cachedSteps, 99999)` — health data untouched.
3. **`y` advance inside try/catch (Low → FIXED v0.55)** — `y += sh + gap` was inside each section's try; a thrown draw meant `y` didn't advance and the next section drew over the failed one. Fix: move every `y += ...` outside the try (after the catch) so layout always progresses; the catch still restores `g.setFontAlign(0,-1)`.
4. **Hardcoded gap count in `totalH` (Low → FIXED v0.55)** — `gap * 5` assumed weather always present. 5 elements (no weather) = 4 gaps, so `totalH` was 8px over-tall and content shifted up 4px. Fix: `gap * (hasWeather ? 5 : 4)`.
5. **Event-driven charging icon not refreshed by redraw (Low → FIXED v0.55)** — the icon was drawn only at init and on charging events; any full redraw could leave it stale. Fix: call `drawChargingIcon()` at the end of `draw()`, outside the outer try/catch (it clears its own zone with `g.theme.bg` then redraws the bolt iff charging — idempotent, ~1 tiny rect per minute).
6. **`onStep` storage churn (Note → FIXED v0.55)** — `onStep` read `Bangle.getHealthStatus("day").steps` on **every** pedometer event (1.6+/sec while walking). Fix: throttle with `lastStepRead` to one read per second.

### g.reset() — the resolved contradiction
Earlier sections of this file (15/18) warned to never call `g.reset()` in `draw()`. The review concluded the opposite: **`g.reset()` as the first line of `draw()` is correct** (Discussion #1800: widgets mutate global graphics state and leak it into apps — the v0.52 red-background was exactly this, `widbat` leaving `bgColor` poisoned at <20% battery). It is cheap on this firmware and is the structural guard for the whole class of widget-state-pollution bugs. The corresponding notes in Sections 15/18 are marked SUPERSEDED above.

---

*Update this document as new discoveries are made during development.*
