---
layout: page
title: Search
permalink: /search/
protected: true
---

<div id="search-container">
  <input type="text" id="search-input" placeholder="Search posts..." class="search-input" disabled>
  <div id="initial-loading" class="initial-loading">
    <div class="loading-spinner">
      <div class="spinner"></div>
      <span>Loading search index...</span>
    </div>
  </div>
  <div id="search-results-info" class="search-results-info"></div>
  <div id="results-container" class="post-grid"></div>
  <div id="loading-indicator" class="load-more-container" style="display: none;">
    <div class="load-more-spinner">
      <div class="spinner"></div>
      <span id="loading-text">Searching...</span>
    </div>
  </div>
</div>

<style>
.search-input {
  width: 100%;
  padding: 14px 16px;
  font-size: 16px;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  margin-bottom: 24px;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

.search-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.6;
}

.search-input:focus {
  outline: none;
  border-color: #2a7ae2;
}

.search-results-info {
  color: #666;
  font-size: 14px;
  margin-bottom: 24px;
  font-weight: 500;
}

/* Initial loading indicator */
.initial-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 20px;
  min-height: 200px;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-spinner .spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e8e8e8;
  border-top-color: #20b2aa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner span {
  color: #666;
  font-size: 15px;
  font-weight: 500;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Ensure search cards match standard card styling */
#results-container .post-card-title {
  font-size: clamp(18px, 2vw, 22px);
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.02em;
}
</style>

