/*
 * node_test.js
 * Naanlib
 *
 *     Conduct unit tests using a Naan repl in Node.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2021 by Richard C. Zulch
 *
 */

"use strict";


/*
 * Begin
 *
 */

var NaanNodeREPL = require('../lib/env_node.js');
var jspath = require("path");

var naanrepl = new NaanNodeREPL({
    replDisable: true
});

naanrepl.setDirectory(__dirname);

naanrepl.textCommand("body("
    + "nodeparse('harness.nlg'),"
    + "sleep(1),"
    + "exec(quote(js.g.process.exit(0))));;\n");
