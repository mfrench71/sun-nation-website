module Jekyll
  module AutoGallery
    def auto_gallery(content)
      return content if content.nil? || content.empty?

      # Fix image URLs: Replace {{ site.baseurl }}/wp-content with full circleseven.co.uk URL
      content = content.gsub(
        /{{ site\.baseurl }}\/wp-content\/uploads/,
        'https://www.circleseven.co.uk/wp-content/uploads'
      )

      # Also handle already-rendered paths
      content = content.gsub(
        /\/circleseven-website\/wp-content\/uploads/,
        'https://www.circleseven.co.uk/wp-content/uploads'
      )

      # Remove any existing manual gallery divs to prevent nesting
      # Match gallery div with its content and extract just the content
      content = content.gsub(/<div class="gallery">\s*(.*?)\s*<\/div>/m) do |match|
        # Return just the content inside the gallery div
        $1
      end

      # Split content into lines and process sequentially
      lines = content.split("\n")
      result = []
      i = 0

      while i < lines.length
        # Check if current line starts a figure
        if lines[i] =~ /^<figure>/
          # Collect consecutive figures (with only blank lines between them)
          figures = [lines[i]]
          j = i + 1

          # Look ahead for more consecutive figures
          while j < lines.length
            if lines[j] =~ /^<figure>/
              # Found another figure
              figures << lines[j]
              j += 1
            elsif lines[j].strip.empty?
              # Blank line, keep looking
              j += 1
            else
              # Non-blank, non-figure line - stop
              break
            end
          end

          # If we found 2+ consecutive figures, wrap them
          if figures.length >= 2
            result << "<div class=\"gallery\">"
            result.concat(figures)
            result << "</div>"
            i = j
          else
            # Single figure, keep as-is
            result << lines[i]
            i += 1
          end
        else
          # Not a figure line, keep as-is
          result << lines[i]
          i += 1
        end
      end

      content = result.join("\n")

      content
    end
  end
end

Liquid::Template.register_filter(Jekyll::AutoGallery)
