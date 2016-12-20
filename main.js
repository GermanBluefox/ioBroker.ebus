/**
 *
 * eBus adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "ebus",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.1",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "ebus Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "Hoich <???@???.de>"
				"lennyCB <lenny.cb@arcor.de>"
 *          ]
 *          "desc":         "ebus Adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "Host": 192.168.2.2,
 *          "Port": 8888
 *      }
 *  }
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.adapter('ebus');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.debug('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.debug('ack is not set!');
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj == 'object' && obj.message) {
        if (obj.command == 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});


// Delete all states from array (one after each other)
function deleteStates(states, callback) {
     // If array is empty => finished
     if (!states || !states.length) {
        if (callback) callback();
        return;
     }
     
     // Get one ID
     var id = states.pop();
     
     // Delete Object
     adapter.delObject(id, function (err) {
        // Delete state
        adapter.delState(id, function (err) {
           // Go to next ID
           setTimeout(deleteStates, 0, states, callback);
        });          
     });
}

function cleanStates(cb) {
	
	// Get all IDs of this adapter
	adapter.getStates('*', function (err, states) {
		var toDelete = [];
		// collect all states that are empty to array
		for (var id in states) {
			// test value and store ID if value is empty
			if (states[id].val.indexOf('ERR: no signal') !== -1) toDelete.push(id);
		}

		// gently delete all empty states
		deleteStates(toDelete, function() {
		    adapter.log.info('delete finished');
			if (typeof cb === 'function') cb();
		});
	});
}

function main() {

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:
    adapter.log.debug('config Host: ' + adapter.config.host);
    adapter.log.debug('config Port: ' + adapter.config.port);
	adapter.config.host = adapter.config.host || '192.168.2.2';
	adapter.config.port = parseInt(adapter.config.port, 10) || 8080;
		
// ebusd find script

var net = require('net');
var fieldsToRead = [];

adapter.log.debug('trying');
 
var req = 'find -f';

//createState('eBus');

var run=1;
var lastFieldRequested='';
var closing=0;

function parse(data) {
    adapter.log.debug("run: " + run);
    if(run == 1)
    {
        var arr = data.toString().split(/\r?\n/);
        for(var i = 0; i<arr.length; i++) {
            var line = arr[i];
            var idx=0;
            var tmp = line.split(',');
            if(tmp.length > 7) {
                var numfields = 0;
                var TYPE = tmp[0];
                var CIRCUIT = tmp[1];
                var NAME = tmp[2];
                var COMMENT = tmp[3];
                var QQ = tmp[4];
                var ZZ = tmp[5];
                var PDSB = tmp[6];
                var ID = tmp[7];
                adapter.log.debug("* TYPE:" + TYPE + " CIRCUIT:" + CIRCUIT + " NAME:" + NAME +
                " COMMENT:" + COMMENT + " QQ:" + QQ + " ZZ:" + ZZ +
                " PDSB:" + PDSB + " ID:" + ID);
                while(tmp.length > (7 + ((numfields+1)*6)))
                {
                    idx = 8 + (numfields)*6;
                    var FIELD = tmp[idx];
                    var PART = tmp[idx+1];
                    var DATATYPE = tmp[idx+2];
                    var DIVIDER = tmp[idx+3];
                    var UNIT = tmp[idx+4];
                    var COMMENT_F = tmp[idx+5];
                    adapter.log.debug("* * FIELD:" + FIELD + " PART:" + PART + " DATATYPE:" + DATATYPE +
                    " DIVIDER:" + DIVIDER + " UNIT:" + UNIT + " COMMENT:" + COMMENT_F);
                    if(FIELD === '')
                        //createState('eBus' + '.' + CIRCUIT + '.' + NAME, undefined, {name: COMMENT, unit: UNIT, desc: COMMENT});
						adapter.setObject(CIRCUIT + '.' + NAME, {type: 'state', common: {name: COMMENT, type: 'number', role: 'value', read: true, write: true, unit: UNIT}, native: {}});
                    else
                        //createState('eBus' + '.' + CIRCUIT + '.' + NAME + '.' + FIELD, undefined, {name: COMMENT_F, unit: UNIT, desc: COMMENT});
						adapter.setObject(CIRCUIT + '.' + NAME + '.' + FIELD, {type: 'state', common: {name: COMMENT_F, type: 'number', role: 'value', read: true, write: true, unit: UNIT}, native: {}});
                    fieldsToRead.push(CIRCUIT + ',' + NAME + ',' + FIELD);
                    numfields++;
                }
    
     //       } else {
                //log("odd line: " + line, 'warn');
            }
        }
        if(fieldsToRead.length > 0) {
            var tmp2 = fieldsToRead.shift();
            var tmp3 = tmp2.split(',');
            var CIRCUIT = tmp3[0];
            var NAME = tmp3[1];
            var FIELD = tmp3[2];
            if(FIELD === '')
                req = "read -c " + CIRCUIT + ' ' + NAME;
            else
                req = "read -c " + CIRCUIT + ' ' + NAME+ ' ' + FIELD;
            adapter.log.debug('Sending: ' + req);
            lastFieldRequested = tmp2;
            client.write(req+'\n');
        }
    } else {
        var arr = data.toString().split(/\r?\n/);
        if(arr.length == 2) {
        //for(var i = 0; i<arr.length; i++) {
            var line = arr[1];
            adapter.log.debug("new line for " + lastFieldRequested +": " + line);
            var tmp3 = lastFieldRequested.split(',');
            var CIRCUIT = tmp3[0];
            var NAME = tmp3[1];
            var FIELD = tmp3[2];
            if(FIELD === '')
				adapter.setState(CIRCUIT + '.' + NAME, {val: line, ack: true});
            else
				adapter.setState(CIRCUIT + '.' + NAME + '.' + FIELD, {val: line, ack: true});  
            lastFieldRequested = '';
        }
        if(fieldsToRead.length > 0) {
            var tmp2 = fieldsToRead.shift();
            var tmp3 = tmp2.split(',');
            var CIRCUIT = tmp3[0];
            var NAME = tmp3[1];
            var FIELD = tmp3[2];
            if(FIELD === '')
                req = "read -c " + CIRCUIT + ' ' + NAME;
            else
                req = "read -c " + CIRCUIT + ' ' + NAME+ ' ' + FIELD;
            adapter.log.debug('Sending: ' + req);
            lastFieldRequested = tmp2;
            client.write(req+'\n');
        }
    }
    run++;
    if(fieldsToRead.length == 0 && lastFieldRequested === '') {
        closing = 1;
        adapter.log.debug('Sending: quit');
        client.write('quit\n');
    }
}

var client = new net.Socket();
client.connect(adapter.config.port, adapter.config.host, function() {
    adapter.log.debug('Connected to ebusd on ' + adapter.config.host + ':' + adapter.config.port);
    client.write(req + '\n');
	// Call after 10 seconds clean process to remove empty states. But it is wrong :) Better to create state if you get valid data.
	setTimeout(cleanStates, 10000);
});

var databuf = '';
client.on('data', function(data) {
  var prev = 0, next;
  var datastr = data.toString();
  while ((next = datastr.indexOf('\n\n', prev)) > -1) {
    databuf += datastr.substring(prev, next);
    parse(databuf);
    databuf = '';
    prev = next + 1;
  }
  databuf += datastr.substring(prev);
//  client.write('quit\n');
});

client.on('close', function() {
   adapter.log.debug('Connection to ebusd closed');
});

client.on('error', function() {
   adapter.log.debug('Error');
});

client.on('end', function() {
   adapter.log.debug('End');
});
}  
       
                    
                    
              
    
