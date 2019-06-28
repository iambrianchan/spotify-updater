// modules
var express        = require('express');
var compression    = require('compression');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var mongoose       = require('mongoose');
var app            = express();

// configuration
var db = require('./env.json').production.db;
var port = process.env.PORT || 8080; 

mongoose.connect(db, { useNewUrlParser: true });
mongoose.set('useFindAndModify', false); 

app.set('views', __dirname + '/public/src/views');
app.set('view engine', 'pug');

app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(methodOverride('X-HTTP-Method-Override')); 
app.use(express.static(__dirname + '/'));

// enable cors
app.use(function (req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
    res.set('Access-Control-Allow-Credentials', true);
    next();
});

require('./app/routes')(app);
app.listen(port);
console.log('Listening on port:', port);
exports = module.exports = app;                         