
const SpotifyWebApi = require('spotify-web-api-node');
const ArtistsSchema = require('./models/artist').Artist;
const PlaylistsSchema = require('./models/playlist');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

const defaultDelay = 500;
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
  return spotifyApi.clientCredentialsGrant().then(
    (data) => {
      spotifyApi.setAccessToken(data.body.access_token);
    },
    (error) => {
      console.log('Something went wrong when retrieving an access token', error);
    },
  );
};

// Iterate over the cities
spot.transformCities = async function transformCities(cities) {
  await spot.authenticate();
  return Promise.all(cities.map(async (city) => {
    const cityVenues = await spot.transformCity(city);
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
spot.transformCity = async function transformCity(city) {
  return new Promise((async (resolve, reject) => {
    const venues = Object.keys(city.venues);
    /* eslint-disable no-await-in-loop */
    for (const index of venues.keys()) {
      const newVenueArtists = await spot.transformVenues(city.venues[venues[index]]);
      console.log('finished', venues[index]);
      await delay(defaultDelay);
      await spot.authenticate();
      const transformedVenue = {
        name: venues[index],
        artists: newVenueArtists,
      };
      venues[index] = transformedVenue;
    }
    /* eslint-enable no-await-in-loop */
    resolve(venues);
  }));
};

// Iterate over all of the artists in a Venue
spot.transformVenues = async function transformVenues(venue) {
  return new Promise((async (resolve, reject) => {
    const artists = venue;
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
          newArtist.track = newTrack;
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
    const filtered = artists.filter(artist => artist != null && artist.track != null);
    resolve(filtered);
  }));
};

// Make a request for artist's Top Track using artistId
spot.searchTopTrack = async function searchTopTrack(artistId) {
  return new Promise(((resolve, reject) => {
    let topTrack = null;
    spotifyApi.getArtistTopTracks(artistId, 'US') // Make the request using spotifyApi
      .then((response) => {
        const data = response.body;
        if (data.tracks.length > 0) {
          const track = data.tracks[0];
          topTrack = {
            trackId: track.id,
            trackUri: track.uri,
            images: track.album.images,
          };
        }
        resolve(topTrack);
      })
      .catch((error) => {
        console.log('An error occurred using the spotify api to search for a track for artist', artistId, error);
        reject(topTrack);
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

module.exports = spot;
