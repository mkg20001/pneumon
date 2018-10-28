'use strict'

const cp = require('child_process')
const bl = require('bl')

module.exports = (cmd, args) => new Promise((resolve, reject) => {
  const p = cp.spawn(cmd, args, {stdio: 'pipe'})
  p.stdout = p.stdout.pipe(bl())
  p.stderr = p.stderr.pipe(bl())

  p.on('exit', (code, sig) => {
    if (code || sig) {
      return reject(new Error('Code/Sig ' + (code || sig)))
    }

    return resolve(p)
  })
})
