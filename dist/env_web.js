/*
 * env_web.js
 * Naanlib
 *
 *     Host Naan in the Browser environment.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2017-2022 by Richard C. Zulch
 *
 */


/*
 * Initialize
 *
 */

(function(exports){


/*
 * NaanControllerWeb
 *
 * This JavaScript object manages a single Naan interpreter instance with the following services:
 *  1. Load persistent state on startup, if available and allowed
 *  2. Interpret query strings supplied when the host window was opened
 *  3. Save state before the host window is closed.
 *
 */

exports.NaanControllerWeb = function() {

    "use strict";
    /*jshint -W024 */
    var undefined;                                                          // JavaScript should make this a keyword
 
    //
    // Persistent
    //

    var
        kStateFirstVersion = 200,                                           // increment when losing backwards compatbility
        kStateCurrentVersion = 200;                                         // increment when adding features

 
    //
    // Environment
    //
  
    var pageLoading = true;                                                 // assume we are loading the page

    window.addEventListener("load", function (e) {
        pageLoading = false;
    });
 
    var querystrings = (function(a) {
        if (a === "") return {};
        var b = {};
        for (var i = 0; i < a.length; ++i)
        {
            var p=a[i].split('=', 2);
            if (p.length == 1)
                b[p[0]] = "";
            else
                b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
        }
        return b;
    })(window.location.search.substr(1).split('&'));
   
   
    //
    // Initialization
    //
 
    var naanlib = new exports.Naanlib();
    var contSelf = this;                                                    // this is us, for access within nested functions
    exports.naancon = this;                                                 // access to this instance
    contSelf.anaan = naanlib.js.n;
    naanlib.js.t = contSelf;
    var replstate;                                                          // latest known state of the REPL
    var naanstate;                                                          // desired state for the interpreter
    var replqueue;                                                          // text destined for terminal when opened
    var termlist = [];                                                      // list of terminals currently attached
    contSelf.termlist = termlist;
    var prefs = { };
    var vsiteName;

    //
    // termTextOut
    //
    // Output debug text/level to terminal.
    //

    naanlib.onText(termTextOut);

    function termTextOut(text, level) {
        if (!text)
            return;
        if (termlist.length === 0) {
            console.log(text);                                              // make sure we can see early errors
            if (!replqueue)
                replqueue = [];
            replqueue.push({text:text, level:level});
        }
        else {
            termlist.forEach(function(term) {
                var msg;
                if (level)
                    msg = {
                        id: "debugtext",
                        text: text,
                        level: level
                    };
                else
                    msg = {
                        id: "textout",
                        text: text
                    };
                term.OnMessage(msg);
            });
        }
    }

    //
    // takePending
    //
    // Read any pending Naan output and send to terminal.
    //
 
    function takePending() {
        var outputq = replqueue;
        replqueue = false;
        if (outputq)
            outputq.reverse();
        while (outputq && outputq.length > 0) {
            var item = outputq.pop();
            termTextOut(item.text, item.level);
        }
    }


    //==========================================================================
    // New Terminal Interface
    //--------------------------------------------------------------------------
               
    //
    // StateGet
    //
    // Report the saved state we are keeping for the terminal.
    //
    
    this.StateGet = function StateGet() {
        termlist.every(function(term) {
            var state;
            if (term.StateSave && (state = term.StateSave()))
            {                                                               // update the state if we can
                replstate = state;
                return (false);
            }
            return (true);                                                  // keep searching
        });
        return (replstate);
    };

    //
    // Attach
    //
    // Attach a terminal to our interpreter and immediately start sending it messages.
    //
    
    this.Attach = function Attach(terminal) {
        var repdex = termlist.indexOf(terminal);
        if (repdex < 0)
            termlist.push(terminal);
        takePending();                                                      // output all pending terminal messages
    };
    
    //
    // Detach
    //
    // Detach the terminal from the interpreter.
    //
    
    this.Detach = function Detach(terminal) {
        var repdex = termlist.indexOf(terminal);
        if (repdex >= 0)
            termlist.splice(repdex, 1);
        if (termlist.length === 0)
            replstate = terminal.StateSave();                               // save ultimate repl state
    };
    
    //
    // Interrupt
    //
    // Interrupt the interpreter in response to a user request.
    //
    
    this.Interrupt = function Interrupt(terminal) {
        window.setTimeout(function () {
            naanlib.escape();
        }, 1);
    };

    //
    // Return
    //
    // Enter line of text to instance.
    //
    
    this.Return = function Return(text, terminal) {
        termlist.forEach(function(term) {
            if (term !== terminal)
                term.OnMessage({                                            // send text to other terminals
                    id: "textout",
                    text: "\x1b[90m\x1b[3m" + text + "\x1b[0m" + "\r\n"
                });
        });
        window.setTimeout(function () {
            naanlib.textLine(text);
        }, 1);
    };

    this.ReplyMessage = function ReplyMessage(data) {                       // "remote" -> "local"
        termlist.forEach(function(term) {
            if (term.OnMessageOut)
                term.OnMessageOut(data);
        });
        return (data);
    };
    
    var nideListener;
    this.OnMessage = function OnMessage(proc) {
        nideListener = proc;
        return (proc);
    };
    
    this.DispatchMessage = function DispatchMessage(data) {                 // "local" -> "remote"
        if (nideListener)
            setTimeout(function() {
                nideListener(data);
            }, 1);
    };

    this.ReplyDebugger = function ReplyDebugger(data) {                     // "remote" -> "local"
        termlist.forEach(function(term) {
            if (term.OnDebugOut)
                term.OnDebugOut(data);
        });
        return (data);
    };

    var debugListener;
    this.OnDebugger = function OnDebugger(proc) {
        debugListener = proc;
        return (proc);
    };
    
    this.DispatchDebugger = function DispatchDebugger(data) {               // "local" -> "remote"
        if (debugListener)
            setTimeout(function() {
                debugListener(data);
            }, 1);
    };

    //
    // Status
    //
    // Report status to the terminal.
    //
    
    setInterval(function() {
        var samples = naanlib.status(1);
        if (samples.length > 0)
            termlist.forEach(function(term) {
                if (term.OnStatus)
                    term.OnStatus({                                         // send status dictionary without ID
                        sample: samples[0]
                    });
            });
    }, 1000);

    //
    // Keystroke
    //
    // Enter keystroke to instance.
    //
    
    this.Keystroke = function Keystroke(text, keycode) {
        console.log("Naan keystroke mode not implemented");
    };
    
    //
    // Dimensions
    //
    // Report terminal dimensions to instance.
    //
    
    this.Dimensions = function Dimensions(rows, cols) {
        console.log("Naan terminal dimensions now (" + rows + ", " + cols + ")");
    };
    
    //
    // VsiteRefresh
    //
    // Check if our underlying data has changed, and reload if needed.
    //
    
    this.VsiteRefresh = function VsiteRefresh(url_origin) {
        if (window.location.href.startsWith(url_origin))
            window.location.reload();                                       // we have changed underneath
    };


    //==========================================================================
    // Clone Debug Interface
    //--------------------------------------------------------------------------

    function CloneDebugTerminal()
    {
        var termSelf = this;
        //
        // listen for messages
        //
        window.addEventListener("message", function (event) {
            if (event.origin !== window.origin)
                return;                                                     // only talk with our peers
            var msg = event.data;
            if (msg.id == "interrupt")
                contSelf.Interrupt();
            else if (msg.id == "keyline")
                contSelf.Return(msg.text, termSelf);                        // keyboard text from terminal
            else if (msg.id == "start")
                contSelf.Attach(term);                                      // opener is ready
            else if (msg.id == "import")
            {                                                               // for workers
            }
            else if (msg.id == "targetin")
            {
                if (nideListener)
                    nideListener(msg.data);                                 // target received a message
            }
            else if (msg.id == "debugin")
            {
                if (debugListener)
                    debugListener(msg.data);                                // target received a message
            }
        });
        
        //
        // report messages back to opener
        //
        termSelf.OnMessage = function OnMessage(msg) {
            window.opener.postMessage(msg, window.origin);
            return (msg);
        };
                
        //
        // report messages back to opener
        //
        termSelf.OnMessageOut = function OnMessageOut(data) {
            var msg = {                                                       // target is sending debug data
                id: "targetout",
                data: data
            };
            return (termSelf.OnMessage(msg));
        };

        //
        // report debug messages back to opener
        //
        termSelf.OnDebugOut = function OnDebugOut(data) {
            var msg = {                                                       // target is sending debug data
                id: "debugout",
                data: data
            };
            return (termSelf.OnMessage(msg));
        };
        
        //
        // report status back to opener
        //
        termSelf.OnStatus = function OnStatus(status) {
            var msg = {                                                       // target is sending debug data
                id: "status",
                status: status
            };
            return (termSelf.OnMessage(msg));
        };
    }
 
    //==========================================================================
    // Host Environment
    //--------------------------------------------------------------------------
 
    //
    // SavePref
    //
    // Save a persistent preference object that can be retrieved in the future.
    //
    
    this.SavePref = function SavePref(key, value) {
        return (prefs[key] = value);
    };
 
    //
    // LoadPref
    //
    // Load a previously-saved preference object for future retrieval.
    //
    
    this.LoadPref = function LoadPref(key) {
        return (prefs[key]);
    };
 
    var saveEvent = new Event("NaanSave");
 
    window.document.addEventListener("visibilitychange", function (e) {
        if (window.document.visibilityState != "hidden")
            return;
        window.dispatchEvent(saveEvent);
        saveLocal();
    });

    window.addEventListener("pagehide", function (e) {
        window.dispatchEvent(saveEvent);
        saveLocal();
    });
  
    window.addEventListener("unload", function (e) {
        window.dispatchEvent(saveEvent);
        saveLocal();
        virtualClose();
    });
 
    window.addEventListener("beforeunload", function (e) {
        window.dispatchEvent(saveEvent);
        saveLocal();
    });

    function makeState() {
        var statedoc = {};
        statedoc.curversion = kStateCurrentVersion;
        statedoc.firstver = kStateFirstVersion;
        statedoc.licensee = "$Licensee$";
        statedoc.verstring = "$Version$";
        statedoc.date = new Date().toISOString();
        statedoc.prefs = prefs;
        statedoc.naan = naanlib.saveState(false);                           // true to optimize, which is a bit slower
        termlist.forEach(function(term) {
            if (!replstate || term.termwin)
                replstate = term.StateSave();                               // state with separate window, otherwise any state
        });
        if (replstate)
            statedoc.replstate = replstate;
        return (statedoc);
    }
 
    function loadState(statedoc) {
        if (statedoc===undefined || statedoc.naan === undefined
            || statedoc.firstver > kStateCurrentVersion
            || statedoc.curversion < kStateFirstVersion
            || statedoc.licensee != "$Licensee$"
            || statedoc.verstring != "$Version$")
        {
            localStorage.removeItem("NaanState_Hosted");
            return (false);
        }
        naanstate = statedoc.naan;
        replstate = statedoc.replstate;                                     // get terminal state, if any
        if (typeof(statedoc.prefs) == "object")
            prefs = statedoc.prefs;
        return (true);
    }
 
    function saveLocal() {
        /*jshint sub:true */
        if (querystrings["nosave"])
            return (false);
        var statedoc = makeState();
        var statestr = JSON.stringify(statedoc);
        try {
            if ("localStorage" in window && window["localStorage"] !== null)
            {
                localStorage.removeItem("NaanState_Hosted");
                if (localStorage.setItem("NaanState_Hosted", statestr) !== undefined)
                    return (true);
            }
        } catch(e) {
            console.log("save state failed: " + "(" + e + ")");
        }
        return (false);
    }
  
    function loadLocal() {
        try {
            /*jshint sub:true */
            if ("localStorage" in window && window["localStorage"] !== null)
            {
                var statestr = localStorage.getItem("NaanState_Hosted");
                if (statestr)
                    return (loadState(JSON.parse(statestr)));
            }
        } catch(e) {
            termTextOut("load state failed: " + "(" + e + ")");
        }
        return (false);
    }
        
    function virtualOpen() {
        vsiteName = window.document.title;                                  // consistent name at open and close
        if (window.opener && window.opener.Naanlang)
            window.opener.Naanlang.naancon.DispatchMessage({
                op: "VsiteOpen",
                name: vsiteName,
                naancont: contSelf
            });
    }
    
    function virtualClose() {
        if (window.opener && window.opener.Naanlang) {
            window.opener.Naanlang.naancon.DispatchMessage({
                op: "VsiteClose",
                name: vsiteName,
                naancont: contSelf
            });
            termTextOut("\x1b[90m\x1b[3m".concat("\nwindow closed", "\x1b[0m\n"));
        }
    }

    /*jshint sub:true */
    if (querystrings["restart"] || !loadLocal())
    {                                                                       // don't load state or can't load state
        naanlib.banner();
        var hostpath = naanlib.js.r("path").dirname(window.location.href);
        naanlib.start({
            cmd: 'Naan.module.webparse("naan_init.nlg", "' + hostpath + '"' + ');;\r\n'
        });
    } else {
        if (!replstate) {                                                   // saved state but never opened a terminal
            naanlib.banner();
            naanlib.textLine("print();;\n");
        }
        naanlib.start({
            state: naanstate
        });
    }

    if (window.opener) {
        virtualOpen();
        var term = new CloneDebugTerminal();
        term.OnMessage({
            id: "loaded"
        });
    }
};

/*jshint sub:true */
})(typeof exports === 'undefined'?(this.Naanlang?this.Naanlang:this.Naanlang={}) : exports);

new Naanlang.NaanControllerWeb();
