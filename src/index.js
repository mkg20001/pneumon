'use strict'

const Joi = require('joi')
const debug = require('debug')
const log = debug('pneumon')

const configScheme = { // TODO: add
  version: Joi.string().required()
}

const updateScheme = Joi.object().required().keys({
  version: Joi.string().required(),
  checksum: Joi.binary(),
  url: Joi.string().required(),
  _source: Joi.string()
})

const serviceManagerScheme = {
  isInstalled: Joi.func().required(),
  install: Joi.func().required(),
  uninstall: Joi.func().required(),
  start: Joi.func().required(),
  stop: Joi.func().required(),
  restart: Joi.func().required(),
  isRunningAsService: Joi.func().required(),
  detect: Joi.func() // "private" api
}

const DefaultUpdater = require('./updater')
const ScriptTypeByPlatform = {linux: 'sh', darwin: 'sh', win32: 'bat'}
const ScriptTypes = require('./script')
const ServiceManagers = require('./service')

const prom = (f) => new Promise((resolve, reject) => f((err, res) => err ? reject(err) : resolve(res)))

const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const os = require('os')

const multihashing = require('multihashing')
const multihash = require('multihashes')

const Pneumon = (options) => {
  // TODO: validate
  let {version, updater, checkInterval, executorPath, binaryPath, wrapperScript, serviceManager, name} = options

  log('setup pneumon for %s', name)

  if (typeof updater === 'string') {
    updater = DefaultUpdater(updater) // create updater from url
  }

  if (!checkInterval) {
    checkInterval = 1000 * 60 * 60
    log('check for updates every %i', checkInterval)
  }

  if (typeof executorPath === 'undefined') {
    executorPath = process.pkg ? false : process.argv[0]
  }

  if (typeof binaryPath === 'undefined') {
    binaryPath = executorPath ? process.argv[1] : process.argv[0]
  }

  if (wrapperScript) {
    if (typeof wrapperScript === 'boolean') {
      wrapperScript = {path: binaryPath + '.' + ScriptTypeByPlatform[process.platform]}
    }

    if (typeof wrapperScript === 'string') {
      wrapperScript = {path: wrapperScript}
    }

    if (typeof wrapperScript.type === 'undefined') {
      let ext = wrapperScript.path.split('.').pop()
      wrapperScript.type = Object.keys(ScriptTypes).indexOf(ext) !== -1 ? ext : ScriptTypeByPlatform[process.platform]
    }

    wrapperScript.manager = ScriptTypes[wrapperScript.type]
  }

  log('wrapper script config: %o', wrapperScript || 'not enabled')
  log('runtime config: executor=%o, binary=%o', executorPath, binaryPath)

  if (typeof serviceManager === 'string') {
    log('using service manager %s', serviceManager)
    serviceManager = ServiceManagers[serviceManager]
  }

  if (typeof serviceManager === 'undefined') {
    const svMgr = Object.keys(ServiceManagers).map(s => [s, ServiceManagers[s]]).filter(s => s[1].detect())[0][0]
    log('using service manager %s (auto)', svMgr)
    serviceManager = ServiceManagers[svMgr]
  }

  let service
  let wrapper

  if (executorPath) {
    service = {
      cmd: executorPath,
      args: [binaryPath]
    }
  } else {
    service = {
      cmd: binaryPath,
      args: []
    }
  }

  if (wrapperScript) {
    wrapper = service
    service = {
      cmd: wrapperScript.manager.executor,
      args: [wrapperScript.path]
    }
  }

  service.name = name

  try {
    serviceManager = new serviceManager(service)
  } catch (e) {
    serviceManager = serviceManager(service)
  }

  Joi.validate(serviceManager, serviceManagerScheme)

  const updateRoutine = {
    check: async (force) => { // check for new version
      log('checking for updates')
      const newVer = await updater()
      Joi.validate(newVer, updateScheme)
      if (newVer.version !== version) {
        log('found (%o => %o)', version, newVer.version)
        return newVer
      } else if (force) {
        log('forcing reinstall of %o', version)
        return newVer
      }
    },
    download: async (newVer) => { // download new version to tmp, do checksum
      const tmp = path.join(os.tmpdir(), String(Math.random()))

      let dlUrl
      if (newVer.url.match(/^[./]/)) {
        if (!newVer._source) {
          throw new Error('Manifest provided relative URL but no _source parameter!')
        }
        const parsed = new URL(newVer._source)
        parsed.pathname = path.posix.resolve(parsed.pathname, newVer.url)
        dlUrl = parsed.toString()
      } else {
        dlUrl = newVer.url
      }

      log('downloading %o to %o', dlUrl, tmp)
      const res = await fetch(dlUrl)

      let hash
      let hashFnc
      if (newVer.checksum) {
        hash = newVer.checksum
        hashFnc = multihashing.createHash(multihash.decode(hash).name)
      }

      return new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(tmp)

        if (hash) {
          res.body.on('data', (data) => {
            hashFnc.update(data)
          })
        }
        res.body.on('error', (err) => {
          reject(err)
        })

        dest.on('finish', () => {
          log('finishing dl')

          if (hash) {
            const hashDl = hashFnc.digest()
            // if (!multihashing.verify(hash, hashDl)) { // TODO: WHY THE ACTUAL FUCK DOESN'T THIS WORK?!
            if (hash.toString('hex') !== hashDl.toString('hex')) {
              return reject(new Error('Hash should be ' + hash.toString('hex') + ' but got ' + hashDl.toString('hex')))
            }
          }

          resolve(tmp)
        })
        dest.on('error', (err) => {
          reject(err)
        })

        res.body.pipe(dest)
      })
    },
    prepare: async (tmp, newVer) => { // prepare update (move bin, rewrite wrapper)
      // we're using copyFile since rename can fail sometimes accross filesystems?!
      log('copying binary')
      if (wrapper) {
        await prom(cb => fs.copyFile(tmp, binaryPath + '.new', fs.constants.COPYFILE_FICLONE, cb)) // wrapper will move $BIN.new to $BIN on launch because some os don't allow writing to the exec while it's running
        await prom(cb => fs.chmod(binaryPath + '.new', 755, cb))
      } else {
        await prom(cb => fs.unlink(binaryPath, cb)) // remove first so we can "overwrite". we can't change the running executable on linux
        await prom(cb => fs.copyFile(tmp, binaryPath, fs.constants.COPYFILE_FICLONE, cb)) // this could fail
        await prom(cb => fs.chmod(binaryPath, 755, cb))
      }
      await prom(cb => fs.unlink(tmp, cb))
      await routines.install()
    },
    finalize: async () => { // finalize (restart service)
      log('finalize update')
      await serviceManager.restart(true)
      process.kill(process.pid, 'SIGTERM') // if we're still here then simply try auto-restart as a last resort
    },
    all: async (force) => {
      log('update routine started')
      const newVer = await updateRoutine.check(force)
      if (!newVer) {
        return
      }
      const tmp = await updateRoutine.download(newVer)
      await updateRoutine.prepare(tmp, newVer)
      await updateRoutine.finalize()
    }
  }

  let updating
  const updateRoutineSafe = async (...a) => {
    if (updating) {
      await updating
    } else {
      updating = updateRoutine.all(...a)
      try {
        await updating
      } catch (e) {
        log(e)
      }
      let up = updating
      updating = null
      return up
    }
  }

  const routines = {
    install: async () => {
      log('running install')
      if (wrapper) {
        await prom(cb => fs.writeFile(wrapperScript.path, wrapperScript.manager.generator(wrapper, binaryPath), cb))
      }
      await serviceManager.install(name)
    },
    uninstall: async () => {
      if (wrapper && fs.existsSync(wrapperScript.path)) {
        await prom(cb => fs.unlink(wrapperScript.path, cb))
      }
      await serviceManager.uninstall(name)
    }
  }

  return {
    isInstalled: () => serviceManager.isInstalled(name),
    install: async () => {
      await routines.install()
      await serviceManager.restart()
    },
    uninstall: async () => {
      await serviceManager.stop()
      await routines.uninstall()
    },
    service: serviceManager,
    isRunningAsService: () => serviceManager.isRunningAsService(),
    checkForUpdates: async () => {
      return Boolean(await updateRoutine.check())
    },
    update: (...a) => updateRoutineSafe(...a),
    interval: setInterval(() => updateRoutineSafe(), checkInterval)
  }
}

module.exports = Pneumon

const PKG_EXEC = {win32: 'win.exe', darwin: 'macos', linux: 'linux'}

module.exports.guessPkg = (name) => {
  return name + '-' + PKG_EXEC[process.platform]
}
