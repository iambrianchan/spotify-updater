
const SpotifyWebApi = require('spotify-web-api-node');
const ArtistsSchema = require('./models/artist').Artist;
const PlaylistsSchema = require('./models/playlist');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  // redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

spotifyApi.setAccessToken(process.env.SPOTIFY_ACCESS_TOKEN);
spotifyApi.setRefreshToken(process.env.SPOTIFY_REFRESH_TOKEN);


const defaultDelay = 1000;
const spot = {};

// function for delaying
async function delay(t, val) {
  return new Promise(((resolve, reject) => {
    setTimeout(() => {
      resolve(val);
    }, t);
  }));
}

// Lookup a request in the artists database
async function lookupArtistInMongo(artistName) {
  return new Promise(((resolve, reject) => {
    ArtistsSchema.findOne({ name: artistName }, (error, data) => {
      if (error) {
        console.log('An error occurred looking up an artist in the database', error);
        reject(error);
      }
      resolve(data);
    });
  }));
}

// Update a playlist (city) in the playlist database
async function updatePlaylistInMongo(city) {
  return new Promise(((resolve, reject) => {
    PlaylistsSchema.findOneAndUpdate({ name: city.name }, city, { upsert: true }, (error, data) => {
      if (error) {
        console.log('An error occurred updating a playlist to the database', error);
        reject(error);
      }
      resolve(data);
    });
  }));
}

async function getAllPlaylistsFromMongo() {
  return new Promise(((resolve, reject) => {
    PlaylistsSchema.find({}, (error, data) => {
      if (error) {
        console.log('An error occurred finding all playlists from the database', error);
        reject(error);
      }
      resolve(data);
    })
  }))
}

// Save an artist to database
async function saveArtistInMongo(artist) {
  return new Promise(((resolve, reject) => {
    const artistDocument = new ArtistsSchema(artist);
    artistDocument.save((error) => {
      if (error) {
        console.log('An error occurred saving an artist to the database', error);
        reject(error);
      }
      resolve();
    });
  }));
}

// Get an access token for spotifyApi
spot.authenticate = async function authenticate() {
  return spotifyApi.refreshAccessToken().then(
    (data) => {
      spotifyApi.setAccessToken(data.body['access_token']);
    },
    (error) => {
      console.log('Something went wrong when retrieving an access token', error);
    },
  );
};

function findExistingSpotifyPlaylistId(listOfVenues, venueName, cityName) {
  for (const existingVenue of listOfVenues) {
    if (existingVenue.name === venueName + ", " + cityName) {
      return existingVenue.id;
    }
  }
  return null;
}

// Iterate over the cities
spot.transformCities = async function transformCities(cities) {
  await spot.authenticate();
  const currentUser = await spot.getCurrentUser(spotifyApi);
  const currentPlaylists = await spot.getAllCurrentUserPlaylists(spotifyApi, currentUser);
  return Promise.all(cities.map(async (city) => {
    const cityVenues = await spot.transformCity(city, currentPlaylists, currentUser);
    const transformedCity = {
      name: city.name,
      venues: cityVenues,
      date: new Date(),
    };
    await updatePlaylistInMongo(transformedCity);
    return transformedCity;
  }));
};

// Iterate over all of the venues in a city
spot.transformCity = async function transformCity(city, currentPlaylists, currentUser) {
  return new Promise((async (resolve, reject) => {
    let venues = Object.keys(city.venues);

    /* eslint-disable no-await-in-loop */
    // loop through all all venues
    // find spotify playlist id if it exists
    // lookup all artists in the venue
    for (const index of venues.keys()) {
      const currentVenueName = venues[index];
      const spotifyPlaylistId = findExistingSpotifyPlaylistId(currentPlaylists, currentVenueName, city.name);
      const newVenueArtists = await spot.transformVenues(city.venues[currentVenueName]);
      console.log('finished', venues[index], 'with', newVenueArtists.length, 'artists');
      await delay(defaultDelay);

      let transformedVenue = {
        name: venues[index],
        artists: newVenueArtists,
      };

      if (spotifyPlaylistId === null) {
        transformedVenue = await spot.createUserPlaylist(spotifyApi, currentUser, transformedVenue, city.name)
      } else {
        transformedVenue.spotifyPlaylistId = spotifyPlaylistId;
      }

      await spot.replaceAllTracksInPlaylist(spotifyApi, currentUser, transformedVenue);
      venues[index] = transformedVenue;
    }
    
    // filter venues that did not have more than 5 artists
    venues = venues.filter(venue => {
      return typeof venue === 'object';
    });
    /* eslint-enable no-await-in-loop */
    resolve(venues);
  }));
};

