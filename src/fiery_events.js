var https = require('https');
var vasync = require('vasync');
var WebSocket = require('ws');

//******************************************************************************
// configuration section
//******************************************************************************

// set the host name as fiery server name or ip address
var hostname = 'the_server_name_or_ip_address';

// set the key to access Fiery API
var apiKey = 'the_api_key';

// set the username to login to the fiery
var username = 'the_username';

// set the password to login to the fiery
var password = 'the_password';

// websocket object
var ws = null;


// login to the fiery server
function login(callback) {
    var loginJson = {
        username: username,
        password: password,
        accessrights: apiKey,
    };

    var options = {
        hostname: hostname,
        path: '/live/api/v2/login',
        method: 'POST',
        headers: {
            content_type: 'application/json',
        },
        rejectUnauthorized: false,
    };

    var req = https.request(options, function (res) {
        var response = '';

        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            response = response + chunk;
        }).on('end', function () {
            console.log();
            console.log('Login');
            console.log(response);

            var cookie = res.headers['set-cookie'];
            callback(null, cookie);
        });
    });

    req.write(JSON.stringify(loginJson));
    req.end();
}

// logout from the fiery server
function logout(cookie, callback) {
    var options = {
        hostname: hostname,
        path: '/live/api/v2/logout',
        method: 'POST',
        headers: {
            cookie: cookie,
        },
        rejectUnauthorized: false,
    };

    var req = https.request(options, function (res) {
        var response = '';

        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            response = response + chunk;
        }).on('end', function () {
            console.log();
            console.log('Logout');
            console.log(response);

            var cookie = res.headers['set-cookie'];
            callback(null, cookie);
        });
    });

    req.end();
}

// receive events from fiery server
function receiveFieryEvents() {
    vasync.waterfall([
        login,
        runWebsocket,
        logout,
        function(callback) {
            process.exit();
        }
    ]);
}

// set filters to receive only fiery status change events
function receiveFieryStatusChangeEvents(callback) {
    console.log("");
    console.log("Scenario: Receive only Fiery status change events");
    console.log("Press <Enter> when you want to run next scenario");

    // ignore all events except device events
    ws.send(
        JSON.stringify(
        {
            jsonrpc : "2.0",
            method : "ignore",
            params : ["accounting", "job", "jobprogress", "preset", "property", "queue"],
            id : 1
        })
    );

    // receive device events
    ws.send(
        JSON.stringify(
        {
            jsonrpc : "2.0",
            method : "receive",
            params : ["device"],
            id : 2
        })
    );

    // wait for user to press enter key
    process.stdin.resume();
    process.stdin.once('data', function (chunk) {
        callback();
    });
}

// set filters to receive only job is printing? events
function receiveJobIsPrintingEvents(callback) {
    console.log("");
    console.log("Scenario: Receive only job is printing? events");
    console.log("Press <Enter> when you want to run next scenario");

    // ignore all events except job events
    ws.send(
        JSON.stringify(
        {
            jsonrpc : "2.0",
            method : "ignore",
            params : ["accounting", "device", "jobprogress", "preset", "property", "queue"],
            id : 1
        })
    );

    // receive job events
    ws.send(
        JSON.stringify(
        {
            jsonrpc : "2.0",
            method : "receive",
            params : ["job"],
            id : 2
        })
    );

    // receive job events only if they contain <is printing?> key in the <attributes> key
    ws.send(
        JSON.stringify(
        {
            jsonrpc : "2.0",
            method : "filter",
            params : {
                eventKind : "job",
                mode : "add",
                attr : {
                    attributes : ["is printing?"]
                }
            },
            id : 3
        })
    );

    // wait for user to press enter key
    process.stdin.resume();
    process.stdin.once('data', function (chunk) {
        callback();
    });
}

// set filters in batch mode to receive only job is printing? events
function receiveJobIsPrintingEventsInBatchMode(callback) {
    console.log("");
    console.log("Scenario: Receive only job is printing? events in batch mode");
    console.log("Press <Enter> when you want to run next scenario");

    ws.send(
    JSON.stringify(
        [
            // ignore all events except job events
            {
                jsonrpc : "2.0",
                method : "ignore",
                params : ["accounting", "device", "jobprogress", "preset", "property", "queue"],
                id : 1
            },

            // receive job events
            {
                jsonrpc : "2.0",
                method : "receive",
                params : ["job"],
                id : 2
            },

            // receive job events only if they contain <is printing?> key in the <attributes> key
            {
                jsonrpc : "2.0",
                method : "filter",
                params : {
                    eventKind : "job",
                    mode : "add",
                    attr : {
                        attributes : ["is printing?"]
                    }
                },
                id : 3
            }
        ])
    );

    // wait for user to press enter key
    process.stdin.resume();
    process.stdin.once('data', function (chunk) {
        callback();
    });
}

// open websocket connection, set event listeners and receive fiery events
function runWebsocket(cookie, callback) {
    var options = {
      rejectUnauthorized: false,
      headers: {
          'cookie': cookie
      }
    };

    // open websocket connection
    ws = new WebSocket('wss://' + hostname + '/live/api/v2/events', options);

    ws.on('open', function() {
        console.log("new websocket connection is opened");

        vasync.waterfall([
            receiveFieryStatusChangeEvents,
            receiveJobIsPrintingEvents,
            receiveJobIsPrintingEventsInBatchMode,
            function(callback) {
                ws.close();
                callback();
            }
        ]);
    });

    ws.on('message', function (data) {
        console.log(data);
    });

    ws.on('error', function (error) {
        console.log("websocket error: " + error);
    });

    ws.on('close', function close(code, message) {
        console.log('websocket connection closed: ' + code + " " + message);
        callback(null, cookie);
    });
}

receiveFieryEvents();