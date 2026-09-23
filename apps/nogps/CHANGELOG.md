# No GPS - Changelog

## v0.01

- Initial release
- Boot app (`type: bootloader`) that runs at startup before any watchface loads
- Overrides `Bangle.setGPSPower` so every attempt to enable the GPS is forced off, regardless of watchface or app
- Explicitly turns the GPS off at boot with `Bangle.setGPSPower(0, "nogps")`
- Guards all calls with existence checks for emulator compatibility
- Uninstall to restore normal GPS behaviour
