'use strict'

const VERSION = '#VERSION#'
const WRAPPER = '#WRAPPER#'
const PORT = 3779

const net = require('net')

const arg = process.argv[2]

let Pneumon
try {
  Pneumon = require('..')
} catch (e) {
  Pneumon = require('../../..')
}

const app = Pneumon({
  version: VERSION,
  updater: 'http://localhost:3778/app.json',
  name: 'pn-test-app',
  checkInterval: 5000,
  wrapperScript: WRAPPER || ''
})

async function main () {
  console.log('Test App %s', VERSION)

  if (await app.isRunningAsService()) {
    const server = net.createServer(socket => {
      socket.write(VERSION)
      socket.end()
    })

    server.listen(PORT)

    console.log('Listening')
  } else {
    console.log('%sing...', arg)
    switch (arg) {
      case 'install': {
        await app.install()
        break
      }
      case 'uninstall': {
        if (await app.isInstalled()) {
          await app.uninstall()
        }
        break
      }
      default: throw new TypeError(arg)
    }
    process.exit(0)
  }
}

main().catch(err => {
  console.error(err.stack)
  process.exit(2)
})
