
const cron = require('cron');

// import scraper, spotify api
const scraper = require('./scraper');
const spot = require('./spotify');

// handle a city
async function getScrapedArtists(location) {
  return new Promise((async (resolve, reject) => {
    try {
      if (location === 'ATX') {
        const austin = await scraper.scraper.main('ATX');
        resolve(austin);
      } else if (location === 'SFO') {
        const sanfrancisco = await scraper.scraper.main('SFO');
        resolve(sanfrancisco);
      } else if (['NYC', 'LAX', 'CHI'].includes(location)) {
        const ohmyrockness = await scraper.scraper.main(location);
        resolve(ohmyrockness);
      }
    } catch (error) {
      reject(Error('An error occurred'));
    }
  }));
}

// return all city data scrapped
async function automateScrapes() {
  const cities = ['ATX', 'SFO', 'NYC', 'LAX', 'CHI'];
  return Promise.all(cities.map(async city => getScrapedArtists(city)));
}

// Scrape and update database
async function updateArtistsAndPlaylists() {
  const start = new Date();
  console.log('Updating the database...');

  automateScrapes()
    .then(cities => spot.transformCities(cities))
    .then(() => {
      const end = new Date();
      console.log(end);
      console.log('Update finished. Time elapsed:', ((end.getTime() - start.getTime()) / 1000), 'seconds.');
    });
}

// Run once a day
new cron.CronJob('00 00 00 * * *',
  (() => {
    updateArtistsAndPlaylists();
  }),
  null,
  true,
  'Europe/London');

// run the update adhoc
updateArtistsAndPlaylists();

module.exports = function (app) {
  app.get('*', (req, res) => {
    console.log('The server is meant to run a cron job');
  });
};
