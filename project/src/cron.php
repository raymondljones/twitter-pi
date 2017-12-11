<?php
	
	// get the current directory the php script is running from
	$_dir = DIRNAME (__FILE__);
	
	// check if the log directory exists, if not then create it
	if (!is_dir ($_dir . '/log')) {
		
		// create the log directory
		mkdir ($_dir . '/log');
	}
	
	// check if the log exists, if not then create it
	if (!is_file ($_dir . '/log/access.log')) {
		
		// create the log
		touch ($_dir . '/log/access.log');
	}
	
	// find other instances of the application
	$bot = shell_exec ("ps auxw | awk '/twitter-pi.js/ && ! /" . getmypid () . "/ && ! /awk/ {print $2}'");
	
	// if there is another instance, then quit, of not then spin a new one up
	if ($bot != null && trim ($bot) != "") {
		
		// quit
		exit;
	} else {
		
		// get the path to node
		$system = json_decode (file_get_contents ($_dir . '/data/system.json'));
		
		// spin up a new instance of the application, directing all output to the log file
		shell_exec ($system->node . ' \'' . $_dir . '/twitter-pi.js\' > \'' . $_dir . '/log/access.log\' >> /dev/null &');
	}
?>