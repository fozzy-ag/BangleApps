// BtnFix - restore short BTN1 press -> launcher on Bangle.js 2 clock apps
// Replaces the firmware's stock clock-mode BTN1 watch (which can get lost on
// some watches) with a persistent watch of our own, while respecting any
// custom button handler the clock defines itself.
(function() {
  if (global._btnFixInstalled) return;
  global._btnFixInstalled = true;

  // True only while a clock WITHOUT its own BTN1 handler has focus
  var btnFixActive = false;
  var btnFixWatch = undefined;

  var onBtn1 = function() {
    if (!Bangle.CLOCK || !btnFixActive) return; // launcher/app owns the button
    Bangle.haptic("btn");
    Bangle.showLauncher();
  };

  var installBtnFixWatch = function() {
    if (btnFixWatch !== undefined) { clearWatch(btnFixWatch); btnFixWatch = undefined; }
    btnFixWatch = setWatch(onBtn1, BTN1, {repeat: true, edge: "rising"});
  };

  var origSetUI = Bangle.setUI;
  Bangle.setUI = function(mode, cb) {
    origSetUI.call(Bangle, mode, cb);
    btnFixActive = false;
    if (Bangle.CLOCK && Bangle.btnWatches) {
      // Remove ONLY the stock mode watch (always index 0); keep any custom
      // options.btn / options.btnRelease handlers the clock registered.
      var stockWatch = Bangle.btnWatches.shift();
      if (stockWatch) clearWatch(stockWatch);
      // If the clock defined its own BTN1 handler, the button belongs to the
      // app - don't also open the launcher on top of it.
      btnFixActive = !(mode && typeof mode === "object" && (mode.btn || mode.btnRelease));
    }
    // (Re)install our persistent watch on every UI change so it self-heals if
    // anything ever clears it - no timers, so no battery cost.
    installBtnFixWatch();
  };

  installBtnFixWatch();
})();
