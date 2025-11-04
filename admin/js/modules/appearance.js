/**
 * Appearance Module - Google Fonts Management
 */

import { showError, showSuccess } from '../ui/notifications.js';
import logger from '../core/logger.js';

// Curated list of popular Google Fonts
const GOOGLE_FONTS = [
  'Open Sans',
  'Roboto',
  'Lato',
  'Montserrat',
  'Oswald',
  'Source Sans Pro',
  'Raleway',
  'PT Sans',
  'Merriweather',
  'Nunito',
  'Poppins',
  'Ubuntu',
  'Playfair Display',
  'Rubik',
  'Work Sans',
  'Inter',
  'Noto Sans',
  'Mukta',
  'Libre Baskerville',
  'PT Serif'
];

let currentSettings = {};

export async function initAppearance() {
  try {
    await loadFontSettings();
    populateFontSelects();
    setupEventListeners();
  } catch (error) {
    logger.error('Failed to initialize appearance:', error);
    showError('Failed to load font settings');
  }
}

async function loadFontSettings() {
  const token = window.netlifyIdentity?.currentUser()?.token?.access_token;
  const response = await fetch('/.netlify/functions/settings', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) throw new Error('Failed to load settings');

  const data = await response.json();
  currentSettings = data.google_fonts || { enabled: false, body_font: '', heading_font: '' };

  document.getElementById('google-fonts-enabled').checked = currentSettings.enabled;
  toggleFontSettings();
}

function populateFontSelects() {
  const bodySelect = document.getElementById('body-font');
  const headingSelect = document.getElementById('heading-font');

  GOOGLE_FONTS.forEach(font => {
    bodySelect.add(new Option(font, font));
    headingSelect.add(new Option(font, font));
  });

  bodySelect.value = currentSettings.body_font || '';
  headingSelect.value = currentSettings.heading_font || '';

  updatePreview('body');
  updatePreview('heading');
}

function setupEventListeners() {
  document.getElementById('google-fonts-enabled').addEventListener('change', toggleFontSettings);
  document.getElementById('body-font').addEventListener('change', () => updatePreview('body'));
  document.getElementById('heading-font').addEventListener('change', () => updatePreview('heading'));
}

function toggleFontSettings() {
  const enabled = document.getElementById('google-fonts-enabled').checked;
  document.getElementById('font-settings').style.display = enabled ? 'block' : 'none';
}

function updatePreview(type) {
  const select = document.getElementById(`${type}-font`);
  const preview = document.getElementById(`${type}-font-preview`);
  const font = select.value;

  if (!font) {
    preview.innerHTML = '<p class="text-muted small mb-0">System default font</p>';
    preview.style.fontFamily = '';
    return;
  }

  // Load font
  const fontId = `gfont-${font.replace(/\s/g, '')}`;
  if (!document.getElementById(fontId)) {
    const link = document.createElement('link');
    link.id = fontId;
    link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/\s/g, '+')}:wght@400;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  preview.innerHTML = type === 'body'
    ? `<p style="font-family: '${font}', sans-serif; margin: 0;">The quick brown fox jumps over the lazy dog. 0123456789</p>`
    : `<h4 style="font-family: '${font}', sans-serif; margin: 0;">Heading Preview Text</h4>`;
}

export async function saveFonts() {
  try {
    const enabled = document.getElementById('google-fonts-enabled').checked;
    const bodyFont = document.getElementById('body-font').value;
    const headingFont = document.getElementById('heading-font').value;

    const settings = {
      google_fonts: {
        enabled,
        body_font: bodyFont,
        heading_font: headingFont
      }
    };

    const token = window.netlifyIdentity?.currentUser()?.token?.access_token;
    const response = await fetch('/.netlify/functions/settings', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });

    if (!response.ok) throw new Error('Failed to save settings');

    const result = await response.json();

    if (result.commitSha && window.trackDeployment) {
      window.trackDeployment({
        commitSha: result.commitSha,
        action: 'Update Google Fonts settings',
        type: 'settings'
      });
    }

    showSuccess('Font settings saved successfully! Your site will rebuild in 1-2 minutes.');
    currentSettings = settings.google_fonts;
  } catch (error) {
    logger.error('Failed to save fonts:', error);
    showError('Failed to save font settings');
  }
}
