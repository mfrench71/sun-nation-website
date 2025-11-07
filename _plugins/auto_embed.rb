module Jekyll
  module AutoEmbed
    def auto_embed(content)
      return content if content.nil? || content.empty?

      # Process YouTube URLs
      content = process_youtube(content)

      # Process Vimeo URLs
      content = process_vimeo(content)

      # Process Twitter/X URLs
      content = process_twitter(content)

      # Process Instagram URLs
      content = process_instagram(content)

      # Process TikTok URLs
      content = process_tiktok(content)

      content
    end

    private

    def process_youtube(content)
      # Match YouTube URLs that are standalone (not already in markdown links or HTML)
      # Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID

      # First, handle URLs in paragraph tags
      content = content.gsub(%r{<p>(https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})(?:[?&][^\s<]*)?)</p>}) do |match|
        video_id = $2
        create_youtube_embed(video_id)
      end

      # Then handle plain URLs not in HTML
      youtube_pattern = %r{
        (?<![\[("'>])                                     # Not preceded by markdown/HTML link syntax
        (?:https?://)?                                     # Optional protocol
        (?:www\.)?                                         # Optional www
        (?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)  # YouTube domain patterns
        ([a-zA-Z0-9_-]{11})                               # Video ID (11 chars)
        (?:[?&][^\s<]*)?                                  # Optional query params
        (?![\])"'<])                                      # Not followed by markdown/HTML link syntax
      }x

      content.gsub(youtube_pattern) do |match|
        video_id = $1
        create_youtube_embed(video_id)
      end
    end

    def process_vimeo(content)
      # Match Vimeo URLs: vimeo.com/123456789

      # First, handle URLs in paragraph tags
      content = content.gsub(%r{<p>(https?://(?:www\.)?vimeo\.com/(\d+)(?:[?/][^\s<]*)?)</p>}) do |match|
        video_id = $2
        create_vimeo_embed(video_id)
      end

      # Then handle plain URLs not in HTML
      vimeo_pattern = %r{
        (?<![\[("'>])                                     # Not preceded by markdown/HTML link syntax
        (?:https?://)?                                     # Optional protocol
        (?:www\.)?vimeo\.com/                             # Vimeo domain
        (\d+)                                              # Video ID (digits only)
        (?:[?/][^\s<]*)?                                  # Optional query params or path
        (?![\])"'<])                                      # Not followed by markdown/HTML link syntax
      }x

      content.gsub(vimeo_pattern) do |match|
        video_id = $1
        create_vimeo_embed(video_id)
      end
    end

    def process_twitter(content)
      # Match Twitter/X URLs: twitter.com/user/status/ID or x.com/user/status/ID

      # First, handle URLs in paragraph tags
      content = content.gsub(%r{<p>(https?://(?:www\.)?(?:twitter|x)\.com/\w+/status/\d+(?:[?][^\s<]*)?)</p>}) do |match|
        tweet_url = $1
        create_twitter_embed(tweet_url)
      end

      # Then handle plain URLs not in HTML
      twitter_pattern = %r{
        (?<![\[("'>])                                     # Not preceded by markdown/HTML link syntax
        (https?://(?:www\.)?(?:twitter|x)\.com/\w+/status/\d+)  # Full tweet URL
        (?:[?][^\s<]*)?                                   # Optional query params
        (?![\])"'<])                                      # Not followed by markdown/HTML link syntax
      }x

      content.gsub(twitter_pattern) do |match|
        tweet_url = $1
        create_twitter_embed(tweet_url)
      end
    end

    def process_instagram(content)
      # Match Instagram URLs: instagram.com/p/POST_ID/ or instagram.com/reel/REEL_ID/

      # First, handle URLs in paragraph tags
      content = content.gsub(%r{<p>(https?://(?:www\.)?instagram\.com/(?:p|reel)/[a-zA-Z0-9_-]+/(?:[?][^\s<]*)?)</p>}) do |match|
        post_url = $1
        create_instagram_embed(post_url)
      end

      # Then handle plain URLs not in HTML
      instagram_pattern = %r{
        (?<![\[("'>])                                     # Not preceded by markdown/HTML link syntax
        (https?://(?:www\.)?instagram\.com/(?:p|reel)/[a-zA-Z0-9_-]+/)  # Post or reel URL
        (?:[?][^\s<]*)?                                   # Optional query params
        (?![\])"'<])                                      # Not followed by markdown/HTML link syntax
      }x

      content.gsub(instagram_pattern) do |match|
        post_url = $1
        create_instagram_embed(post_url)
      end
    end

    def process_tiktok(content)
      # Match TikTok URLs: tiktok.com/@user/video/ID or vm.tiktok.com/ID

      # First, handle URLs in paragraph tags
      content = content.gsub(%r{<p>(https?://(?:www\.|vm\.)?tiktok\.com/(?:@[\w.-]+/video/\d+|[\w-]+)(?:[?][^\s<]*)?)</p>}) do |match|
        tiktok_url = $1
        create_tiktok_embed(tiktok_url)
      end

      # Then handle plain URLs not in HTML
      tiktok_pattern = %r{
        (?<![\[("'>])                                     # Not preceded by markdown/HTML link syntax
        (https?://(?:www\.|vm\.)?tiktok\.com/(?:@[\w.-]+/video/\d+|[\w-]+))  # TikTok URL
        (?:[?][^\s<]*)?                                   # Optional query params
        (?![\])"'<])                                      # Not followed by markdown/HTML link syntax
      }x

      content.gsub(tiktok_pattern) do |match|
        tiktok_url = $1
        create_tiktok_embed(tiktok_url)
      end
    end

    # Embed template generators

    def create_youtube_embed(video_id)
      thumbnail_url = "https://img.youtube.com/vi/#{video_id}/maxresdefault.jpg"
      <<~HTML
        <div class="embed-container youtube-embed" data-embed-type="youtube" data-video-id="#{video_id}" data-thumbnail="#{thumbnail_url}">
          <iframe src="https://www.youtube-nocookie.com/embed/#{video_id}"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                  loading="lazy"></iframe>
        </div>
      HTML
    end

    def create_vimeo_embed(video_id)
      # Vimeo thumbnails require API call, using placeholder for now
      thumbnail_url = "https://vumbnail.com/#{video_id}.jpg"
      <<~HTML
        <div class="embed-container vimeo-embed" data-embed-type="vimeo" data-video-id="#{video_id}" data-thumbnail="#{thumbnail_url}">
          <iframe src="https://player.vimeo.com/video/#{video_id}?dnt=1"
                  frameborder="0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowfullscreen
                  loading="lazy"></iframe>
        </div>
      HTML
    end

    def create_twitter_embed(tweet_url)
      # Twitter embeds require JavaScript from Twitter's widget.js
      # We'll create a placeholder that gets enhanced by embeds.js
      # Using Twitter logo as thumbnail placeholder
      thumbnail_url = "/assets/images/twitter-placeholder.svg"
      <<~HTML
        <div class="twitter-embed" data-embed-type="twitter" data-tweet-url="#{tweet_url}" data-thumbnail="#{thumbnail_url}">
          <blockquote class="twitter-tweet">
            <a href="#{tweet_url}">View tweet</a>
          </blockquote>
        </div>
      HTML
    end

    def create_instagram_embed(post_url)
      # Instagram embeds require JavaScript from Instagram's embed.js
      # We'll create a placeholder that gets enhanced by embeds.js
      # Using Instagram logo as thumbnail placeholder
      thumbnail_url = "/assets/images/instagram-placeholder.svg"
      <<~HTML
        <div class="instagram-embed" data-embed-type="instagram" data-instagram-url="#{post_url}" data-thumbnail="#{thumbnail_url}">
          <blockquote class="instagram-media" data-instgrm-permalink="#{post_url}">
            <a href="#{post_url}">View this post on Instagram</a>
          </blockquote>
        </div>
      HTML
    end

    def create_tiktok_embed(tiktok_url)
      # TikTok embeds require JavaScript from TikTok's embed.js
      # We'll create a placeholder that gets enhanced by embeds.js
      # Using TikTok logo as thumbnail placeholder
      thumbnail_url = "/assets/images/tiktok-placeholder.svg"
      <<~HTML
        <div class="tiktok-embed" data-embed-type="tiktok" data-tiktok-url="#{tiktok_url}" data-thumbnail="#{thumbnail_url}">
          <blockquote class="tiktok-embed" cite="#{tiktok_url}">
            <a href="#{tiktok_url}">View this TikTok</a>
          </blockquote>
        </div>
      HTML
    end
  end
end

Liquid::Template.register_filter(Jekyll::AutoEmbed)
