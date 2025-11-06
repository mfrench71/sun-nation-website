# Security Notes

## Critical: Authentication Required for Netlify Functions

**Status**: ⚠️ **ACTION REQUIRED**

### Issue
Currently, Netlify Functions rely solely on CORS headers for protection. This is insufficient because:
- CORS is browser-level protection only
- Tools like curl, Postman, or scripts can bypass CORS by not sending Origin headers
- Anyone with direct API access can modify content without authentication

### Affected Functions
All write operations on:
- `posts.js` (POST, PUT, DELETE)
- `pages.js` (POST, PUT, DELETE)
- `settings.js` (PUT)
- `taxonomy.js` (PUT)
- `bin.js` (POST, PUT, DELETE)

### Recommended Solution

#### Option 1: Netlify Identity (Recommended)
Integrate Netlify Identity for proper user authentication.

#### Option 2: API Key (Simpler, Less Secure)
Use a shared API key stored in environment variables.

### Implementation Steps

1. **Choose authentication method** (Netlify Identity recommended)
2. **Update all write-capable functions** to check authentication
3. **Update admin panel** to send auth headers with requests
4. **Test thoroughly** on development before deploying
5. **Document** authentication setup in README

## Other Security Improvements Made

### ✅ Completed
1. **Removed hardcoded API keys** from `media.js` and `cloudinary-folders.js`
2. **Added path traversal protection** to `pages.js` with filename validation
3. **Improved error handling** with proper validation messages

### 📋 Recommended Future Improvements
1. **Rate Limiting**: Add request throttling to prevent abuse
2. **Remove CSP unsafe-inline**: Eliminate inline scripts and event handlers
3. **Add SRI** to all CDN resources
4. **Implement request logging** for audit trail

## CSP Improvements Needed

### Current Issue
CSP headers allow `unsafe-inline` which defeats the primary purpose of Content Security Policy.

### Inline Event Handlers to Fix

1. **CSS Preload onload handlers** (`_includes/head.html`)
   - Multiple `<link rel="preload" ... onload="this.onload=null;this.rel='stylesheet'">`

2. **Image onerror handler** (`index.html:80`)
   ```html
   <img onerror="this.src='/assets/images/default-avatar.svg'">
   ```

3. **Netlify Identity onclick** (`admin/settings/index.html:32`)
   ```html
   <button onclick="netlifyIdentity.open()">
   ```

## Environment Variables

### Required for Production
```bash
# GitHub Integration
GITHUB_TOKEN=<your-github-personal-access-token>

# Cloudinary (NO FALLBACK VALUES)
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# Authentication (TO BE IMPLEMENTED)
API_KEY=<generate-secure-key>
```

### How to Set Environment Variables in Netlify
1. Go to Site Settings
2. Navigate to "Environment Variables"
3. Add each variable with its value
4. Redeploy the site for changes to take effect

## Security Checklist

- [x] Remove hardcoded credentials
- [x] Add input validation (filename, SHA)
- [ ] Implement authentication on write operations
- [ ] Add rate limiting
- [ ] Remove CSP unsafe-inline
- [ ] Add SRI to CDN resources
- [ ] Enable security headers (done partially)
- [ ] Regular dependency updates
- [ ] Security audit schedule

## Reporting Security Issues

If you discover a security vulnerability, please email: info@sun-nation.co.uk

Do NOT create public GitHub issues for security vulnerabilities.

## Last Updated
2025-11-06
