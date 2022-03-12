**Naan**™
-----

Naan is an async-first software platform for rapid development.

#### Release:
     Naan for NPM version 1.0.0-1
     Copyright (c) 2017-2022 Zulch Laboratories, Inc.

#### Features
- **Naan** runs in NodeJS and web browsers using JavaScript
- Based on an asynchronous LISP-2 engine with persistent execution
- The default **Lingo**™ surface language provides familiar Algol-style braces syntax
- Concurrent operation without async or await declarations
- Provides tuples, objects, closures, macros, lexical and dynamic binding
- Module and package support with namespaces and write-protect isolation
- Preserves referential integrity when communicating among workers or hosts
- Plugin architecture enables alternate languages and functionality
- Custom language syntax can be added through simplified dialect extensions
- Integrates transparently with all exising JavaScript libraries
- Can save and reload running program state across page loads or lambda invocations
- Lightweight and efficient

#### Installation

Please ensure you have a recent version of [node.js](http://nodejs.org/)

For use everywhere as a command line app:

    npm install naan -g

For use as a library in the current project:

    npm install naan

#### Command line usage

    naan

##### Dependencies:
     We greatfully acknowlege these software packages used with Naan:
- [jszip.js](http://stuartk.com/jszip) - read and write zip files
- [NodeJS-path](https://nodejs.org/) - NodeJS path utilities
- [PouchDB](https://pouchdb.com/) - synchronizing database
- [SparkMD5](https://github.com/satazor/js-spark-md5) - browser MD5 library
- [UglifyJS](https://github.com/mishoo/UglifyJS) - JavaScript code minifier
