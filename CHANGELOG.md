
v0.7.2 / 2016-03-17
===================

  * Add include option (#125)

v0.7.1 / 2016-02-26
===================

  * Dropped jshint and added xo
  * Adjust tests for penthouse 0.8.4
  * Bump dependencies
  * Remove listeners on exit
  * Update Readme

v0.7.0 / 2015-12-22
===================

  * bump penthouse
  * Test #79
  * some debug logs
  * trigger cleanup
  * added missing deps
  * Switch to http server for local files (#94)
  * ignore generated css
  * tests adjusted for penthouse 0.7.1
  * minor tweaks
  * Fix appveyor tests
  * local url for phantomjs (#94)
  * penthouse bump
  * Bump dependencies
  * Bump inline-critical
  * Update README.md
  * use default base
  * add a test for query string in file name
  * fix local files query string ENOENT exception
  * fixed tests for bumped deps
  * Bump dependencies
  * appveyor file tweaks
  * Actually Emit Critical Error in Stream
  * cleanup
  * Switched postcss-image-inliner
  * bump inline-critical
  * appveyor tweaks
  * cleanup
  * added gc to address #82
  * Added cli remote test
  * some cleanup
  * fixed phantom on missing file extension
  * use loadCSS 0.1.8
  * allow remote resources
  * Hey, man
  * Bump dependencies

v0.6.0 / 2015-07-07
===================

  * added testcase for #88
  * testcase for bc53420 issue
  * Fixed issue from bc53420
  * Update README.md
  * backwards compatibility
  * drop node 0.10
  * simplify cli help creation
  * minor style tweaks
  * Merged master
  * Fixed tests & locked clean-css version
  * Bump filter-css
  * Fixed CLI tests
  * minor package.json tweaks
  * Bump devDependencies
  * Correct expectation for adaptive
  * Updatet tests for new clean-css 3.2.7
  * some cleanup
  * Bump dependencies
  * Update README.md
  * Don't encode entities
  * Removed parallel testcase
  * Add 'ignore' option
  * Deprecated some things
  * deprecated htmltarget & styletarget for CLI and introduced --inline
  * Added pathPrefix support for CLI
  * normalize newlines
  * added test for pathPrefix option
  * allows pathPrefix to be set through options. Updates README
  * Added stream wrapper

v0.5.7 / 2015-04-12
===================

  * appveyor tweaks
  * Automated windows tests using appveyor
  * Fixed tests on windows
  * Added some badges
  * Bump dependencies
  * cleancss syntax change
  * modified tests to use new cleancss output

v0.5.6 / 2015-03-16
===================

  * catch cancellation
  * Fix callbacks on error

v0.5.5 / 2015-03-03
===================

  * Fixed CLI error codes
  * renaming
  * Added jshint
  * Added tests for #63 & #64
  * Bump dependencies
  * up dimensions used in tests, update expected result files
  * fix typo
  * up dimensions used for generate in index.js
  * up dimensions used in README examples
  * Fix multi test
  * bump dependency
  * fix #67
  * Add support for multi-dimension critical css.
  * improve file structure
  * readme tweaks
  * fix .gitignore
  * codestyle
  * Bump dependencies
  * updated tests for penthouse 0.3.0

v0.5.4 / 2015-02-09
===================

  * Update .travis.yml
  * Use os.tmpdir() folder for temporary css
  * add `preferGlobal` prop to package.json

v0.5.3 / 2015-01-18
===================

  * Bump dependencies

v0.5.2 / 2015-01-12
===================

  * #56 Locked penthouse version

v0.5.1 / 2014-12-28
===================

  * Fixed tests
  * 'inline-critical' version bump
  * Fixed CLI Tests for Windows
  * Added tests and additional CLI fixes for #52
  * Fix for #52

v0.5.0 / 2014-11-28
===================

  * inline critical version bump
  * Increased mocha timeout
  * Fixed newline character in css to address #14
  * Updated version of inline-critical to address #14
  * Added bin/critical to files #49
  * added cli / changed structure
  * Update README.md
  * Remove inlined CSS rules from source stylesheets #39
  * Fixed backslash in rebased paths on windows
  * fixed fa77c44
  * Return critical css even if unlinking of the temporary file fails
  * Ignores external stylesheets

v0.4.0 / 2014-10-04
===================

  * Add build tasks
  * Update UUID dep
  * Changed inlineImages default to false
  * Fixed tests for #35

v0.3.1 / 2014-09-16
===================

  * Fixed parallel calls mentioned in #34

v0.3.0 / 2014-09-09
===================

  * Update fixtures to account for dep. bump
  * Bump dependencies

v0.2.0 / 2014-08-30
===================

  * fixed implementation in #30
  * Skipped max size for inlined images
  * Added image inlining to generate
  * removed dynamic test file
  * Adds a maxImageFileSize for inlined images and rebases relative css resource paths

v0.1.6 / 2014-07-30
===================

  * Update to Penthouse 0.2.5 to addr raised issues
  * change penthouse test to critical css test
  * some code formatting
  * Fixed tests
  * fixed fixtures
  * changed test size to only include header nav
  * prevent catching callback test errors
  * Format code
  * Make CSS files/path configurable
  * CSS Images fix
  * Add more demo projects.
  * Add demo projects.
  * Move viewport settings up.
  * Improve formatting of first example.

v0.1.5 / 2014-07-16
===================

  * Improve the Critical / Penthouse section
  * Readme corrections
  * Add contributing guide
  * Readme revisions
  * Add mention of criticalCSS module.
  * More edits
  * Infra revisions
  * Add note about unit tests.
  * Add better comments to inline-styles.
  * Tweaks to readme.
  * Minor revisions.

v0.1.4 / 2014-07-11
===================

  * Add note about sample project
  * Strap update
  * improve tests
  * Tweak to readme.
  * Update README.md
  * fix all the things
  * Attempt to fix builds
  * README.md: break long lines.
  * Lint fixes.
  * Whitespace normalization
  * package.json: Add missing properties.

v0.1.3 / 2014-07-04
===================

  * Add support for generateInline

v0.1.2 / 2014-07-04
===================

  * Address path issues post-integration testing

v0.1.1 / 2014-07-04
===================

  * Add missing file to package
  * Update to latest Oust, API
  * Add syntax highlighting to code blocks

v0.1.0 / 2014-06-30
===================

  * Consistency of example order
  * Add minification for inline styles
  * Fix some style, cb issues
  * Revisions for minification
  * Add support for minification
  * Add options to readme
  * Fixes #9 - adds defaults for w/h
  * Add note about FAQs, license
  * Expand on joined paths
  * Move reads
  * Improve test descriptions
  * Improve callbacks, add more tests
  * Fixes #2, passes errors
  * Path joins for #6, test > fixture for #10, other fixes
  * Fixes #4 - drop log statements
  * Fixes #5 - switch to readFile/writeFile only
  * Fixes #7 - throw if src/base not specified
  * Should fix #1 - only write to disk if dest specified
  * Switch to integers
  * Readme revisions

v0.0.1 / 2014-06-28
===================

  * API revisions, readme updates, cleanup
  * Various fixes
  * Add implementation.
  * Add tests.
  * Add testing rig.
  * Add README.
  * Initial package.
  * Ignore.
  * Initial commit
