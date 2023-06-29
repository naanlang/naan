/*
 * env_node.js
 * Naanlib
 *
 *     Host Naan in the NodeJS REPL environment.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2017-2023 by Richard C. Zulch
 *
 */

(function(exports){

/*
 * NaanNodeREPL
 *
 *     This is executes Naan with a NodeJS REPL.
 *
 * Currently defined options are:
 *  {
 *      replDisable:    <boolean>               // disable REPL and just respond to textCommand in API
 *  }
 *
 */

exports.NaanNodeREPL = function NaanNodeREPL(options) {

    "use strict";
    /*jshint -W024 */
    var undefined;

    //
    // Initialization
    //
    
    if (typeof(options) != 'object')
        options = { };
    var repl = require('repl');
    var process = require('process');
    var Naan = require('./core/naanlib');
    var naanlib = new Naan.Naanlib();
    var servSelf = this;
    naanlib.js.t = this;                                                    // allow us to be accessed from Naan
    var termops;
    var outEnable = !options.replDisable;
    var useConsoleOut = false;
    if (outEnable && process.env["RUNKIT_ENDPOINT_URL"])
        useConsoleOut = true;                                               // use console.log for output in RunKit


    //==========================================================================
    // API
    //--------------------------------------------------------------------------

    this.setRequire = function setRequire(req) {                            // override require function
        naanlib.js.r = req;
    };

    this.setDirectory = function setDirectory(path) {                       // override base directory
        naanlib.js.d = path;
    };
        
    this.setGlobal = function setGlobal(key, value) {                       // set a global value
        naanlib.js[key] = value;
    };

    this.textCommand = function textCommand(cmd) {                          // send a command without echo
        outEnable = true;
        naanlib.textLine(cmd);
    };


    //==========================================================================
    // NodeJS REPL Terminal Interface
    //--------------------------------------------------------------------------

    //
    // Prepare the NodeJS console.
    //

    function myEval(cmd, context, filename, callback)
    {                                                                       // Node REPL does too much crap
    }
    
    if (!options.replDisable)
    {
        var nprompt = repl.start({ prompt: 'Naan> ', eval: myEval});
    
        nprompt.on('line', function(cmd) {                                  // process raw command line
            if (cmd.charAt(0) != ".") {
                textToRemoteTerm(cmd);
                naanlib.textLine(cmd + "\n");
            }
        });
    
        //
        // Hook the ^C interrupt
        //
    
        nprompt._events.SIGINT = function () {
            naanlib.escape();
        };
    
        //
        // Hook an exit command
        //
    
        nprompt.on('exit', function() {
            process.exit();
        });
    }

    //
    // Interpreter's console/debug output
    //

    naanlib.onText(function (text, level) {
        if (level) {
            if (level >= 5)
                console.log("\x1b[36m" + text + "\x1b[0m");                 // cyan for builtin logging
            else if (level >= 4)
                console.log("\x1b[34m" + text + "\x1b[0m");                 // blue for Naan function logging
            else if (level >= 3)
                console.log("\x1b[31m" + text + "\x1b[0m");                 // light read for warnings
            else if (level >= 2)
                console.log("\x1b[32m" + text + "\x1b[0m");                 // green for Naan.debug.debuglog logging
            else
                console.log("\x1b[31m\x1b[1m" + text + "\x1b[0m");          // heavy red for errors
            if (termops)
            {
                setTimeout(function () {
                    termops.debugtext(text, level);
                }, 1);
            }
        } else if (outEnable) {
            if (useConsoleOut) {                                            // stdout doesn't work
                text = text.replace(/\r?\n$/, "");                          // console.log already does a newline
                console.log(text);
            }
            else
                process.stdout.write(text);
            textToRemoteTerm(text);
        }
    });


    //==========================================================================
    // Naan Remote Terminal Interface
    //--------------------------------------------------------------------------

    //
    // Attach
    //
    // Attach a terminal controller to our interpreter.
    //

    this.Attach = function(tops) {
        termops = tops;
    };

    //
    // Detach
    //
    // Detach the terminal from the interpreter.
    //

    this.Detach = function(tops) {
        if (termops === tops)
            termops = false;
    };

    //
    // OnMessage
    //
    // Respond to a message. Note that this calls Naan via timeouts to handle the use case that the
    // messages are originating from the interpreter itself, so that it does not call itself back
    // recurxsively. That would be Very Bad™.
    //
            
    this.ReplyMessage = function ReplyMessage(data) {
        if (termops)
        {
            setTimeout(function () {
                termops.messageout(data);
            }, 1);
        }
        return (data);
    };
    
    var nodeListener;
    this.OnMessage = function OnMessage(proc) {
        nodeListener = proc;
        return (proc);
    };

    this.ReplyDebugger = function ReplyDebugger(data) {
        if (termops)
        {
            setTimeout(function () {
                termops.debugout(data);
            }, 1);
        }
        return (data);
    };

    var debugListener;
    this.OnDebugger = function OnDebugger(proc) {
        debugListener = proc;
        return (proc);
    };

    //
    // DispatchMessage
    //
    // Respond to a message. Note that this calls Naan via timeouts to handle the use case that the
    // messages are originating from the interpreter itself, so that it does not call itself back
    // recurxsively. That would be Very Bad™.
    //
    
    this.DispatchMessage = function(msg) {
        if (msg.id == "interrupt")
        {                                                                   // interrupt request from remote terminal
            setTimeout(function () {
                naanlib.escape();                                           // interrupt request from terminal
            }, 1);
        }
        else if (msg.id == "keyline")
        {                                                                   // typing from remote terminal
            setTimeout(function () {
                process.stdout.write(msg.text + "\r\n");
                outEnable = true;
                naanlib.textLine(msg.text);                                 // keyboard text from terminal
            }, 1);
        }
        else if (msg.id == "targetin")
        {
            setTimeout(function () {
                if (nodeListener)
                    nodeListener(msg.data);                                 // received a generic message
            }, 1);
        }
        else if (msg.id == "debugin")
        {
            setTimeout(function () {
                if (debugListener)
                    debugListener(msg.data);                                // received a debugger message
            }, 1);
        }
    };
    
    // textToRemoteTerm
    //
    // Echo text typed locally to any remote terminal(s) that might be attached.
    
    function textToRemoteTerm(text) {
        if (termops)
        {
            setTimeout(function () {
                termops.textout(text);
            }, 1);
        }
    }
    
    //
    // Status updates
    //
    // Send status updates once per second while a terminal is attached.
    //
    
    setInterval(function() {
        if (termops && termops.status)
        {
            var samples = naanlib.status(1);
            if (samples.length > 0)
                termops.status({
                    sample: samples[0]
                });
        }
    }, 1000);
    
    
    //==========================================================================
    // Start the Naan Interpreter
    //--------------------------------------------------------------------------
    var startOptions = {};
    if (options.noWelcome)
        startOptions.noWelcome = true;
    naanlib.banner();
    naanlib.start(startOptions);
};

})(typeof exports === 'undefined'? this.NaanNodeREPL={}: exports);

if (typeof(module) && typeof(module.exports))
    module.exports = this.NaanNodeREPL;                                     // export for NodeJS
