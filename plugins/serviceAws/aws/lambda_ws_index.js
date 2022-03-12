/*
 * lambda_ws_index.js
 * serviceAws
 *
 *     AWS Lambda startup code for WebSocket interfaces.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2020 by Richard C. Zulch
 *
 */


/*
 * Imports & Utilities
 *
 */

var AWS = require('aws-sdk');
require('./patch.js');
var s3 = new AWS.S3();
var process = require('process');
var naan = require('/opt/core/naan_interpreter.js');
var naan_start = require('/opt/core/naan_start.js');
var naan_module = require('/opt/core/naan_module.js');
var naan_lingo = require('/opt/core/naan_lingo.js');

var kLogError = 1;
var kLogWarn = 3;

var activeWorkerID;                 // workerID of the active Naan instance, or false
var activeCounter = 0;              // message counter for the active worker
var activeController;               // active NaanController, or false
var activeOptions;                  // active options, saved with state

var instance_counter = 0;


//===================================================================================================
// AWS Interface
//---------------------------------------------------------------------------------------------------
//
//     The awsHandler protocol is mandated by Amazon's Lambda API for NodeJS. It is called for each
// message received from the client side.
//

exports.handler = function awsHandler(event, context, callback) {
    var messageIn;
    var connectionId = event.requestContext.connectionId;
    logOut("awsHandler connectionID: " + connectionId + " " + instance_counter++);
    
    //
    // initialize
    //

    var apigwManagementApi = new AWS.ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
    });

    //
    // finished
    //
    //     Terminate execution with the specified code, defaulting to 200.
    //

    function finished(code)
    {
        if (!code)
            code = 200;                                                     // default success
        logOut("callback finished: " + code);
        callback(null, {
            statusCode: code,
            headers: { 'Content-Type': 'application/json' },
            body: ""
        });
    }
    
    //
    // logOut
    //
    //     Log the specified string for CloudWatch reporting.
    //

    function logOut(text, level)
    {
        if (!(level >= 0 && level <= 5))
            level = 0;
        var levelstr = ["[INFO]", "[ERRR]", "[DBUG]", "[WARN]", "[NAAN]", "[BTIN]"][level];
        process.stdout.write(levelstr + " " + text + "\n");
    }
    
    //
    // stateName
    //
    //     Return the name of the active saved state file.
    //
    
    function stateName()
    {
        return ("naan-" + activeWorkerID + ".state");
    }

    //
    // sendData
    //
    //     Send data back to the originating client. Generally this should be a dictionary. The
    // callback is required or this will fail silently.
    //

    function sendData(data, callback)
    {
        if (typeof(data) === "object")
            data = JSON.stringify(data);
        apigwManagementApi.postToConnection({
            ConnectionId: connectionId,
            Data: data
        }, callback);
    }
    
    //
    // execDone
    //
    //     Called by the NaanController when it's done executing the request. The specified array of
    // messages is sent back to the client. These are sent all at once as an array to avoid ordering
    // issues that are otherwise inevitable.
    //
    
    function execDone(sendqueue, save)
    {
        sendData({                                                          // first send our response
            clientID: messageIn.clientID,
            serverID: messageIn.serverID,
            workerID: messageIn.workerID,
            respOp: "msgarray",
            payload: sendqueue
        }, function() {
            if (save)
            {
                saveState(function() {                                      // then save the Naan state
                    finished();                                             // then finish the lambda
                });
                return;
            }
            finished();
        });
    }
        
    //
    // saveState
    //
    //     Save the state of the active Naan instance.
    //

    function saveState(callback)
    {
        var saved = {
            workerID: activeWorkerID,
        };
        if (activeOptions)
            saved.options = activeOptions;
        saved.state = activeController.StateSave();
        s3.putObject({
            Body: JSON.stringify(saved),
            Bucket: "zulchlab-naan",
            Key: stateName(),
            ContentType: "utf8"
        }, function(err, data) {
            if (err)
                logOut("putObject failed" + err, kLogError);
            else
                logOut("putObject successful");
            if (callback)
                callback();
        });
    }

    //
    // processMessage
    //
    //     Process an incoming message from Naan.
    //

    function processMessage()
    {
        logOut("processing action " + event.requestContext.routeKey);
        if (!event.body) {
            finished(200);                                                  // must return success for $connect route
            return;
        }
        try {
            messageIn = JSON.parse(event.body);                             // parse incoming message from Naan client
            if (messageIn.serverID != "Workers")
            {                                                               // unknown server-side functionality
                logOut("invalid serverID rejected: " + messageIn.serverID, kLogError);
                finished(404);                                              // not found
                return;
            }
        } catch(e) {
            logOut("cannot parse incoming message JSON", e.toString(), kLogError);
            finished(400);                                                  // bad request
            return;
        }
        if (typeof(messageIn.workerID) !== "string" || messageIn.workerID.length === 0)
        {
            logOut("invalid workerID rejected: " + messageIn.workerID, kLogError);
            finished(400);                                                  // bad request
            return;
        }
        if (messageIn.workerOp == "spawn" && messageIn.payload.reset)
        {                                                                   // clean start
            activeOptions = messageIn.payload.options;
            activeWorkerID = messageIn.workerID;
            activeCounter = messageIn.msgCounter;
            logOut("reset instance: " + activeWorkerID + " " + activeCounter);
            activeController = new NaanController(logOut, execDone);
            activeController.reset();
            activeController.execute(event, messageIn);
        }
        else if (activeWorkerID == messageIn.workerID && activeCounter+1 == messageIn.msgCounter)
        {                                                                   // already have correct instance
            activeCounter = messageIn.msgCounter;                           // update our counter
            logOut("reusing instance: " + activeWorkerID + " " + activeCounter);
            activeController.reuse(logOut, execDone);
            activeController.execute(event, messageIn);
        }
        else
        {                                                                   // need new Naan instance
            activeOptions = false;
            activeWorkerID = messageIn.workerID;
            activeCounter = messageIn.msgCounter;                           // start with specified counter
            logOut("new instance: " + activeWorkerID + " " + activeCounter);
            activeController = new NaanController(logOut, execDone);
            s3.getObject({
                Bucket: "zulchlab-naan",
                Key: stateName()
            }, function(err, data) {
                if (err)
                    logOut("getObject failed: " + err.toString(), kLogWarn);
                else {
                    try {
                        var saved = JSON.parse(data.Body.toString("utf8"));
                        activeOptions = saved.options;
                        if (activeController.StateLoad(saved.state))
                            logOut("getObject succeeded: " + saved.state.length);
                        else
                            err = true;
                    } catch (e) {
                        logOut("stateLoad failed: " + e.toString(), kLogWarn);
                        err = true;
                    }
                }
                if (err)
                    activeController.reset();
                activeController.execute(event, messageIn);
            });
        }
    }
    
    processMessage();
};


