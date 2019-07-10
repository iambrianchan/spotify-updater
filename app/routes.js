"use strict";
var CronJob = require('cron').CronJob;

// import scraper, spotify api
var scraper = require('./scraper');
var spot = require("./spotify");

// use the imported scraper from ./scraper.
var scrape = function() {

	async function getScrapedArtists (location, access_token) {

		return new Promise(async function(resolve, reject) {
			if (location == 'ATX') {
				let austin = await scraper.scraper.main('ATX');
				resolve(austin);
			}
			else if (location == 'SFO') {
				let sanfrancisco = await scraper.scraper.main('SFO');
				resolve(sanfrancisco);
			}
			else if (location == 'NYC') {
				let newyorkcity = await scraper.scraper.main('NYC');
				resolve(newyorkcity);
			}
		});
	};

	async function automateScrapes() {
		let cities = ['ATX', 'SFO', 'NYC'];
		return Promise.all(cities.map(async (city) => {
			return getScrapedArtists(city);
		}));
	};

	return {
		automateScrapes : automateScrapes
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

// Run the scraper adhoc
// async function myAsync() {
// 	let start = new Date().getTime();
// 	console.log("Updating the database...");

// 	scrape.automateScrapes()
// 	.then((cities) => {
// 		return spot.transformCities(cities);
// 	})
// 	.then((result) => {
// 		var end = new Date().getTime();
// 		console.log("Update finished. Time elapsed:", (end - start) / 1000);
// 	});
// }

myAsync();

module.exports = function(app) {
    app.get('*', function(req, res) {
    	console.log("The server is meant to run a cron job");
    });
};