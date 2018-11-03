'use strict'

const Wrapper = require('./wrapper')

module.exports = {
  systemd: require('./systemd'),
  upstart: require('./upstart'),
  linux: Wrapper(() => require('node-linux').Service, '/.pneumon-', 'linux'),
  mac: Wrapper(() => require('node-mac').Service, '/system/.pneumon-', 'darwing'),
  windows: Wrapper(() => require('node-windows').Service, 'C:\\windows\\pnemon-', 'win32')
}