//===================================================================================================
// Naan Controller
//---------------------------------------------------------------------------------------------------
//
//     The Naan controller executes Naan until there is nothing more to do, which one hopes is before
// the configured AWS Lambda timeout. After execution completes the state of the interpreter can be
// saved if desired. This is done by either a) setting the msgin.payload.save flag on the client side
// or b) calling js.t.SetSave(boolean) from within the invocation to be saved.
//
        
function NaanController(logOut, execDone)
{
    var self = this;
    var typeahead = "";
    var keyboard = false;
    var sendqueue = [];
    var timerID;
    var saveInvocation;
    var anaan = new naan.NaanInterpreter();
    var jsvar = {
        d: __dirname,
        r: require,
        t: this,
        n: anaan,
        o: Object,
        g: global
    };
    anaan.On("init-load", function () {
        anaan._AddNamedObject("js", jsvar);
    });

    //
    // debugWrite
    // textWrite
    //
    //     Naan hooks for text output.
    //
    anaan.On("debug-write", function(text, level) {
        logOut(text, level);
        sendqueue.push({
            respOp: "msgout",
            payload: {
                id: "debugtext",
                text: text,
                level: level
            }
        });
    });
    
    anaan.On("console-out", function(who, text) {
        process.stdout.write(text);
        sendqueue.push({
            respOp: "msgout", 
            payload: {
                id: "textout",
                text: text
            }
        });
    });

    //
    // naanFlush
    //
    // Run until there is nothing else to do
    //
    function naanFlush()
    {
        var outext;
        for (;;)
        {
            if ((outext = anaan.RunOutput()) !== "")
            {
                process.stdout.write(outext);
                outext = "";
            }
            if (!anaan.Run())
                break;
        }
    }

    //
    // runOne
    //
    // Process input text when idle, returning without reschedule when there is nothing left to
    // do here. (But there may be things going on in the background, waiting for a callback.)
    //
    function runOne()
    {
        if (timerID) {
            clearTimeout(timerID);
            timerID = false;
        }
        if (!anaan.Run())
        {
            if (typeahead.length === 0) {
                logOut("runOne idle");
                timerID = setTimeout(function() {
                    logOut("save timeout completed");
                    execDone(sendqueue, saveInvocation);
                }, 10);
                return;
            }
            var cmds = typeahead + "\n";
            typeahead = "";
            anaan.Process(cmds, keyboard);
        }
        reschedule(anaan);
    }

    //
    // reschedule
    //
    // Run us again from the NodeJS event loop.
    //
    function reschedule(who)
    {
        Promise.resolve().then(runOne);
    }

    anaan.On("interrupted", function (who) {
        reschedule();                                                       // need to reschedule again in this case
    });

    //
    // scheduleInitFile
    //
    // Schedule a file to be parsed and executed for initialization.
    //
    function scheduleInitFile(path)
    {
        path = require("path").resolve(__dirname, path);
        typeahead += 'Naan.module.nodeparse("' + path + '");;\n';
    }
    
    //
    // reuse
    //
    //     Reuse the active controller.
    //
    
    this.reuse = function reuse(_logout, _execdone)
    {
        logOut = _logout;
        execDone = _execdone;
        typeahead = "";
        keyboard = false;
        sendqueue = [];
        timerID = false;
        saveInvocation = false;
    };

    //
    // reset
    //
    //     Initialize Naan instance to run the first time.
    //
    this.reset = function reset()
    {
        logOut("Naan reboot");
        self.reuse(logOut, execDone);
        anaan.StateDefault();
        anaan.Banner();
        naan_start.BootRoot(anaan);
        naan_module.BootModule(anaan);
        naan_lingo.BootLingo(anaan);
        naan_start.BootPlayNG(anaan);
        anaan.Process("");
        naanFlush();
        scheduleInitFile("./lambda_init.nlg");
    };
    
    // execute
    //
    //     Execute Naan until there is no more to do.
    //
    this.execute = function execute(event, messageIn)
    {
        jsvar.lambda = {
            event: event
        };
        if (messageIn.workerOp == "spawn")
        {                                                                   // configure instance with options
            activeOptions = messageIn.payload.options;
            sendqueue.push({
                respOp: "msgout",
                payload: {
                    id: "started",
                    connectionId: event.requestContext.connectionId
                }
            });
        }
        else if (messageIn.workerOp == "msgin")
        {                                                                   // execute Naan
            if (messageIn.payload.save)
                saveInvocation = messageIn.payload.save;                    // set the save flag
            if (messageIn.payload.id == "interrupt")
                anaan.Escape();
            else if (messageIn.payload.id == "keyline")
            {
                keyboard = true;
                typeahead += messageIn.payload.text;
            } else
                logOut("msgin.id not recognized" + messageIn.payload.id, kLogWarn);
        } else
            logOut("workerOp not recognized" + messageIn.workerOp, kLogWarn);
        runOne();
    };
    
    // SetSave
    //
    //     Set the save flag for the current invocation.
    //
    this.SetSave = function SetSave(dosave)
    {
        saveInvocation = dosave
    };
    
    // StateLoad
    //
    //     Load the interpreter state from the specified string.
    //
    this.StateLoad = function StateLoad(state)
    {
        return (anaan.StateLoad(state));
    };
    
    // StateSave
    //
    //     Return the interpreter state as a string.
    //
    this.StateSave = function StateSave()
    {
        return (anaan.StateSave());
    };
}
