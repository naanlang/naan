/*
 * env_nodeworker.js
 * Naanlib
 *
 *     Host Naan in the NodeJS worker thread environment.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2019-2021 by Richard C. Zulch
 *
 */


/*
 * NaanWorkerActivate
 *
 *     Activate a new worker.
 *
 */

exports.NaanWorkerActivate = function NaanWorkerActivate(cbReady) {
    
    // initialize

    var threads = require('worker_threads');
    threads.parentPort.once('message', function (value) {
        var naancon = new NaanControllerNodeWorker(value.hereIsYourPort);
        cbReady(naancon);
    });
    
    /*
     * NaanControllerNodeWorker
     *
     *     This is the Node worker that executes Naan.
     *
     */
    
    function NaanControllerNodeWorker(msgPort) {
    
        "use strict";
        /*jshint -W024 */
        var undefined;
    
        //
        // Initialization
        //
    
        var Naanlang = require('./core/naanlib');
        var naanlib = new Naanlang.Naanlib();
        var workSelf = this;
        workSelf.anaan = naanlib.js.n;
        naanlib.js.t = workSelf;
    
    
        //==========================================================================
        // API
        //--------------------------------------------------------------------------
    
        this.setRequire = function setRequire(req) {                        // override require function
            naanlib.js.r = req;
        };
    
        this.setDirectory = function setDirectory(path) {                   // override base directory
            naanlib.js.d = path;
        };
        
        this.textCommand = function textCommand(cmd) {                      // send a command
            naanlib.textLine(cmd);
        };
    
    
        //==========================================================================
        // NodeJS Worker Terminal Interface
        //--------------------------------------------------------------------------
    
        naanlib.onText(function(text, level) {
            if (level)
                msgPort.postMessage({
                    id: "debugtext",
                    text: text,
                    level: level
                });
            else
                msgPort.postMessage({
                    id: "textout",
                    text: text
                });
        });
    
        setInterval(function() {
            var samples = naanlib.status(1);
            if (samples.length > 0)
                msgPort.postMessage({                                       // periodic worker status
                    id: "status",
                    status: {
                        sample: samples[0]
                    }
                });
        }, 1000);
        
        workSelf.ReplyMessage = function ReplyMessage(data) {
            msgPort.postMessage({                                           // worker is sending a message
                id: "targetout",
                data: data
            });
            return (data);
        };
        
        var workerListener;
        workSelf.OnMessage = function OnMessage(proc) {
            workerListener = proc;
            return (proc);
        };
            
        workSelf.ReplyDebugger = function ReplyDebugger(data) {
            msgPort.postMessage({                                           // target is sending debug data
                id: "debugout",
                data: data
            });
            return (data);
        };
    
        var debugListener;
        workSelf.OnDebugger = function OnDebugger(proc) {
            debugListener = proc;
            return (proc);
        };
    
        msgPort.on("message", function(msg) {
            if (msg.id == "interrupt")
                naanlib.escape();                                           // interrupt request from terminal
            else if (msg.id == "keyline")
                naanlib.textLine(msg.text);                                 // keyboard text from terminal
            else if (msg.id == "start")
            {                                                               // start execution with optional state
                if (typeof(__dirname) !== "undefined")
                    naanlib.js.h = naanlib.js.d;                            // set host directory path
                if (msg.dirpath)
                    naanlib.js.d = msg.dirpath;                             // set owner directory path
                naanlib.start({
                    state: msg.state,
                    cmd: msg.altcmd
                });
            }
            else if (msg.id == "import")
                importScripts(msg.script);                                  // load a JavaScript
            else if (msg.id == "targetin")
            {
                if (workerListener)
                    workerListener(msg.data);                               // worker received a message
            }
            else if (msg.id == "debugin")
            {
                if (debugListener)
                    debugListener(msg.data);                                // target received a message
            }
        });
        
        msgPort.postMessage({
            id: "loaded"                                                    // initialization complete
        });
        naanlib.banner();
    }

};
