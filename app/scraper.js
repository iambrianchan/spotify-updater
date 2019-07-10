"use strict";

var request = require("request");
var cheerio = require("cheerio");
var Q = require("q");
const http = require('https');

var scraper = {};
scraper.main = async function(cityName) {
	if (cityName == 'ATX') {
		return await scraper.runAtxScrape();
	}
	else if (cityName == 'SFO') {
		return await scraper.runSfScrape();
	}
	else if (cityName == 'NYC') {
		let html = await getNycHtml();
		let data = parseNycJson(html);
		return data;
	}
}

// parse the json
function parseNycJson(data) {
	let city = {
		name: 'New York City',
		venues: {},

	};

	data = JSON.parse(data);

	data.forEach((item) => {
		parseNycConcert(city, item);
	});

	return city;
};

function parseNycConcert(city, concert) {
	let venueName = concert.venue.name;
	let date = concert.starts_at;
	let artists = concert.cached_bands.map((band) => {
		return band.name;
	});

	// if the venue does not exist create the key in the city.venues object
	if (!(venueName in city.venues)) {
		city.venues[venueName] = [];	
	}
	// map all artist names into venue;
	artists.forEach((artist) => {
		city.venues[venueName].push(artist);
	});
	return city;
}

async function getNycHtml () {
	let header = {
			authorization: 'Token token="3b35f8a73dabd5f14b1cac167a14c1f6"'
		};
	const options = {
		hostname: 'www.ohmyrockness.com',
		path: '/api/shows.json?index=true&regioned=1',
		port: 443,
		method: 'GET',
		headers: header
	};

	return new Promise(function(resolve, reject) {
		let request = http.request(options, (response) => {
			let data = '';

			response.on('data', (chunk) => {
				data += chunk;
			});

			response.on('end', async () => {
				resolve(data);
			});
		});

		request.on('error', (error) => {
			console.log(error);
			resolve(error)
		});

		request.end();
	});
}






// scraper.getHTML = async function () {
	// const options = {
	// 	hostname: "showlistaustin.com",
	// 	path: "/",
	// 	port: 80,
	// 	method: 'GET'
	// };

// 	const req = http.request(options, (response) => {
// 		let data = '';

// 		response.on('data', (chunk) => {
// 			data += chunk;
// 		});

// 		response.on('end', () => {
// 			console.log(data);
// 		});
// 	});

// 	req.on('error', (error) => {
// 		// console.error(error);
// 	})

// 	req.end();
// }


// // bay area
// scraper.getHTML = async function () {

// 	let pages = [0, 1, 2, 3];

// 	return await Promise.all(pages.map(page => {
// 		let options = {
// 			hostname: 'www.foopee.com',
// 			path: '/punk/the-list/by-club.' + page + '.html',
// 			method: "GET"
// 		};
// 		const req = http.request(options, (response) => {
// 			let data = '';

// 			response.on('data', (chunk) => {
// 				data += chunk;
// 			});

// 			response.on('end', () => {
// 				console.log(data);
// 				return data;
// 			});
// 		});

// 		req.on('error', (error) => {
// 			console.error(error);
// 		});

// 		req.end();

// 	})

// 	);


// }

// Austin scrape
function getAtxHTML(callback) {
	var options = {
		url: "http://showlistaustin.com"
	};
	request(options, function scrape(error, response, body) {
		if (!error && response.statusCode == 200) {
			callback(body);
		}
	});		
}

