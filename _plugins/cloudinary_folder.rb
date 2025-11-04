module Jekyll
  module CloudinaryFolder
    def inject_cloudinary_folder(content)
      return content if content.nil? || content.empty?

      # Get the default folder from site config
      default_folder = @context.registers[:site].config['cloudinary_default_folder']

      # If no default folder is set, return content unchanged
      return content if default_folder.nil? || default_folder.empty?

      # Get cloudinary cloud name from config
      cloud_name = @context.registers[:site].config['cloudinary_cloud_name'] || 'circleseven'

      # Pattern to match Cloudinary URLs with transformations
      # Matches: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{image_name}
      # Transformations contain commas, underscores, numbers, letters but NO forward slashes
      # Example: https://res.cloudinary.com/circleseven/image/upload/q_auto,f_auto/image-name
      cloudinary_pattern = %r{(https://res\.cloudinary\.com/#{Regexp.escape(cloud_name)}/image/upload/)((?:[^/\s"')<]+/)*?)([^/\s"')<,]+)(?=[\s"')<]|$)}

      # Replace Cloudinary URLs
      modified_content = content.gsub(cloudinary_pattern) do |match|
        base_url = $1
        transformations_and_folders = $2  # May contain transformations and/or folders
        image_name = $3

        # Check if there's already a folder path after transformations
        # Transformation parameters contain commas/underscores (e.g., "q_auto,f_auto/")
        # Version parameters follow the pattern v{digits} (e.g., "v1760879325/")
        # Real folder paths don't contain these (e.g., "circle-seven/")
        # Check if the last segment before image name contains transformation indicators
        has_folder = false
        if transformations_and_folders =~ %r{([^/]+)/$}
          last_segment = $1
          # If the last segment has no commas, underscores, AND is not a version parameter, it's likely a real folder
          is_version_param = last_segment =~ /^v\d+$/
          has_folder = !(last_segment =~ /[,_]/) && !is_version_param
        end

        if has_folder
          # Already has a folder path, don't modify
          match
        else
          # Inject the default folder after transformations
          "#{base_url}#{transformations_and_folders}#{default_folder}/#{image_name}"
        end
      end

      modified_content
    end
  end
end

Liquid::Template.register_filter(Jekyll::CloudinaryFolder)