// Iterate over all of the artists in a Venue
spot.transformVenues = async function transformVenues(venue) {
  return new Promise((async (resolve, reject) => {
    const artists = Array.from(new Set(venue));
    // Iterate over artist names, first searching for the artist by name in DB
    /* eslint-disable no-await-in-loop */
    for (const index of artists.keys()) {
      const artistInDb = await lookupArtistInMongo(artists[index]);
      if (artistInDb != null) {
        artists[index] = artistInDb;
      } else { // If not found, use spotify api to try to find artist by name, and save.
        const newArtist = await spot.searchArtist(artists[index]);
        if (newArtist != null) {
          const newTrack = await spot.searchTopTrack(newArtist.spotifyArtistId);
          newArtist.tracks = newTrack;
          if (newTrack != null) {
            await saveArtistInMongo(newArtist);
          }
          await delay(defaultDelay);
        }
        artists[index] = newArtist;
      }
    }
    /* eslint-enable no-await-in-loop */

    // filter any null values
    const filtered = artists.filter(artist => artist != null && artist.tracks != null);
    // make sure if an artist is playing a venue more than once, that unique tracks are selected
    for (const index of filtered.keys()) {
      let count = 0;
      const name = filtered[index].name;
      for (let i = 0; i < index; i+=1) {
        if (filtered[i].name === name) {
          count += 1;
        }
      }
      if (count >= filtered[index].tracks.length) {
        filtered[index].track = filtered[index].tracks[count % filtered[index].tracks.length];
      } else {
        filtered[index].track = filtered[index].tracks[count];
      }
    }
    resolve(filtered);
  }));
};

// Make a request for artist's Top Track using artistId
spot.searchTopTrack = async function searchTopTrack(artistId) {
  return new Promise(((resolve, reject) => {
    let topTracks = null;
    spotifyApi.getArtistTopTracks(artistId, 'US') // Make the request using spotifyApi
      .then((response) => {
        const data = response.body;
        if (data.tracks.length > 0) {
          topTracks = [];
          for (const index of data.tracks.keys()) {
            const track = data.tracks[index];
            topTracks[index] = {
              trackId: track.id,
              trackUri: track.uri,
              images: track.album.images,
            };
          }
        }
        resolve(topTracks);
      })
      .catch((error) => {
        console.log('An error occurred using the spotify api to search for a track for artist', artistId, error);
        reject(topTracks);
      });
  }))
    .catch((error) => { console.log(error); });
};

// Make request to search for an artist based on name
spot.searchArtist = async function searchArtist(artistName) {
  return new Promise(((resolve, reject) => {
    let newArtist = null;
    spotifyApi.searchArtists(artistName) // Make the artist search request with spotifyApi
      .then((response) => {
        const data = response.body.artists;
        if (data.total > 0) {
          newArtist = {
            name: artistName,
            spotifyArtistId: data.items[0].id,
            track: {},
            images: data.items[0].images,
            popularity: data.items[0].popularity,
            genres: data.items[0].genres,
            followers: data.items[0].followers.total,
          };
        }
        resolve(newArtist);
      })
      .catch((error) => {
        console.log('An error occurred using the spotify api to search for artist', artistName, error);
        reject(newArtist);
      });
  }))
    .catch((error) => { console.log(error); });
};

// Get the current user id.
spot.getCurrentUser = async function(spotifyApi) {
  return new Promise(function(resolve, reject) {
    spotifyApi.getMe()
      .then(function(data) {
        resolve(data.body.id);
      }, function(error) {
        console.log(error);
        reject(Error('An error occurred getting the current user.'));
      });
  })
    .catch((error) => { console.log(error); });
};

// Get the current user's playlists.
spot.getAllCurrentUserPlaylists = async function(spotifyApi, userId) {
  let offset = 0;
  let stop = false;
  let playlists = [];
  while (!stop) {
    const retrieved = await new Promise(function(resolve, reject) {
    spotifyApi.getUserPlaylists(userId, {offset: offset, limit: 50})
      .then(function(data) {
        resolve(data.body.items);
      }, function(error) {
        console.log(error);
        resolve(Error('An error occurred getting the current user\'s playlists.'));
      });
    });

    playlists = playlists.concat(retrieved);
    offset += 50;
    if (retrieved.length == 0) {
      stop = true;
    }
  }

  console.log('found:', playlists.length, 'associated with', userId);
  return playlists;
};

// Create a playlist on the current user's account
spot.createUserPlaylist = async function(spotifyApi, userId, playlist, location) {
  return new Promise(function(resolve, reject) {
    let playlistName = playlist.name + ", " + location;
    
    spotifyApi.createPlaylist(userId, playlistName, {'public': true})
      .then(function(data) {
        playlist.spotifyPlaylistId = data.body.id;
        resolve(playlist);
      }, function(error) {
        resolve(Error('An error occurred creating a user playlist.'));
      });
  });
};

// Replace all tracks in a playlist with ones supplied in playlist array.
spot.replaceAllTracksInPlaylist = async function(spotifyApi, userId, playlist) {
  return new Promise(function(resolve, reject) {
    let tracks = playlist.artists.map(function(artist) {
      return artist.track.trackUri;
    });
    if (tracks.length > 100) {
      tracks = tracks.slice(0, 100);
    }
    if (playlist.spotifyPlaylistId) {
      spotifyApi.replaceTracksInPlaylist(playlist.spotifyPlaylistId, tracks)
        .then(function(data) {
          resolve('Successfully replaced tracks in playlist.');
        }, function(error) {
          console.log(error);
          resolve(Error('An error occured replacing tracks in an existing user playlist.'));
        });
    }
  });
};

module.exports = spot;