function parseAtxHtml(html) {
	var $ = cheerio.load(html);
	var dates = $("h4 b");
	var events = $("td.h4");
	let city = {
		name: 'Austin',
		venues: {}
	};
	events.each(function(index, date) {
		parseAtxHTMLForArtists(city, date);
	});
	return city;

	function parseAtxHTMLForArtists(city, events) {
		// pick out hr (event start/stop markers), a tags and text
		let contents = $(events).contents().filter(function() {
			return (this.name === 'hr' || (this.name === 'a' && (this.attribs.title != 'list by venue' && this.attribs.title != 'map')) || (this.type === 'text' && this.data.length > 3 && this.data.charAt(this.data.length - 1) != '['));
		});

		for (let i = 0; i < contents.length; i++) {
			if (contents.get(i).tagName === 'hr') {
				let venueName, listing;
				let artists = [];

				// go through all proceeding items. hr tag will mark the end, a tag will mark venue name, text will be artists
				for (let k = i + 1; k < contents.length; k++) {
					// this block means we have got to the end of a single concert. artists in listing will be added to venue.
					if (contents.get(k).tagName === 'hr') {
						if (city.venues[venueName] == undefined) {
							city.venues[venueName] = [];
							city.venues[venueName] = artists;
						}
						else {
							if (listing) {
								listing.forEach(function(artistName) {
									city.venues[venueName].push(artistName);
								});
							}
						}

						artists = [];
						break;
					}
					// extract venue name
					else if (contents.get(k).tagName === 'a') {
						venueName = contents.eq(k).text();
					}
					// clean up the the listing to be an array of artist names
					else {
						listing = contents.eq(k).text();
						listing = cleanUpListing(listing);
					}
				}
			}
		}
	}

	// 	// clean up the listing, and return an array of artists/bands
	function cleanUpListing(listing) {
		listing = listing.trim();
		var lastThree = listing.slice(-3);
		var lastSeven = listing.slice(-7);

		if (lastThree === ' at') {
			listing = listing.slice(0, -3);
		}
		else if (lastSeven === ' at the'){
			listing = listing.slice(0, -7);
		}

		// remove anything inside parentheses, to remove settimes, band origin etc.
		listing = listing.split(/\(.*?\)/).join('').split(' , ').join(', ').split(/\, | \/ /);;

		// return an array of artists
		if (listing[0].substr(0, 7).indexOf("with") != -1) {
			listing[0] = listing[0].substr(5);
		}
		for (let i = 0; i < listing.length; i++) {
			listing[i] = listing[i].replace("&", "and");
			listing[i] = listing[i].toLowerCase();
			if (listing[i] == '') {
				listing.splice(i, 1);
				i--;
			}
		}
		return listing
	}
}

scraper.runAtxScrape = async function () {
	return new Promise(function(resolve, reject) {
		getAtxHTML(function parse(html) {
			let city = parseAtxHtml(html);
			resolve(city);
		});
	})
}


// San francisco scrape
function getAllSfHtml() {
	var pages = [0, 1, 2, 3];
	
	return Q.all(pages.map(function(pageNum) {
		return Q.fcall(function() {
			return getHtml(pageNum);
		})
	}));

	function getHtml(pageNumber) {
		var deferred = Q.defer();
		var options = {
			method: "GET",
			url: "http://www.foopee.com/punk/the-list/by-club." + pageNumber + ".html"
		}

		request(options, function callback(error, response, body) {
			if (!error && response.statusCode == 200) {
				deferred.resolve(body);
			}
			else {
				console.log(error);
			}
		});

		return deferred.promise;
	}
}

function parseSfHtml(html) {
	var $ = cheerio.load(html);

	var ul = $("body").children("ul");

	var li = ul.children();
	var data = {};
	for (let i = 0; i < li.length; i++) {
		var venue = li.eq(i).children().first().text();
		data[venue] = [];
		var shows = li.eq(i).children("ul").children("li");
		for (let j = 0; j < shows.length; j++) {
			var date = shows.eq(j).children("b").text();
			var artists = shows.eq(j).children("a");
			for (let k = 0; k < artists.length; k++) {
				var artist = artists.eq(k).text();
				artist = artist.split(/\W\(.+/).join('');
				if (artist.indexOf(")") == -1) {
					artist = artist.replace("&", "and").toLowerCase();
					if (artist != "") {
						data[venue].push(artist);
					}
				}
			}
		}
	}
	return data;
}

scraper.runSfScrape = function () {
	let city = {
		name: 'San Francisco',
		venues: []
	};

	return new Promise(function(resolve, reject) {
		getAllSfHtml()
		.then(function(result) {
			var data = {};
			for (let i = 0; i < result.length; i++) {
				var page = parseSfHtml(result[i]);
				var venues = Object.keys(page);
				for (let i = 0; i < venues.length; i++) {
					data[venues[i]] = page[venues[i]];
				}
			}
			city.venues = data;
			resolve(city);
		})
	});
}


exports.scraper = scraper;