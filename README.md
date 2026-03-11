# xgettext-regex

Minimum viable xgettext .pot file generator. Uses a configurable regex to get translation keys.

___________________
*Note: This repository was forked from [alanshaw/xgettext-regex](https://github.com/alanshaw/xgettext-regex), which is no longer maintained.*  
*It provides the following additional features:*

**✨ Improved command line interface (CLI)**
- **Configurable regex via CLI:** made the regex (and regexTextCaptureIndex) configurable.

**✨ Better support for complex syntax & other languages**
- Added an **improved default regex** and documentation for it.
- **Multiline extraction support:** rewrote matching to work across newlines, added regex dotAll support.
- Added support for **Java text blocks** using """.
- Fix bug of missing location information if two strings found in same line.

**✨ Better .pot file diffs to use it in version management like GIT**
- Deterministic order of the keys by file path
- Switched to **relative paths** for location comments to prohibit commiting personal workspace directory paths.
___________________

## Examples

```sh
cat foo.js | xgettext-regex # Output to stdout
xgettext-regex foo.js -o foo.po # Output to foo.po
xgettext-regex app-dir -o app.po # Recursive read directory
```

```js
var fs = require('fs')
var xgettext = require('xgettext-regex')

var src = '/path/to/file'
var dest = '/path/to/en-GB.po'
var opts = {}

fs.createReadStream(src)
  .pipe(xgettext(src, opts))
  .pipe(fs.createWriteStream(dest))
```

```js
var fs = require('fs')
var xgettext = require('xgettext-regex')

var files = ['/path/to/file.js', '/path/to/html/dir']
var opts = {}

xgettext.createReadStream(files, opts))
  .pipe(fs.createWriteStream('/path/to/en-GB.po'))
```

## Options

```js
opts = {
    /* i18n function name */
    fn: '_',
    /* The regex used to match i18n function calls */
    regex: /_\(((["'])(?:(?=(\\?))\3.)*?\2)\)/g,
    /* Capture index for the i18n text in the above regex */
    regexTextCaptureIndex: 1,
    /* readdirp filters etc. */
    readdirp: {
      fileFilter: ['!.*', '!*.png', '!*.jpg', '!*.gif', , '!*.zip', , '!*.gz'],
      directoryFilter: ['!.*', '!node_modules', '!coverage']
    }
}
```
