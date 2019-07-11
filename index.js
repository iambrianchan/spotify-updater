// modules
const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const mongoose = require('mongoose');

const app = express();

// configuration
const db = process.env.SPOTIFY_DB;
const port = process.env.PORT || 8080;

mongoose.connect(db, { useNewUrlParser: true });
mongoose.set('useFindAndModify', false);

app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(express.static(__dirname + '/'));

// enable cors
app.use((req, res, next) => {
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
