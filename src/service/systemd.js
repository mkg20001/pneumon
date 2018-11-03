'use strict'

const fs = require('fs')
const prom = (f) => new Promise((resolve, reject) => f((err, res) => err ? reject(err) : resolve(res)))
const exec = require('./exec')
const esc = require('shell-escape')

const tpl = ({name, cmd, args}) => `
[Unit]
Description=Pneumon deployment of ${name}

[Service]
ExecStart=${esc([cmd].concat(args))}
Restart=always
SyslogIdentifier=${name}
#User={{user}}
#Group={{group}}
Environment=NODE_ENV=production
Environment=PNEUMON_INNER=1

[Install]
WantedBy=multi-user.target
`

module.exports = ({name, cmd, args}) => {
  const svcPath = '/etc/systemd/system/' + name + '.service'

  return {
    isInstalled: async () => fs.existsSync(svcPath),
    install: async () => {
      await prom(cb => fs.writeFile(svcPath, tpl({name, cmd, args}), cb))
      await exec('systemctl', ['daemon-reload'])
      await exec('systemctl', ['enable', name])
    },
    uninstall: async () => {
      await exec('systemctl', ['disable', name])
      await prom(cb => fs.unlink(svcPath, cb))
    },
    start: async () => {
      await exec('systemctl', ['start', name])
    },
    stop: async () => {
      await exec('systemctl', ['stop', name])
    },
    restart: async () => {
      await exec('systemctl', ['restart', name])
    },
    isRunningAsService: async () => Boolean(process.env.PNEUMON_INNER)
  }
}

// http://unix.stackexchange.com/questions/18209/detect-init-system-using-the-shell
module.exports.detect = () => process.platform === 'linux' && (fs.existsSync('/usr/bin/systemctl') || fs.existsSync('/bin/systemctl'))
