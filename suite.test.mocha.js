var t1 = new Date();
;(function(){

// CommonJS require()

function require(p){
    var path = require.resolve(p)
      , mod = require.modules[path];
    if (!mod) throw new Error('failed to require "' + p + '"');
    if (!mod.exports) {
      mod.exports = {};
      mod.call(mod.exports, mod, mod.exports, require.relative(path));
    }
    return mod.exports;
  }

require.modules = {};

require.resolve = function (path){
    var orig = path
      , reg = path + '.js'
      , index = path + '/index.js';
    return require.modules[reg] && reg
      || require.modules[index] && index
      || orig;
  };

require.register = function (path, fn){
    require.modules[path] = fn;
};

require.relative = function (parent) {
    return function(p){
      if ('.' != p.charAt(0)) return require(p);

      var path = parent.split('/')
        , segs = p.split('/');
      path.pop();

      for (var i = 0; i < segs.length; i++) {
        var seg = segs[i];
        if ('..' == seg) path.pop();
        else if ('.' != seg) path.push(seg);
      }

      return require(path.join('/'));
    };
  };


require.register("browser/debug.js", function(module, exports, require){

module.exports = function(type){
  return function(msg){
    nlapiLogExecution('DEBUG', type, (msg || ''));
  }
};

}); // module: browser/debug.js

require.register("browser/diff.js", function(module, exports, require){
/* See LICENSE file for terms of use */

/*
 * Text diff implementation.
 *
 * This library supports the following APIS:
 * JsDiff.diffChars: Character by character diff
 * JsDiff.diffWords: Word (as defined by \b regex) diff which ignores whitespace
 * JsDiff.diffLines: Line based diff
 *
 * JsDiff.diffCss: Diff targeted at CSS content
 *
 * These methods are based on the implementation proposed in
 * "An O(ND) Difference Algorithm and its Variations" (Myers, 1986).
 * http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.4.6927
 */
var JsDiff = (function() {
  /*jshint maxparams: 5*/
  function clonePath(path) {
    return { newPos: path.newPos, components: path.components.slice(0) };
  }
  function removeEmpty(array) {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }
    return ret;
  }
  function escapeHTML(s) {
    var n = s;
    n = n.replace(/&/g, '&amp;');
    n = n.replace(/</g, '&lt;');
    n = n.replace(/>/g, '&gt;');
    n = n.replace(/"/g, '&quot;');

    return n;
  }

  var Diff = function(ignoreWhitespace) {
    this.ignoreWhitespace = ignoreWhitespace;
  };
  Diff.prototype = {
      diff: function(oldString, newString) {
        // Handle the identity case (this is due to unrolling editLength == 0
        if (newString === oldString) {
          return [{ value: newString }];
        }
        if (!newString) {
          return [{ value: oldString, removed: true }];
        }
        if (!oldString) {
          return [{ value: newString, added: true }];
        }

        newString = this.tokenize(newString);
        oldString = this.tokenize(oldString);

        var newLen = newString.length, oldLen = oldString.length;
        var maxEditLength = newLen + oldLen;
        var bestPath = [{ newPos: -1, components: [] }];

        // Seed editLength = 0
        var oldPos = this.extractCommon(bestPath[0], newString, oldString, 0);
        if (bestPath[0].newPos+1 >= newLen && oldPos+1 >= oldLen) {
          return bestPath[0].components;
        }

        for (var editLength = 1; editLength <= maxEditLength; editLength++) {
          for (var diagonalPath = -1*editLength; diagonalPath <= editLength; diagonalPath+=2) {
            var basePath;
            var addPath = bestPath[diagonalPath-1],
                removePath = bestPath[diagonalPath+1];
            oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;
            if (addPath) {
              // No one else is going to attempt to use this value, clear it
              bestPath[diagonalPath-1] = undefined;
            }

            var canAdd = addPath && addPath.newPos+1 < newLen;
            var canRemove = removePath && 0 <= oldPos && oldPos < oldLen;
            if (!canAdd && !canRemove) {
              bestPath[diagonalPath] = undefined;
              continue;
            }

            // Select the diagonal that we want to branch from. We select the prior
            // path whose position in the new string is the farthest from the origin
            // and does not pass the bounds of the diff graph
            if (!canAdd || (canRemove && addPath.newPos < removePath.newPos)) {
              basePath = clonePath(removePath);
              this.pushComponent(basePath.components, oldString[oldPos], undefined, true);
            } else {
              basePath = clonePath(addPath);
              basePath.newPos++;
              this.pushComponent(basePath.components, newString[basePath.newPos], true, undefined);
            }

            var oldPos = this.extractCommon(basePath, newString, oldString, diagonalPath);

            if (basePath.newPos+1 >= newLen && oldPos+1 >= oldLen) {
              return basePath.components;
            } else {
              bestPath[diagonalPath] = basePath;
            }
          }
        }
      },

      pushComponent: function(components, value, added, removed) {
        var last = components[components.length-1];
        if (last && last.added === added && last.removed === removed) {
          // We need to clone here as the component clone operation is just
          // as shallow array clone
          components[components.length-1] =
            {value: this.join(last.value, value), added: added, removed: removed };
        } else {
          components.push({value: value, added: added, removed: removed });
        }
      },
      extractCommon: function(basePath, newString, oldString, diagonalPath) {
        var newLen = newString.length,
            oldLen = oldString.length,
            newPos = basePath.newPos,
            oldPos = newPos - diagonalPath;
        while (newPos+1 < newLen && oldPos+1 < oldLen && this.equals(newString[newPos+1], oldString[oldPos+1])) {
          newPos++;
          oldPos++;

          this.pushComponent(basePath.components, newString[newPos], undefined, undefined);
        }
        basePath.newPos = newPos;
        return oldPos;
      },

      equals: function(left, right) {
        var reWhitespace = /\S/;
        if (this.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right)) {
          return true;
        } else {
          return left === right;
        }
      },
      join: function(left, right) {
        return left + right;
      },
      tokenize: function(value) {
        return value;
      }
  };

  var CharDiff = new Diff();

  var WordDiff = new Diff(true);
  var WordWithSpaceDiff = new Diff();
  WordDiff.tokenize = WordWithSpaceDiff.tokenize = function(value) {
    return removeEmpty(value.split(/(\s+|\b)/));
  };

  var CssDiff = new Diff(true);
  CssDiff.tokenize = function(value) {
    return removeEmpty(value.split(/([{}:;,]|\s+)/));
  };

  var LineDiff = new Diff();
  LineDiff.tokenize = function(value) {
    return value.split(/^/m);
  };

  return {
    Diff: Diff,

    diffChars: function(oldStr, newStr) { return CharDiff.diff(oldStr, newStr); },
    diffWords: function(oldStr, newStr) { return WordDiff.diff(oldStr, newStr); },
    diffWordsWithSpace: function(oldStr, newStr) { return WordWithSpaceDiff.diff(oldStr, newStr); },
    diffLines: function(oldStr, newStr) { return LineDiff.diff(oldStr, newStr); },

    diffCss: function(oldStr, newStr) { return CssDiff.diff(oldStr, newStr); },

    createPatch: function(fileName, oldStr, newStr, oldHeader, newHeader) {
      var ret = [];

      ret.push('Index: ' + fileName);
      ret.push('===================================================================');
      ret.push('--- ' + fileName + (typeof oldHeader === 'undefined' ? '' : '\t' + oldHeader));
      ret.push('+++ ' + fileName + (typeof newHeader === 'undefined' ? '' : '\t' + newHeader));

      var diff = LineDiff.diff(oldStr, newStr);
      if (!diff[diff.length-1].value) {
        diff.pop();   // Remove trailing newline add
      }
      diff.push({value: '', lines: []});   // Append an empty value to make cleanup easier

      function contextLines(lines) {
        return lines.map(function(entry) { return ' ' + entry; });
      }
      function eofNL(curRange, i, current) {
        var last = diff[diff.length-2],
            isLast = i === diff.length-2,
            isLastOfType = i === diff.length-3 && (current.added !== last.added || current.removed !== last.removed);

        // Figure out if this is the last line for the given file and missing NL
        if (!/\n$/.test(current.value) && (isLast || isLastOfType)) {
          curRange.push('\\ No newline at end of file');
        }
      }

      var oldRangeStart = 0, newRangeStart = 0, curRange = [],
          oldLine = 1, newLine = 1;
      for (var i = 0; i < diff.length; i++) {
        var current = diff[i],
            lines = current.lines || current.value.replace(/\n$/, '').split('\n');
        current.lines = lines;

        if (current.added || current.removed) {
          if (!oldRangeStart) {
            var prev = diff[i-1];
            oldRangeStart = oldLine;
            newRangeStart = newLine;

            if (prev) {
              curRange = contextLines(prev.lines.slice(-4));
              oldRangeStart -= curRange.length;
              newRangeStart -= curRange.length;
            }
          }
          curRange.push.apply(curRange, lines.map(function(entry) { return (current.added?'+':'-') + entry; }));
          eofNL(curRange, i, current);

          if (current.added) {
            newLine += lines.length;
          } else {
            oldLine += lines.length;
          }
        } else {
          if (oldRangeStart) {
            // Close out any changes that have been output (or join overlapping)
            if (lines.length <= 8 && i < diff.length-2) {
              // Overlapping
              curRange.push.apply(curRange, contextLines(lines));
            } else {
              // end the range and output
              var contextSize = Math.min(lines.length, 4);
              ret.push(
                  '@@ -' + oldRangeStart + ',' + (oldLine-oldRangeStart+contextSize)
                  + ' +' + newRangeStart + ',' + (newLine-newRangeStart+contextSize)
                  + ' @@');
              ret.push.apply(ret, curRange);
              ret.push.apply(ret, contextLines(lines.slice(0, contextSize)));
              if (lines.length <= 4) {
                eofNL(ret, i, current);
              }

              oldRangeStart = 0;  newRangeStart = 0; curRange = [];
            }
          }
          oldLine += lines.length;
          newLine += lines.length;
        }
      }

      return ret.join('\n') + '\n';
    },

    applyPatch: function(oldStr, uniDiff) {
      var diffstr = uniDiff.split('\n');
      var diff = [];
      var remEOFNL = false,
          addEOFNL = false;

      for (var i = (diffstr[0][0]==='I'?4:0); i < diffstr.length; i++) {
        if(diffstr[i][0] === '@') {
          var meh = diffstr[i].split(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
          diff.unshift({
            start:meh[3],
            oldlength:meh[2],
            oldlines:[],
            newlength:meh[4],
            newlines:[]
          });
        } else if(diffstr[i][0] === '+') {
          diff[0].newlines.push(diffstr[i].substr(1));
        } else if(diffstr[i][0] === '-') {
          diff[0].oldlines.push(diffstr[i].substr(1));
        } else if(diffstr[i][0] === ' ') {
          diff[0].newlines.push(diffstr[i].substr(1));
          diff[0].oldlines.push(diffstr[i].substr(1));
        } else if(diffstr[i][0] === '\\') {
          if (diffstr[i-1][0] === '+') {
            remEOFNL = true;
          } else if(diffstr[i-1][0] === '-') {
            addEOFNL = true;
          }
        }
      }

      var str = oldStr.split('\n');
      for (var i = diff.length - 1; i >= 0; i--) {
        var d = diff[i];
        for (var j = 0; j < d.oldlength; j++) {
          if(str[d.start-1+j] !== d.oldlines[j]) {
            return false;
          }
        }
        Array.prototype.splice.apply(str,[d.start-1,+d.oldlength].concat(d.newlines));
      }

      if (remEOFNL) {
        while (!str[str.length-1]) {
          str.pop();
        }
      } else if (addEOFNL) {
        str.push('');
      }
      return str.join('\n');
    },

    convertChangesToXML: function(changes){
      var ret = [];
      for ( var i = 0; i < changes.length; i++) {
        var change = changes[i];
        if (change.added) {
          ret.push('<ins>');
        } else if (change.removed) {
          ret.push('<del>');
        }

        ret.push(escapeHTML(change.value));

        if (change.added) {
          ret.push('</ins>');
        } else if (change.removed) {
          ret.push('</del>');
        }
      }
      return ret.join('');
    },

    // See: http://code.google.com/p/google-diff-match-patch/wiki/API
    convertChangesToDMP: function(changes){
      var ret = [], change;
      for ( var i = 0; i < changes.length; i++) {
        change = changes[i];
        ret.push([(change.added ? 1 : change.removed ? -1 : 0), change.value]);
      }
      return ret;
    }
  };
})();

if (typeof module !== 'undefined') {
    module.exports = JsDiff;
}

}); // module: browser/diff.js

require.register("browser/escape-string-regexp.js", function(module, exports, require){
'use strict';

var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;

module.exports = function (str) {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string');
	}

	return str.replace(matchOperatorsRe,  '\\$&');
};

}); // module: browser/escape-string-regexp.js

require.register("browser/events.js", function(module, exports, require){
	exports.EventEmitter = $.EventEmitter;
}); // module: browser/events.js

require.register("browser/fs.js", function(module, exports, require){

}); // module: browser/fs.js

require.register("browser/glob.js", function(module, exports, require){

}); // module: browser/glob.js

require.register("browser/path.js", function(module, exports, require){

}); // module: browser/path.js

require.register("browser/progress.js", function(module, exports, require){
/**
 * Expose `Progress`.
 */

module.exports = Progress;

/**
 * Initialize a new `Progress` indicator.
 */

function Progress() {
  this.percent = 0;
  this.size(0);
  this.fontSize(11);
  this.font('helvetica, arial, sans-serif');
}

/**
 * Set progress size to `n`.
 *
 * @param {Number} n
 * @return {Progress} for chaining
 * @api public
 */

Progress.prototype.size = function(n){
  this._size = n;
  return this;
};

/**
 * Set text to `str`.
 *
 * @param {String} str
 * @return {Progress} for chaining
 * @api public
 */

Progress.prototype.text = function(str){
  this._text = str;
  return this;
};

/**
 * Set font size to `n`.
 *
 * @param {Number} n
 * @return {Progress} for chaining
 * @api public
 */

Progress.prototype.fontSize = function(n){
  this._fontSize = n;
  return this;
};

/**
 * Set font `family`.
 *
 * @param {String} family
 * @return {Progress} for chaining
 */

Progress.prototype.font = function(family){
  this._font = family;
  return this;
};

/**
 * Update percentage to `n`.
 *
 * @param {Number} n
 * @return {Progress} for chaining
 */

Progress.prototype.update = function(n){
  this.percent = n;
  return this;
};

/**
 * Draw on `ctx`.
 *
 * @param {CanvasRenderingContext2d} ctx
 * @return {Progress} for chaining
 */

Progress.prototype.draw = function(ctx){
  try {
    var percent = Math.min(this.percent, 100)
      , size = this._size
      , half = size / 2
      , x = half
      , y = half
      , rad = half - 1
      , fontSize = this._fontSize;

    ctx.font = fontSize + 'px ' + this._font;

    var angle = Math.PI * 2 * (percent / 100);
    ctx.clearRect(0, 0, size, size);

    // outer circle
    ctx.strokeStyle = '#9f9f9f';
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, angle, false);
    ctx.stroke();

    // inner circle
    ctx.strokeStyle = '#eee';
    ctx.beginPath();
    ctx.arc(x, y, rad - 1, 0, angle, true);
    ctx.stroke();

    // text
    var text = this._text || (percent | 0) + '%'
      , w = ctx.measureText(text).width;

    ctx.fillText(
        text
      , x - w / 2 + 1
      , y + fontSize / 2 - 1);
  } catch (ex) {} //don't fail if we can't render progress
  return this;
};

}); // module: browser/progress.js

