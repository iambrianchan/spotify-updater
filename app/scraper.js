"use strict";

var request = require("request");
var cheerio = require("cheerio");
var Q = require("q");

var atxScraper = function () {
	function getHTML(callback) {
		var options = {
			url: "http://showlistaustin.com"
		};
		request(options, function scrape(error, response, body) {
			if (!error && response.statusCode == 200) {
				callback(body);
			}
		});		
	}

	function parseHTMLForArtists(html) {
		var $ = cheerio.load(html);
		var dates = $("h4 b");
		var events = $("td.h4");

		// get a list of all dates listed in showlist
		function createMapFromDates() {
			var map = [];

			for (let i = 0; i < dates.length; i++) {
				let date = {};
				date.date = dates.eq(i).text();
				date.shows = {};
				map.push(date);
			}
			return map;
		}

		// populate dates obtained with events/shows
		function populateDatesWithEvents(tables, map) {
			// loop through each table (date)
			for (let i = 0; i < tables.length; i++) {

				// pick out hr (event start/stop markers), a tags and text
				let contents = tables.eq(i).contents().filter(function() {
					return (this.name === 'hr' || (this.name === 'a' && (this.attribs.title != 'list by venue' && this.attribs.title != 'map')) || (this.type === 'text' && this.data.length > 3 && this.data.charAt(this.data.length - 1) != '['));
				});

				// go through all picked out items for a particular date
				for (let j = 0; j < contents.length; j++) {

					// if hr, it is the start of an event. Set venue to TBD by default.
					if (contents.get(j).tagName === 'hr') {
						var venue, listing;

						venue = "TBD";

						// go through all proceeding items. hr tag will mark the end, a tag will mark venue name, text will be artists
						for (let k = j + 1; k < contents.length; k++) {
							if (contents.get(k).tagName === 'hr') {
								if (map[i].shows[venue] == undefined) {
									map[i].shows[venue] = {};
								};
								listing.forEach(function addListingToVenue(artist) {
									map[i].shows[venue][artist] = true;
								})
								break;
							}

							else if (contents.get(k).tagName === 'a') {
								venue = contents.eq(k).text();
							}

							else {
								listing = contents.eq(k).text();
								listing = parseShowListing(listing);
							}
						}
					}
				}
			}
			return map;

			// clean up the listing, and return an array of artists/bands
			function parseShowListing(listing) {
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

		var map = createMapFromDates(dates);
		map = populateDatesWithEvents(events, map);

		return map;
	}

	function runProgram(callback) {
		getHTML(function parse(html) {
			var map = parseHTMLForArtists(html);
			callback(map);
		});
	}

	return {
		run: runProgram
	};
}();

var sfScraper = function() {
	function getAllHtml() {
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

	function parseHtml(html) {
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

	function runProgram(callback) {
		Q.all(
			getAllHtml()
			.then(function(result) {
				var data = {};
				for (let i = 0; i < result.length; i++) {
					var page = parseHtml(result[i]);
					var venues = Object.keys(page);
					for (let i = 0; i < venues.length; i++) {
						data[venues[i]] = page[venues[i]];
					}
				}
				callback(data);
			})
		)
	}
	return {
		run: runProgram
	};
}();

exports.atxScraper = atxScraper;
exports.sfScraper = sfScraper;