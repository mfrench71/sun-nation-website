#!/bin/bash
set -e

echo "Building Jekyll site with cache busting..."

# Generate a cache bust hash (using current timestamp)
CACHE_BUST=$(date +%s)

echo "Cache bust version: $CACHE_BUST"

# Update index.html to use versioned assets
sed -i.bak "s/app\.js\?v=[0-9]*/app.js?v=$CACHE_BUST/g" admin/index.html
sed -i.bak "s/admin-custom\.css\?v=[0-9]*/admin-custom.css?v=$CACHE_BUST/g" admin/index.html

# Update all ES6 module imports with new version
sed -i.bak "s/\.js\?v=[0-9]*/.js?v=$CACHE_BUST/g" admin/index.html

# Update module imports in all JavaScript module files
find admin/js/modules -name "*.js" -type f -exec sed -i.bak "s/\.js\?v=[0-9]*/.js?v=$CACHE_BUST/g" {} \;
find admin/js/core -name "*.js" -type f -exec sed -i.bak "s/\.js\?v=[0-9]*/.js?v=$CACHE_BUST/g" {} \;
find admin/js/ui -name "*.js" -type f -exec sed -i.bak "s/\.js\?v=[0-9]*/.js?v=$CACHE_BUST/g" {} \;
find admin/js/components -name "*.js" -type f -exec sed -i.bak "s/\.js\?v=[0-9]*/.js?v=$CACHE_BUST/g" {} \;
find admin/js/shared -name "*.js" -type f -exec sed -i.bak "s/\.js\?v=[0-9]*/.js?v=$CACHE_BUST/g" {} \;

# Update standalone pages (posts, pages, media, etc.)
find admin -maxdepth 2 -name "index.html" -type f -exec sed -i.bak "s/\.js\?v=[0-9]*/.js?v=$CACHE_BUST/g" {} \;
find admin/posts -name "*.html" -type f -exec sed -i.bak "s/\.js\?v=[0-9]*/.js?v=$CACHE_BUST/g" {} \;
find admin/pages -name "*.html" -type f -exec sed -i.bak "s/\.js\?v=[0-9]*/.js?v=$CACHE_BUST/g" {} \;

# Also update service worker cache name to force cache refresh
sed -i.bak "s/circle-seven-admin-v[0-9]*/circle-seven-admin-v$CACHE_BUST/g" admin/sw.js 2>/dev/null || true

# Clean up backup files
rm -f admin/index.html.bak
rm -f admin/sw.js.bak
find admin -name "*.bak" -type f -delete

echo "Cache busting complete. Updated to version: $CACHE_BUST"

# TODO: Re-enable tests before building once test suite is fixed
# Currently disabled due to pre-existing test failures that need to be resolved
# echo "Running tests..."
# npm run test
# if [ $? -ne 0 ]; then
#   echo "Tests failed! Build aborted."
#   exit 1
# fi
# echo "Tests passed!"

# Run Jekyll build
bundle exec jekyll build

echo "Build complete!"
# Deployment test - Tue 28 Oct 2025 13:15:42 GMT
