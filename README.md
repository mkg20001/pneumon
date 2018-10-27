# pneumon

## WIP DOESNT WORK YET

Pneumon is a module that allows automatic updating and managment of nodeJS app deployments.

# API

**NOTE: Most of the options/events don't currently work as this is WIP**

## `Pneumon(options)`
- `String version`: Current app version
- `updater`: Updater configuration
  - `Function<Promise<Object>>`: A function that returns a promise that contains the following values
     - `String version`: Version String (Can be anything, pnemoun does not differentiate between up- and downgrades)
     - `Buffer checksum`(optional): Multihash encoded checksum (note: only a subset supported). If this is null, checksum checks will be skipped (UNRECOMMENDED)
     - `String url`: Download URL for file
  - `String`: URL to a JSON file in the above format, except checksum must be base58 encoded
- `Integer checkInterval`: Check interval for updates. Default 1000 * 60 * 60 (1h)
- `String executorPath`: Binary to execute the executable with. This usually is the nodeJS runtime. Set this to `false` to make the binary get directly executed, as it is required for pkg. (Note: If `process.pkg` is set then this is automatically getting set to `false`)
- `String binaryPath`: The path to the binary. This is `process.argv[1]` by default, unless `executorPath` is set to `false` then it's `process.argv[0]`
- `wrapperScript`: Wrapper script that needs to be replaced. Optional.
  - `String`: Path to wrapper script
  - `Object`:
    - `path`: Path to wrapper script
    - `type`: Can be one of `sh`, `bat`, `ps`. Usually auto-detected based on file-ending or platform
- `Object serviceManager`: Service manager. Can be either a string of `systemd`, `windows` or an object. Default is auto-detected by platform
    - `Promise<Boolean> isInstalled(name)`: Checks whether the named service is installed
    - `Promise<Void> install(name, cmd, args)`: Installs a service that launches a command with arguments. NOTE: Will also be called sometimes to update an existing service
    - `Promise<Void> uninstall(name)`: Uninstalls a service
    - `Promise<Void> start(name)`: Starts a service
    - `Promise<Void> stop(name)`: Stops a service
    - `Promise<Void> restart(name)`: Restarts a service
    - `Promise<Boolean> isRunningAsService()`: Tries to detect whether the app is running in a service
- `String name`: Name used for app service

### `Promise<Boolean> .isInstalled()`: Returns whether the app is installed as a service
### `Promise<Void> .install()`: Installs app
### `Promise<Void> .uninstall()`: Uninstalls app
### `.service`: See serviceManager
### `Promise<Boolean> .isRunningAsService()`: Check whether we are in a service or not
### `Promise<Boolean> .checkForUpdates()`: Returns if updates are available
### `Promise<Void> .update()`: Runs update routine (Check?, Download, Replace, Restart)

## Events
### `checkFailed(err)`: Update check has failed
### `check(data, currentVersion)`: Update check has succeded
### `updateFound(data, currentVersion)`: Update check has found new version
### `download(url)`: Downloading newer version
### `downloadFail(err)`: Downloading newer version failed

# Usage

```js
const pneumon = require('pneumon')
const App = Pneumon({ // most stuff is optional, this is the bare-minimum
  version: require('./package.json').version,
  updater: 'https://your-ota-server/app/pneumon.json',
  name: 'my-cool-app'
})

const main = async () => {
  if (!await app.isInstalled()) {
    await app.install() // installs service
    await app.service.start() // starts service
    process.exit(0) // quit this instance
  }

  if (!await app.isRunningAsService()) {
    console.error('Run this as a service')
    process.exit(0)
  }
}

main()
```

# Helpful notes

You need to bundle your code into a single file

You should really use [pkg](https://github.com/zeit/pkg) for bundling

This makes managing nodeJS versions easier, too

You could also use docker, but sometimes that's simply not an option or just too much

# Wrapper Script

The wrapper script is a simple script that checks for a new binary, replaces the current one with the new one and runs the new binary.

# Todo

 - [ ] Tests
 - [ ] More services
 - [ ] Maybe support archives, too
