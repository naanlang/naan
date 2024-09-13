/*
 * env_webworker.js
 * Naanlib
 *
 *     Host Naan in the Browser worker environment.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2019-2024 by Richard C. Zulch
 *
 */


/*
 * Initialize
 *
 */

importScripts(
    
    "lib/core/naanlib.js"
);


(function(exports){


/*
 * NaanControllerWebWorker
 *
 *     This is the Web worker that executes Naan.
 *
 */

exports.NaanControllerWebWorker = function NaanControllerWebWorker() {

    "use strict";
    /*jshint -W024 */
    var undefined;                                                          // should be a keyword

    //
    // Initialization
    //

    var naanlib = new Naanlang.Naanlib();
    var targSelf = this;                                                    // this is us, for access within nested functions
    targSelf.anaan = naanlib.js.n;
    naanlib.js.t = targSelf;
    
    //
    // Communications
    //

    naanlib.onText(function(text, level) {
        if (level)
            postMessage({
                id: "debugtext",
                text: text,
                level: level
            });
        else
            postMessage({
                id: "textout",
                text: text
            });
    });
        
    setInterval(function() {
        var samples = naanlib.status(1);
        if (samples.length > 0)
            postMessage({                                                   // periodic worker status
                id: "status",
                status: {
                    sample: samples[0]
                }
            });
    }, 1000);

    targSelf.ReplyMessage = function ReplyMessage(data) {
        postMessage({                                                       // target is sending a message
            id: "targetout",
            data: data
        });
        return (data);
    };

    var targetListener;
    targSelf.OnMessage = function OnMessage(proc) {
        targetListener = proc;
        return (proc);
    };

    this.DispatchMessage = function DispatchMessage(data) {
        postMessage({                                                       // target is sending a message
            id: "targetsend",
            data: data
        });
        return (data);
    };

    var targetReceiver;
    targSelf.OnReceive = function OnReceive(proc) {
        targetReceiver = proc;
        return (proc);
    };

    targSelf.ReplyDebugger = function ReplyDebugger(data) {
        postMessage({                                                       // target is sending debug data
            id: "debugout",
            data: data
        });
        return (data);
    };

    var debugListener;
    targSelf.OnDebugger = function OnDebugger(proc) {
        debugListener = proc;
        return (proc);
    };

    targSelf.Download = function Download(bits, name, options) {
        postMessage({                                                       // tell browser host to download a file
            id: "download",
            bits: bits,
            name: name,
            options: options,
        });
        return (name);
    };

    targSelf.Terminate = function Terminate(result) {
        postMessage({                                                       // terminate this worker from worker
            id: "termination",
            result: result
        });
        close();
        return (result);
    };

    onmessage = function(e) {
        var msg = e.data;
        if (msg.id == "interrupt")
            naanlib.escape();
        else if (msg.id == "keyline")
            naanlib.textLine(msg.text);                                     // keyboard text from terminal
        else if (msg.id == "start")
        {                                                                   // start execution with optional state
            naanlib.banner();
            naanlib.start({
                state: msg.state,
                cmd: msg.altcmd
            });
        }
        else if (msg.id == "import")
            importScripts(msg.script);                                      // load any desired script
        else if (msg.id == "targetin")
        {
            if (targetListener)
                targetListener(msg.data);                                   // target received a message
        }
        else if (msg.id == "debugin")
        {
            if (debugListener)
                debugListener(msg.data);                                    // target received a message
        }
        else if (msg.id == "targetreceive")
        {
            if (targetReceiver)
                targetReceiver(msg.data);
        }
    };
    
    //
    // Initialization complete
    //

    postMessage({
        id: "loaded"
    });
};

})(typeof exports === 'undefined'?(this.Naanlang?this.Naanlang:this.Naanlang={}) : exports);

new Naanlang.NaanControllerWebWorker();
