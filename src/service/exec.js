'use strict'

const cp = require('child_process')
const bl = require('bl')

module.exports = (cmd, args, unref) => new Promise((resolve, reject) => {
  const p = unref ? cp.spawn(cmd, args, {detached: true, stdio: 'ignore'}) : cp.spawn(cmd, args, {stdio: 'pipe'})
  if (!unref) {
    p.stdout = p.stdout.pipe(bl())
    p.stderr = p.stderr.pipe(bl())
  } else {
    p.unref()
  }

  p.once('exit', (code, sig) => {
    if (code || sig) {
      return reject(new Error('Code/Sig ' + (code || sig) + ' on ' + cmd.concat(args).map(JSON.stringify).join(' ')))
    }

    return resolve(p)
  })

  p.once('error', reject)
})
