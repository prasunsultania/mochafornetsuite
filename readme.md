# Mocha For NetSuite

It is a unit test framework for NetSuite.

NetSuite lacks a unit testeing framework. This repo bridges that gap by exploiting existing open source libraries - Mochajs and Chaijs.

Tests can be ran in the context of Suitelet or Scheduled Script.

## What kind of scripts can you test using this framework?

You should write your scripts more as a library which can run in the context of any script (to be more specific - suitelet and scheduled script). You can then load these libraries in the context of suitelet or scheduled script and then write tests for it. For testing user events you may simply want to create, update or delete the record and then do some assertions based on your expectations.

## Getting Started

### A. Create Your Script
1. Create a Suitelet or a Scheduled Script
2. Entry function name - "suite.test.SuiteRunner.suiteletEntry" for Suitelet and "suite.test.SuiteRunner.scheduledEntry" for a Scheduled Script.
3. Script file  - "suite.test.runner.js"
4. Add Library files exactly in the order
    1. suite.utils.lodash.js
    2. suite.utils.utils.js
    3. suite.utils.eventEmitter.js
    4. suite.utils.fs.js
    5. suite.test.chai.js
    6. suite.test.reporter.js
    7. suite.test.mocha.js
    8. suite.test.sinon.js (optional, if you want to write test spies, stubs and mocks)
    9. suite.test.fakedate.js  (optional)
5. If you are creating scheduled Script, create three parameters
    1. Email Receipients CC, Id: "custscript_suite_test_emails" of type free-form-text. value must be an Array, eg: ["you@example.com"]
    2. Unite Test Suite Files Id:custscript_suite_test_files, of type free-form-text. Value must be an Array, eg: ["suite.testsuite.credstoresuites.js", "suite.testsuite.suite1.js"]
    3. Email To Employee: Id "custscript_suite_test_email_to" of type List/Record pointing to Employee

### B. Create Folders
1. "testsuites" under standard folder "suitescripts". It assumes all testsuites/test files are located in this folder.

### B. Writing tests
1. Make sure all libraries that needs to be loaded are in folder
2. Refer to the example code example/suite.testsuite.example1.js on how to include test libraries and for a sample testuite
3. For more on syntax of testuite please refer https://mochajs.org/ .Beware, asynchrnous tests are not supported. Also, the reporters are not supported.
4. For more on syntax of assertions please refer http://chaijs.com/

### TODO
1. Better UI for suitelet :)
2. Support for SuiteScript 2.0
