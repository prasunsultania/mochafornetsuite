$.namespace('suite.test');

suite.test.testLibraries = [];

suite.test.SuiteRunner = {
	scheduledEntry: function(){

		var fileNames,
			recipients,
			html;

		try{
			fileNames = JSON.parse(nlapiGetContext().getSetting('SCRIPT', 'custscript_suite_test_files'));
		} catch(ex){
			throw new nlapiCreateError('SUITE_PARAM_ERROR', 'Failed to parse fileNames. Make sure Files string is a valid JSON');
		}

		try{
			recipients = JSON.parse(nlapiGetContext().getSetting('SCRIPT', 'custscript_suite_test_emails'));
		} catch(ex){
			throw new nlapiCreateError('SUITE_PARAM_ERROR', 'Failed to parse recipients. Make sure emails string is a valid JSON');
		}

		//Current assumption is No scheduling required
		//If the tests are going to consume excessive points, consider manually creating multiple deployments instead
		var testResults = suite.test.SuiteRunner.runTests({
			fileNames : fileNames
		});

		html = '<table border="1" cellspacing="0" cellpadding="5">' +
			'<thead>' +
			'<tr><td>Title</td><td>Suite</td><td>Duration</td><td>State</td><td>Error</td>' +
			'</thead>';

		_.each(testResults, function(result){
			html += '<tr>' +
				'<td>' + result.title + '</td>' +
				'<td>' + result.suite + '</td>' +
				'<td>' + result.duration + '</td>' +
				'<td>' + result.state + '</td>' +
				'<td>' + (result.err || '') + '</td>';
		});

		html += '</table>';

		nlapiLogExecution('DEBUG', 'EMAIL DETAILS',
				$.getAnActiveEmployee() + ' ' + recipients[0]);

		nlapiSendEmail($.getAnActiveEmployee(),
				nlapiGetContext().getSetting('SCRIPT', 'custscript_suite_test_email_to'), 'Unit test results',
				html,
				recipients ? recipients.toString() : null
				);

	},
	suiteletEntry: function(request, response){
		if(request.getParameter('test')){
			return response.write(JSON.stringify(suite.test.SuiteRunner.runTests({
				fileNames : JSON.parse(request.getParameter('test'))
			})));
		}

		var html = '<!doctype html>'+
					'<html>' +
						'<head>' +
							'<style>' +
								'.leftcheck{float: left; padding: 0 5px 0 5px; min-width: 40px; text-align: center;' +
								'border-bottom: 1px solid #000; border-left: 1px solid #000; border-right: 1px solid #000;' +
								'line-height: 20px}' +
								'.filelist {list-style: none;}' +
								'.clear{clear: both;}' +
								'ul.filelist > li {}' +
								'span.filename{  padding: 1px 5px 1px 5px;border-bottom: 1px solid #000; float: left; width: 500px; }' +
							'</style>' +
						'</head>' +
						'<body>' +
							'<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/2.1.4/jquery.min.js"></script>' +
							'<script>' + 'window.runTests = function(){' +
									' var checkboxes = $("input:checkbox:checked");' +
									' var files=  []; ' +
									'$.each(checkboxes, function(i, box){' +
										'files.push(box.name);' +
									'});' +
									'window.location.href="/app/site/hosting/scriptlet.nl?script=customscript_suite_test_runner' +
									'&deploy=customdeploy1&test=" + JSON.stringify(files); ' +
								'}' +
							'</script>' +
							'<ul class="filelist">' +
								'<li><span class="tableheader"><div class="leftcheck">Select</div>' +
								'<span class="filename">Filename</span><div class="clear"></div></span>';

		var tests = suite.test.SuiteRunner.listTests();
		_.each(tests, function(test){
			html += '<li><span><div class="leftcheck"><input type="checkbox" name="'+ test +'"></div><span class="filename">' +
				test + '</span><div class="clear"></div></span></li>';
		});

		html += '<span class="button"><a href="#" onclick="runTests()">Submit</a></span>'

		html += '</ul></body></html>'

		//nlapiLogExecution('DEBUG', 'HTML', nlapiEscapeXML(html));

		return response.write(html);
	},

	runTests: function(args){
		var expect = chai.expect,
			allTests;

		//ready for mocha
		mocha.setup({
			ui: 'bdd',
			reporter: 'suite-reporter',
			ignoreLeaks: true
		});

		suite.test.testLibraries = [];

		//load test suites
		_.each(args.fileNames, function(file){
			eval($.fs.readFileSync(file));
		});

		//load libraries
		_.each(suite.test.testLibraries, function(lib){
			//TODO think on this path prefix if solution needs to be bundled
			nlapiLogExecution('DEBUG', 'loading lib', ('suitescripts/' +  lib));
			eval($.fs.readFileSync('suitescripts/' +  lib));
		});

		//nlapiLogExecution('DEBUG', 'suite.io.credstore', suite.io.CredStore);

		$.SuiteReporter.EventEmitter.addListener('end', function(tests, passes, failures){
			allTests = tests;
		});

		mocha.globals([]);
	    //nlapiLogExecution('DEBUG', 'mocha Globals', 'OK');
	    x = mocha.run();

	    return allTests;
	    //Get end reports
	},

	listTests: function(){
		return $.fs.readdirSync('suitescripts/testsuites');
	}
};
