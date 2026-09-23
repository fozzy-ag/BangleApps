# No GPS

A [Bangle.js 2](https://banglejs.com/) boot app that **fully disables the GPS**, no matter which watchface or app is installed.

## Features

- **Runs at boot** — as a `bootloader` type app it starts before any watchface or app loads
- **Blocks every enable attempt** — `Bangle.setGPSPower` is overridden so any app, navigation tool or run-tracking app that tries to switch the GPS on is silently forced off
- **No GPS hardware activity** — the receiver never powers up, saving the GPS's ~20mA draw listed in the [official Bangle.js 2 Software Reference](https://www.espruino.com/Bangle.js2#power-consumption)
- **Emulator safe** — guards every API call with an existence check
- **Easy to remove** — uninstall the app to restore normal GPS behaviour

## How it works

```js
(function() {
  let originalSetGPSPower = Bangle.setGPSPower;
  if (!originalSetGPSPower) return;
  Bangle.setGPSPower = function(power, appID, libName) {
    return originalSetGPSPower(0, "nogps");
  };
  originalSetGPSPower(0, "nogps");
})();
```

Because boot files re-run on every app launch, the override is always freshly installed before any app runs, so it can't be bypassed.

## Installation

### Via Web Loader (recommended)
1. Run the included loader server: `python3 serve.py` (serves `http://0.0.0.0:8080`)
2. Open the [Bangle.js App Loader](https://banglejs.com/apps) in Chrome/Edge/Opera
3. Click **More... → Load app from URL**
4. Enter `http://<your-termux-ip>:8080`
5. Find **No GPS** and click Install

### Manual
1. Connect to the Bangle.js via the Espruino Web IDE
2. Upload `boot.js` as `nogps.boot.js`

## Verifying it works

Connect via the Web IDE and run:

```js
Bangle.setGPSPower(1, "test");
Bangle.isGPSOn();   // expect: false
```

If `false`, the GPS is disabled (the enable attempt is instantly forced off, so the receiver never powers up).

## Credits

- Icon: [Maps Location](https://www.iconpacks.net/free-icon/maps-location-11096.html) by [Iconpacks](https://www.iconpacks.net) — free for commercial use, modified (resized and crossed out for "No GPS")

## Version History

See [ChangeLog](ChangeLog) for the full version history.

## License

MIT
