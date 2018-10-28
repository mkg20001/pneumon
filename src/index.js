'use strict'

const Joi = require('joi')

const configScheme = { // TODO: add
  version: Joi.string().required()
}

const updateScheme = Joi.object().required().keys({
  version: Joi.string().required(),
  checksum: Joi.buffer(),
  url: Joi.string().required()
})

const serviceManagerScheme = {
  isInstalled: Joi.function().required(),
  install: Joi.function().required(),
  uninstall: Joi.function().required(),
  start: Joi.function().required(),
  stop: Joi.function().required(),
  restart: Joi.function().required(),
  isRunningAsService: Joi.function().required(),
  detect: Joi.function() // "private" api
}

const DefaultUpdater = require('./updater')
const ScriptTypeByPlatform = {linux: 'sh', darwin: 'sh', win32: 'bat'}
const ScriptTypes = ['sh', 'bat', 'ps'] // TODO: add
const ServiceManagers = {} // TODO: add

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

  if (typeof updater === 'string') {
    updater = DefaultUpdater(updater) // create updater from url
  }

  if (!checkInterval) {
    checkInterval = 1000 * 60 * 60
  }

  if (typeof executorPath === 'undefined') {
    executorPath = process.pkg ? false : process.argv[0]
  }

  if (typeof binaryPath === 'undefined') {
    binaryPath = executorPath ? process.argv[1] : process.argv[0]
  }

  if (typeof wrapperScript === 'string') {
    wrapperScript = {path: wrapperScript}
  }

  if (typeof wrapperScript.type === 'undefined') {
    let ext = wrapperScript.path.split('.').pop()
    wrapperScript.type = ScriptTypes.indexOf(ext) !== -1 ? ext : ScriptTypeByPlatform[process.platform]
  }

  wrapperScript.manager = ScriptTypes[wrapperScript.type]

  if (typeof serviceManager === 'string') {
    serviceManager = ServiceManagers[serviceManager]
  }

  if (typeof serviceManager === 'undefined') {
    serviceManager = ServiceManagers[Object.keys(ServiceManagers).filter(s => s.detect())[0]]
  }

  Joi.validate(serviceManager, serviceManagerScheme)

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

  const updateRoutine = {
    check: async () => { // check for new version
      const newVer = await updater()
      Joi.validate(newVer, updateScheme)
      if (newVer.version !== version) {
        return newVer
      }
    },
    download: async (newVer) => { // download new version to tmp, do checksum
      const tmp = path.join(os.tmpdir(), Math.random())
      const res = await fetch(newVer.url)

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
          if (hash) {
            const hashDl = hashFnc.digest()
            if (!multihashing.verify(hash, hashDl)) {
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
      await prom(cb => fs.copyFile(tmp, binaryPath + '.new', fs.constants.COPYFILE_FICLONE, cb))
      await prom(cb => fs.unlink(tmp))
      await installRoutine()
    },
    finalize: async () => { // finalize (restart service)
      await serviceManager.restart()
    },
    all: async () => {
      const newVer = await updateRoutine.check()
      if (!newVer) {
        return
      }
      const tmp = await updateRoutine.download(newVer)
      await updateRoutine.prepare(tmp, newVer)
      await updateRoutine.finalize()
    }
  }

  const installRoutine = async () => {
    if (wrapper) {
      await prom(cb => fs.writeFile(wrapperScript.path, wrapperScript.manager.generator(wrapper, binaryPath), cb))
    }
    await serviceManager.install(name)
  }

  return {
    isInstalled: () => serviceManager.isInstalled(name),
    install: installRoutine,
    uninstall: async () => {
      if (wrapper) {
        await prom(cb => fs.unlink(wrapperScript.path, cb))
      }
      await serviceManager.uninstall(name)
    },
    service: serviceManager,
    isRunningAsService: () => serviceManager.isRunningAsService(),
    checkForUpdates: async () => {
      return Boolean(await updateRoutine.checkForNewVersion())
    },
    update: () => updateRoutine.all(),
    interval: setInterval(() => updateRoutine.all(), checkInterval)
  }
}

module.exports = Pneumon
