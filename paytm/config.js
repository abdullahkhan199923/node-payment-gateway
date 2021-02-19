const dotenv = require('dotenv').config()
//dotenv.config()

var PaytmConfig = {
  mid: process.env.MID_PAYTM,
  key: process.env.KEY_PAYTM,
  website: "WEBSTAGING"
}
console.log(PaytmConfig)
module.exports.PaytmConfig = PaytmConfig
