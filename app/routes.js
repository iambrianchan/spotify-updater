"use strict";
var Q = require('q');
var CronJob = require('cron').CronJob;

// import scraper, spotify api
var scraper = require('./scraper');
var spot = require("./spotify");

// use the imported scraper from ./scraper.
var scrape = function() {

	// utility function for removing venues with few listed artists.
	function filterPlaylist(playlist) {
		var venues = Object.keys(playlist);
		for (let i = venues.length - 1; i >= 0; i--) {
			let artists = Object.keys(playlist[venues[i]].artists).length;
        	if (artists < 10) {
        		delete playlist[venues[i]];
        	}
        };
        return playlist;
	};

	function getScrapedArtists (location, access_token) {
		var deferred = Q.defer();
		if (location == "ATX") {
		    scraper.atxScraper.run(function onComplete(result) {
		        var playlist = {};
		        for (let i = 0; i < result.length; i++) {
		            let date = result[i];
		            let venues = Object.keys(result[i].shows);
		            for (let j = 0; j < venues.length; j++) {
		                let venue = venues[j];

		                if (playlist[venue] === undefined) {
		                    playlist[venue] = {artists: date.shows[venue]};
		                }
		                else {
		                    var artists = Object.keys(date.shows[venue]);
		                    // check to see if an artist is already listed in this venue
		                    for (let k = 0; k < artists.length; k++) {
		                        let artist = artists[k];
		                        if (playlist[venue].artists[artist] == undefined) {
		                            playlist[venue].artists[artist] = {};
		                        };
		                    };
		                }
		            }
		        }
		        playlist = filterPlaylist(playlist);
		        deferred.resolve(playlist);
		    });
		}

		else if (location == "SFO") {
		  	scraper.sfScraper.run(function onComplete(result) {
		  		var playlist = {};
		  		var venues = Object.keys(result);

		  		for (let i = 0; i < venues.length; i++) {
		  			let venue = venues[i];
		  			playlist[venue] = {artists:{}};

		  			for (let j = 0; j < result[venue].length; j++) {
		  				let artist = result[venue][j];
		  				playlist[venue].artists[artist] = {};
		  			}
		  		};
		        playlist = filterPlaylist(playlist);
		        deferred.resolve(playlist);
	    	});
		}
		return deferred.promise;
	};
	function main() {
		return Q.fcall(function() {
			return getScrapedArtists(location, access_token);
		})
		.then(function(result) {
			playlist = result;
			return;
		})
	};

	function automateATXScrape () {
		return Q.fcall(function() {
			return getScrapedArtists('ATX')
			.then(function(result) {
				return {name: 'ATX', venues: result};
			})
		});
	};
	function automateSFOScrape() {
		return Q.fcall(function() {
			return getScrapedArtists('SFO')
			.then(function(result) {
				return {name: 'SFO', venues: result}
			})
		});
	};

	function automateBothScrapes() {
		var arry = [];
		return Q.fcall(function() {
			return automateATXScrape()
			.then(function(result) {
				arry.push(result);
				return automateSFOScrape()
				.then(function(result) {
					arry.push(result);
					return arry;
				});
			});
		});
	};

	return {
		getScrape : main,
		automateScrapes : automateBothScrapes
	};
}();

new CronJob('00 00 00 * * *', 
	function() {
		var start = new Date().getTime();
		console.log("Updating the database...");

		scrape.automateScrapes()
		.then((cities) => {
			return spot.transformCities(cities);
		})
		.then((result) => {
			var end = new Date().getTime();
			console.log("Update finished. Time elapsed:", (end - start) / 1000);
		});
	},
	null, 
	true, 
	'Europe/London'
);


module.exports = function(app) {
    app.get('*', function(req, res) {
    	console.log("The server is meant to run a cron job");
    });
};