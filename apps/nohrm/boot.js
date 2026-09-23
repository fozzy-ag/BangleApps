// No HRM - fully disable the heart rate monitor for all apps
(function() {
  let originalSetHRMPower = Bangle.setHRMPower;
  if (!originalSetHRMPower) return; // not available (e.g. emulator)

  // Override Bangle.setHRMPower so every attempt to enable the HRM is forced off
  Bangle.setHRMPower = function(power, appID, libName) {
    return originalSetHRMPower(0, "nohrm");
  };

  // Disable the HRM now (in case this boot file runs after others)
  originalSetHRMPower(0, "nohrm");
})();
