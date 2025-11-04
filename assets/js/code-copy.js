/**
 * Code Copy Buttons
 *
 * Enhances code blocks with copy-to-clipboard functionality.
 * Dynamically adds copy buttons to all code blocks on the page with visual feedback.
 *
 * Features:
 * - Wraps each code block in a container div for positioning
 * - Adds accessible copy button with ARIA label
 * - Uses Clipboard API for copy functionality
 * - Provides visual feedback (success/error states)
 * - Automatic 2-second timeout to reset button state
 * - Prevents duplicate wrapping on re-execution
 *
 * Dependencies:
 * - Expects code blocks in <pre><code> structure
 * - Works with Highlight.js syntax highlighting
 * - Requires modern browser with Clipboard API support
 *
 * @module assets/js/code-copy
 */

(function() {
  'use strict';

  /**
   * Initializes copy buttons for all code blocks on the page
   *
   * Waits for DOM to be ready, then finds all <pre><code> blocks and enhances them
   * with a wrapper div and copy button. Skips blocks that are already wrapped to
   * prevent duplicate processing.
   *
   * Each code block is wrapped in a .code-block-wrapper div with a positioned
   * copy button that uses the Clipboard API to copy the code text.
   *
   * @listens DOMContentLoaded
   */
  document.addEventListener('DOMContentLoaded', function() {
    // Find all code blocks
    const codeBlocks = document.querySelectorAll('pre code');

    codeBlocks.forEach(function(codeBlock) {
      const pre = codeBlock.parentElement;

      // Skip if already wrapped
      if (pre.parentElement.classList.contains('code-block-wrapper')) {
        return;
      }

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      // Wrap the pre element
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Create copy button
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-code-button';
      copyButton.textContent = 'Copy';
      copyButton.setAttribute('aria-label', 'Copy code to clipboard');

      /**
       * Handles copy button click event
       *
       * Copies the code block's text content to the clipboard using the Clipboard API.
       * Provides visual feedback by changing button text and class:
       * - Success: Shows "Copied!" with .copied class for 2 seconds
       * - Error: Shows "Error" for 2 seconds
       *
       * @param {Event} event - Click event
       */
      copyButton.addEventListener('click', function() {
        const code = codeBlock.textContent;

        // Copy to clipboard
        navigator.clipboard.writeText(code).then(function() {
          // Success feedback
          copyButton.textContent = 'Copied!';
          copyButton.classList.add('copied');

          setTimeout(function() {
            copyButton.textContent = 'Copy';
            copyButton.classList.remove('copied');
          }, 2000);
        }).catch(function(err) {
          copyButton.textContent = 'Error';

          setTimeout(function() {
            copyButton.textContent = 'Copy';
          }, 2000);
        });
      });

      wrapper.appendChild(copyButton);
    });
  });
})();
