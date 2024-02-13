/*
 * lambda_rest_index.js
 * serviceAws
 *
 *     AWS Lambda startup code for REST interfaces.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2019-2023 by Richard C. Zulch
 *
 */

/*
 * awsHandler
 *
 * Execute Naan in an AWS REST Lambda.
 *
 */

var save_naanlib;

exports.handler = function awsHandler(event, context, callback) {
    logOut("awsHandler: " + context.awsRequestId.toString());

    "use strict";
    /*jshint -W024 */
    var undefined;

    //
    // Initialization
    //
    
    var Naan = require('/opt/core/naanlib');
    var naanlib;
    if (save_naanlib) {
        naanlib = save_naanlib;
        logOut("naanlib reused");
    }
    else {
        save_naanlib = naanlib = new Naan.Naanlib();
        logOut("naanlib built");
    }
    var servSelf = this;

    //==========================================================================
    // AWS Lambda interface
    //--------------------------------------------------------------------------

    //
    // respond
    //

    function respond(message, response)
    {
        callback(message, response);
    }

    naanlib.js.lambda = {
        event:      event,
        context:    context,
        respond:    respond,
        id:         context.awsRequestId.toString(),
        aws:        require('aws-sdk')
    };

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
    
    this.textCommand = function textCommand(cmd) {                          // send a command without echo
        logOut("command:" + cmd);
        naanlib.textLine(cmd);
    };

    //==========================================================================
    // NodeJS Terminal Interface
    //--------------------------------------------------------------------------
    
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
        console.log(levelstr + " " + text);
    }

    //
    // Interpreter's console/debug output
    //

    naanlib.onText(function (text, level) {
        if (level)
            logOut(text, level);
        else
            console.log(text);
    });
    
    
    //==========================================================================
    // Start the Naan Interpreter
    //--------------------------------------------------------------------------

    naanlib.banner();
    naanlib.start();
    var path = require("path").resolve(__dirname, './lambda_rest_init.nlg');
    this.textCommand("nodeparse('" + path + "');\n");
    logOut("completed" + naanlib);
};
