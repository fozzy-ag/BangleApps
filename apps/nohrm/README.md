# No HRM

A [Bangle.js 2](https://banglejs.com/) boot app that **fully disables the heart rate monitor** (HRM), no matter which watchface or app is installed.

## Features

- **Runs at boot** — as a `bootloader` type app it starts before any watchface or app loads
- **Blocks every enable attempt** — `Bangle.setHRMPower` is overridden so any app, widget, workout app or health-tracking app that tries to switch the HRM on is silently forced off
- **No HRM hardware activity** — the sensor never powers up, saving the HRM's ~1.0mA draw listed in the [official Bangle.js 2 power consumption specs](https://www.espruino.com/Bangle.js2#power-consumption)
- **Emulator safe** — guards every API call with an existence check
- **Easy to remove** — uninstall the app to restore normal HRM behaviour

## How it works

```js
(function() {
  let originalSetHRMPower = Bangle.setHRMPower;
  if (!originalSetHRMPower) return;
  Bangle.setHRMPower = function(power, appID, libName) {
    return originalSetHRMPower(0, "nohrm");
  };
  originalSetHRMPower(0, "nohrm");
})();
```

Because boot files re-run on every app launch, the override is always freshly installed before any app runs, so it can't be bypassed.

## Installation

### Via Web Loader (recommended)
1. Run the included loader server: `python3 serve.py` (serves `http://0.0.0.0:8080`)
2. Open the [Bangle.js App Loader](https://banglejs.com/apps) in Chrome/Edge/Opera
3. Click **More... → Load app from URL**
4. Enter `http://<your-termux-ip>:8080`
5. Find **No HRM** and click Install

### Manual
1. Connect to the Bangle.js via the Espruino Web IDE
2. Upload `boot.js` as `nohrm.boot.js`

## Verifying it works

Connect via the Web IDE and run:

```js
Bangle.setHRMPower(1, "test");
Bangle.isHRMOn();   // expect: false
```

If `false`, the HRM is disabled (the enable attempt is instantly forced off, so the sensor never powers up).

## Credits

- Icon: [Red Heart Rate](https://www.iconpacks.net/free-icon/red-heart-rate-23223.html) by [Iconpacks](https://www.iconpacks.net) — free for commercial use, modified (resized and crossed out for "No HRM")

## Version History

See [ChangeLog](ChangeLog) for the full version history.

## License

MIT
