# No HRM - Changelog

## v0.01

- Initial release
- Boot app (`type: bootloader`) that runs at startup before any watchface loads
- Overrides `Bangle.setHRMPower` so every attempt to enable the HRM is forced off, regardless of watchface or app
- Explicitly turns the HRM off at boot with `Bangle.setHRMPower(0, "nohrm")`
- Guards all calls with existence checks for emulator compatibility
- Uninstall to restore normal HRM behaviour
