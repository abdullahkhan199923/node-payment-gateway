const express = require('express')
const path = require('path')
const app = express()
const https = require('https')
const qs = require('querystring')
// Middleware for body parsing
const parseUrl = express.urlencoded({ extended: false })
const parseJson = express.urlencoded({ extended: false })
const checksum_lib = require('./paytm/checksum')
const config = require('./paytm/config')
var nodemailer = require('nodemailer')
let email='overwrite@gmail.com'
let amt='overwrite'
const port = process.env.PORT || 3000
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/index.html'))
  console.log(config);
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}` );
})
app.get('/payment.html', (req, res) => {
    res.sendFile(path.join(__dirname + '/payment.html'))
  })
app.post('/paynow', [parseUrl, parseJson], (req, res) => {
    if (!req.body.amount || !req.body.email || !req.body.phone) {
      res.status(400).send('<h1>payment failed</h1> <a href="./index.html">Back to Home...</a>')
    } else {
      var params = {};
      params['MID'] = config.PaytmConfig.mid;
      params['WEBSITE'] = config.PaytmConfig.website;
      params['CHANNEL_ID'] = 'WEB';
      params['INDUSTRY_TYPE_ID'] = 'Retail';
      params['ORDER_ID'] = 'TEST_' + new Date().getTime();
      params['CUST_ID'] = 'customer_001';
      params['TXN_AMOUNT'] = req.body.amount.toString();
      params['CALLBACK_URL'] = 'https://abd-payment.herokuapp.com/callback'
       //'http://localhost:3000/callback';
      params['EMAIL'] = req.body.email;
      params['MOBILE_NO'] = req.body.phone.toString();
      email=req.body.email;
      amt=req.body.amount.toString();
      checksum_lib.genchecksum(params, config.PaytmConfig.key, function (err, checksum) {
        var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction"; // for staging
        // var txn_url = "https://securegw.paytm.in/theia/processTransaction"; // for production
  
        var form_fields = "";
        for (var x in params) {
          form_fields += "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
        }
        form_fields += "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";
  
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write('<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' + txn_url + '" name="f1">' + form_fields + '</form><script type="text/javascript">document.f1.submit();</script></body></html>');
        res.end();
      });
    }
    //return res.redirect('/'); 
  })
  app.post('/callback', (req, res) => {
    var body = '';
    //res.se('<h1>Thank You<h1>')
    req.on('data', function (data) {
       body += data;
    });
  
     req.on('end', function () {
       var html = "";
       var post_data = qs.parse(body);
  
       // received params in callback
       console.log('Callback Response: ', post_data, "\n");
       var oid=post_data.ORDERID
       var amt=post_data.TXNAMOUNT 
       var mode=post_data.PAYMENTMODE
       var bank=post_data.BANKNAME

       // verify the checksum
       var checksumhash = post_data.CHECKSUMHASH;
       // delete post_data.CHECKSUMHASH;
       var result = checksum_lib.verifychecksum(post_data, config.PaytmConfig.key, checksumhash);
       console.log("Checksum Result => ", result, "\n");
  
  
       // Send Server-to-Server request to verify Order Status
       var params = {"MID": config.PaytmConfig.mid, "ORDERID": post_data.ORDERID};
  
       checksum_lib.genchecksum(params, config.PaytmConfig.key, function (err, checksum) {
  
         params.CHECKSUMHASH = checksum;
         post_data = 'JsonData='+JSON.stringify(params);
  
         var options = {
           hostname: 'securegw-stage.paytm.in', // for staging
           // hostname: 'securegw.paytm.in', // for production
           port: 443,
           path: '/merchant-status/getTxnStatus',
           method: 'POST',
           headers: {
             'Content-Type': 'application/x-www-form-urlencoded',
             'Content-Length': post_data.length
           }
         };
  
  
         // Set up the request
         var response = "";
         var post_req = https.request(options, function(post_res) {
           post_res.on('data', function (chunk) {
             response += chunk;
           });
  
           post_res.on('end', function(){
             console.log('S2S Response: ', response, "\n");
  
             var _result = JSON.parse(response);
               if(_result.STATUS == 'TXN_SUCCESS') {
                   res.send('<h1>Payment Successful</h1> <a href="./index.html">Back to Home...</a>')
                   console.log(email)
                   let transporter = nodemailer.createTransport({
                    host: 'smtp.gmail.com',
                    port: 587,
                    secure: false, // true for 465, false for other ports
                    auth: {
                        user: 'thesparkfoundationdonation@gmail.com', // generated ethereal user
                        pass: 'yourpassword'  // generated ethereal password
                    },
                    tls:{
                      rejectUnauthorized:false
                    }
                  });
                
                  // setup email data with unicode symbols
                  let mailOptions = {
                      from: 'thesparkfoundationdonation@gmail.com', // sender address
                      to: email, // list of receivers
                      subject: 'Payment successfull', // Subject line
                      text: 'ORDER_ID='+oid+' \n'+
                      'AMOUNT='+amt+' \n'+ 
                      'MODE_OF_PAYMENT='+mode+' \n'+
                      'BANK_NAME='+bank+''
                // plain text body
                      //html: output // html body
                  };
                
                  // send mail with defined transport object
                  transporter.sendMail(mailOptions, (error, info) => {
                      if (error) {
                          return console.log(error);
                      }
                      console.log('Message sent: %s', info.messageId);   
                      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
                
                      res.render('contact', {msg:'Email has been sent'});
                  });
                  
               }else {
                   res.send('<h1>payment failed</h1> <a href="./index.html">Back to Home...</a>')
                   let transporter = nodemailer.createTransport({
                    host: 'smtp.gmail.com',
                    port: 587,
                    secure: false, // true for 465, false for other ports
                    auth: {
                        user: 'thesparkfoundationdonation@gmail.com', // generated ethereal user
                        pass: 'yourpassword'  // generated ethereal password
                    },
                    tls:{
                      rejectUnauthorized:false
                    }
                  });
                
                  // setup email data with unicode symbols
                  let mailOptions = {
                      from: 'thesparkfoundationdonation@gmail.com', // sender address
                      to: email, // list of receivers
                      subject: 'Payment Failed', // Subject line
                      text: 'This message is to inform you that your transaction has failed due to some error', // plain text body
                      //html: output // html body
                  };
                
                  // send mail with defined transport object
                  transporter.sendMail(mailOptions, (error, info) => {
                      if (error) {
                          return console.log(error);
                      }
                      console.log('Message sent: %s', info.messageId);   
                      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
                
                      res.render('contact', {msg:'Email has been sent'});
                  });
               }
               //setTimeout(function(){ res.redirect('/index.html');  }, 3000);

             
             });
         });
  
         // post the data
         post_req.write(post_data);
         post_req.end();
        });
       });
     //  setTimeout(function(){ res.redirect('/');  }, 3000);
  })
  