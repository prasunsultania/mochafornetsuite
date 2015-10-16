this.suite = this.suite || {};
var t1 = new Date();

if(!this.suite || !this.suite._batchYielded)
this.$ = suite.utils = (function(root) {
    var __context;
    var __configuration = {};

    var ENVIRONMENT_URL_STRING = {
    		'PRODUCTION' : '',
    		'SANDBOX' : '.sandbox',
    		'BETA' : '.beta'
    };

    /**
     * NetSuite has got lot many UI only internal fields
     * We shouldn't include them in meta information
     * As they are not required for mapping
     */
    var UI_INTERNAL_FIELDS = ['whence', 'selectedtab', 'customwhence', 'saved_name',
                              'customwhence' , 'edition', 'oldparent', 'baserecordtype',
                              'conflictdata', 'entryformquerystring','ntype'];

    /**
     * NetSuite has got Sublist SubRecords
     * In many records subrecords are embedded and its hard to identify them programmatically
     * So, we are maintaining a list of these.
     */
    var SUBLIST_SUBRECORDS = ['addressbook'];
    var SUBRECORDS_SUBLIST_TO_ACTUAL_ID = {'addressbook': 'addressbookaddress'};

    /**
     *	An empty Proxy function for inheritance util
     **/
    var F = function () {};

    /**
     * get field Meta and value from nlobjField
     */
    var _getFieldMetaAndValue = function(nsRecord, fieldInfo, linegroup, lineNum, onlyMeta){
    	var fieldName = fieldInfo.getName();

    	if(!fieldInfo.getLabel()){

        	if(fieldName.indexOf('nl') === 0 || fieldName.indexOf('wf') === 0 ||
        			fieldName.indexOf('ns') === 0 ||
        			fieldName.indexOf('_') === 0 || UI_INTERNAL_FIELDS.indexOf(fieldName) !== -1){
        		return null;
        	}
            //ignore fields without label
            //they appear to be undocumented field used internally by NS

        	//nlapiLogExecution('DEBUG', 'Meta Utility: No Label for field', fieldInfo.getName());
        }

        var currentField = {
            label: fieldInfo.getLabel(),
            apiName: fieldInfo.getName(),
            dataType: fieldInfo.getType(),
            isMandatory: fieldInfo.mandatory,
            readOnly: fieldInfo.disabled
        };

        if(onlyMeta && (currentField.dataType === 'multiselect' || currentField.dataType === 'select')){
            currentField.selectOptions = fieldInfo.getSelectOptions();
            currentField.selectOptions = _.map(currentField.selectOptions, function(option){
                return {
                    value: option.getId(),
                    text: option.getText()
                };
            });
        } else if(!onlyMeta){
            if(currentField.dataType === 'multiselect'){
                currentField.values =  linegroup ? nsRecord.getLineItemValues(linegroup, fieldName, lineNum) : nsRecord.getFieldValues(fieldName);
                //getLineItemTexts() is not available
                //https://system.na1.netsuite.com/help/helpcenter/en_US/Output/Help/SuiteCloudCustomizationScriptingWebServices/SuiteScript/nlobjRecord.html#bridgehead_N3099101
                currentField.texts = linegroup ? null : nsRecord.getFieldTexts(fieldName);
            } else if(currentField.dataType === 'select'){
                currentField.value = linegroup ? nsRecord.getLineItemValue(linegroup, fieldName, lineNum) : nsRecord.getFieldValue(fieldName);
                currentField.text = linegroup ? nsRecord.getLineItemText(linegroup, fieldName, lineNum) : nsRecord.getFieldText(fieldName);
            } else {
                currentField.value = linegroup ? nsRecord.getLineItemValue(linegroup, fieldName, lineNum) : nsRecord.getFieldValue(fieldName);
            }

            if(currentField.dataType === 'datetime' && currentField.value){
            	//transform value as Date Object
            	currentField.value = $.dateTime.getDateTimeWithTimeZoneCorrection({dateTimeString: currentField.value});
            } else if(currentField.dataType === 'date' && currentField.value){
            	//transform value as Date Object
            	currentField.value = $.dateTime.getDateWithTimeZoneCorrection({dateString: currentField.value});
            }
        }

        return currentField;
    };

    var _getFieldMeta = function(nsRecord, fieldInfo, linegroup){
        return _getFieldMetaAndValue(nsRecord, fieldInfo, linegroup, null, true);
    };

    return {
        root : root,

        decodeBase64: function(base64str){
    	    var e = 0;
    	    var cnt = 0;
    	    var len = base64str.length;
    	    var lst = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    	    var total = "";
    	    for (cnt = 0; cnt < len; cnt++) {
    	        if (lst.indexOf(base64str.charAt(cnt)) != -1) {
    	            var currnum = lst.indexOf(base64str.charAt(cnt)) ;
    	            var bin = currnum.toString(2);
    				var temp = bin.length
    	            while (temp < 6) {
    	                bin = "0" + bin;
    					temp++;
    	            }
    				total = total + bin
    	        } else if (base64str.charAt(cnt) == '=') {
    	            e++;
    	        }
    	    }
    		var hexg = total.substring(0, total.length - (e * 2));
    		var text = "";
    		var curr = "";
    		cnt = 0;
    		while(cnt < hexg.length){
    			curr = hexg.substring(cnt, cnt+8);
    			var deci = parseInt(curr, 2).toString(10);
    			text = text + String.fromCharCode(deci)
    			cnt += 8;
    		}
    		return text;
        },

        http: {
            jsonToQueryParam : function(params){
                return _.map(_.keys(params), function(k) {
                    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
                }).join('&');
            }
        },

        /**
         * nlobjRequest in case if execution context is suitelet
         * Suitelet script ID in case, execution context is NOT suitelet
         */
        getNsDomain: function(param) {
        	if(!_.isString(param)){
        		return param.getURL().match(/https:\/\/([^\/]+)\/.*/)[1];
        	}

        	var url = nlapiResolveURL('SUITELET', param, '1', true).replace('forms', 'system').replace(
        			/\.na(.)/, '.na$1' + ENVIRONMENT_URL_STRING[$.getContext().getEnvironment()]);

        	nlapiLogExecution('DEBUG', 'url 1', url);

        	if(url.indexOf('.na') === -1){
        		//we dont need data center specific fix
        		url = url.replace('.system' + ENVIRONMENT_URL_STRING[$.getContext().getEnvironment()]);
        	}

        	nlapiLogExecution('DEBUG', 'url 2', url);

        	return url.match(/https:\/\/([^\/]+)\/.*/)[1];
        },

        getContext: function(){
            __context = __context || nlapiGetContext();
            return __context;
        },

        isSuiteCloudAccount: function(){
            return (suite.utils.getContext().getQueueCount() > 1);
        },

        getNsAccountNumber: function() {
            return (suite.utils.getContext().getAccount());
        },

        getNsEnvironment: function(){
            return suite.utils.getContext().getEnvironment();
        },

        getCompanyTimeZone: function(){
            return suite.utils.getConfiguration('companyinformation').getFieldValue('timezone');
        },

        getConfiguration : function(type){
            return __configuration[type] = __configuration[type] || nlapiLoadConfiguration(type);
        },

        getUserTimeZone : function() {
            //system user runs as -4
            if(suite.utils.getContext().getUser() !== -4){
                return $.getContext().getPreference('TIMEZONE');
            } else {
                //user timezone is not applicable for -4, it should return company tz
                return $.getCompanyTimeZone();
            }
        },

        //added by Gagan on 23-09-14
        getClassObject : function(strClassName, args){

            var classes = strClassName.split("."),
                classObj = $.root[classes[0]];

            _.each(classes, function(newClass, i){

                if(i === 0){
                    return;
                }

                classObj = classObj[newClass];

                if(!classObj){
                	nlapiLogExecution('ERROR', 'Class not found Exception', strClassName);
                	throw new nlapiCreateError("SUITE_CLASS_LOAD_ERROR",
                			'We failed to load class ' + strClassName);
                }
            });

            if(args){
                return new classObj(args);
            }else{
                return new classObj({});
            }
        },

        getUserDateTimeFormat : function(){
			if(suite.utils.getContext().getUser() !== -4){
				return ($.getContext().getPreference('DATEFORMAT') + " " + $.getContext().getPreference('TIMEFORMAT'))
					.replace("fmHH", 'hh').replace("fmMI", 'mm').replace('am', 'a');
			} else {
				return ($.getConfiguration('companypreferences').getFieldValue('DATEFORMAT') +
						" " + $.getConfiguration('companypreferences').getFieldValue('TIMEFORMAT'))
				.replace("fmHH", 'hh').replace("fmMI", 'mm').replace('am', 'a');
			}
		},

		getUserTimeFormat : function(){
			if(suite.utils.getContext().getUser() !== -4){
				return ($.getContext().getPreference('TIMEFORMAT'))
					.replace("fmHH", 'hh').replace("fmMI", 'mm').replace('am', 'a');
			} else {
				return ($.getConfiguration('companypreferences').getFieldValue('TIMEFORMAT'))
					.replace("fmHH", 'hh').replace("fmMI", 'mm').replace('am', 'a');
			}
		},

		getUserDateFormat : function(){
			if(suite.utils.getContext().getUser() !== -4){
				return ($.getContext().getPreference('DATEFORMAT'));
			} else {
				return $.getConfiguration('companypreferences').getFieldValue('DATEFORMAT');
			}
		},

		dateTime: {
			/**
			 * NLApis gives you date as String in user Time zone
			 * but, new Date() expects date in NS Server time zone
			 * This method is handy to get Date object with time zone corrections
			 * @param Object {
			 * 	dateString
			 * 	fieldName
			 * 	nlobjRecord
			 * }
			 * @return Date object in NetSuite Server Time zone
			 */
			getDateWithTimeZoneCorrection: function(args){

				if(args.nlobjRecord && args.fieldName){
					args.dateString = nlobjRecord.getFieldValue(args.fieldName);
				}

				return $.moment.tz(args.dateString, $.getUserDateFormat(), $.getUserTimeZone()).toDate();
			},

			/**
			 * NLApis gives you dateTime as String in user Time zone
			 * but, new Date() expects dateTime in NS Server time zone
			 * This method is handy to get Date object with time zone corrections
			 * @param Object {
			 * 	dateTimeString
			 * 	fieldName
			 * 	nlobjRecord
			 * }
			 * @return Date object in NetSuite Server Time zone
			 */
			getDateTimeWithTimeZoneCorrection: function(args){

				//nlapiLogExecution('DEBUG', 'getDateTimeWithTimeZoneCorrection args', JSON.stringify(args));

				if(args.nlobjRecord && args.fieldName){
					args.dateTimeString = args.nlobjRecord.getFieldValue(args.fieldName);
					//nlapiLogExecution('DEBUG', 'dateString', args.nlobjRecord.getFieldValue(args.fieldName));
				}
				nlapiLogExecution('DEBUG', '$.getUserTimeZone()', $.getUserTimeZone());
				nlapiLogExecution('DEBUG', '$.getUserDateTimeFormat()', $.getUserDateTimeFormat());
				nlapiLogExecution('DEBUG', 'args.dateTimeString', args.dateTimeString);

				return $.moment.tz(args.dateTimeString, $.getUserDateTimeFormat(), $.getUserTimeZone()).toDate();
			},

			/**
			 * NLApis gives you dateTime as String in user Time zone
			 * but, new Date() expects dateTime in NS Server time zone
			 * This method is handy to get Date object with time zone corrections
			 * @param args
			 * @returns
			 */
			getTimeWithTimeZoneCorrection: function(args){

				var date;

				if(args.nlobjRecord && args.fieldName){
					args.timeString = nlobjRecord.getFieldValue(args.fieldName);
				}

				date = $.moment.tz(args.timeString, $.getUserDateFormat(), $.getUserTimeZone()).toDate();
				return date.getHours.toString() + ":" + date.getMinutes();
			},

			getDateStringFromDateObject: function(dateObject){
				return $.moment(dateObject).tz($.getUserTimeZone()).format($.getUserDateFormat());
			},

			getDateTimeStringFromDateObject: function(dateObject){
				return $.moment(dateObject).tz($.getUserTimeZone()).format($.getUserDateTimeFormat());
			}
		},

        nsRecord: {
            /**
             * @governance - std transactions: 10, std non-transactions, custom record - 2
             * @param nsRecord - nlobjRecord
             * @returns
             */
            toJSON: function(nsRecord){
                var fieldNames = nsRecord.getAllFields();
                var toReturn = {};
                toReturn.fields = [];

                //get all fields Meta and value
                _.each(fieldNames, function(fieldName){
                    var fieldInfo = nsRecord.getField(fieldName);

                    if(!fieldInfo){
                        nlapiLogExecution('AUDIT', 'No field info fora main field', fieldName);
                        return;
                    }

                    var currentField = _getFieldMetaAndValue(nsRecord, fieldInfo);

                    if(currentField){
                        toReturn.fields.push(currentField);
                    }
                });

                var lineItemNames = nsRecord.getAllLineItems();
                toReturn.lineItems = [];
                _.each(lineItemNames, function(lineItemName){
                    var lineItem = {},
                        i = 0,
                        currentField,
                        subRecord,
                        subRecordJson,
                        lineFieldInfo;
                    lineItem[lineItemName] = [];

                    var lines = nsRecord.getLineItemCount(lineItemName);
                    var lineFieldNames = nsRecord.getAllLineItemFields(lineItemName);

                    //for each lines
                    for(i = 1; i <= lines ; i++){

                    	lineItem[lineItemName][i - 1] = [];

                    	if(SUBLIST_SUBRECORDS.indexOf(lineItemName) !== -1){
                    		nsRecord.selectLineItem(lineItemName, i);
                    		subRecord = nsRecord.editCurrentLineItemSubrecord(lineItemName, SUBRECORDS_SUBLIST_TO_ACTUAL_ID[lineItemName]);
                    		if(!subRecord){
                    			throw new nlapiCreateError('SUITE_INVALID_SUBRECORD',
                    					'Invalid Subrecord ' + SUBRECORDS_SUBLIST_TO_ACTUAL_ID[lineItemName] + ' in sublist ' + lineItemName);
                    		}
                    		subRecordJson = {name: SUBRECORDS_SUBLIST_TO_ACTUAL_ID[lineItemName], join: lineItemName, fields: []};
                    		_.each(subRecord.getAllFields(), function(subField) {
                    			var fieldInfo = subRecord.getField(subField);

                    			if(!fieldInfo){
                                    nlapiLogExecution('AUDIT', 'No field info for a subrecord field', subField);
                                    return;
                                }

                                currentField = _getFieldMetaAndValue(subRecord, fieldInfo);

                                if(currentField){
                                	subRecordJson.fields.push(currentField);
                                }

                    		});
                    		lineItem[lineItemName][i - 1].push(subRecordJson);
                    	}

                        _.each(lineFieldNames, function(lineFieldName){
                        	var currentField;
                        	lineFieldInfo = nsRecord.getLineItemField(lineItemName, lineFieldName, i);
                            if(!lineFieldInfo){
                                nlapiLogExecution('AUDIT', 'No field info for a line field', lineFieldInfo);
                                return;
                            }
                            currentField = _getFieldMetaAndValue(nsRecord, lineFieldInfo, lineItemName, i);
                            if(currentField){
                                lineItem[lineItemName][i - 1].push(currentField);
                            }
                        });
                    }
                    toReturn.lineItems.push(lineItem);
                });

                return toReturn;
            },

            /**
             * @governance - std transactions: 10, std non-transactions, custom record - 2
             * @param String - recordType
             * @returns
             */
            getRecordMetaJson: function(recordType){
                var nsRecord = nlapiCreateRecord(recordType);
                var fieldNames = nsRecord.getAllFields();
                var toReturn = {};
                toReturn.fields = [];

                //get all fields Meta and value
                _.each(fieldNames, function(fieldName){
                    var fieldInfo = nsRecord.getField(fieldName);
                    if(!fieldInfo){
                    	nlapiLogExecution('DEBUG', 'Ns record Meta Warning: No fieldInfo', 'for ' + fieldName);
                    	return;
                    }
                    var currentField = _getFieldMeta(nsRecord, fieldInfo);

                    if(currentField){
                        toReturn.fields.push(currentField);
                    }
                });

                //Undocumented method, so, far this is the only way to dynamically get the sublist names
                var lineItemNames = nsRecord.getAllLineItems();
                toReturn.lineItems = [];
                _.each(lineItemNames, function(lineItemName){
                    var lineItem = {},
                    	subRecord,
                    	subRecordJson;
                    var lineFieldNames = nsRecord.getAllLineItemFields(lineItemName);

                    lineItem[lineItemName] = [];

                    if(SUBLIST_SUBRECORDS.indexOf(lineItemName) !== -1){
                		nsRecord.selectNewLineItem(lineItemName);
                		subRecord = nsRecord.createCurrentLineItemSubrecord(lineItemName, SUBRECORDS_SUBLIST_TO_ACTUAL_ID[lineItemName]);
                		if(!subRecord){
                			throw new nlapiCreateError('SUITE_INVALID_SUBRECORD',
                					'Invalid Subrecord ' + SUBRECORDS_SUBLIST_TO_ACTUAL_ID[lineItemName] + ' in sublist ' + lineItemName);
                		}
                		subRecordJson = {name: SUBRECORDS_SUBLIST_TO_ACTUAL_ID[lineItemName], join: lineItemName, fields: []};
                		_.each(subRecord.getAllFields(), function(subField) {
                			var fieldInfo = subRecord.getField(subField);

                			if(!fieldInfo){
                                nlapiLogExecution('AUDIT', 'No field info for a subrecord field', subField);
                                return;
                            }

                            currentField = _getFieldMetaAndValue(subRecord, fieldInfo);

                            if(currentField){
                            	subRecordJson.fields.push(currentField);
                            }

                		});
                		lineItem[lineItemName].push(subRecordJson);
                	}

                    _.each(lineFieldNames, function(lineFieldName){
                        var lineFieldInfo = nsRecord.getLineItemField(lineItemName, lineFieldName);
                        var currentField = _getFieldMeta(nsRecord, lineFieldInfo, lineItemName);
                        if(currentField){
                            lineItem[lineItemName].push(currentField);
                        }
                    });

                    toReturn.lineItems.push(lineItem);
                });

                return toReturn;
            },

            submitJsonRecord: function(recordJson){
            	//TODO return record Id
            	throw new nlapiCreateError('SUITE_UNIMPLEMENTED_METHOD_ERROR', 'This method is not yet implemented');
            }

        },

        getAnActiveEmployee: function(){
        	var user = nlapiGetUser(),
        		search;

        	if(user !== -4 && user !== '-4'){
        		return user;
        	}

        	//attempt -5
        	search = nlapiSearchRecord('employee', null,
        			[
        			 ['internalid', 'anyof', [-5]], 'and',
        			 ['isinactive', 'is', 'F'], 'and',
        			 ['giveaccess', 'is', 'T']
        			]);

        	if(search){
        		return -5;
        	}

        	search = nlapiSearchRecord('employee', null,
        			[
        			 ['isinactive', 'is', 'F'], 'and',
        			 ['giveaccess', 'is', 'T']
        			]);

        	return search[0].getId();

        },

        nsSearch: {
            toJSON: function(searchResultSet){

                var resultArr = [],
                	columns,
                    fields;

                searchResultSet.forEachResult(function(result){

                    resultArr.push({
                        recordType: result.getRecordType(),
                        recordId: result.getId(),
                        fields: []
                    });

                    fields = resultArr[resultArr.length-1].fields;
                    columns = result.getAllColumns();

                    _.each(columns, function(column){

                        currVal = result.getValue(column.getName(), column.getJoin(), column.getSummary());

                        fields.push({
                            label : column.getLabel(),
                            join: column.getJoin(),
                            apiName: column.getName(),
                            dataType: column.getType(),
                            text: result.getText(column.getName(), column.getJoin(), column.getSummary()) || null,
                            value: result.getValue(column.getName(), column.getJoin(), column.getSummary()) || null
                        });
                    });
                    return true;
                });

                return resultArr;
            },

            getSearchMeta: function(searchid){

                var searchObj= nlapiLoadSearch(null, searchid),
                    cols = searchObj.getColumns(),
                    colsJSON = {
                        recordType: searchObj.getSearchType(),
                        columns: []
                    },
                    obj = colsJSON.columns;

                _.each(cols, function(col){
                    obj.push({
                        apiName: col.getName(),
                        label: col.getLabel(),
                        dataType: col.getType()
                    });
                });

                return colsJSON;
            },

            /**
             * args Object {recordIds: Array, recordType: String, fieldIds: Array}
             * @returns searchResults in JSON format
             */
            getSearchResultsRecordIdsAndFieldIds: function(args){
            	//TODO implement it
            	throw new nlapiCreateError('SUITE_UNIMPLEMENTED_METHOD_ERROR', 'This method is not yet implemented');
            	//compute filters assuming recordIds and recordType

            	//compute searchColumns if array of fieldIds are given

            	//return search as JSON
            },

            /**
             * args Object {recordIds: Array, recordType: String, fieldIds: Array}
             * @returns searchResults in JSON format
             */
            getSearchResultsExternalIdsAndFieldIds: function(args){
            	//TODO implement it
            	throw new nlapiCreateError('SUITE_UNIMPLEMENTED_METHOD_ERROR', 'This method is not yet implemented');
            	//compute filters assuming recordIds and recordType

            	//compute searchColumns if array of fieldIds are given

            	//return search as JSON
            }
        },

        // http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
        // http://www.ietf.org/rfc/rfc4122.txt
        uuid : function() {
        	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
	            return v.toString(16);
        	});
        },

        inherit: function(Child, Parent){
        	if(!Parent){
        		throw new nlapiCreateError('SUITE_INHERITANCE_ERROR',
        				'Please make sure parent class is defined.');
        	}
            F.prototype = Parent.prototype;
            Child.prototype = new F();
            Child.prototype.superclass = Parent; // add a link to superclass
            Child.prototype.constructor = Child;
        },

        namespace: function(nsString){
            var parts = nsString.split('.'),
                parent = suite,
                i;

            // strip redundant leading global
            if (parts[0] === "suite") {
                parts = parts.slice(1);
            }

            for (i = 0; i < parts.length; i += 1) {
                // create a property if it doesn't exist
                if (typeof parent[parts[i]] === "undefined") {
                    parent[parts[i]] = {};
                }
                parent = parent[parts[i]];
            }

        }
    };
}(this));
nlapiLogExecution('DEBUG', 'load time for Utils', (new Date() - t1).toString() + "ms");