require.register("browser/tty.js", function(module, exports, require){

exports.isatty = function(){
  return true;
};

exports.getWindowSize = function(){
  if ('innerHeight' in global) {
    return [global.innerHeight, global.innerWidth];
  } else {
    // In a Web Worker, the DOM Window is not available.
    return [640, 480];
  }
};

}); // module: browser/tty.js

require.register("context.js", function(module, exports, require){

/**
 * Expose `Context`.
 */

module.exports = Context;

/**
 * Initialize a new `Context`.
 *
 * @api private
 */

function Context(){}

/**
 * Set or get the context `Runnable` to `runnable`.
 *
 * @param {Runnable} runnable
 * @return {Context}
 * @api private
 */

Context.prototype.runnable = function(runnable){
  if (0 == arguments.length) return this._runnable;
  this.test = this._runnable = runnable;
  return this;
};

/**
 * Set test timeout `ms`.
 *
 * @param {Number} ms
 * @return {Context} self
 * @api private
 */

Context.prototype.timeout = function(ms){
  if (arguments.length === 0) return this.runnable().timeout();
  this.runnable().timeout(ms);
  return this;
};

/**
 * Set test timeout `enabled`.
 *
 * @param {Boolean} enabled
 * @return {Context} self
 * @api private
 */

Context.prototype.enableTimeouts = function (enabled) {
  this.runnable().enableTimeouts(enabled);
  return this;
};


/**
 * Set test slowness threshold `ms`.
 *
 * @param {Number} ms
 * @return {Context} self
 * @api private
 */

Context.prototype.slow = function(ms){
  this.runnable().slow(ms);
  return this;
};

/**
 * Inspect the context void of `._runnable`.
 *
 * @return {String}
 * @api private
 */

Context.prototype.inspect = function(){
  return JSON.stringify(this, function(key, val){
    if ('_runnable' == key) return;
    if ('test' == key) return;
    return val;
  }, 2);
};

}); // module: context.js

require.register("hook.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var Runnable = require('./runnable');

/**
 * Expose `Hook`.
 */

module.exports = Hook;

/**
 * Initialize a new `Hook` with the given `title` and callback `fn`.
 *
 * @param {String} title
 * @param {Function} fn
 * @api private
 */

function Hook(title, fn) {
  Runnable.call(this, title, fn);
  this.type = 'hook';
}

/**
 * Inherit from `Runnable.prototype`.
 */

function F(){};
F.prototype = Runnable.prototype;
Hook.prototype = new F;
Hook.prototype.constructor = Hook;


/**
 * Get or set the test `err`.
 *
 * @param {Error} err
 * @return {Error}
 * @api public
 */

Hook.prototype.error = function(err){
  if (0 == arguments.length) {
    var err = this._error;
    this._error = null;
    return err;
  }

  this._error = err;
};

}); // module: hook.js

