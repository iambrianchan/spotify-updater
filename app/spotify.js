var SpotifyWebApi = require("spotify-web-api-node");
var artistsSchema = require('./models/artist');
var playlistsSchema = require('./models/playlist');

var spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

var defaultDelay = 2000;
var spot = {};

// Get an access token for spotifyApi
spot.authenticate = async function () {
	return spotifyApi.clientCredentialsGrant().then(
	  function(data) {
	    spotifyApi.setAccessToken(data.body['access_token']);
	    return;
	  },
	  function(err) {
	    console.log('Something went wrong when retrieving an access token', err);
	  }
	);
};

// Iterate over the cities
spot.transformCities = async function(cities) {
	await spot.authenticate();
	return Promise.all(cities.map(async city => {
		let cityVenues =  await spot.transformCity(city);
		let transformedCity = {
			name: city.name,
			venues: cityVenues,
			date: new Date()
		};
		await updatePlaylistInMongo(transformedCity);
		return transformedCity;
	}));
};

// Iterate over all of the venues in a city
spot.transformCity = async function(city) {
	return new Promise(async function(resolve, reject) {
		let venues = Object.keys(city.venues);
		for (let i = 0; i < venues.length; i++) {
			let newVenueArtists = await spot.transformVenues(city.venues[venues[i]]);
			console.log('finished',venues[i]);
			await delay(defaultDelay);
			await spot.authenticate();
			transformedVenue = {
				name: venues[i],
				artists: newVenueArtists
			};
			venues[i] = transformedVenue;
		}
		resolve(venues);
	});
};

// Iterate over all of the artists in a Venue
spot.transformVenues = async function(venue) {
	return new Promise(async function(resolve, reject) {
		let artists = venue;
		// Iterate over artist names, first searching for the artist by name in DB
		for (let i = 0; i < artists.length; i++) {
			let artistInDb = await lookupArtistInMongo(artists[i]);
			if (artistInDb != null) {
				artists[i] = artistInDb;
				continue;
			}
			// If not found, use spotify api to try to find artist by name, and save.
			else {
				let newArtist = await spot.searchArtist(artists[i]);
				if (newArtist != null) {
					let newTrack = await spot.searchTopTrack(newArtist.spotifyArtistId);
					newArtist.track = newTrack;
					if (newTrack != null) {
						await saveArtistInMongo(newArtist);
					}
					await delay(defaultDelay);
				}
				artists[i] = newArtist;
			}
		}

		// filter any null values
		filtered = artists.filter(function(artist) {
			return artist != null && artist.track != null;
		});
		resolve(filtered);
	});
}

// Make a request for artist's Top Track using artistId
spot.searchTopTrack = async function(artistId) {
	return new Promise(function(resolve, reject) {
		topTrack = null;
		spotifyApi.getArtistTopTracks(artistId, 'US')  // Make the request using spotifyApi
		.then(function(data) {
			data = data.body;
			if (data.tracks.length > 0) {
				track = data.tracks[0];
				topTrack = {
					trackId: track.id,
            		trackUri: track.uri,
            		images: track.album.images
				};
			}
			resolve(topTrack);
		}, function(error) {
			console.log(error);
			resolve(topTrack);
		})
	});
}

// Delay
async function delay(t, val) {
	return new Promise(function(resolve, reject) {
		setTimeout(function() {
			resolve(val);
		}, t);
	});
}

// Lookup a request in the artists database
async function lookupArtistInMongo(artistName) {
	return new Promise(function(resolve, reject) {
		artistsSchema.findOne({name: artistName}, function(error, data) {
			if (error) {
				console.log(error);
			}
			resolve(data)
		});
	});
}

// Update a playlist (city) in the playlist database
async function updatePlaylistInMongo(city) {
	return new Promise(function(resolve, reject) {
		playlistsSchema.findOneAndUpdate({name: city.name}, city, {upsert: true}, function(error, data) {
			if(error) {
				console.log(error);
			}
			resolve(data);
		});
	});
}

// Save an artist to database
async function saveArtistInMongo(artist) {
	return new Promise(function(resolve, reject) {
		// artistsDb.create(artist)
		artistDocument = new artistsSchema(artist);
		artistDocument.save(function(error) {
			if (error) {
				console.log(error)
			}
			resolve();
		});
	});
}

// Make request to search for an artist based on name
spot.searchArtist = async function (artistName) {
	return new Promise(function(resolve, reject) {
		newArtist = null;
		spotifyApi.searchArtists(artistName)  // Make the artist search request with spotifyApi
		.then(function(data) {
	    	data = data.body.artists;
	    	if (data.total > 0) {
		        newArtist = {
		        	name: artistName,
		        	spotifyArtistId: data.items[0].id,
		        	track: {},
		        	images: data.items[0].images,
		        	popularity: data.items[0].popularity,
		        	genres: data.items[0].genres,
		        	followers: data.items[0].followers.total
		        };
	    	}
	        resolve(newArtist);
		}, function(error) {
			console.log(error);
			resolve(newArtist);
		});
	});
}

module.exports = spot;