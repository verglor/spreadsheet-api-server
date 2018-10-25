const express = require('express');
const bearerToken = require('express-bearer-token');
const morgan = require('morgan')

const cli = require('commander');

const xlsx = require('xlsx');

const fs = require('fs');
const sanitize = require("sanitize-filename");

const iconv = require('iconv-lite');

const app = express();

cli.description('REST API wrapper for spreadsheet files')
  .version(require('./package').version, '-v --version')
  .option('-p, --port [port number]', 'listening port (default 8888)', parseInt)
  .option('-d, --data [directory]', 'data path (default ./data)')
  .option('-t, --token [access token]', 'bearer token to access the API')
  .parse(process.argv);

var port = cli.port || process.env.SAPIS_PORT || 8888;
var path = cli.data || process.env.SAPIS_DATA || './data';
var token = cli.token || process.env.SAPIS_TOKEN;

console.log('Environment:', app.get('env'));
console.log('Listening port:', port);
console.log('Data path:', path);
//console.log('Access token:', token);

app.listen(port);
app.use(express.json());
app.use(bearerToken());
app.use(morgan('dev'));

if (token) app.use(function(req, res, next){
    if (req.token == token) {
        next();
    } else {
        res.status(401).set('WWW-Authenticate', 'Bearer').json({error: 'Invalid or missing token'});
    }
});

function withSpreadsheet(req, res, callback) {
    var filename = sanitize(req.params.workbook + '.' + req.params.format);
    if (!fs.existsSync(path + '/' + filename)) {
        return res.status(404).json({error: 'File ' + filename + ' not found'});
    }
    try {
        var wb = xlsx.readFile(path + '/' + filename, {raw: true, cellDates: true});
        callback(wb, wb.Sheets[req.params.sheet || wb.SheetNames[0]]);
    } catch (e) {
        console.error(e);
        return res.status(400).json({error: e});
    }
}

app.route('/:format/:workbook/:sheet?')
    .get(function (req, res) {
        withSpreadsheet(req, res, function(wb, ws) {
            var json = xlsx.utils.sheet_to_json(ws);
            if (req.query.encoding) {
                json = JSON.parse(iconv.decode(iconv.encode(JSON.stringify(json), 'win1252'), req.query.encoding));
            }
            return res.json(json);
        });
    })
    .post(function (req, res) {
        withSpreadsheet(req, res, function(wb, ws) {
            var json = req.body;
            if (req.query.encoding) {
                json = JSON.parse(iconv.decode(iconv.encode(JSON.stringify(json), req.query.encoding), 'win1252'));
            }
            var header = xlsx.utils.sheet_to_json(ws, {header: 1})[0];
            xlsx.utils.sheet_add_json(ws, [json], {origin: -1, skipHeader: true, header: header});
            console.log(ws);
            var filename = sanitize(req.params.workbook + '_new.' + req.params.format);
            xlsx.writeFile(wb, path + '/' + filename);
            return res.json(xlsx.utils.sheet_to_json(ws));
        });
    });

