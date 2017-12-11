// import the dependencies
var fs = require ('fs');
var util = require ('util');
var Twitter = require ('twitter');
var gpio = require("gpio");
var request = require ('request');
var exec = require ('exec');
var logger = require ('logat');

var dmessage = function (m) {
	
	var message = {
  		date: new Date().toUTCString(),
  		details: ((new Error ().stack).split ("at ") [3]).trim (),
  		message: m
  	};
  
	fs.appendFile(
		dir + '/log/access.log',
		"\n\n\n\n" + JSON.stringify (message),
		function (err) {
	  		
	  		if (err) {
	  			
	  			derror (err, false);
	  		}
		}
	);
};

// setup a few variables that the application needs
// the max size of the log in MB
var logSize = 10;
// the current directory the application runs on
var dir = __dirname;
// declare a few global variables
var launchTime, client, interval;

// read the last modified time of the main js file
var stats = fs.statSync (dir + '/twitter-pi.js');
launchTime = new Date (util.inspect (stats.mtime));

// read the pin info from the json file
var pins = require (dir + '/data/pins.json');

// turn a pin on
var pinOn = function (p) {
	
	dmessage ('On: ' + p.gpio);
	
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
	
	dmessage ('Off:  ' + p.gpio);
	
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
	
	dmessage ('All On');
	for (var i = 0; i < pins.length; i++) {
	
		pinOn (pins [i]);
	}
};

// turn all pins off, loop thru pins and send each one to the pinOff() function
var pinsOff = function () {
	
	dmessage ('All Off');
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
				
				dmessage('Reduced the log.');
			}
		);
	}
	
	if (checkTime > launchTime) {
		dmessage ('Quitting because the server has changed.');
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
var options = {
	track: '@' + listen.mention
};
var twitterConfig = require (dir + '/data/twitter.json');
var seconds = 0;
var current = 0;
var interval;

// the main logic
var start = function () {
	
	// turn all pins off
	pinsOff ();
	
	seconds = 0;
	
	dmessage ('Starting the stream (attempt on ' + current + ') ...');
	
	// read the twitter config for credentials
	
	// load the config for the stream
	client = new Twitter (twitterConfig [current]);
	
	if (current == 0) {
		
		current = 1;
	} else {
		
		current = 0;
	}
	
	// start the stream
	client.stream ('statuses/filter', options, function (stream) {
  		
		// the callback function for when a matching tweet comes thru
		stream.on ('data', function (tweet) {
			
			// run the check function
			seconds = 0;

			dmessage ('-------------------------------------------------');
			dmessage ('Id: ' + tweet.id);

			var tweetDate = new Date (tweet.created_at).getTime ();
			var compareTime = new Date ().getTime ();

			dmessage (((compareTime - tweetDate) / 1000) + ' seconds ago ...');

			if (tweet.user) {

				dmessage ('Tweeter: @' + tweet.user.screen_name);
			}

			dmessage ('Tweet: ' + tweet.text);

			if (tweet.entities) {

				if (tweet.entities.hashtags) {

					dmessage ('Hashtags:');
					dmessage (tweet.entities.hashtags);

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

					dmessage ('Mentions:');
					dmessage (tweet.entities.user_mentions);
				}
			}

			dmessage ('-------------------------------------------------');
		});
 		
 		// the callback function for when the stream fails
		stream.on ('error', function (error) {

			dmessage (error);
			start ();
		});
	});
	
	// the interval, runs every second.  When a pin's "when" property passes the 60 second mark ... we turn the pin off
	if (interval) {
		
		clearInterval (interval);
	}
	interval = setInterval (
		function () {
			
			seconds++;
			dmessage ('Restarting the stream in ' + (listen.max - seconds) + ' seconds ...');
			if (seconds >= listen.max) {
			
				start ();
			}
		
			var now = new Date ();
			
			for (var i = 0; i < pins.length; i++) {
	
				if (pins [i].when != 0 && ((now.getTime () - pins [i].when.getTime ()) / 1000) >= 60) {
					
					// pin passed the 60 second mark
					pinOff (pins [i]);
				}
			}
			
			check ();
		},
		1000
	);
};

var ping = setInterval (
	function () {
		
		request(
			"https://twitter.com/",
			function (error, response, body) {
				
				if (error) {
					dmessage ('No internet connection (rebooting) ...');
					exec(
						['reboot'],
						function (err, out, code) {
							if (err instanceof Error)
								throw err;
							dmessage ('Rebooting ...');
						}
					);
				}
			}
		);
	},
	5000
);

// on initial run, we setup the pins and export them so that the Raspberry Pi can control them
for (var i = 0; i < pins.length; i++) {
	
	pins [i].controller = gpio.export (
		pins [i].gpio,
		{
			direction: "out",
			ready: function() {
				
				dmessage ('Pin is ready');
			}
		}
	);
	
	if (i >= 3) {
		
		// we have setup the last pin, kick off the warmup sequence and start the application
		warmup ();
	}
}