<script src="https://unpkg.com/lunr/lunr.js"></script>
<script>
  window.addEventListener('DOMContentLoaded', (event) => {
    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');
    const resultsInfo = document.getElementById('search-results-info');
    const loadingIndicator = document.getElementById('loading-indicator');
    const loadingText = document.getElementById('loading-text');
    const initialLoading = document.getElementById('initial-loading');

    // Get default folder from site config
    const defaultFolder = '{{ site.cloudinary_default_folder | default: "" }}';
    const folderPath = defaultFolder ? `${defaultFolder}/` : '';

    let searchData = [];
    let idx;
    let currentResults = [];
    let displayedCount = 0;
    const resultsPerLoad = 12; // Show 12 cards initially
    const loadMoreCount = 6;   // Load 6 more on scroll
    let isLoading = false;

    // Load search data
    fetch('{{ site.baseurl }}/search.json')
      .then(response => response.json())
      .then(data => {
        searchData = data;

        // Build Lunr index
        idx = lunr(function () {
          this.ref('url');
          this.field('title', { boost: 10 });
          this.field('category', { boost: 5 });
          this.field('content');

          searchData.forEach(function (doc) {
            this.add(doc);
          }, this);
        });

        // Hide loading indicator and enable search input
        initialLoading.style.display = 'none';
        searchInput.disabled = false;
        searchInput.focus();

        // Get search query from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query) {
          searchInput.value = query;
          performSearch(query);
        }
      });

    // Search on input (debounced)
    let searchTimeout;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      const query = this.value;

      searchTimeout = setTimeout(() => {
        if (query.length > 2) {
          performSearch(query);
        } else {
          resultsContainer.innerHTML = '';
          resultsInfo.innerHTML = '';
        }
      }, 300); // Debounce 300ms
    });

    // Scroll listener for infinite scroll
    window.addEventListener('scroll', function() {
      if (isLoading || displayedCount >= currentResults.length) return;

      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.offsetHeight;

      if (scrollPosition >= documentHeight - 300) {
        loadMoreResults();
      }
    });

    function performSearch(query) {
      // Show loading indicator
      resultsContainer.innerHTML = '';
      resultsInfo.innerHTML = '';
      loadingText.textContent = 'Searching...';
      loadingIndicator.style.display = 'flex';

      // Use setTimeout to allow loading indicator to render
      setTimeout(() => {
        try {
          const results = idx.search(query);
          currentResults = results;
          displayedCount = 0;

          if (results.length > 0) {
            resultsInfo.innerHTML = `Found ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`;
            displayResults(resultsPerLoad);
          } else {
            resultsInfo.innerHTML = `No results found for "${query}"`;
          }
        } catch (e) {
          resultsInfo.innerHTML = 'Please enter a valid search term.';
        }

        // Hide loading indicator
        loadingIndicator.style.display = 'none';
      }, 100);
    }

    function displayResults(count) {
      const endIndex = Math.min(displayedCount + count, currentResults.length);
      const resultsToShow = currentResults.slice(displayedCount, endIndex);

      resultsToShow.forEach((result, index) => {
        const item = searchData.find(post => post.url === result.ref);
        if (item) {
          const card = createPostCard(item);
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px)';
          resultsContainer.appendChild(card);

          // Animate in
          setTimeout(() => {
            card.style.transition = 'all 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, index * 50);
        }
      });

      displayedCount = endIndex;
    }

    function loadMoreResults() {
      if (isLoading || displayedCount >= currentResults.length) return;

      isLoading = true;
      loadingText.textContent = 'Loading more results...';
      loadingIndicator.style.display = 'flex';

      setTimeout(() => {
        displayResults(loadMoreCount);
        loadingIndicator.style.display = 'none';
        isLoading = false;
      }, 500);
    }

    function createPostCard(item) {
      const article = document.createElement('article');
      article.className = 'post-card';

      // Slugify category for badge class (match Jekyll's slugify filter)
      const categorySlug = item.category ?
        item.category
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
          .replace(/^-+|-+$/g, '')      // Remove leading/trailing dashes
        : '';
      const categoryBadge = item.category ?
        `<a href="{{ site.baseurl }}/category/${categorySlug}/" class="category-badge badge-${categorySlug}">${item.category}</a>` : '';

      // Generate featured image URL
      let imageHtml = '';
      if (item.featured_image && item.featured_image.trim() !== '') {
        // Check if it's already a full URL
        if (item.featured_image.startsWith('http://') || item.featured_image.startsWith('https://')) {
          imageHtml = `<img src="${item.featured_image}" alt="${item.title}" loading="lazy"
                            onerror="this.src='{{ '/assets/images/default-post.svg' | relative_url }}'">`;
        } else {
          // It's a filename/public_id, construct Cloudinary URL
          const imgId = item.featured_image.replace(/\.(jpg|png|gif|webp|jpeg)$/i, '');
          imageHtml = `<img src="{{ site.cloudinary_base_url }}/c_fill,g_auto,w_320,h_213,q_auto,f_auto,dpr_auto/${folderPath}${imgId}"
                            srcset="{{ site.cloudinary_base_url }}/c_fill,g_auto,w_320,h_213,q_auto,f_auto/${folderPath}${imgId} 320w,
                                    {{ site.cloudinary_base_url }}/c_fill,g_auto,w_640,h_427,q_auto,f_auto/${folderPath}${imgId} 640w,
                                    {{ site.cloudinary_base_url }}/c_fill,g_auto,w_960,h_640,q_auto,f_auto/${folderPath}${imgId} 960w"
                            sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 320px"
                            alt="${item.title}"
                            loading="lazy"
                            onerror="this.src='{{ '/assets/images/default-post.svg' | relative_url }}'">`;
        }
      } else {
        imageHtml = `<img src="{{ '/assets/images/default-post.svg' | relative_url }}" alt="${item.title}" loading="lazy">`;
      }

      // Generate reading time display
      const readingTime = item.reading_time ? `· <i class="far fa-clock reading-time-icon" aria-hidden="true" title="${item.reading_time * 200} words"></i> ${item.reading_time} min read` : '';

      article.innerHTML = `
        <div class="post-card-image">
          <a href="${item.url}">
            ${imageHtml}
          </a>
        </div>
        <div class="post-card-content">
          ${categoryBadge}
          <h2 class="post-card-title">
            <a href="${item.url}">${item.title}</a>
          </h2>
          <p class="post-card-excerpt">${item.content.substring(0, 150)}...</p>
          <div class="post-card-meta">
            <img src="https://www.gravatar.com/avatar/{{ site.gravatar_hash }}?s=64&d=mp"
                 alt="{{ site.author | escape }}"
                 class="post-author-avatar"
                 loading="lazy"
                 onerror="this.src='{{ '/assets/images/default-avatar.svg' | relative_url }}'">
            <div class="post-meta-info">
              <span class="post-author-name">{{ site.author | escape }}</span>
              <span class="post-date-reading">
                <i class="far fa-calendar calendar-icon" aria-hidden="true"></i>
                ${item.date}
                ${readingTime}
              </span>
            </div>
          </div>
        </div>
      `;

      return article;
    }
  });
</script>