require.register("interfaces/bdd.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var Suite = require('../suite')
  , Test = require('../test')
  , utils = require('../utils')
  , escapeRe = require('browser/escape-string-regexp');

/**
 * BDD-style interface:
 *
 *      describe('Array', function(){
 *        describe('#indexOf()', function(){
 *          it('should return -1 when not present', function(){
 *
 *          });
 *
 *          it('should return the index when present', function(){
 *
 *          });
 *        });
 *      });
 *
 */

module.exports = function(suite){
  var suites = [suite];

  suite.on('pre-require', function(context, file, mocha){

	nlapiLogExecution('DEBUG', 'pre-require BDD', file);
    /**
     * Execute before running tests.
     */

    context.before = function(name, fn){
      suites[0].beforeAll(name, fn);
    };

    /**
     * Execute after running tests.
     */

    context.after = function(name, fn){
      suites[0].afterAll(name, fn);
    };

    /**
     * Execute before each test case.
     */

    context.beforeEach = function(name, fn){
      suites[0].beforeEach(name, fn);
    };

    /**
     * Execute after each test case.
     */

    context.afterEach = function(name, fn){
      suites[0].afterEach(name, fn);
    };

    /**
     * Describe a "suite" with the given `title`
     * and callback `fn` containing nested suites
     * and/or tests.
     */

    context.describe = context.context = function(title, fn){
      var suite = Suite.create(suites[0], title);
      suite.file = file;
      suites.unshift(suite);
      fn.call(suite);
      suites.shift();
      return suite;
    };

    /**
     * Pending describe.
     */

    context.xdescribe =
    context.xcontext =
    context.describe.skip = function(title, fn){
      var suite = Suite.create(suites[0], title);
      suite.pending = true;
      suites.unshift(suite);
      fn.call(suite);
      suites.shift();
    };

    /**
     * Exclusive suite.
     */

    context.describe.only = function(title, fn){
      var suite = context.describe(title, fn);
      mocha.grep(suite.fullTitle());
      return suite;
    };

    /**
     * Describe a specification or test-case
     * with the given `title` and callback `fn`
     * acting as a thunk.
     */

    context.it = context.specify = function(title, fn){
      var suite = suites[0];
      if (suite.pending) var fn = null;
      var test = new Test(title, fn);
      test.file = file;
      suite.addTest(test);
      return test;
    };

    /**
     * Exclusive test-case.
     */

    context.it.only = function(title, fn){
      var test = context.it(title, fn);
      var reString = '^' + escapeRe(test.fullTitle()) + '$';
      mocha.grep(new RegExp(reString));
      return test;
    };

    /**
     * Pending test case.
     */

    context.xit =
    context.xspecify =
    context.it.skip = function(title){
      context.it(title);
    };
  });
};

}); // module: interfaces/bdd.js

require.register("interfaces/exports.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var Suite = require('../suite')
  , Test = require('../test');

/**
 * TDD-style interface:
 *
 *     exports.Array = {
 *       '#indexOf()': {
 *         'should return -1 when the value is not present': function(){
 *
 *         },
 *
 *         'should return the correct index when the value is present': function(){
 *
 *         }
 *       }
 *     };
 *
 */

module.exports = function(suite){
  var suites = [suite];

  suite.on('require', visit);

  function visit(obj, file) {
    var suite;
    for (var key in obj) {
      if ('function' == typeof obj[key]) {
        var fn = obj[key];
        switch (key) {
          case 'before':
            suites[0].beforeAll(fn);
            break;
          case 'after':
            suites[0].afterAll(fn);
            break;
          case 'beforeEach':
            suites[0].beforeEach(fn);
            break;
          case 'afterEach':
            suites[0].afterEach(fn);
            break;
          default:
            var test = new Test(key, fn);
            test.file = file;
            suites[0].addTest(test);
        }
      } else {
        var suite = Suite.create(suites[0], key);
        suites.unshift(suite);
        visit(obj[key]);
        suites.shift();
      }
    }
  }
};

}); // module: interfaces/exports.js

require.register("interfaces/index.js", function(module, exports, require){

exports.bdd = require('./bdd');
//exports.tdd = require('./tdd');
//exports.qunit = require('./qunit');
exports.exports = require('./exports');

}); // module: interfaces/index.js

require.register("interfaces/qunit.js", function(module, exports, require){}); // module: interfaces/qunit.js

require.register("interfaces/tdd.js", function(module, exports, require){}); // module: interfaces/tdd.js

require.register("mocha.js", function(module, exports, require){
/*!
 * mocha
 * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var path = require('browser/path')
  , escapeRe = require('browser/escape-string-regexp')
  , utils = require('./utils');

/**
 * Expose `Mocha`.
 */

exports = module.exports = Mocha;

/**
 * To require local UIs and reporters when running in node.
 */

if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
  var join = path.join
    , cwd = process.cwd();
  module.paths.push(cwd, join(cwd, 'node_modules'));
}

/**
 * Expose internals.
 */

exports.utils = utils;
exports.interfaces = require('./interfaces');
exports.reporters = require('./reporters');
exports.Runnable = require('./runnable');
exports.Context = require('./context');
exports.Runner = require('./runner');
exports.Suite = require('./suite');
exports.Hook = require('./hook');
exports.Test = require('./test');

/**
 * Return image `name` path.
 *
 * @param {String} name
 * @return {String}
 * @api private
 */

function image(name) {
  return __dirname + '/../images/' + name + '.png';
}

/**
 * Setup mocha with `options`.
 *
 * Options:
 *
 *   - `ui` name "bdd", "tdd", "exports" etc
 *   - `reporter` reporter instance, defaults to `mocha.reporters.spec`
 *   - `globals` array of accepted globals
 *   - `timeout` timeout in milliseconds
 *   - `bail` bail on the first test failure
 *   - `slow` milliseconds to wait before considering a test slow
 *   - `ignoreLeaks` ignore global leaks
 *   - `grep` string or regexp to filter tests with
 *
 * @param {Object} options
 * @api public
 */

function Mocha(options) {
  options = options || {};
  this.files = [];
  this.options = options;
  this.grep(options.grep);
  this.suite = new exports.Suite('', new exports.Context);
  this.ui(options.ui);
  this.bail(options.bail);
  this.reporter(options.reporter);
  if (null != options.timeout) this.timeout(options.timeout);
  if (options.enableTimeouts !== null) this.enableTimeouts(options.enableTimeouts);
  if (options.slow) this.slow(options.slow);

  this.suite.on('pre-require', function (context) {
	  nlapiLogExecution('DEBUG', 'pre-require CONTEXT');
    exports.afterEach = context.afterEach || context.teardown;
    exports.after = context.after || context.suiteTeardown;
    exports.beforeEach = context.beforeEach || context.setup;
    exports.before = context.before || context.suiteSetup;
    exports.describe = context.describe || context.suite;
    exports.it = context.it || context.test;
    exports.setup = context.setup || context.beforeEach;
    exports.suiteSetup = context.suiteSetup || context.before;
    exports.suiteTeardown = context.suiteTeardown || context.after;
    exports.suite = context.suite || context.describe;
    exports.teardown = context.teardown || context.afterEach;
    exports.test = context.test || context.it;
  });
}

/**
 * Enable or disable bailing on the first failure.
 *
 * @param {Boolean} [bail]
 * @api public
 */

Mocha.prototype.bail = function(bail){
  if (0 == arguments.length) bail = true;
  this.suite.bail(bail);
  return this;
};

/**
 * Add test `file`.
 *
 * @param {String} file
 * @api public
 */

Mocha.prototype.addFile = function(file){
  this.files.push(file);
  return this;
};

/**
 * Set reporter to `reporter`, defaults to "suite-reporter".
 *
 * @param {String|Function} reporter name or constructor
 * @api public
 */

Mocha.prototype.reporter = function(reporter){
  nlapiLogExecution('DEBUG', 'Mocha reporter', typeof reporter);
  if ('function' == typeof reporter) {
    this._reporter = reporter;
  } else {
    reporter = reporter || 'suite-reporter';
    //nlapiLogExecution('DEBUG', 'Mocha reporter spec', reporter);
    var _reporter;
    try { _reporter = require('./reporters/' + reporter); } catch (err) {};
    if (!_reporter) try { _reporter = require(reporter); } catch (err) {};
    if (!_reporter && reporter === 'teamcity')
      console.warn('The Teamcity reporter was moved to a package named ' +
        'mocha-teamcity-reporter ' +
        '(https://npmjs.org/package/mocha-teamcity-reporter).');
    if (!_reporter) throw new Error('invalid reporter "' + reporter + '"');
    this._reporter = _reporter;
  }
  return this;
};

/**
 * Set test UI `name`, defaults to "bdd".
 *
 * @param {String} bdd
 * @api public
 */

Mocha.prototype.ui = function(name){
  name = name || 'bdd';
  this._ui = exports.interfaces[name];
  if (!this._ui) try { this._ui = require(name); } catch (err) {};
  if (!this._ui) throw new Error('invalid interface "' + name + '"');
  this._ui = this._ui(this.suite);
  return this;
};

/**
 * Load registered files.
 *
 * @api private
 */

Mocha.prototype.loadFiles = function(fn){
  var self = this;
  var suite = this.suite;
  var pending = this.files.length;
  this.files.forEach(function(file){
    file = path.resolve(file);
    nlapiLogExecution('DEBUG', 'loadfiles - file', file);
    suite.emit('pre-require', global, file, self);
    suite.emit('require', require(file), file, self);
    suite.emit('post-require', global, file, self);
    --pending || (fn && fn());
  });
};

/**
 * Enable growl support.
 *
 * @api private
 */

Mocha.prototype._growl = function(runner, reporter) {
  var notify = require('growl');

  runner.on('end', function(){
    //nlapiLogExecution('DEBUG', '_growl end');
    var stats = reporter.stats;
    if (stats.failures) {
      var msg = stats.failures + ' of ' + runner.total + ' tests failed';
      notify(msg, { name: 'mocha', title: 'Failed', image: image('error') });
    } else {
      notify(stats.passes + ' tests passed in ' + stats.duration + 'ms', {
          name: 'mocha'
        , title: 'Passed'
        , image: image('ok')
      });
    }
  });
};

/**
 * Add regexp to grep, if `re` is a string it is escaped.
 *
 * @param {RegExp|String} re
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.grep = function(re){
  this.options.grep = 'string' == typeof re
    ? new RegExp(escapeRe(re))
    : re;
  return this;
};

/**
 * Invert `.grep()` matches.
 *
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.invert = function(){
  this.options.invert = true;
  return this;
};

/**
 * Ignore global leaks.
 *
 * @param {Boolean} ignore
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.ignoreLeaks = function(ignore){
  this.options.ignoreLeaks = !!ignore;
  return this;
};

/**
 * Enable global leak checking.
 *
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.checkLeaks = function(){
  this.options.ignoreLeaks = false;
  return this;
};

/**
 * Enable growl support.
 *
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.growl = function(){
  this.options.growl = true;
  return this;
};

/**
 * Ignore `globals` array or string.
 *
 * @param {Array|String} globals
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.globals = function(globals){
  this.options.globals = (this.options.globals || []).concat(globals);
  return this;
};

/**
 * Emit color output.
 *
 * @param {Boolean} colors
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.useColors = function(colors){};

/**
 * Use inline diffs rather than +/-.
 *
 * @param {Boolean} inlineDiffs
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.useInlineDiffs = function(inlineDiffs) {
  this.options.useInlineDiffs = arguments.length && inlineDiffs != undefined
  ? inlineDiffs
  : false;
  return this;
};

/**
 * Set the timeout in milliseconds.
 *
 * @param {Number} timeout
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.timeout = function(timeout){
  this.suite.timeout(timeout);
  return this;
};

/**
 * Set slowness threshold in milliseconds.
 *
 * @param {Number} slow
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.slow = function(slow){
  this.suite.slow(slow);
  return this;
};

/**
 * Enable timeouts.
 *
 * @param {Boolean} enabled
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.enableTimeouts = function(enabled) {
  this.suite.enableTimeouts(arguments.length && enabled !== undefined
    ? enabled
    : true);
  return this
};

/**
 * Disable syntax highlighting (in browser).
 * @returns {Mocha}
 * @api public
 */
Mocha.prototype.noHighlighting = function() {
  this.options.noHighlighting = true;
  return this;
};

/**
 * Run tests and invoke `fn()` when complete.
 *
 * @param {Function} fn
 * @return {Runner}
 * @api public
 */

Mocha.prototype.run = function(fn){
  //nlapiLogExecution('DEBUG', 'Mocha prototype run enter', 'OK');
  if (this.files.length) this.loadFiles();
  var suite = this.suite;
  var options = this.options;
  options.files = this.files;
  var runner = new exports.Runner(suite);
  //nlapiLogExecution('DEBUG', 'Mocha prototype exports.Runner', 'OK');
  var reporter = new this._reporter(runner, options);
  //nlapiLogExecution('DEBUG', 'Mocha prototype run Reporter', 'OK');
  runner.ignoreLeaks = false !== options.ignoreLeaks;
  if (options.grep) runner.grep(options.grep, options.invert);
  if (options.globals) runner.globals(options.globals);
  if (options.growl) this._growl(runner, reporter);
  return runner.run(fn);
};

}); // module: mocha.js

