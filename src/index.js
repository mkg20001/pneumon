'use strict'

/* const Joi = require('joi')

const pattern = {
  version: Joi.string().required()
} */

const DefaultUpdater = require('./updater')
const ScriptTypeByPlatform = {linux: 'sh', darwin: 'sh', win32: 'bat'}
const ScriptTypes = ['sh', 'bat', 'ps'] // TODO: add
const ServiceManagers = {} // TODO: add
const fs = require('fs')

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

  // TODO: validate service manager

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
      if (newVer.version !== version) {
        return newVer
      }
    },
    download: async (newVer) => { // download new version to tmp, do checksum

    },
    prepare: async (tmp, newVer) => { // prepare update (move bin, rewrite wrapper)

    },
    finalize: async () => { // finalize (restart service)
      serviceManager.restart()
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

  return {
    isInstalled: () => serviceManager.isInstalled(name),
    install: () => {
      if (wrapper) {
        fs.writeFileSync(wrapperScript.path, wrapperScript.manager.generate(wrapper))
      }
      serviceManager.install(name)
    },
    uninstall: () => {
      if (wrapper) {
        fs.unlinkSync(wrapperScript.path)
      }
      serviceManager.uninstall(name)
    },
    service: serviceManager,
    isRunningAsService: () => serviceManager.isRunningAsService(),
    checkForUpdates: async () => {
      return Boolean(await updateRoutine.checkForNewVersion())
    },
    update: () => updateRoutine.all()
  }
}
