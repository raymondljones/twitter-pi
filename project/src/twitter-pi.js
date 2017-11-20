// import the dependencies
var fs = require ('fs');
var util = require ('util');
var Twitter = require ('twitter');
var gpio = require("gpio");

// setup a few variables that the application needs
// the max size of the log in MB
var logSize = 10;
// the current directory the application runs on
var dir = __dirname;
// declare a few global variables
var launchTime, twitterConfig, client, interval;

// read the last modified time of the main js file
var stats = fs.statSync (dir + '/twitter-pi.js');
launchTime = new Date (util.inspect (stats.mtime));

// read the pin info from the json file
var pins = require (dir + '/data/pins.json');

// turn a pin on
var pinOn = function (p) {
	
	console.log ('On: ' + p.gpio);
	
	// set the direction of the pin to "out" ... this will send power thru the pin
	p.controller.setDirection ('out');
	
	// find the pin in the global pins object and set the date to now (for use later in the interval)
	for (var i = 0; i < pins.length; i++) {
	
		if (pins [i].pin == p.pin) {
			
			pins [i].when = new Date ();
		}
	}
};

// turn a pin off
var pinOff = function (p) {
	
	console.log ('Off:  ' + p.gpio);
	
	// set the direction of the pin to "in" ... this will stop power from going out
	p.controller.setDirection ('in');
	
	// find the pin in the global pins object and set the date to 0 (so the interval ignores it)
	for (var i = 0; i < pins.length; i++) {
	
		if (pins [i].pin == p.pin) {
			
			pins [i].when = 0;
		}
	}
};

// turn all pins on, loop thru pins and send each one to the pinOn() function
var pinsOn = function () {
	
	console.log ('All On');
	for (var i = 0; i < pins.length; i++) {
	
		pinOn (pins [i]);
	}
};

// turn all pins off, loop thru pins and send each one to the pinOff() function
var pinsOff = function () {
	
	console.log ('All Off');
	for (var i = 0; i < pins.length; i++) {
		
		pinOff (pins [i]);
	}
};

// this function checks the size of the log and re-checks the modification date of the main js file.  If the modification date changes, the script will die (and allow a new instance to be spun up).  If the log size exceeds logSize, then it truncates the log file
var check = function () {
	
	var stats = fs.statSync (dir + '/twitter-pi.js');
	var checkTime = new Date (util.inspect (stats.mtime));
	
	stats = fs.statSync (dir + '/log/access.log');
	if (stats.size >= (1000000 * logSize)) {
		
		fs.truncate (
			dir + '/log/access.log',
			0,
			function () {
				
				console.log('Reduced the log.');
			}
		);
	}
	
	if (checkTime > launchTime) {
		console.log ('Quitting because the server has changed.');
		process.exit (0);
	}
};

// the warmup sequence
var warmup = function () {
	
	// turn all pins off, and wait 1 second
	pinsOff ();
	
	setTimeout (
		function () {
			
			// turn on the first pin, and wait 1 second
			pinOn (pins[0]);
		
			setTimeout (
				function () {
					
					// turn on the second pin, and wait 1 second
					pinOn (pins[1]);
		
					setTimeout (
						function () {
							
							// turn on the third pin, and wait 1 second
							pinOn (pins[2]);
				
							setTimeout (
								function () {
									
									// turn on the fourth pin, and wait 1 second
									pinOn (pins[3]);
						
									setTimeout (
										function () {
											
											// turn on the main logic, listening to the twitter stream
											start ();
										},
										1000
									);
								},
								1000
							);
						},
						1000
					);
				},
				1000
			);
		},
		1000
	);
};

// read the data that the stream will listen to
var listen = require (dir + '/data/listen.json');

// the main logic
var start = function () {
	
	// turn all pins off
	pinsOff ();
	
	// read the twitter config for credentials
	twitterConfig = require (dir + '/data/twitter.json');
	// load the config for the stream
	client = new Twitter (twitterConfig);
	
	// set up the options for the stream
	var options = {
		track: '@' + listen.mention
	};
	
	// start the stream
	client.stream ('statuses/filter', options, function (stream) {
  		
		// the callback function for when a matching tweet comes thru
		stream.on ('data', function (tweet) {
			
			// run the check function
			check ();

			console.log ('-------------------------------------------------');
			console.log ('Id: ' + tweet.id);

			var tweetDate = new Date (tweet.created_at).getTime ();
			var compareTime = new Date ().getTime ();

			console.log (((compareTime - tweetDate) / 1000) + ' seconds ago ...');

			if (tweet.user) {

				console.log ('Tweeter: @' + tweet.user.screen_name);
			}

			console.log ('Tweet: ' + tweet.text);

			if (tweet.entities) {

				if (tweet.entities.hashtags) {

					console.log ('Hashtags:');
					console.log (tweet.entities.hashtags);

					var hashtags = tweet.entities.hashtags;
					
					// read the hastags and find out if one matches any of the pins
					for (var i = 0; i < hashtags.length; i++) {
	
						var hashtag = hashtags [i];
						var hash = hashtag.text.toLowerCase ();
		
						for (var i = 0; i < pins.length; i++) {

							if (hash == pins [i].hash) {
								
								// found a match, so turn the matching pin on
								pinOn (pins [i]);
							}
						}
					}
				}

				if (tweet.entities.user_mentions) {

					console.log ('Mentions:');
					console.log (tweet.entities.user_mentions);
				}
			}

			console.log ('-------------------------------------------------');
		});
 		
 		// the callback function for when the stream fails
		stream.on ('error', function (error) {

			console.log (error);
			throw error;
		});
	});
	
	// the interval, runs every second.  When a pin's "when" property passes the 60 second mark ... we turn the pin off
	interval = setInterval (
		function () {
			
			check ();
			
			var now = new Date ();
			
			for (var i = 0; i < pins.length; i++) {
	
				if (pins [i].when != 0 && ((now.getTime () - pins [i].when.getTime ()) / 1000) >= 60) {
					
					// pin passed the 60 second mark
					pinOff (pins [i]);
				}
			}
		},
		1000
	);
};

// on initial run, we setup the pins and export them so that the Raspberry Pi can control them
for (var i = 0; i < pins.length; i++) {
	
	pins [i].controller = gpio.export (
		pins [i].gpio,
		{
			direction: "out",
			ready: function() {
				
				console.log ('Pin is ready');
			}
		}
	);
	
	if (i >= 3) {
		
		// we have setup the last pin, kick off the warmup sequence and start the application
		warmup ();
	}
}