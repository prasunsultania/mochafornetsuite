$.namespace('suite.test');
$.SuiteReporter = suite.test.reporter = function(runner, output){
	  var self = this;

	  var tests = []
	    , failures = []
	    , passes = [];

	  var emitter = $.SuiteReporter.EventEmitter;

	  runner.on('test end', function(test){
		//nlapiLogExecution('DEBUG', 'Test Ended - test object', test.inspect());

	    emitter.emitEvent('test end', [test]);
	  });

	  runner.on('pass', function(test){
	    nlapiLogExecution('DEBUG', 'Test Pass - test object', test.inspect());
	    passes.push(JSON.parse(test.inspect()));
	    tests.push({
	    	title: test.title,
	    	suite: test.parent.title
	        , fullTitle: test.fullTitle()
	        , duration: test.duration,
	        state: test.state
	    });
	    emitter.emitEvent('test end', [test]);
	  });

	  runner.on('fail', function(test, err){
	    nlapiLogExecution('DEBUG', 'Test Failure - test object', err);
	    tests.push({
	    	title: test.title,
	    	suite: test.parent.title
	        , fullTitle: test.fullTitle()
	        , duration: test.duration,
	        state: test.state,
	        err: err.toString()
	    });
	    failures.push(JSON.parse(test.inspect()));
	    emitter.emitEvent('test end', [test]);
	  });

	  runner.on('end', function(){
	    //nlapiLogExecution('DEBUG', 'end of tests', _.keys(tests[0]));
	    //nlapiLogExecution('DEBUG', 'end of tests', JSON.stringify(tests[0].ctx));
		emitter.emitEvent('end', [tests, passes, failures]);
	  });
}

$.SuiteReporter.EventEmitter = new $.EventEmitter();
