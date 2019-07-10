# spotify-updater
This application updates a mongo database with current artists and venues.

Currently the application scrapes for concert shows in Austin, San Francisco, and New York City.

Application is run by `node index.js`

The following environment variables are necessary for running:
SPOTIFY_DB // url to the mongo database
SPOTIFY_CLIENT_ID // spotify api client id
SPOTIFY_CLIENT_SECRET // spotify api client secret
SPOTIFY_REDIRECT_URI // spotify api redirect uri