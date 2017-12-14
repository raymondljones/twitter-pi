// import the dependencies
var fs = require ('fs');
var util = require ('util');
var Twitter = require ('twitter');
var gpio = require("gpio");
var request = require ('request');
var exec = require ('exec');
var logger = require ('logat');
var ua = require ('universal-analytics');
var canStart = false;
var retryCount = 0;
var ga = 'UA-72811938-4';
var gabase = '/dc/';
var gatitlebase = 'DC: ';
var server = ua(
	ga,
	'server',
	{
		strictCidFormat: false
	}
);

var serverPageView = function (page, title) {
	
	server.pageview (
		gabase + page,
		gatitlebase + title,
		function (err) {
			
			if (err) {
				
				dmessage (err);
			}
		}
	);
};

var pageView = function (v, page, title) {
	
	var visitor = ua(
		ga,
		v,
		{
			strictCidFormat: false
		}
	);
	visitor.pageview (
		gabase + page,
		gatitlebase + title,
		function (err) {
			
			if (err) {
				
				dmessage (err);
			}
		}
	);
};

var dmessage = function (m) {
	
	var err = (new Error ().stack);
	var errp = err.split ('at ');
	
	var message = {
  		date: new Date().toUTCString(),
  		details: (errp [2])?errp [2]:err,
  		message: m
  	};
  	
  	console.log (message);
  
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
var launchTime, client;

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
		process.exit (1);
	}
};

// the warmup sequence
var warmup = function () {
	
	serverPageView ('warmup', 'Warmup');
	
	canStart = false;
	pinsOff ();
	
	var waitTill = new Date(new Date().getTime() + 1 * 1000);
	while(waitTill > new Date()){}
	
	pinOn (pins[0]);
	
	var waitTill = new Date(new Date().getTime() + 1 * 1000);
	while(waitTill > new Date()){}
	
	pinOn (pins[1]);
	
	var waitTill = new Date(new Date().getTime() + 1 * 1000);
	while(waitTill > new Date()){}
	
	pinOn (pins[2]);
	
	var waitTill = new Date(new Date().getTime() + 1 * 1000);
	while(waitTill > new Date()){}
	
	pinOn (pins[3]);
	
	var waitTill = new Date(new Date().getTime() + 1 * 1000);
	while(waitTill > new Date()){}
	
	canStart = true;
};

// read the data that the stream will listen to
var listen = require (dir + '/data/listen.json');
var options = {
	track: '@' + listen.mention
};
var twitterConfig = require (dir + '/data/twitter.json');
var seconds = 0;
var current = 0;

// the main logic
var start = function () {
	
	serverPageView ('start', 'Start');
	
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
			
			var tweeter = 'undefined';
			
			if (tweet.user) {
				
				tweeter = tweet.user.id;
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
								pageView (tweeter, 'on/' + pins [i].hash, 'On ' + pins [i].hash);
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
			
			if (error) {
				
				dmessage (error);
			}
			seconds = listen.max;
		});
	});
};

var interval = setInterval (
	function () {
		
		seconds++;
		
		if (client && canStart) {
					
			if (seconds >= listen.max) {
				
				serverPageView ('terminate', 'Terminate');
				client = null;
				dmessage ('Terminating the client');
			}

			var now = new Date ();

			for (var i = 0; i < pins.length; i++) {

				if (pins [i].when != 0 && ((now.getTime () - pins [i].when.getTime ()) / 1000) >= 60) {
	
					// pin passed the 60 second mark
					serverPageView ('reset/' + pins [i].hash, 'Reset ' + pins [i].hash);
					pinOff (pins [i]);
				}
			}
		}
		
		check ();
	},
	1000
);

var pingInterval = setInterval (
	function () {
		
		request(
			"https://google.com/",
			function (error, response, body) {
				
				if (error) {
					
					retryCount++;
					dmessage (error);
					client = null;
					dmessage ('Terminating the client');
					
					if (canStart) {
						
						pinsOn ();
					}
					
					if (retryCount >= 12) {
						
						dmessage ('Rebooting');
						exec (
							['shutdown', '-r', 'now'],
							function (err, out, code) {
								
								if (err) {
									
									dmessage (err);
								}
								process.exit (1);
							}
						);
					}
				} else {
					
					if (!client && canStart) {
						
						start ();
					}
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