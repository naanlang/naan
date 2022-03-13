#!/usr/bin/env node
/*
 * index.js
 * Naanlib
 *
 *     Naan command line.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2021-2022 by Richard C. Zulch
 *
 */

"use strict";

/*
 * imports
 *
 */

var path = require("path");
var fs = require("fs");
var naanOptions;

/*
 * Process command-line arguments
 *
 */

var cmd_file;
var eval_text;
var do_interactive;
var cmd_text = "nodeparse('node_repl_init.nlg');;\n";

process.argv.forEach((val, index) => {
    if (index < 2)
        return;
    if (val == "-e") {
        eval_text = 1;
        return;
    }
    if (val == "-h" || val == "--help") {
        console.log(
            "Usage: naan [options] [source file] [arguments]\n\n" +
            "Options:\n" +
            "  -e <expression>      evaluate an expression\n" +
            "  -i, --interactive    use REPL with -e or [source file]\n" +
            "  -v, --version        print the Naan version\n" +
            "  -vv                  print the version and build\n"
        );
        process.exit(0);
    }
    if (val == "-i" || val == "--interactive") {
        do_interactive = true;
        return;
    }
    if (val == "-v" || val == "--version") {
        console.log("1.0.1");
        process.exit(0);
    }
    if (val == "-vv") {
        console.log("1.0.1-2");
        process.exit(0);
    }
    if (val.substring(0,1) == "-") {
        console.log("naan: bad option: " + val);
        process.exit(9);
    }
    if (eval_text) {
        if (eval_text == 1)
            eval_text = val + '\n';
        return;
    }
    if (!cmd_file) {
        cmd_file = val;
        return;
    }
    // ignore extra arguments
});

if (eval_text == 1) {
    console.log("naan: -e requires an argument");
    process.exit(9);
}
if (cmd_file) {
    if (!fs.existsSync(cmd_file)) {
        console.log("naan: file not found: " + cmd_file);
        process.exit(1);
    }
    eval_text = fs.readFileSync(cmd_file, "utf8");
    eval_text = eval_text.replace(/^#!.*\n/, "");
}
if (eval_text) {
    if (!do_interactive)
        naanOptions = { replDisable: true };
    cmd_text =
        "closure NodeREPL(local input, error, expr) {\n" +
        (do_interactive ?
        ""
        :
        "   sudo(putproc(`exception, false))\n") +
        "   input = new(textstream, js.expr)\n" +
        "   try {\n" +
        "       loop {\n" +
        "           `(error, expr) = Dialect.parse(input)\n" +
        "           if error {\n" +
        "               printline(' ==> parse error: ', Dialect.parseErrorString(error.0))\n" +
        "               break\n" +
        "           } else\n" +
        (cmd_file && !do_interactive ?
        "               eval(expr)\n"
        :
        "           {\n" +
        "               if input.tokenlast().atom == `;;\n" +
        "                   eval(expr)\n" +
        "               else if input.tokenlast().atom == `;>\n" +
        "                   printline(eval(expr))\n" +
        "               else\n" +
        "                   printline(Dialect.print(eval(expr)))\n" +
        "           }\n") +
        "       }\n" +
        "   } catch {\n" +
        "       if true {\n" +
        "           if exception != `(internal, 'end-of-file')\n" +
        "               printline(' ==> exception: ', error = exception)\n" +
        "       }\n" +
        "   } finally {\n" +
        "       sleep(1)\n" +
        "       exec(quote(js.g.process.exit(if error 1 else 0)))\n" +
        "   }\n" +
        "}();;\n";
}


/*
 * Execute Naan
 *
 */

var NaanNodeREPL = require('../lib/env_node.js');
var naanrepl = new NaanNodeREPL(naanOptions);
naanrepl.setDirectory(path.join(__dirname, "../lib"));
if (eval_text)
    naanrepl.setGlobal("expr", eval_text + "\n");
naanrepl.textCommand(cmd_text);
