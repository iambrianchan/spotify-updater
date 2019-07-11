const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ArtistSchema = new Schema({
  name: String,
  spotifyArtistId: String,
  track: Object,
  images: [],
  popularity: Number,
  genres: [],
  followers: Number,

});
exports.Schema = ArtistSchema;
exports.Artist = mongoose.model('Artists', ArtistSchema);
