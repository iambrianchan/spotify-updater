

const cheerio = require('cheerio');
const https = require('https');
const http = require('http');

const scraper = {};

// parse each NYC concert object
function parseOhMyRocknessConcert(city, concert) {
  const newCity = city;
  const venueName = concert.venue.name;
  const artists = concert.cached_bands.map(band => band.name);

  // if the venue does not exist create the key in the city.venues object
  if (!(venueName in newCity.venues)) {
    newCity.venues[venueName] = [];
  }
  // map all artist names into venue;
  artists.forEach((artist) => {
    newCity.venues[venueName].push(artist);
  });
  return newCity;
}

// parse the NYC json, then call forEach to parse each concert object
function parseOhMyRocknessJson(cityName, data) {
  let name;
  switch(cityName) {
    case 'CHI':
      name = 'Chicago';
      break;

    case 'LAX':
      name = 'Los Angeles';
      break;

    case 'NYC':
      name = 'New York City';
      region = 1;
      break;
  }
  const city = {
    name: name,
    venues: {},
  };

  const jsonData = JSON.parse(data);

  jsonData.forEach((item) => {
    parseOhMyRocknessConcert(city, item);
  });

  return city;
}

// get the NYC html
async function getOhMyRocknessJson(cityName) {
  let hostname, region;
  switch(cityName) {
    case 'CHI':
      hostname = 'chicago.ohmyrockness.com';
      region = 2;
      break;

    case 'LAX':
      hostname = 'losangeles.ohmyrockness.com';
      region = 3;
      break;

    case 'NYC':
      hostname = 'www.ohmyrockness.com';
      region = 1;
      break;
  }

  const header = {
    authorization: 'Token token="3b35f8a73dabd5f14b1cac167a14c1f6"',
  };
  const options = {
    hostname: hostname,
    path: '/api/shows.json?index=true&regioned=' + region,
    port: 443,
    method: 'GET',
    headers: header,
  };

  return new Promise(((resolve, reject) => {
    const request = https.request(options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', async () => {
        resolve(data);
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  }))
    .catch((error) => { console.log(error); });
}

// Get the Html from Showlist Austin
async function getAtxHTML() {
  const options = {
    hostname: 'www.showlistaustin.com',
    path: '/',
    port: 80,
    method: 'GET',
  };

  return new Promise(((resolve, reject) => {
    const request = http.request(options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', async () => {
        resolve(data);
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  }))
    .catch((error) => { console.log(error); });
}

 // clean up the listing (event), and return an array of artists/bands
function cleanAtxListing(listing) {
  let cleanListing = listing.trim();
  const lastThree = cleanListing.slice(-3);
  const lastSeven = cleanListing.slice(-7);

  if (lastThree === ' at') {
    cleanListing = cleanListing.slice(0, -3);
  } else if (lastSeven === ' at the') {
    cleanListing = cleanListing.slice(0, -7);
  }

  // remove anything inside parentheses, to remove settimes, band origin etc.
  cleanListing = cleanListing.split(/\(.*?\)/).join('').split(' , ').join(', ')
    .split(/\, | \/ /);

  // return an array of artists
  if (cleanListing[0].substr(0, 7).indexOf('with') !== -1) {
    cleanListing[0] = cleanListing[0].substr(5);
  }
  for (let i = 0; i < cleanListing.length; i += 1) {
    cleanListing[i] = cleanListing[i].replace('&', 'and');
    cleanListing[i] = cleanListing[i].toLowerCase();
    if (cleanListing[i] === '') {
      cleanListing.splice(i, 1);
      i -= 1;
    }
  }
  return cleanListing;
}

// parse out each event from a date with list of events
function parseAtxDateForShows(html, city, events) {
  const $ = html;
  // pick out hr (event start/stop markers), a tags and text
  const contents = $(events).contents().filter(function pickOutContents() {
    return (this.name === 'hr' || (this.name === 'a' && (this.attribs.title !== 'list by venue' && this.attribs.title !== 'map')) || (this.type === 'text' && this.data.length > 3 && this.data.charAt(this.data.length - 1) !== '['));
  });

  for (let i = 0; i < contents.length; i += 1) {
    if (contents.get(i).tagName === 'hr') {
      let venueName; let
        listing;
      let artists = [];

      // go through all proceeding items. hr tag will mark the end, a tag will mark venue name, text will be artists
      for (let k = i + 1; k < contents.length; k += 1) {
        // this block means we have got to the end of a single concert. artists in listing will be added to venue.
        if (contents.get(k).tagName === 'hr') {
          if (city.venues[venueName] === undefined) {
            city.venues[venueName] = [];
            city.venues[venueName] = artists;
          } else if (listing) {
            for (const artistName of listing) {
              city.venues[venueName].push(artistName);
            }
          }

          artists = [];
          break;
        } else if (contents.get(k).tagName === 'a') { // extract venue name
          venueName = contents.eq(k).text();
        } else { // clean up the the listing to be an array of artist names
          listing = contents.eq(k).text();
          listing = cleanAtxListing(listing);
        }
      }
    }
  }
}

// parse the Austin html
function parseAtxHtml(html) {

  const $ = cheerio.load(html);
  const events = $('td.h4');
  const city = {
    name: 'Austin',
    venues: {},
  };

  // Get a list of days with events and then parse each day
  events.each((index, date) => {
    parseAtxDateForShows($, city, date);
  });
  return city;
}

// run the scrape for Austin
scraper.runAtxScrape = async function runAtxScrape() {
  return new Promise((async (resolve, reject) => {
    const atxHtml = await getAtxHTML();
    const city = parseAtxHtml(atxHtml);
    resolve(city);
  }));
};

// get the html for each page for San Francisco
async function getSfHtml(pageNumber) {
  const options = {
    hostname: 'www.foopee.com',
    path: `/punk/the-list/by-club.${pageNumber}.html`,
    port: 80,
    method: 'GET',
  };

  return new Promise(((resolve, reject) => {
    const request = http.request(options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        resolve(data);
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  }))
    .catch((error) => { console.log(error); });
}

// Get all pages of San Francisco shows
async function getAllSfHtml() {
  const pages = [0, 1, 2, 3];

  return Promise.all(pages.map(pageNumber => getSfHtml(pageNumber)));
}

// create object with keys of venue name, and values an array of artist names
function parseSfHtml(html) {
  const $ = cheerio.load(html);
  const data = {};

  const ul = $('body').children('ul');
  const li = ul.children();

  for (let i = 0; i < li.length; i += 1) {
    const venue = li.eq(i).children().first().text();
    data[venue] = [];
    const shows = li.eq(i).children('ul').children('li');
    for (let j = 0; j < shows.length; j += 1) {
      const artists = shows.eq(j).children('a');
      for (let k = 0; k < artists.length; k += 1) {
        let artist = artists.eq(k).text();
        artist = artist.split(/\W\(.+/).join('');
        if (artist.indexOf(')') === -1) {
          artist = artist.replace('&', 'and').toLowerCase();
          if (artist !== '') {
            data[venue].push(artist);
          }
        }
      }
    }
  }
  return data;
}

// Run the scrape for San Francisco
scraper.runSfScrape = function runSfScrape() {
  const city = {
    name: 'San Francisco',
    venues: {},
  };

  return new Promise((async (resolve, reject) => {
    const result = await getAllSfHtml();
    const data = {};
    for (const page of result) {
      const parsedPage = parseSfHtml(page);
      const venues = Object.keys(parsedPage);
      for (const venue of venues) {
        const cleanVenue = venue.split(',')[0];
        if (!(cleanVenue in data)) {
          data[cleanVenue] = parsedPage[venue];
          continue;
        }
        let current = data[cleanVenue];
        current = current.concat(parsedPage[venue]);
        data[cleanVenue] = current;
      }
    }
    city.venues = data;
    resolve(city);
  }));
};

// Main function handles all cities
scraper.main = async function scrapeCity(cityName) {
  if (cityName === 'ATX') {
    return scraper.runAtxScrape();
  }
  if (cityName === 'SFO') {
    return scraper.runSfScrape();
  }
  const json = await getOhMyRocknessJson(cityName);
  const data = parseOhMyRocknessJson(cityName, json);
  return data;
};

exports.scraper = scraper;
