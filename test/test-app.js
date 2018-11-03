'use strict'

const VERSION = '#VERSION#'
const PORT = 3779

const net = require('net')
const path = require('path')

const arg = process.argv[2]

let isPN = false
const Pneumon = require(__dirname.split(path.sep).filter(name => {
  if (isPN) return
  isPN = name === 'pneumon'
  return true
}).join(path.sep))
const app = Pneumon({
  version: VERSION,
  updater: 'http://localhost:3778/app.json',
  name: 'pn-test-app',
  checkInterval: 5000
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
