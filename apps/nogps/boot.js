// No GPS - fully disable the GPS for all apps
(function() {
  let originalSetGPSPower = Bangle.setGPSPower;
  if (!originalSetGPSPower) return; // not available (e.g. emulator)

  // Override Bangle.setGPSPower so every attempt to enable the GPS is forced off
  Bangle.setGPSPower = function(power, appID, libName) {
    return originalSetGPSPower(0, "nogps");
  };

  // Disable the GPS now (in case this boot file runs after others)
  originalSetGPSPower(0, "nogps");
})();
