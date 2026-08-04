/*
 * env_webworker.js
 * Naanlib
 *
 *     Host Naan in the Browser worker environment.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2019-2026 by Richard C. Zulch
 *
 */


/*
 * Initialize
 *
 */

importScripts(
    
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
    var workerMetadata = { };

    //
    // Communications
    //

    targSelf.metadata = function metadata() {                               // our creation metadata
        return (workerMetadata);
    };

    naanlib.onText(function(text, level) {
        if (level)
            postMessage({
                scope: "naan-env-web",
                id: "debugtext",
                text: text,
                level: level
            });
        else
            postMessage({
                scope: "naan-env-web",
                id: "textout",
                text: text
            });
    });
        
    setInterval(function() {
        var samples = naanlib.status(1);
        if (samples.length > 0)
            postMessage({                                                   // periodic worker status
                scope: "naan-env-web",
                id: "status",
                status: {
                    sample: samples[0]
                }
            });
    }, 1000);

    targSelf.ReplyMessage = function ReplyMessage(data) {
        postMessage({                                                       // target is sending a message
            scope: "naan-env-web",
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
            scope: "naan-env-web",
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
            scope: "naan-env-web",
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
            scope: "naan-env-web",
            id: "download",
            bits: bits,
            name: name,
            options: options,
        });
        return (name);
    };

    targSelf.Terminate = function Terminate(result) {
        postMessage({                                                       // terminate this worker from worker
            scope: "naan-env-web",
            id: "termination",
            result: result
        });
        close();
        return (result);
    };

    addEventListener("message", function(e) {
        var msg = e.data;
        if (msg.scope != "naan-env-web")
            return;
        if (msg.id == "interrupt")
            naanlib.escape();
        else if (msg.id == "keyline")
            naanlib.textLine(msg.text);                                     // keyboard text from terminal
        else if (msg.id == "typed")
            echoTyped(msg.text);
        else if (msg.id == "start")
        {                                                                   // start execution with optional state
            targSelf.workerID = msg.workerID;
            targSelf.workerGUID = msg.workerGUID;
            workerMetadata = msg.metadata || { };
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
        else if (msg.id == "attached")
            targSelf.ioctl_event("term-attach", msg.guid);
        else if (msg.id == "detached")
            targSelf.ioctl_event("term-detach", msg.guid);
        else if (msg.id == "ioctl-event")
            targSelf.ioctl_event(msg.msg, msg.arg);
    });

    //==========================================================================
    // ioctl terminal control
    //--------------------------------------------------------------------------

    var listeners = { };

    //
    // ioctl_event
    //
    // Events incoming from terminal.
    //

    targSelf.ioctl_event = function ioctl_event(msg, arg) {
        if (listeners[msg])
            listeners[msg].forEach(function(proc) {
                proc(msg, arg);
            });
    };

    //
    // ioctl_add_listener
    // ioctl_remove_listener
    //
    // Add a listener for a terminal event.
    //

    targSelf.ioctl_add_listener = function ioctl_add_listener(msg, proc) {
        if (typeof(msg) != "string" || typeof(proc) != "function")
            return (false);
        targSelf.ioctl_remove_listener(msg, proc);
        if (!listeners[msg])
            listeners[msg] = [];
        listeners[msg].push(proc);
        return (true);
    };

    targSelf.ioctl_remove_listener = function ioctl_remove_listener(msg, proc) {
        if (typeof(msg) != "string" || typeof(proc) != "function")
            return (false);
        if (listeners[msg]) {
            var index = listeners[msg].indexOf(proc);
            if (index >= 0)
                listeners[msg].splice(index, 1);
        }
        return (true);
    };

    //
    // ioctl
    //
    // Control of terminals (and their controller.)
    //

    targSelf.ioctl = function ioctl(op, arg) {
        postMessage({
            scope: "naan-env-web",
            id: "ioctl",
            op: op,
            arg: arg
        });
    };

    //
    // Initialization complete
    //

    postMessage({
        scope: "naan-env-web",
        id: "loaded"
    });
};

})(typeof exports === 'undefined'?(this.Naanlang?this.Naanlang:this.Naanlang={}) : exports);

new Naanlang.NaanControllerWebWorker();
