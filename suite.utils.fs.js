/**
 * Common file and folder utility methods
 */
if(!this.suite || !this.suite._batchYielded)
suite.utils.fs = (function(){
	var CONTENT_TYPES = {
		"application/x-autocad":"AUTOCAD",
		"image/x-xbitmap":"BMPIMAGE",
		"text/csv":"CSV",
		"application/vnd.ms-excel":"EXCEL",
		"application/​x-​shockwave-​flash":"FLASH",
		"image/gif":"GIFIMAGE",
		"application/​x-​gzip-​compressed":"GZIP",
		"text/html":"HTMLDOC",
		"image/ico":"ICON",
		"text/javascript":"JAVASCRIPT",
		"image/jpeg":"JPGIMAGE",
		"message/rfc822":"MESSAGERFC",
		"audio/mpeg":"MP3",
		"video/mpeg":"MPEGMOVIE",
		"application/vnd.ms-project":"MSPROJECT",
		"application/pdf":"PDF",
		"image/pjpeg":"PJPGIMAGE",
		"text/plain":"PLAINTEXT",
		"image/x-png":"PNGIMAGE",
		"image/png":"PNGIMAGE",
		"application/postscript":"POSTSCRIPT",
		"application/​vnd.​ms-​powerpoint":"POWERPOINT",
		"video/quicktime":"QUICKTIME",
		"application/rtf":"RTF",
		"application/sms":"SMS",
		"text/css":"STYLESHEET",
		"image/tiff":"TIFFIMAGE",
		"application/vnd.visio":"VISIO",
		"application/msword":"WORD",
		"text/xml":"XMLDOC",
		"application/zip":"ZIP"
	};

    return {

    	/**
    	 *
    	 * @param contentType
    	 * @returns NS-File Type from HTTP Content-Type
    	 */
    	getFileTypeFromContentType: function(contentType){
    		return CONTENT_TYPES[contentType];
    	},

    	/**
    	 *
    	 * @param fileType
    	 * @returns HTTP Content-Type from NS-File Type
    	 */
    	getContentTypeFromFileType: function(fileType){
    		return _.findKey(CONTENT_TYPES, function(type){return type === fileType;});
    	},

        /**
         * @arg String - fileNameWithPath eg: "suitescripts/suite/sfdc.js"
         * @return file's internal Id
         **/
        getFileId: function(fileNameWithPath){

        	var folders = fileNameWithPath.split("/");
        	var fileName = folders[folders.length - 1];
        	var fileSearch;

        	if(folders.length > 1){
        		fileSearch = nlapiSearchRecord('file', null,
            		[
            		 ['name', 'is', fileName], 'and',
            		 ['folder', 'anyof', $.fs.getFolderId(folders.slice(0, folders.length - 1))]
            		]);
        	} else {
        		fileSearch = nlapiSearchRecord('file', null, ['name', 'is', fileName]);
        	}

        	if(fileSearch && fileSearch.length === 1){
        		return fileSearch[0].getId();
        	}

        	if(fileSearch && fileSearch.length > 1){
        		throw new nlapiCreateError("SUITE_MULTIPLE_FILES", "Miltiple files found for - " + fileNameWithPath);
        	}

            return null;
        },

        /**
         * @arg String - fileNameWithPath eg: "suitescripts/suite/sfdc.js"
         * @return file contents
         **/
        readFileSync: function(fileNameWithPath){

        	var fileId = $.fs.getFileId(fileNameWithPath),
        		file;

        	if(!fileId){
        		throw new nlapiCreateError("SUITE_FILE_READ_ERROR", "No file found for location - " + fileNameWithPath);
        	}

            file = nlapiLoadFile(fileId);
            return file.getValue();
        },

        /**
         *
         * @param String folderPath
         * @returns Internalid of folderpath
         */
        getFolderId: function(folderPath){
        	var folders,
	            searchedFolders;

        	folders = _.isArray(folderPath) ? folderPath : folderPath.split('/');

	        if(folders.length === 1){
	        	nlapiLogExecution('DEBUG', 'Searching for root folder', folders);
	        	//Search and return
	        	searchedFolders = nlapiSearchRecord('folder', null,
	            		new nlobjSearchFilter('name', null, 'is', folders[0]),
	            		[new nlobjSearchColumn('parent'), new nlobjSearchColumn('internalid')]);

        	} else if(folders.length === 2){
        		nlapiLogExecution('DEBUG', 'Searching for folder', folders);
	        	//search and return
	        	searchedFolders = nlapiSearchRecord('folder', null,
	            		[
	            		 ['name', 'is', folders[1]], 'and',
	            		 ['parent', 'is', folders[0]]
	            		],
	            		[new nlobjSearchColumn('parent'), new nlobjSearchColumn('internalid')]);

        	} else {
        		nlapiLogExecution('DEBUG', 'requesting id for folders', folders.slice(0, folders.length - 1).join("::"));
        		searchedFolders = nlapiSearchRecord('folder', null,
                		[
                		 ['name', 'is', folders[folders.length - 1]], 'and',
                		 ['parent', 'anyof', $.fs.getFolderId(folders.slice(0, folders.length - 1))]
                		],
                		[new nlobjSearchColumn('parent'), new nlobjSearchColumn('internalid')]);
        	}

	        if(!searchedFolders){
        		return null;
        	}

        	if(searchedFolders.length > 1){
        		throw new nlapiCreateError('SUITE_FOLDER_READ_ERROR', 'Multiple folders found with same name.');
        	}

        	nlapiLogExecution('DEBUG', 'folder id', searchedFolders[0].getId());

        	return searchedFolders[0].getId();
        },

        /**
         * @arg String - dirNameWithPath eg: "suitescripts/suite/sfdc"
         * @return Array of file names
         **/
        readdirSync: function(dirNameWithPath){
        	var filesArr = [],
        		folderId = $.fs.getFolderId(dirNameWithPath);

        	if(folderId == null){
        		throw new nlapiCreateError('No such folder - ' + dirNameWithPath);
        	}

            var searchResult = nlapiSearchRecord('folder', null,
                new nlobjSearchFilter('internalid', null, 'is', folderId),  //filter
                [new nlobjSearchColumn('name', 'file').setSort(),
                 new nlobjSearchColumn('internalid', 'file')]  //columns
            );

            _.each(searchResult, function (result) {
                filesArr.push(result.getValue('name', 'file'));
            });

            return filesArr;
        }
    };
}());
