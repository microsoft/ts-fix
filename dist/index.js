
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./mylib.cjs.production.min.js')
} else {
  module.exports = require('./mylib.cjs.development.js')
}
