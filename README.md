# pneumon

Pneumon is a module that allows automatic updating and managment of nodeJS app deployments.

# API

## `Pneumon(options)`
- `String version`: Current app version
- `updater`: Updater configuration
  - `Function<Promise<Object>>`: A function that returns a promise that contains the following values
     - `String version`: Version String (Can be anything, pnemoun does not differentiate between up- and downgrades)
     - `Buffer checksum`(optional): Multihash encoded checksum (note: only a subset supported). If this is null, checksum checks will be skipped (UNRECOMMENDED)
     - `String url`: Download URL for file
  - `String`: URL to a JSON file in the above format, except checksum must be encoded as hex
- `Integer checkInterval`: Check interval for updates. Default 1000 * 60 * 60 (1h)
- `String executorPath`: Binary to execute the executable with. This usually is the nodeJS runtime. Set this to `false` to make the binary get directly executed, as it is required for pkg. (Note: If `process.pkg` is set then this is automatically getting set to `false`)
- `String binaryPath`: The path to the binary. This is `process.argv[1]` by default, unless `executorPath` is set to `false` then it's `process.argv[0]`
- `wrapperScript`: Wrapper script that needs to be replaced. Optional.
  - `Boolean`: If `true` then a wrapper script will be created at `binaryPath` + extension for platform
  - `String`: Path to wrapper script
  - `Object`:
    - `path`: Path to wrapper script
    - `type`: Can be one of `sh`, `bat`, `ps`. Usually auto-detected based on file-ending or platform
- `Function serviceManager({ name, cmd, args })`: Service manager. Can be either a string of `systemd`, `linux`, `mac`, `windows` (NOTE: last 3 will get deperacted soon, see issue #1) or an object. Default is auto-detected by platform
    - `Promise<Boolean> isInstalled(name)`: Checks whether the named service is installed
    - `Promise<Void> install(name, cmd, args)`: Installs a service that launches a command with arguments. NOTE: Will also be called sometimes to update an existing service
    - `Promise<Void> uninstall()`: Uninstalls the service
    - `Promise<Void> start()`: Starts the service
    - `Promise<Void> stop()`: Stops the service
    - `Promise<Void> restart(bg)`: Restarts the service, `bg` option forks the command to the background
    - `Promise<Boolean> isRunningAsService()`: Tries to detect whether the app is running in a service
- `String name`: Name used for app service

### `Promise<Boolean> .isInstalled()`: Returns whether the app is installed as a service
### `Promise<Void> .install()`: Installs app and starts service
### `Promise<Void> .uninstall()`: Uninstalls app and stops service
### `Promise<Void> routines.install()`: Installs app
### `Promise<Void> routines.uninstall()`: Uninstalls app
### `.service`: See serviceManager
### `Promise<Boolean> .isRunningAsService()`: Check whether we are in a service or not
### `Promise<Boolean> .checkForUpdates()`: Returns if updates are available
### `Promise<Void> .update()`: Runs update routine (Check?, Download, Replace, Restart)

## Events (NOT YET IMPLEMENTED)
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

To use pneumon, you need to bundle your code into a single file which you can do using [pkg](https://github.com/zeit/pkg) or [parcel](https://github.com/parcel-bundler/parcel)

You could also use docker, but sometimes that's simply not an option or just too much, that's why I created this lib

## GitLab Config

If you want to deploy the binary from gitlab simply launch a [gitlab-artifacts-server](https://github.com/mkg20001/gitlab-artifacts-server) and add this job to the gitlab-ci yaml:

```
build:
  script:
# for pkg
   - npx pkg --out-path deploy .
# OR for parcel (unrecommended as it doesn't always work)
#   - npx parcel --target node --bundle-node-modules
# writes metadata
   - 'for f in deploy/*; do npx pneumon --version "$(cat package.json | jq -rc)" --hash --file "$f" --out "$f.json"; done'
  image: node:10
  stage: build
  artifacts:
    paths:
      - deploy/
```

# Wrapper Script

The wrapper script is a simple script that checks for a new binary, replaces the current one with the new one and runs the new binary

# Todo

 - [ ] Tests
 - [ ] More services
 - [ ] Maybe support archives, too
