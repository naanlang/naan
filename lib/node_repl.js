/*
 * node_repl.js
 * Naanlib
 *
 *     Provide a Naan repl in Node.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2021-2022 by Richard C. Zulch
 *
 */

"use strict";


/*
 * Begin
 *
 */

var NaanNodeREPL = require('./env_node.js');

var naanrepl = new NaanNodeREPL();
naanrepl.setDirectory(__dirname);
naanrepl.textCommand("nodeparse('node_repl_init.nlg');;\n");