require.register("ms.js", function(module, exports, require){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options['long'] ? longFormat(val) : shortFormat(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 's':
      return n * s;
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function shortFormat(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function longFormat(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

}); // module: ms.js

require.register("reporters/index.js", function(module, exports, require){}); // module: reporters/index.js

require.register("reporters/suite-reporter.js", function(module, exports, require){
	/**
	 * Expose `SuiteReporter`.
	 */
	exports = module.exports = $.SuiteReporter;
}); // module: reporters/json-cov.js

require.register("runnable.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var EventEmitter = require('browser/events').EventEmitter
  , debug = require('browser/debug')('mocha:runnable')
  , milliseconds = require('./ms');

/**
 * Save timer references to avoid Sinon interfering (see GH-237).
 */

var Date = global.Date
  , setTimeout = global.setTimeout
  , setInterval = global.setInterval
  , clearTimeout = global.clearTimeout
  , clearInterval = global.clearInterval;

/**
 * Object#toString().
 */

var toString = Object.prototype.toString;

/**
 * Expose `Runnable`.
 */

module.exports = Runnable;

/**
 * Initialize a new `Runnable` with the given `title` and callback `fn`.
 *
 * @param {String} title
 * @param {Function} fn
 * @api private
 */

function Runnable(title, fn) {
  this.title = title;
  this.fn = fn;
  //this.async = fn && fn.length;
  this.sync = true;
  this._timeout = 2000;
  this._slow = 75;
  this._enableTimeouts = true;
  this.timedOut = false;
}

/**
 * Inherit from `EventEmitter.prototype`.
 */

function F(){};
F.prototype = EventEmitter.prototype;
Runnable.prototype = new F;
Runnable.prototype.constructor = Runnable;


/**
 * Set & get timeout `ms`.
 *
 * @param {Number|String} ms
 * @return {Runnable|Number} ms or self
 * @api private
 */

Runnable.prototype.timeout = function(ms){
  if (0 == arguments.length) return this._timeout;
  if (ms === 0) this._enableTimeouts = false;
  if ('string' == typeof ms) ms = milliseconds(ms);
  debug('timeout %d', ms);
  this._timeout = ms;
  if (this.timer) this.resetTimeout();
  return this;
};

/**
 * Set & get slow `ms`.
 *
 * @param {Number|String} ms
 * @return {Runnable|Number} ms or self
 * @api private
 */

Runnable.prototype.slow = function(ms){
  if (0 === arguments.length) return this._slow;
  if ('string' == typeof ms) ms = milliseconds(ms);
  debug('timeout %d', ms);
  this._slow = ms;
  return this;
};

/**
 * Set and & get timeout `enabled`.
 *
 * @param {Boolean} enabled
 * @return {Runnable|Boolean} enabled or self
 * @api private
 */

Runnable.prototype.enableTimeouts = function(enabled){
  if (arguments.length === 0) return this._enableTimeouts;
  debug('enableTimeouts %s', enabled);
  this._enableTimeouts = enabled;
  return this;
};

/**
 * Return the full title generated by recursively
 * concatenating the parent's full title.
 *
 * @return {String}
 * @api public
 */

Runnable.prototype.fullTitle = function(){
  return this.parent.fullTitle() + ' ' + this.title;
};

/**
 * Clear the timeout.
 *
 * @api private
 */

Runnable.prototype.clearTimeout = function(){
  clearTimeout(this.timer);
};

/**
 * Inspect the runnable void of private properties.
 *
 * @return {String}
 * @api private
 */

Runnable.prototype.inspect = function(){
  return JSON.stringify(this, function(key, val){
    if ('_' == key[0]) return;
    if ('parent' == key) return '#<Suite>';
    if ('ctx' == key) return '#<Context>';
    return val;
  }, 2);
};

/**
 * Reset the timeout.
 *
 * @api private
 */

Runnable.prototype.resetTimeout = function(){
  var self = this;
  var ms = this.timeout() || 1e9;

  if (!this._enableTimeouts) return;
  //this.clearTimeout();
  this.timer = setTimeout(function(){
    if (!self._enableTimeouts) return;
    self.callback(new Error('timeout of ' + ms + 'ms exceeded'));
    self.timedOut = true;
  }, ms);
};

/**
 * Whitelist these globals for this test run
 *
 * @api private
 */
Runnable.prototype.globals = function(arr){
  var self = this;
  this._allowedGlobals = arr;
};

/**
 * Run the test and invoke `fn(err)`.
 *
 * @param {Function} fn
 * @api private
 */

Runnable.prototype.run = function(fn){
  var self = this
    , start = new Date
    , ctx = this.ctx
    , finished
    , emitted;

  // Some times the ctx exists but it is not runnable
  if (ctx && ctx.runnable) ctx.runnable(this);

  // called multiple times
  function multiple(err) {
    if (emitted) return;
    emitted = true;
    self.emit('error', err || new Error('done() called multiple times'));
  }

  // finished
  function done(err) {
    var ms = self.timeout();
    if (self.timedOut) return;
    if (finished) return multiple(err);
    //self.clearTimeout();
    self.duration = new Date - start;
    finished = true;
    if (!err && self.duration > ms && self._enableTimeouts) err = new Error('timeout of ' + ms + 'ms exceeded');
    fn(err);
  }

  // for .resetTimeout()
  this.callback = done;

  // sync or promise-returning
  try {
    if (this.pending) {
      done();
    } else {
      callFn(this.fn);
    }
  } catch (err) {
    done(err);
  }

  function callFn(fn) {
    var result = fn.call(ctx);
    if (result && typeof result.then === 'function') {
      self.resetTimeout();
      result
        .then(function() {
          done()
        },
        function(reason) {
          done(reason || new Error('Promise rejected with no or falsy reason'))
        });
    } else {
      done();
    }
  }
};

}); // module: runnable.js

require.register("runner.js", function(module, exports, require){
/**
 * Module dependencies.
 */

var EventEmitter = require('browser/events').EventEmitter,
  debug = require('browser/debug')('mocha:runner'),
  Test = require('./test'),
  utils = require('./utils'),
  filter = utils.filter,
  keys = utils.keys;

/**
 * Non-enumerable globals.
 */

var globals = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'XMLHttpRequest',
  'Date'
];

/**
 * Expose `Runner`.
 */

module.exports = Runner;

/**
 * Initialize a `Runner` for the given `suite`.
 *
 * Events:
 *
 *   - `start`  execution started
 *   - `end`  execution complete
 *   - `suite`  (suite) test suite execution started
 *   - `suite end`  (suite) all tests (and sub-suites) have finished
 *   - `test`  (test) test execution started
 *   - `test end`  (test) test completed
 *   - `hook`  (hook) hook execution started
 *   - `hook end`  (hook) hook complete
 *   - `pass`  (test) test passed
 *   - `fail`  (test, err) test failed
 *   - `pending`  (test) test pending
 *
 * @api public
 */

function Runner(suite) {
  var self = this;
  this._globals = [];
  this._abort = false;
  this.suite = suite;
  this.total = suite.total();
  this.failures = 0;
  this.on('test end', function(test){ self.checkGlobals(test); });
  this.on('hook end', function(hook){ self.checkGlobals(hook); });
  this.grep(/.*/);
  this.globals(this.globalProps().concat(extraGlobals()));
}

/**
 * Wrapper for setImmediate, process.nextTick, or browser polyfill.
 *
 * @param {Function} fn
 * @api private
 */

Runner.immediately = global.setImmediate || process.nextTick;

/**
 * Inherit from `EventEmitter.prototype`.
 */

function F(){};
F.prototype = EventEmitter.prototype;
Runner.prototype = new F;
Runner.prototype.constructor = Runner;


/**
 * Run tests with full titles matching `re`. Updates runner.total
 * with number of tests matched.
 *
 * @param {RegExp} re
 * @param {Boolean} invert
 * @return {Runner} for chaining
 * @api public
 */

Runner.prototype.grep = function(re, invert){
  debug('grep %s', re);
  this._grep = re;
  this._invert = invert;
  this.total = this.grepTotal(this.suite);
  return this;
};

/**
 * Returns the number of tests matching the grep search for the
 * given suite.
 *
 * @param {Suite} suite
 * @return {Number}
 * @api public
 */

Runner.prototype.grepTotal = function(suite) {
  var self = this;
  var total = 0;

  suite.eachTest(function(test){
    var match = self._grep.test(test.fullTitle());
    if (self._invert) match = !match;
    if (match) total++;
  });

  return total;
};

/**
 * Return a list of global properties.
 *
 * @return {Array}
 * @api private
 */

Runner.prototype.globalProps = function() {
  var props = utils.keys(global);

  // non-enumerables
  for (var i = 0; i < globals.length; ++i) {
    if (~utils.indexOf(props, globals[i])) continue;
    props.push(globals[i]);
  }

  return props;
};

/**
 * Allow the given `arr` of globals.
 *
 * @param {Array} arr
 * @return {Runner} for chaining
 * @api public
 */

Runner.prototype.globals = function(arr){
  if (0 == arguments.length) return this._globals;
  debug('globals %j', arr);
  this._globals = this._globals.concat(arr);
  return this;
};

/**
 * Check for global variable leaks.
 *
 * @api private
 */

Runner.prototype.checkGlobals = function(test){
  if (this.ignoreLeaks) return;
  var ok = this._globals;

  var globals = this.globalProps();
  var leaks;

  if (test) {
    ok = ok.concat(test._allowedGlobals || []);
  }

  if(this.prevGlobalsLength == globals.length) return;
  this.prevGlobalsLength = globals.length;

  leaks = filterLeaks(ok, globals);
  this._globals = this._globals.concat(leaks);

  if (leaks.length > 1) {
    this.fail(test, new Error('global leaks detected: ' + leaks.join(', ') + ''));
  } else if (leaks.length) {
    this.fail(test, new Error('global leak detected: ' + leaks[0]));
  }
};

/**
 * Fail the given `test`.
 *
 * @param {Test} test
 * @param {Error} err
 * @api private
 */

Runner.prototype.fail = function(test, err){
  ++this.failures;
  test.state = 'failed';

  if ('string' == typeof err) {
    err = new Error('the string "' + err + '" was thrown, throw an Error :)');
  }

  this.emit('fail', test, err);
};

/**
 * Fail the given `hook` with `err`.
 *
 * Hook failures work in the following pattern:
 * - If bail, then exit
 * - Failed `before` hook skips all tests in a suite and subsuites,
 *   but jumps to corresponding `after` hook
 * - Failed `before each` hook skips remaining tests in a
 *   suite and jumps to corresponding `after each` hook,
 *   which is run only once
 * - Failed `after` hook does not alter
 *   execution order
 * - Failed `after each` hook skips remaining tests in a
 *   suite and subsuites, but executes other `after each`
 *   hooks
 *
 * @param {Hook} hook
 * @param {Error} err
 * @api private
 */

Runner.prototype.failHook = function(hook, err){
  this.fail(hook, err);
  if (this.suite.bail()) {
    this.emit('end');
  }
};

/**
 * Run hook `name` callbacks and then invoke `fn()`.
 *
 * @param {String} name
 * @param {Function} function
 * @api private
 */

Runner.prototype.hook = function(name, fn){
  var suite = this.suite
    , hooks = suite['_' + name]
    , self = this
    , timer;

  function next(i) {
    var hook = hooks[i];
    if (!hook) return fn();
    if (self.failures && suite.bail()) return fn();
    self.currentRunnable = hook;

    hook.ctx.currentTest = self.test;

    self.emit('hook', hook);

    hook.on('error', function(err){
      self.failHook(hook, err);
    });

    hook.run(function(err){
      hook.removeAllListeners('error');
      var testError = hook.error();
      if (testError) self.fail(self.test, testError);
      if (err) {
        self.failHook(hook, err);

        // stop executing hooks, notify callee of hook err
        return fn(err);
      }
      self.emit('hook end', hook);
      delete hook.ctx.currentTest;
      next(++i);
    });
  }

  Runner.immediately(function(){
    next(0);
  });
};

/**
 * Run hook `name` for the given array of `suites`
 * in order, and callback `fn(err, errSuite)`.
 *
 * @param {String} name
 * @param {Array} suites
 * @param {Function} fn
 * @api private
 */

Runner.prototype.hooks = function(name, suites, fn){
  var self = this
    , orig = this.suite;

  function next(suite) {
    self.suite = suite;

    if (!suite) {
      self.suite = orig;
      return fn();
    }

    self.hook(name, function(err){
      if (err) {
        var errSuite = self.suite;
        self.suite = orig;
        return fn(err, errSuite);
      }

      next(suites.pop());
    });
  }

  next(suites.pop());
};

/**
 * Run hooks from the top level down.
 *
 * @param {String} name
 * @param {Function} fn
 * @api private
 */

Runner.prototype.hookUp = function(name, fn){
  var suites = [this.suite].concat(this.parents()).reverse();
  this.hooks(name, suites, fn);
};

/**
 * Run hooks from the bottom up.
 *
 * @param {String} name
 * @param {Function} fn
 * @api private
 */

Runner.prototype.hookDown = function(name, fn){
  var suites = [this.suite].concat(this.parents());
  this.hooks(name, suites, fn);
};

/**
 * Return an array of parent Suites from
 * closest to furthest.
 *
 * @return {Array}
 * @api private
 */

Runner.prototype.parents = function(){
  var suite = this.suite
    , suites = [];
  while (suite = suite.parent) suites.push(suite);
  return suites;
};

/**
 * Run the current test and callback `fn(err)`.
 *
 * @param {Function} fn
 * @api private
 */

Runner.prototype.runTest = function(fn){
  var test = this.test
    , self = this;

  try {
    test.on('error', function(err){
      self.fail(test, err);
    });
    test.run(fn);
  } catch (err) {
    fn(err);
  }
};

/**
 * Run tests in the given `suite` and invoke
 * the callback `fn()` when complete.
 *
 * @param {Suite} suite
 * @param {Function} fn
 * @api private
 */

Runner.prototype.runTests = function(suite, fn){
  var self = this
    , tests = suite.tests.slice()
    , test;

  function hookErr(err, errSuite, after) {
    // before/after Each hook for errSuite failed:
    var orig = self.suite;

    // for failed 'after each' hook start from errSuite parent,
    // otherwise start from errSuite itself
    self.suite = after ? errSuite.parent : errSuite;

    if (self.suite) {
      // call hookUp afterEach
      self.hookUp('afterEach', function(err2, errSuite2) {
        self.suite = orig;
        // some hooks may fail even now
        if (err2) return hookErr(err2, errSuite2, true);
        // report error suite
        fn(errSuite);
      });
    } else {
      // there is no need calling other 'after each' hooks
      self.suite = orig;
      fn(errSuite);
    }
  }

  function next(err, errSuite) {
    // if we bail after first err
    if (self.failures && suite._bail) return fn();

    if (self._abort) return fn();

    if (err) return hookErr(err, errSuite, true);

    // next test
    test = tests.shift();

    // all done
    if (!test) return fn();

    // grep
    var match = self._grep.test(test.fullTitle());
    if (self._invert) match = !match;
    if (!match) return next();

    // pending
    if (test.pending) {
      self.emit('pending', test);
      self.emit('test end', test);
      return next();
    }

    // execute test and hook(s)
    self.emit('test', self.test = test);
    self.hookDown('beforeEach', function(err, errSuite){

      if (err) return hookErr(err, errSuite, false);

      self.currentRunnable = self.test;
      self.runTest(function(err){
        test = self.test;

        if (err) {
          self.fail(test, err);
          self.emit('test end', test);
          return self.hookUp('afterEach', next);
        }

        test.state = 'passed';
        self.emit('pass', test);
        self.emit('test end', test);
        self.hookUp('afterEach', next);
      });
    });
  }

  this.next = next;
  next();
};

/**
 * Run the given `suite` and invoke the
 * callback `fn()` when complete.
 *
 * @param {Suite} suite
 * @param {Function} fn
 * @api private
 */

Runner.prototype.runSuite = function(suite, fn){
  var total = this.grepTotal(suite)
    , self = this
    , i = 0;

  debug('run suite %s', suite.fullTitle());

  if (!total) return fn();

  this.emit('suite', this.suite = suite);

  function next(errSuite) {
    if (errSuite) {
      // current suite failed on a hook from errSuite
      if (errSuite == suite) {
        // if errSuite is current suite
        // continue to the next sibling suite
        return done();
      } else {
        // errSuite is among the parents of current suite
        // stop execution of errSuite and all sub-suites
        return done(errSuite);
      }
    }

    if (self._abort) return done();

    var curr = suite.suites[i++];
    if (!curr) return done();
    self.runSuite(curr, next);
  }

  function done(errSuite) {
    self.suite = suite;
    self.hook('afterAll', function(){
      nlapiLogExecution('DEBUG', 'Mocha runSuite afterAll', 'OK');
      self.emit('suite end', suite);
      fn(errSuite);
    });
  }

  this.hook('beforeAll', function(err){
    if (err) return done();
    nlapiLogExecution('DEBUG', 'Mocha runSuite beforeAll', 'OK');
    self.runTests(suite, next);
  });
};

/**
 * Handle uncaught exceptions.
 *
 * @param {Error} err
 * @api private
 */

Runner.prototype.uncaught = function(err){
  if (err) {
    debug('uncaught exception %s', err !== function () {
      return this;
    }.call(err) ? err : ( err.message || err ));
  } else {
    debug('uncaught undefined exception');
    err = new Error('Caught undefined error, did you throw without specifying what?');
  }
  err.uncaught = true;

  var runnable = this.currentRunnable;
  if (!runnable) return;

  var wasAlreadyDone = runnable.state;
  this.fail(runnable, err);

  //runnable.clearTimeout();

  if (wasAlreadyDone) return;

  // recover from test
  if ('test' == runnable.type) {
    this.emit('test end', runnable);
    this.hookUp('afterEach', this.next);
    return;
  }

  // bail on hooks
  this.emit('end');
};

/**
 * Run the root suite and invoke `fn(failures)`
 * on completion.
 *
 * @param {Function} fn
 * @return {Runner} for chaining
 * @api public
 */

Runner.prototype.run = function(fn){
  var self = this
    , fn = fn || function(){};

  function uncaught(err){
    self.uncaught(err);
  }

  debug('start');

  // callback
  this.on('end', function(){
    debug('end');
    process.removeListener('uncaughtException', uncaught);
    fn(self.failures);
  });

  // run suites
  this.emit('start');
  this.runSuite(this.suite, function(){
    debug('finished running');
    self.emit('end');
  });

  // uncaught exception
  process.on('uncaughtException', uncaught);

  return this;
};

/**
 * Cleanly abort execution
 *
 * @return {Runner} for chaining
 * @api public
 */
Runner.prototype.abort = function(){
  debug('aborting');
  this._abort = true;
}

/**
 * Filter leaks with the given globals flagged as `ok`.
 *
 * @param {Array} ok
 * @param {Array} globals
 * @return {Array}
 * @api private
 */

function filterLeaks(ok, globals) {
  return filter(globals, function(key){
    // Firefox and Chrome exposes iframes as index inside the window object
    if (/^d+/.test(key)) return false;

    // in firefox
    // if runner runs in an iframe, this iframe's window.getInterface method not init at first
    // it is assigned in some seconds
    if (global.navigator && /^getInterface/.test(key)) return false;

    // an iframe could be approached by window[iframeIndex]
    // in ie6,7,8 and opera, iframeIndex is enumerable, this could cause leak
    if (global.navigator && /^\d+/.test(key)) return false;

    // Opera and IE expose global variables for HTML element IDs (issue #243)
    if (/^mocha-/.test(key)) return false;

    var matched = filter(ok, function(ok){
      if (~ok.indexOf('*')) return 0 == key.indexOf(ok.split('*')[0]);
      return key == ok;
    });
    return matched.length == 0 && (!global.navigator || 'onerror' !== key);
  });
}

/**
 * Array of globals dependent on the environment.
 *
 * @return {Array}
 * @api private
 */

 function extraGlobals() {
  if (typeof(process) === 'object' &&
      typeof(process.version) === 'string') {

    var nodeVersion = process.version.split('.').reduce(function(a, v) {
      return a << 8 | v;
    });

    // 'errno' was renamed to process._errno in v0.9.11.

    if (nodeVersion < 0x00090B) {
      return ['errno'];
    }
  }

  return [];
 }

}); // module: runner.js

require.register("suite.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var EventEmitter = require('browser/events').EventEmitter
  , debug = require('browser/debug')('mocha:suite')
  , milliseconds = require('./ms')
  , utils = require('./utils')
  , Hook = require('./hook');

/**
 * Expose `Suite`.
 */

exports = module.exports = Suite;

/**
 * Create a new `Suite` with the given `title`
 * and parent `Suite`. When a suite with the
 * same title is already present, that suite
 * is returned to provide nicer reporter
 * and more flexible meta-testing.
 *
 * @param {Suite} parent
 * @param {String} title
 * @return {Suite}
 * @api public
 */

exports.create = function(parent, title){
  var suite = new Suite(title, parent.ctx);
  suite.parent = parent;
  if (parent.pending) suite.pending = true;
  title = suite.fullTitle();
  parent.addSuite(suite);
  return suite;
};

/**
 * Initialize a new `Suite` with the given
 * `title` and `ctx`.
 *
 * @param {String} title
 * @param {Context} ctx
 * @api private
 */

function Suite(title, parentContext) {
  this.title = title;
  var context = function() {};
  context.prototype = parentContext;
  this.ctx = new context();
  this.suites = [];
  this.tests = [];
  this.pending = false;
  this._beforeEach = [];
  this._beforeAll = [];
  this._afterEach = [];
  this._afterAll = [];
  this.root = !title;
  this._timeout = 2000;
  this._enableTimeouts = true;
  this._slow = 75;
  this._bail = false;
}

/**
 * Inherit from `EventEmitter.prototype`.
 */

function F(){};
F.prototype = EventEmitter.prototype;
Suite.prototype = new F;
Suite.prototype.constructor = Suite;


/**
 * Return a clone of this `Suite`.
 *
 * @return {Suite}
 * @api private
 */

Suite.prototype.clone = function(){
  var suite = new Suite(this.title);
  debug('clone');
  suite.ctx = this.ctx;
  suite.timeout(this.timeout());
  suite.enableTimeouts(this.enableTimeouts());
  suite.slow(this.slow());
  suite.bail(this.bail());
  return suite;
};

/**
 * Set timeout `ms` or short-hand such as "2s".
 *
 * @param {Number|String} ms
 * @return {Suite|Number} for chaining
 * @api private
 */

Suite.prototype.timeout = function(ms){
  if (0 == arguments.length) return this._timeout;
  if (ms === 0) this._enableTimeouts = false;
  if ('string' == typeof ms) ms = milliseconds(ms);
  debug('timeout %d', ms);
  this._timeout = parseInt(ms, 10);
  return this;
};

/**
  * Set timeout `enabled`.
  *
  * @param {Boolean} enabled
  * @return {Suite|Boolean} self or enabled
  * @api private
  */

Suite.prototype.enableTimeouts = function(enabled){
  if (arguments.length === 0) return this._enableTimeouts;
  debug('enableTimeouts %s', enabled);
  this._enableTimeouts = enabled;
  return this;
}

/**
 * Set slow `ms` or short-hand such as "2s".
 *
 * @param {Number|String} ms
 * @return {Suite|Number} for chaining
 * @api private
 */

Suite.prototype.slow = function(ms){
  if (0 === arguments.length) return this._slow;
  if ('string' == typeof ms) ms = milliseconds(ms);
  debug('slow %d', ms);
  this._slow = ms;
  return this;
};

/**
 * Sets whether to bail after first error.
 *
 * @parma {Boolean} bail
 * @return {Suite|Number} for chaining
 * @api private
 */

Suite.prototype.bail = function(bail){
  if (0 == arguments.length) return this._bail;
  debug('bail %s', bail);
  this._bail = bail;
  return this;
};

/**
 * Run `fn(test[, done])` before running tests.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.beforeAll = function(title, fn){
  if (this.pending) return this;
  if ('function' === typeof title) {
    fn = title;
    title = fn.name;
  }
  title = '"before all" hook' + (title ? ': ' + title : '');

  var hook = new Hook(title, fn);
  hook.parent = this;
  hook.timeout(this.timeout());
  hook.enableTimeouts(this.enableTimeouts());
  hook.slow(this.slow());
  hook.ctx = this.ctx;
  this._beforeAll.push(hook);
  this.emit('beforeAll', hook);
  return this;
};

/**
 * Run `fn(test[, done])` after running tests.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.afterAll = function(title, fn){
  if (this.pending) return this;
  if ('function' === typeof title) {
    fn = title;
    title = fn.name;
  }
  title = '"after all" hook' + (title ? ': ' + title : '');

  var hook = new Hook(title, fn);
  hook.parent = this;
  hook.timeout(this.timeout());
  hook.enableTimeouts(this.enableTimeouts());
  hook.slow(this.slow());
  hook.ctx = this.ctx;
  this._afterAll.push(hook);
  this.emit('afterAll', hook);
  return this;
};

/**
 * Run `fn(test[, done])` before each test case.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.beforeEach = function(title, fn){
  if (this.pending) return this;
  if ('function' === typeof title) {
    fn = title;
    title = fn.name;
  }
  title = '"before each" hook' + (title ? ': ' + title : '');

  var hook = new Hook(title, fn);
  hook.parent = this;
  hook.timeout(this.timeout());
  hook.enableTimeouts(this.enableTimeouts());
  hook.slow(this.slow());
  hook.ctx = this.ctx;
  this._beforeEach.push(hook);
  this.emit('beforeEach', hook);
  return this;
};

/**
 * Run `fn(test[, done])` after each test case.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.afterEach = function(title, fn){
  if (this.pending) return this;
  if ('function' === typeof title) {
    fn = title;
    title = fn.name;
  }
  title = '"after each" hook' + (title ? ': ' + title : '');

  var hook = new Hook(title, fn);
  hook.parent = this;
  hook.timeout(this.timeout());
  hook.enableTimeouts(this.enableTimeouts());
  hook.slow(this.slow());
  hook.ctx = this.ctx;
  this._afterEach.push(hook);
  this.emit('afterEach', hook);
  return this;
};

/**
 * Add a test `suite`.
 *
 * @param {Suite} suite
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.addSuite = function(suite){
  suite.parent = this;
  suite.timeout(this.timeout());
  suite.enableTimeouts(this.enableTimeouts());
  suite.slow(this.slow());
  suite.bail(this.bail());
  this.suites.push(suite);
  this.emit('suite', suite);
  return this;
};

/**
 * Add a `test` to this suite.
 *
 * @param {Test} test
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.addTest = function(test){
  test.parent = this;
  test.timeout(this.timeout());
  test.enableTimeouts(this.enableTimeouts());
  test.slow(this.slow());
  test.ctx = this.ctx;
  this.tests.push(test);
  this.emit('test', test);
  return this;
};

/**
 * Return the full title generated by recursively
 * concatenating the parent's full title.
 *
 * @return {String}
 * @api public
 */

Suite.prototype.fullTitle = function(){
  if (this.parent) {
    var full = this.parent.fullTitle();
    if (full) return full + ' ' + this.title;
  }
  return this.title;
};

/**
 * Return the total number of tests.
 *
 * @return {Number}
 * @api public
 */

Suite.prototype.total = function(){
  return utils.reduce(this.suites, function(sum, suite){
    return sum + suite.total();
  }, 0) + this.tests.length;
};

/**
 * Iterates through each suite recursively to find
 * all tests. Applies a function in the format
 * `fn(test)`.
 *
 * @param {Function} fn
 * @return {Suite}
 * @api private
 */

Suite.prototype.eachTest = function(fn){
  utils.forEach(this.tests, fn);
  utils.forEach(this.suites, function(suite){
    suite.eachTest(fn);
  });
  return this;
};

}); // module: suite.js

