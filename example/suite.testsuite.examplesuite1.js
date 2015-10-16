//Make sure this is the first statement if you need libraries to be loaded in your tests.
//An array of paths, paths are relative to suitescripts folder.
//suite.test.testLibraries = _.union(suite.test.testLibraries, ['utils/suite.utils.crypto.js', 'io/suite.io.iofile.js']);
  describe('credstore suite', function(){

	  it('should be array', function(){
        //make sure there is no credentials for testplatform and test@test.com
		  var x = [2];
		  expect(x).to.exist;
		  expect(x).to.have.length(1);
      });

      it('should read existing creds', function(){
    	  var creds = {
			  username: 'test@test.com',
			  password: 'test123'
		  };

    	  expect(creds).to.exist;
    	  expect(creds).to.have.ownProperty('username');
    	  expect(creds).to.have.ownProperty('password');
    	  expect(creds.username).to.equal('test@test.com');
    	  expect(creds.password).to.equal('test123');
      });

      it('should be null', function(){

    	  var x = null;
    	  expect(x).to.be.a('null');
      });

  });
