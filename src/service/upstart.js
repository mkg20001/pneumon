'use strict'

const fs = require('fs')
const prom = (f) => new Promise((resolve, reject) => f((err, res) => err ? reject(err) : resolve(res)))
const exec = require('./exec')
const esc = require('shell-escape')

const tpl = ({name, cmd, args}) => `
# ${name}.conf
# WARNING: AUTOMATICALLY GENERATED BY PNEUMON

start on filesystem
exec /usr/bin/env NODE_ENV=production PNEUMON_INNER=1 ${esc([cmd].concat(args))}
# auto-restart
respawn
`

module.exports = ({name, cmd, args}) => {
  const svcPath = '/etc/init/' + name + '.conf'
  const svcEnable = '/etc/init.d/' + name

  return {
    isInstalled: async () => fs.existsSync(svcPath),
    install: async () => {
      await prom(cb => fs.writeFile(svcPath, tpl({name, cmd, args}), cb))
      await exec('ln', ['-sf', svcPath, svcEnable])
      await exec('chmod', ['+x', svcEnable])
      await exec('sleep', ['1s']) // wait a bit so it can find the service
    },
    uninstall: async () => {
      await prom(cb => fs.unlink(svcEnable, cb))
      await prom(cb => fs.unlink(svcPath, cb))
    },
    start: async () => {
      await exec('initctl', ['start', name])
    },
    stop: async () => {
      await exec('initctl', ['stop', name])
    },
    restart: async (unref) => {
      await exec('initctl', ['restart', name], unref)
    },
    isRunningAsService: async () => Boolean(process.env.PNEUMON_INNER)
  }
}

// http://unix.stackexchange.com/questions/18209/detect-init-system-using-the-shell
module.exports.detect = () => process.platform === 'linux' && (fs.existsSync('/bin/initctl') || fs.existsSync('/sbin/initctl'))