require.register("test.js", function(module, exports, require){

/**
 * Module dependencies.
 */

var Runnable = require('./runnable');

/**
 * Expose `Test`.
 */

module.exports = Test;

/**
 * Initialize a new `Test` with the given `title` and callback `fn`.
 *
 * @param {String} title
 * @param {Function} fn
 * @api private
 */

function Test(title, fn) {
  Runnable.call(this, title, fn);
  this.pending = !fn;
  this.type = 'test';
}

/**
 * Inherit from `Runnable.prototype`.
 */

function F(){};
F.prototype = Runnable.prototype;
Test.prototype = new F;
Test.prototype.constructor = Test;


}); // module: test.js

require.register("utils.js", function(module, exports, require){
/**
 * Module dependencies.
 */

var fs = require('browser/fs')
  , path = require('browser/path')
  , basename = path.basename
  , exists = fs.existsSync || path.existsSync
  , glob = require('browser/glob')
  , join = path.join
  , debug = require('browser/debug')('mocha:watch');

/**
 * Ignored directories.
 */

var ignore = ['node_modules', '.git'];

/**
 * Escape special characters in the given string of html.
 *
 * @param  {String} html
 * @return {String}
 * @api private
 */

exports.escape = function(html){
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Array#forEach (<=IE8)
 *
 * @param {Array} array
 * @param {Function} fn
 * @param {Object} scope
 * @api private
 */

exports.forEach = function(arr, fn, scope){
  for (var i = 0, l = arr.length; i < l; i++)
    fn.call(scope, arr[i], i);
};

/**
 * Array#map (<=IE8)
 *
 * @param {Array} array
 * @param {Function} fn
 * @param {Object} scope
 * @api private
 */

exports.map = function(arr, fn, scope){
  var result = [];
  for (var i = 0, l = arr.length; i < l; i++)
    result.push(fn.call(scope, arr[i], i));
  return result;
};

/**
 * Array#indexOf (<=IE8)
 *
 * @parma {Array} arr
 * @param {Object} obj to find index of
 * @param {Number} start
 * @api private
 */

exports.indexOf = function(arr, obj, start){
  for (var i = start || 0, l = arr.length; i < l; i++) {
    if (arr[i] === obj)
      return i;
  }
  return -1;
};

/**
 * Array#reduce (<=IE8)
 *
 * @param {Array} array
 * @param {Function} fn
 * @param {Object} initial value
 * @api private
 */

exports.reduce = function(arr, fn, val){
  var rval = val;

  for (var i = 0, l = arr.length; i < l; i++) {
    rval = fn(rval, arr[i], i, arr);
  }

  return rval;
};

/**
 * Array#filter (<=IE8)
 *
 * @param {Array} array
 * @param {Function} fn
 * @api private
 */

exports.filter = function(arr, fn){
  var ret = [];

  for (var i = 0, l = arr.length; i < l; i++) {
    var val = arr[i];
    if (fn(val, i, arr)) ret.push(val);
  }

  return ret;
};

/**
 * Object.keys (<=IE8)
 *
 * @param {Object} obj
 * @return {Array} keys
 * @api private
 */

exports.keys = Object.keys || function(obj) {
  var keys = []
    , has = Object.prototype.hasOwnProperty // for `window` on <=IE8

  for (var key in obj) {
    if (has.call(obj, key)) {
      keys.push(key);
    }
  }

  return keys;
};

/**
 * Watch the given `files` for changes
 * and invoke `fn(file)` on modification.
 *
 * @param {Array} files
 * @param {Function} fn
 * @api private
 */

exports.watch = function(files, fn){
  var options = { interval: 100 };
  files.forEach(function(file){
    debug('file %s', file);
    fs.watchFile(file, options, function(curr, prev){
      if (prev.mtime < curr.mtime) fn(file);
    });
  });
};

/**
 * Ignored files.
 */

function ignored(path){
  return !~ignore.indexOf(path);
}

/**
 * Lookup files in the given `dir`.
 *
 * @return {Array}
 * @api private
 */

exports.files = function(dir, ext, ret){
  ret = ret || [];
  ext = ext || ['js'];

  var re = new RegExp('\\.(' + ext.join('|') + ')$');

  fs.readdirSync(dir)
  .filter(ignored)
  .forEach(function(path){
    path = join(dir, path);
    if (fs.statSync(path).isDirectory()) {
      exports.files(path, ext, ret);
    } else if (path.match(re)) {
      ret.push(path);
    }
  });

  return ret;
};

/**
 * Compute a slug from the given `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

exports.slug = function(str){
  return str
    .toLowerCase()
    .replace(/ +/g, '-')
    .replace(/[^-\w]/g, '');
};

/**
 * Strip the function definition from `str`,
 * and re-indent for pre whitespace.
 */

exports.clean = function(str) {
  str = str
    .replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/^\uFEFF/, '')
    .replace(/^function *\(.*\) *{|\(.*\) *=> *{?/, '')
    .replace(/\s+\}$/, '');

  var spaces = str.match(/^\n?( *)/)[1].length
    , tabs = str.match(/^\n?(\t*)/)[1].length
    , re = new RegExp('^\n?' + (tabs ? '\t' : ' ') + '{' + (tabs ? tabs : spaces) + '}', 'gm');

  str = str.replace(re, '');

  return exports.trim(str);
};

/**
 * Trim the given `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

exports.trim = function(str){
  return str.replace(/^\s+|\s+$/g, '');
};

/**
 * Parse the given `qs`.
 *
 * @param {String} qs
 * @return {Object}
 * @api private
 */

exports.parseQuery = function(qs){
  return exports.reduce(qs.replace('?', '').split('&'), function(obj, pair){
    var i = pair.indexOf('=')
      , key = pair.slice(0, i)
      , val = pair.slice(++i);

    obj[key] = decodeURIComponent(val);
    return obj;
  }, {});
};

/**
 * Highlight the given string of `js`.
 *
 * @param {String} js
 * @return {String}
 * @api private
 */

function highlight(js) {
  return js
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\/\/(.*)/gm, '<span class="comment">//$1</span>')
    .replace(/('.*?')/gm, '<span class="string">$1</span>')
    .replace(/(\d+\.\d+)/gm, '<span class="number">$1</span>')
    .replace(/(\d+)/gm, '<span class="number">$1</span>')
    .replace(/\bnew[ \t]+(\w+)/gm, '<span class="keyword">new</span> <span class="init">$1</span>')
    .replace(/\b(function|new|throw|return|var|if|else)\b/gm, '<span class="keyword">$1</span>')
}

/**
 * Highlight the contents of tag `name`.
 *
 * @param {String} name
 * @api private
 */

exports.highlightTags = function(name) {
  var code = document.getElementById('mocha').getElementsByTagName(name);
  for (var i = 0, len = code.length; i < len; ++i) {
    code[i].innerHTML = highlight(code[i].innerHTML);
  }
};


/**
 * Stringify `obj`.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

exports.stringify = function(obj) {
  if (obj instanceof RegExp) return obj.toString();
  return JSON.stringify(exports.canonicalize(obj), null, 2).replace(/,(\n|$)/g, '$1');
}

/**
 * Return a new object that has the keys in sorted order.
 * @param {Object} obj
 * @param {Array} [stack]
 * @return {Object}
 * @api private
 */

exports.canonicalize = function(obj, stack) {
  stack = stack || [];

  if (exports.indexOf(stack, obj) !== -1) return '[Circular]';

  var canonicalizedObj;

  if ({}.toString.call(obj) === '[object Array]') {
    stack.push(obj);
    canonicalizedObj = exports.map(obj, function (item) {
      return exports.canonicalize(item, stack);
    });
    stack.pop();
  } else if (typeof obj === 'object' && obj !== null) {
    stack.push(obj);
    canonicalizedObj = {};
    exports.forEach(exports.keys(obj).sort(), function (key) {
      canonicalizedObj[key] = exports.canonicalize(obj[key], stack);
    });
    stack.pop();
  } else {
    canonicalizedObj = obj;
  }

  return canonicalizedObj;
 }

/**
 * Lookup file names at the given `path`.
 */
exports.lookupFiles = function lookupFiles(path, extensions, recursive) {
  var files = [];
  var re = new RegExp('\\.(' + extensions.join('|') + ')$');

  if (!exists(path)) {
    if (exists(path + '.js')) {
      path += '.js';
    } else {
      files = glob.sync(path);
      if (!files.length) throw new Error("cannot resolve path (or pattern) '" + path + "'");
      return files;
    }
  }

  try {
    var stat = fs.statSync(path);
    if (stat.isFile()) return path;
  }
  catch (ignored) {
    return;
  }

  fs.readdirSync(path).forEach(function(file){
    file = join(path, file);
    try {
      var stat = fs.statSync(file);
      if (stat.isDirectory()) {
        if (recursive) {
          files = files.concat(lookupFiles(file, extensions, recursive));
        }
        return;
      }
    }
    catch (ignored) {
      return;
    }
    if (!stat.isFile() || !re.test(file) || basename(file)[0] === '.') return;
    files.push(file);
  });

  return files;
}

}); // module: utils.js
// The global object is "self" in Web Workers.
var global = (function() { return this; })();

