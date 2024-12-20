**NaaN**™
-----

NaaN is an async-first software platform for rapid development.

#### Release:
     **NaaN for NPM** version **1.4.3+1**  
     Copyright (c) 2017-2024 Zulch Laboratories, Inc.

#### Features
- **NaaN** runs in NodeJS and web browsers using JavaScript
- Based on an asynchronous LISP-2 engine with persistent execution
- The default **Lingo**™ surface language provides familiar Algol-style braces syntax
- Fiber-based concurrent execution without async or await declarations
- Provides tuples, objects, closures, macros, lexical and dynamic binding
- Module and package support with namespaces and write-protect isolation
- Preserves referential integrity when communicating among workers or hosts
- Plugin architecture enables alternate languages and functionality
- Custom language syntax can be added through simplified dialect extensions
- Integrates transparently with all existing JavaScript libraries
- Can save and reload running program state across page loads or lambda invocations
- Lightweight and efficient

#### Installation

Please ensure you have a recent version of [node.js](http://nodejs.org/). The minimum is `v16.20.2`

For use everywhere as a command line app:

    sudo npm install @naanlang/naan -g

For use as a library in the current project:

    sudo npm install @naanlang/naan

#### Command line execution

    naan [options] [source file] [arguments]

With no arguments NaaN runs as an interactive REPL using the node.js terminal.  
It can also evaluate an expression or execute a source file.

##### Command line usage

    -e <expression>             evaluate an expression
    -i, --interactive           use REPL with -e or [source file]
    --version                   print NaaN version
    --buildno                   print NaaN version with build number
    -h, --help                  print usage information

NaaN prints the results of evaluating each expression with the REPL, but not
by default with an expression or source file. The interactive flag overrides
this to print the result of each expression in all cases.

##### Example shell commands

Define a function, call it, and return the length of the base-10 result. First recursive and then tail recursive:

```
% naan -e "function fact(x){if x>0 x*fact(x-1) else 1}(1000).length"
2568
% naan -e "function factr(x,a){if x>0 factr(x-1,x*a) else a}(10000,1).length"
35660
```
Fetch your public IP from a website (NodeJS version 18 or later):

```
% naan -e "new(await(await((js.g||js.w).fetch('https://api.ipify.org/?format=json')).1.json()).1)"
{ ip: "64.205.147.202" }
```


##### Shell scripting

When installed globally, NaaN can be used for shell scripts with the [Shebang](https://en.wikipedia.org/wiki/Shebang_(Unix))
mechanism. For example, copy the following text to a file named helloworld:

    #!/usr/bin/env naan
    printline("Hello World")

Now make it executable with chmod:

    chmod a+x helloworld

#### For More Information

[www.naanlang.org](https://www.naanlang.org) has tutorials, explanations, and how-to articles.  
The [NaanIDE](https://www.npmjs.com/package/@naanlang/naanide) installation includes reference documentation.  
Please email [Richard Zulch](mailto:naanlang@zulchlabs.com) with questions and comments.

#### Dependencies:
We gratefully acknowledge these software packages used with NaaN:  
- [jszip.js](http://stuartk.com/jszip) - read and write zip files  
- [NodeJS-path](https://nodejs.org/) - NodeJS path utilities  
- [PouchDB](https://pouchdb.com/) - synchronizing database  
- [SparkMD5](https://github.com/satazor/js-spark-md5) - browser MD5 library  
- [UglifyJS](https://github.com/mishoo/UglifyJS) - JavaScript code minifier  
