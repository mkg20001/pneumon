'use strict'

/* eslint-disable no-console */

const opt = {}
const Joi = require('joi')
const scheme = Joi.object().keys({
  version: Joi.string().required(),
  out: Joi.string().required(),
  hash: Joi.string(),
  file: Joi.string().required(),
  url: Joi.string().required()
})
const multihashing = require('multihashing')
const fs = require('fs')
const path = require('path')

if (process.argv.length <= 2) {
  console.error(`Usage: ${process.argv[0]} [--hash [multihash-algorithm-name]] --file <path> --out <path> --version <version> [--url <download-url>]`)
}

let lastOption
process.argv.slice(2).concat(['-']).forEach(v => {
  if (v.startsWith('-')) {
    if (lastOption) {
      opt[lastOption] = true
    }

    lastOption = v.replace(/-/g, '')
  } else {
    opt[lastOption] = v
  }
})

let out = opt.out || opt.o
let version = opt.version || opt.v
let file = opt.file || opt.f

let hash = opt.hash || opt.h

if (typeof hash === 'boolean') {
  hash = 'sha2-256'
}

let url = opt.url || opt.u

if (!url) {
  url = './' + path.basename(file)
}

Joi.validate({hash, out, version, file}, scheme)

let data = {version, url}

if (hash) {
  data.checksum = multihashing(fs.readFileSync(file), hash).toString('hex')
}

fs.writeFileSync(out, JSON.stringify(data, null, 2))

console.log('Written update %s (version %s) meta to %s!', file, version, out)