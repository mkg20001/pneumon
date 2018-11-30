'use strict'

switch(process.argv[2]) {
  case 'tmp': {
    console.log(require('os').tmpdir())
    process.exit(0)
  }
  case 'kill': {
    // is in it's own file because git-bash mangles flags such as /F into F:/ and platform check

    const cp = require('child_process')

    if (process.platform === 'win32') {
      cp.execSync('taskkill /F /IM node.exe /T')
    }

    process.exit(0)
  }
}

const VERSION = '#VERSION#'
const WRAPPER = '#WRAPPER#'
const PORT = 3779

const net = require('net')
const fs = require('fs')
const bl = require('bl')
process.env.DEBUG = '*'

const stream = fs.createWriteStream(require('path').join(require('os').tmpdir(), 'log'), {flags: 'a'})
const cache = bl()

let pipeToFile = false

const pipes = [process.stdout, process.stderr].forEach(pipe => {
  const ow = pipe.write.bind(pipe)
  pipe.write = (data, ...a) => {
    cache.write(data)
    return ow(data, ...a)
  }
})

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
    cache.pipe(stream) // log to file for debug

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
