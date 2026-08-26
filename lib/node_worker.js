/*
 * node_worker.js
 * naanide
 *
 *     Start a Naanide worker.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2017-2026 by Richard C. Zulch
 *
 */

"use strict";


/*
 * Begin
 *
 */

var workerData = require('node:worker_threads').workerData || { };          // passed from creator
var jspath = require("path");
var naanpath = jspath.resolve(require.resolve('@naanlang/naan'), '../../../');
var envpath = jspath.resolve(naanpath, 'lib/env_nodeworker.js');
var naanenv = require(envpath);

naanenv.NaanWorkerActivate(function(naanworker) {
    naanworker.setRequire(require);                                         // require relative to this file
    naanworker.setImport(function(m) { return (import(m)); });              // import relative to this file
    
    naanworker.textCommand(""
        + `App.naanpath = '${ naanpath.replace(/\\/g, "\\\\") }';;`         // path/to/our naan library
        + "App.rootpath = js.d;;"                                           // path/to/our package.json
        + "Naan.module.defineLoc('naanlib', App.naanpath);;"                // defines "naanlib:" prefix for require
        + "Naan.module.nodeparse('lib/node_worker_init.nlg');;\n");         // Naan initialization
});
