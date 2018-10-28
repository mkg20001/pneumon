'use strict'

const Wrapper = require('./wrapper')

module.exports = {
  linux: Wrapper(() => require('node-linux').Service, '/.pneumon-'),
  mac: Wrapper(() => require('node-mac').Service, '/system/.pneumon-'),
  windows: Wrapper(() => require('node-windows').Service, 'C:\\windows\\pnemon-')
}