/**
 * Save timer references to avoid Sinon interfering (see GH-237).
 */

var Date = global.Date;
var setTimeout = global.setTimeout;
var setInterval = global.setInterval;
var clearTimeout = global.clearTimeout;
var clearInterval = global.clearInterval;

/**
 * Node shims.
 *
 * These are meant only to allow
 * mocha.js to run untouched, not
 * to allow running node code in
 * the browser.
 */

var process = {};
process.exit = function(status){};
process.stdout = {};

var uncaughtExceptionHandlers = [];

var originalOnerrorHandler = global.onerror;

/**
 * Remove uncaughtException listener.
 * Revert to original onerror handler if previously defined.
 */

process.removeListener = function(e, fn){
  if ('uncaughtException' == e) {
    if (originalOnerrorHandler) {
      global.onerror = originalOnerrorHandler;
    } else {
      global.onerror = function() {};
    }
    var i = Mocha.utils.indexOf(uncaughtExceptionHandlers, fn);
    if (i != -1) { uncaughtExceptionHandlers.splice(i, 1); }
  }
};

/**
 * Implements uncaughtException listener.
 */

process.on = function(e, fn){
  if ('uncaughtException' == e) {
    global.onerror = function(err, url, line){
      fn(new Error(err + ' (' + url + ':' + line + ')'));
      return true;
    };
    uncaughtExceptionHandlers.push(fn);
  }
};

