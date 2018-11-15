'use strict'

const Wrapper = require('./wrapper')

module.exports = {
  systemd: require('./systemd'),
  upstart: require('./upstart'),
  winsw: require('./winsw'),
  linux: Wrapper(() => require('node-linux').Service, '/.pneumon-', 'linux'),
  mac: Wrapper(() => require('node-mac').Service, '/system/.pneumon-', 'darwing')
}
