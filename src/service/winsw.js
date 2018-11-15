'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const prom = (f) => new Promise((resolve, reject) => f((err, res) => err ? reject(err) : resolve(res)))
const exec = require('./exec')
const xml = require('xml')
const fetch = require('node-fetch')

const tpl = ({name, cmd, args}) => xml({
  service: [
    {id: name},
    {name},
    {description: 'Pneumon deployment of ' + name},
    {env: {_attr: {
      name: 'PNEUMON_INNER',
      value: '1'
    }}},
    {env: {_attr: {
      name: 'NODE_ENV',
      value: 'production'
    }}},
    {executable: cmd},
    {logmode: 'rotate'},
    {delayedAutoStart: true},
    {onfailure: {_attr: {
      action: 'restart'
    }}}
  ].concat(args.map(argument => { return {argument} }))
})

const WSWV = '2.1.2'

const debug = require('debug')
const log = debug('pneumon:winsw')

const pnPath = path.join('C:\\', 'pneumon')

module.exports = ({name, cmd, args}) => {
  const svcMainPath = path.join(pnPath, name)
  const exeName = name

  const svcPath = path.join(svcMainPath, name + '.xml')

  const winsw = {
    path: path.join(svcMainPath, exeName + '.exe'),
    url: 'https://github.com/kohsuke/winsw/releases/download/winsw-v' + WSWV + '/WinSW.NET4.exe',
    exists: () => {
      if (fs.existsSync(winsw.path + '.ok')) {
        if (String(fs.readFileSync(winsw.path + '.ok')) !== WSWV) {
          fs.unlinkSync(winsw.path + '.ok')
        } else {
          return true
        }
      }
    },
    download: async () => {
      const res = await fetch(winsw.url)

      log('downloading %s', winsw.url)

      return new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(winsw.path)

        res.body.on('error', (err) => {
          reject(err)
        })

        dest.on('finish', () => {
          log('finishing dl')
          fs.writeFileSync(winsw.path + '.ok', WSWV)

          resolve()
        })

        dest.on('error', (err) => {
          reject(err)
        })

        res.body.pipe(dest)
      })
    },
    exec: (...a) => exec(winsw.path, a)
  }

  const wsw = async (...a) => {
    if (!winsw.exists()) {
      await winsw.download()
    }

    log('winsw %o', a)

    return winsw.exec(...a)
  }

  require('mkdirp').sync(svcMainPath)

  return {
    isInstalled: async () => fs.existsSync(svcPath),
    install: async () => {
      await prom(cb => fs.writeFile(svcPath, tpl({name, cmd, args}), cb))
      await wsw('install')
    },
    uninstall: async () => {
      await wsw('uninstall')
      require('rimraf').sync(svcMainPath)
    },
    start: async () => {
      await wsw('start')
    },
    stop: async () => {
      try {
        await wsw('stop')
      } catch (e) {
        // do nothing
      }
    },
    restart: async (unref) => {
      await wsw('restart')
    },
    isRunningAsService: async () => Boolean(process.env.PNEUMON_INNER)
  }
}

module.exports.detect = () => process.platform === 'win32'
