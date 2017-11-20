# twitter-pi
This nodejs application connects to the twitter fire hose and filters tweets.

For some specifics (path names) run the following commands (as root) on the Raspberry Pi
which node
which php

If those commands do not return anything, then you will need to install php and node
You can install them by running (on the command line):
apt-get install npm
This will install npm, and all of it's dependencies
apt-get install php7.0
This will install the base php packages

Once installed, re-run the which commands to find the 2 paths

Add to crontab:
run "crontab -e" in the command line and add the following
* * * * * /path/to/php -q /path/to/repo/project/src/cron.php &

This will trigger the service every minute.  The cron.php file checks to see if the service is already running and will avoid launching mulitple instances.

Edit the following files:
data/twitter.json - replace the keys with the ones provided from your twitter application
data/system.json - replace the path to node with the one returned from "which node"
data/pins.json - replace the hashtags you wish to listen for on the specific pins (do not include the "#" character)
data/listen.json - replace the mention field with the twitter handle you want to listen to

# Basic Logic
1. The twitter stream only listens for tweets that contain a mention (configured on the listen.json file)
2. Each tweet that comes thru the stream is check to see if it contains a hashtag (defined in the pins.json file)
3. When a match is found, it will turn the corresponding gpio pin on and turn the relay switch on (for 60 seconds)
4. After 60 seconds, the gpio pin is turned off, and the corresponding relay will shut off.
5. Keep in mind, that this is a self-healing applciation.  If an error occurs at any point that shuts the application down (network disruption, twitter stream error, etc), the application will attempt to start up again when the Raspberry Pi clock turns over to the next minute.