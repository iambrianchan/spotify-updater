const mongoose = require('mongoose');
const artistSchema = require('./artist').Schema;

const Schema = mongoose.Schema;

const VenueSchema = new Schema({
  name: String,
  artists: [artistSchema],
  spotifyPlaylistId: String,
});

const PlaylistSchema = new Schema({
  name: String,
  venues: [VenueSchema],
  date: Date,
});

module.exports = mongoose.model('Playlists', PlaylistSchema);
