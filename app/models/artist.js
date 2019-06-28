var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ArtistSchema = new Schema({
	name: String,
	spotifyArtistId: String,
	track: Object,
	images: [],
	popularity: Number,
	genres: [],
	followers: Number

});

module.exports = mongoose.model('Artists', ArtistSchema);