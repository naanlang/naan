/*
 * env_node.js
 * Naanlib
 *
 *     Host Naan in the NodeJS REPL environment.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2017-2024 by Richard C. Zulch
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
 *      noWelcome:      <boolean>               // suppress the welcome banner/messages
 *      state:          <object>                // saved state to load
 *      require:        <function>              // use the specified require function
 *      import:         <function>              // use the specified import function
 *  }
 *
 */

exports.NaanNodeREPL = function NaanNodeREPL(options) {

    "use strict";
    /*jshint -W024 */
    var undefined;
 
    //
    // Persistent
    //

    var
        kStateFirstVersion = 200,                                           // increment when losing backwards compatbility
        kStateCurrentVersion = 200;                                         // increment when adding features

    //
    // Initialization
    //
    
    if (typeof(options) != 'object')
        options = { };
    var repl = require('repl');
    var replServer;
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
    var dontSaveUntilWorking;                                               // true when state loaded, must be reset to save state again
    var prefs = { };

    //==========================================================================
    // API
    //--------------------------------------------------------------------------

    this.setRequire = function setRequire(req) {                            // override require function
        naanlib.js.r = req;
    };

    this.setImport = function setImport(imp) {                              // override import function
        naanlib.js.i = imp;
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
    
    this.setPrompt = function setPrompt(prompt) {
        if (replServer) {
            replServer.setPrompt(prompt);
            return (prompt);
        }
        return (false);
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
        replServer = repl.start({ prompt: '', eval: myEval});
    
        replServer.on('line', function(cmd) {                               // process raw command line
            if (cmd.charAt(0) != ".") {
                textToRemoteTerm("\x1b[90m\x1b[3m".concat(cmd, "\x1b[0m\n"));
                naanlib.textLine(cmd + "\n");
            }
        });
    
        //
        // Hook the ^C interrupt
        //
    
        replServer._events.SIGINT = function () {
            naanlib.escape();
        };
    
        //
        // Hook an exit command
        //
    
        replServer.on('exit', function() {
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
                    if (termops)                                            // avoid crashing if it went away during delay
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
                process.stdout.write("\x1b[90m\x1b[3m".concat(msg.text.trim(), "\x1b[0m\r\n"));
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
    // State load/save
    //--------------------------------------------------------------------------
     
    // SavePref
    //
    // Save a persistent preference object that can be retrieved in the future.
    //
    this.SavePref = function SavePref(key, value) {
        return (prefs[key] = value);
    };
 
    // LoadPref
    //
    // Load a previously-saved preference object for future retrieval.
    //
    this.LoadPref = function LoadPref(key) {
        return (prefs[key]);
    };

    // Working
    //
    // Note that the application is working, so it is safe to save state.
    //
    this.Working = function Working() {
        dontSaveUntilWorking = false;
    };

    // MakeState
    //
    // Save our state into a new object.
    //
    this.MakeState = function MakeState() {
        if (dontSaveUntilWorking)
            return (false);                                                 // didn't get far enough to call Working()
        var statedoc = {};
        statedoc.curversion = kStateCurrentVersion;
        statedoc.firstver = kStateFirstVersion;
        statedoc.date = new Date().toISOString();
        statedoc.prefs = prefs;
        statedoc.naan = naanlib.saveState(true);                            // true to optimize, which is a bit slower
        return (statedoc);
    };
 
    // loadState
    //
    // Load our state from an object.
    //
    function loadState(statedoc) {
        dontSaveUntilWorking = true;                                        // make sure we don't store bad state
        if (typeof(statedoc) != "object" || typeof(statedoc.naan) != "string"
            || statedoc.firstver > kStateCurrentVersion
            || statedoc.curversion < kStateFirstVersion)
        {
            return (false);
        }
        if (typeof(statedoc.prefs) == "object")
            prefs = statedoc.prefs;
        return (statedoc.naan);
    }

    
    //==========================================================================
    // Start the Naan Interpreter
    //--------------------------------------------------------------------------
    if (options.require)
        naanlib.js.r = options.require;
    if (options.import)
        naanlib.js.i = options.import;
    var startOptions = {};
    if (options.noWelcome)
        startOptions.noWelcome = true;
    else
        naanlib.banner();
    if (options.state)
        startOptions.state = loadState(options.state);
    if (options.cmd)
        startOptions.cmd = options.cmd;
    naanlib.start(startOptions);
};

})(typeof exports === 'undefined'? this.NaanNodeREPL={}: exports);

if (typeof(module) && typeof(module.exports))
    module.exports = this.NaanNodeREPL;                                     // export for NodeJS