/**
 * Expose mocha.
 */

var Mocha = global.Mocha = require('mocha'),
    mocha = global.mocha = new Mocha({});

// The BDD UI is registered by default, but no UI will be functional in the
// browser without an explicit call to the overridden `mocha.ui` (see below).
// Ensure that this default UI does not expose its methods to the global scope.
mocha.suite.removeAllListeners('pre-require');

var immediateQueue = []
  , immediateTimeout;

function timeslice() {
  var immediateStart = new Date().getTime();
  while (immediateQueue.length && (new Date().getTime() - immediateStart) < 100) {
    immediateQueue.shift()();
  }
  if (immediateQueue.length) {
    immediateTimeout = timeslice()//setTimeout(timeslice, 0);
  } else {
    immediateTimeout = null;
  }
}

/**
 * High-performance override of Runner.immediately.
 */

Mocha.Runner.immediately = function(callback) {
  immediateQueue.push(callback);
  if (!immediateTimeout) {
    immediateTimeout = timeslice()//setTimeout(timeslice, 0);
  }
};

/**
 * Function to allow assertion libraries to throw errors directly into mocha.
 * This is useful when running tests in a browser because window.onerror will
 * only receive the 'message' attribute of the Error.
 */
mocha.throwError = function(err) {
  Mocha.utils.forEach(uncaughtExceptionHandlers, function (fn) {
    fn(err);
  });
  throw err;
};

/**
 * Override ui to ensure that the ui functions are initialized.
 * Normally this would happen in Mocha.prototype.loadFiles.
 */

mocha.ui = function(ui){
  Mocha.prototype.ui.call(this, ui);
  this.suite.emit('pre-require', global, null, this);
  return this;
};

/**
 * Setup mocha with the given setting options.
 */

mocha.setup = function(opts){
  if ('string' == typeof opts) opts = { ui: opts };
  for (var opt in opts) this[opt](opts[opt]);
  return this;
};

/**
 * Run mocha, returning the Runner.
 */

mocha.run = function(fn){
  var options = mocha.options;
  var query = Mocha.utils.parseQuery(''); //In SS we dont want any URL param parsing

  if (query.invert) mocha.invert();
  return Mocha.prototype.run.call(mocha, function(err){
    // The DOM Document is not available in NetSuite.
	if(err)
		nlapiLogExecution('ERROR', 'Errors count in Mocha runner', err);
    if (fn) fn(err);
  });
};

/**
 * Expose the process shim.
 */

Mocha.process = process;
})();
nlapiLogExecution('DEBUG', 'load time for mocha', (new Date() - t1).toString() + "ms");
