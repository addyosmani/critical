OPTIONS:

----------------------

#### Store results

OLD:
styleTarget
dest

NEW: 
target: dest.ccc | dest.html | {css: dest.css, html: dest.html}

----------------------

#### Handle folders for asset rebasing

OLD:
destFolder
folder
pathPrefix

NEW:
rebase: {from: ..., to: ...} (uses postcss-url)

----------------------

#### Drop filter-css in favor of postcss-discard 

https://github.com/bezoerb/postcss-discard/
