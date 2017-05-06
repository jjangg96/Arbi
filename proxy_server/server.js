var express = require('express');
var fs = require('fs');
var app = express();
var bodyParser = require('body-parser');
var https = require('https');
var qs = require('querystring');
var cors = require('cors');
var URL = require('url');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.get('/get', function(req, res){
    try {
        var data = '';
        var get_url = URL.parse(decodeURIComponent(req.query.url));
        var options = {
            host: get_url.hostname,
            port: '443',
            path: get_url.path,
            method: 'GET',
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            }
        };

        var get_req = https.request(options, function(res2) {
            res2.setEncoding('utf8');
            res2.on('data', function (chunk) {
                data += chunk;
            });
            res2.on('end', function(){
                res.end(data);
            });
        });
        get_req.end();
    } catch (e) {
        console.log('get error', e);
    }
});

var port = 3000;
app.listen(port);
console.log('Listening at http://localhost:' + port)
