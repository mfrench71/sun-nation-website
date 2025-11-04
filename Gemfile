source "https://rubygems.org"

# Jekyll - using 4.3.x to avoid sass-embedded build issues on Netlify
gem "jekyll", "~> 4.3.0"
gem "minima", "~> 2.5"

# Use sassc instead of sass-embedded for better Netlify compatibility
gem "jekyll-sass-converter", "~> 2.2"

# Jekyll plugins
group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.17"
  gem "jekyll-seo-tag", "~> 2.8"
  gem "jekyll-sitemap", "~> 1.4"
  gem "jekyll-paginate", "~> 1.1"
end

# Windows and JRuby does not include zoneinfo files, so bundle the tzinfo-data gem
# and associated library.
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]

# Lock `http_parser.rb` gem to `v0.6.x` on JRuby builds since newer versions of the gem
# do not have a Java counterpart.
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]

# Webrick is required for Jekyll 4.x on Ruby 3.x
gem "webrick", "~> 1.8"
