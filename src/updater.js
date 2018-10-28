'use strict'

const fetch = require('node-fetch')
const Joi = require('joi')
const scheme = Joi.object().required().keys({
  version: Joi.string().required(),
  checksum: Joi.string().regex(/^[a-z0-9]+$/mi),
  url: Joi.string().required()
})
const path = require('path')

module.exports = (url) => async () => {
  let res = await fetch(url)
  res = await res.json()
  Joi.validate(res, scheme)
  if (res.checksum) {
    res.checksum = Buffer.from(res.checksum, 'hex')
  }
  let urlWOName = url.split(path.basename(url))
  urlWOName.pop()
  urlWOName = urlWOName.join(path.basename(url))
  res._source = urlWOName

  return res
}
