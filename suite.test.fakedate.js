$.namespace('suite.test');

var oldDate = Date,
	fakedTodayArg;

/**
 * This class is written specifically to bind new date argument to a specific date
 * Using a dynamic date in your code makes difficult to write a test assertions,
 * specifically when your code behaviour varies on date
 * This class beats that difficulty by setting new Date()'s return type to a specific date
 */
suite.test.FakeDate = function(oldDateConstructorParam){
	return new oldDate(oldDateConstructorParam || fakedTodayArg);
};

suite.test.FakeDate.start = function(oldDateConstructorParam){
	fakedTodayArg = oldDateConstructorParam;
	Date = suite.test.FakeDate;
};

suite.test.FakeDate.restore = function(){
	Date = oldDate;
};
