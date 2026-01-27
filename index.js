var fs = require('fs')
var path = require('path')
var Readable = require('stream').Readable
var through = require('through2')
var readdirp = require('readdirp')
var once = require('once')
var split = require('split')
var xtend = require('xtend')
var combine = require('stream-combiner')

function createDuplexStream (filename, opts) {
  filename = filename || ''
  opts = opts || {}
  opts.fn = opts.fn || '_'
  /*
   * RegExp explaination
   *
   * (?<=               begin of a positive lookbehind that makes sure that the string literal is an argument of the i18n function
   *   opts.fn          i18n function name
   *   \(\s*            opening paranthesis followed by optional whitespace
   *   (?:              non capturing group matching individual prior arguments to the function and their delimeters
   *     (?:                non capturing group matching a single prior argument
   *       "(?:[^"]|\\.)*"  possible argument: a string literal quoted with double quotes, containing only escaped quotes if any
   *       |                or
   *       '(?:[^']|\\.)*'  same with single quotes
   *     )                  end of single argument
   *     \s*,\s*          delimeter: the arguments are seperated by commas and optional whitespace
   *   )*                 end of argument list, ending with a delimeter
   * )                    end of positive lookbehind and therefore everything that comes before the actual string literal that should be matched
   *
   * (                    begin first capturing group containing the string value including its quotes (stripped away later via text.slice(1, -1))
   *   (["'])             second capturing group containing the quote character
   *   (?:                begin non capturing group containing a single (escaped or unescaped) character of the string literal's text content
   *     (?=              begin of a positive lookahead matching and capturing a backslash, if there is one at the current position
   *       (\\?)          capturing the backslash (or an empty string) in \3
   *     )
   *     \3.              matches any character, optionally preceeded by a backslash.
   *   )*?                end of the character. The lazy repetition ensures, that no quotes (\2) are included. Escaped quotes are included, because the character immediately after a backslash is always included, since \3 is followed by a dot and therefore the string cannot end with a backslash, but automatically matches the next character as well.
   *   \2                 the quote character, closing the string literal
   * )                    end of the capturing group containing the string literal
   *
   * (?=                  begin of a positive lookahead matching any paramters that might follow after the target string literal
   *   (?:                analogous to the beginning: non capturing group matching arguments and their delimeters
   *     \s*,\s*          now we start with the delimeter
   *     (?:                  match single argument
   *       "(?:[^"]|\\.)*"    string literal with double quotes
   *       |'(?:[^']|\\.)*'   or with single quotes
   *       |[^"')]+           or without any quotes (numbers, object references, variables, ...). Cannot contain any paranthesis either, as it is not possible to ensure that every closing bracket has a preceding opening one with regex (would require at least a context free language)
   *     )
   *   )*                 end of argument list
   *   \s*                optional whitespace
   *   \)                 closing paranthesis
   * )                    end of positive lookahead
   */
  opts.regex = opts.regex || new RegExp("(?<=" + opts.fn + "\\(\\s*(?:(?:\"(?:[^\"]|\\\\.)*\"|'(?:[^']|\\\\.)*')\\s*,\\s*)*)(([\"'])(?:(?=(\\\\?))\\3.)*?\\2)(?=(?:\\s*,\\s*(?:\"(?:[^\"]|\\\\.)*\"|'(?:[^']|\\\\.)*'|[^\"')]+))*\\s*\\))", 'g')
  opts.regexTextCaptureIndex = opts.regexTextCaptureIndex || 1

  var lineNum = 1

  return combine(
    split(),
    through(function (line, enc, cb) {
      line = line.toString()

      var matches
      var first = true

      while ((matches = opts.regex.exec(line)) !== null) {
        var entry = '\n'

        if (first) {
          const relativeFilename = path.relative(process.cwd(), filename)
          entry += '#: ' + relativeFilename + ':' + lineNum + '\n'
          first = false
        }

        var text = matches[opts.regexTextCaptureIndex]

        if (text[0] == "'") {
          text = text.slice(1, -1)
          text = text.replace(/\\'/g, "'")
          text = '"' + text.replace(/"/g, '\\"') + '"'
        }

        entry += 'msgid ' + text + '\n'
        entry += 'msgstr ' + text + '\n'

        this.push(entry)
      }

      lineNum++
      opts.regex.lastIndex = 0
      cb()
    })
  )
}

module.exports = createDuplexStream

module.exports.createReadStream = function (files, opts) {
  if (!Array.isArray(files)) files = [files]

  var index = 0
  var readable = new Readable()

  readable._read = function () {
    var push = true

    while (push && index < files.length) {
      push = this.push(files[index])
      index++
    }

    this.push(null)
  }

  return readable.pipe(createDuplexFileStream(opts))
}

function getText (filename, opts) {
  return fs.createReadStream(filename).pipe(createDuplexStream(filename, opts))
}

var READDIRP_OPTS = {
  fileFilter: ['!.*', '!*.png', '!*.jpg', '!*.gif', '!*.zip', '!*.gz'],
  directoryFilter: ['!.*', '!node_modules', '!coverage']
}

function createDuplexFileStream (opts) {
  opts = opts || {}
  opts.readdirp = opts.readdirp || {}

  return through(function (filename, enc, cb) {
    var self = this
    filename = filename.toString()
    cb = once(cb)

    self.push('#, fuzzy\n')
    self.push('msgid ""\n')
    self.push('msgstr ""\n')
    self.push('"Content-Type: text/plain; charset=UTF-8\\n"\n')

    fs.stat(filename, function (er, stats) {
      if (er) return cb(er)

      if (stats.isFile()) {
        getText(filename, opts)
          .on('data', function (entry) {self.push(entry)})
          .on('error', function (er) {
            console.error('File getText error', filename, er)
            cb(er)
          })
          .on('end', function () {
            cb()
          })
      } else if (stats.isDirectory()) {
        var total = 0
        var complete = 0
        var readdirpComplete = false

        readdirp(filename, xtend(READDIRP_OPTS, opts.readdirp))
          .on('data', function (entry) {
            total++

            getText(entry.fullPath, opts)
              .on('data', function (entry) {self.push(entry)})
              .on('error', function (er) {
                console.error('Directory getText error', entry.fullPath, er)
                cb(er)
              })
              .on('end', function () {
                complete++
                if (total == complete && readdirpComplete) cb()
              })
          })
          .on('error', function (er) {
            console.error('Directory error', filename, er)
            cb(er)
          })
          .on('end', function () {
            readdirpComplete = true
          })
      }
    })
  })
}
