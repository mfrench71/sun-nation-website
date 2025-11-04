# Smoke Test Quick Start Guide

## What is a Smoke Test?

A "smoke test" is a quick manual check to ensure the basic functionality works before deploying. Think of it as a pre-flight checklist.

## How to Run It

### Prerequisites

1. Start your local development server:
   ```bash
   netlify dev
   ```

2. Open your browser to: `http://localhost:8888/admin-custom/`

3. Log in with Netlify Identity

4. Open your browser's Developer Console (F12 or Cmd+Option+I)
   - Keep the Console tab visible to catch any errors

### Running the Checklist

Open TEST_PLAN.md and find the "Manual Smoke Test Checklist" section (starts around line 453).

Go through each section systematically:

---

## Quick 5-Minute Smoke Test

If you're short on time, test these critical items first:

### 1. Module Loading (30 seconds)
- [ ] Open `/admin-custom/`
- [ ] Check browser console - should have **ZERO red errors**
- [ ] Look for errors containing:
  - ❌ "does not provide an export named"
  - ❌ "is not defined"
  - ❌ "is not a function"

**How to check:** Just look at the console. Red = fail, no red = pass.

---

### 2. Section Navigation (1 minute)
Click through each tab in order:
- [ ] Dashboard - Should load without errors
- [ ] Taxonomy - Should show categories/tags
- [ ] Posts - Should show posts list
- [ ] Pages - Should show pages list
- [ ] Media Library - Should show media grid or loading state
- [ ] Bin - Should show trash or "empty" message
- [ ] Settings - Should show two forms (Admin Settings + Site Configuration)

**How to check:** Click each tab, verify it shows content (not a blank page or error)

---

### 3. Settings Prepopulation (30 seconds)
- [ ] Click "Settings" tab
- [ ] Scroll to "Admin Application Settings"
- [ ] Check these fields have numbers in them:
  - Deployment Status Check: should be `10000`
  - Deployment History Refresh: should be `30000`
  - Deployment Timeout: should be `600`
  - API Request Timeout: should be `30000`
  - Search Input Delay: should be `300`

**How to check:** All 5 fields should have values, none should be empty.

---

### 4. Site Settings Prepopulation (30 seconds)
- [ ] Still in Settings section
- [ ] Scroll to "Site Configuration"
- [ ] Check these fields are filled in:
  - Site Title: should have your site name
  - Author Name: should have your name
  - Email: should have your email
  - Posts per Page: should have a number
  - Timezone: should have a timezone string

**How to check:** All fields should be populated from `_config.yml`

---

### 5. Protected Pages (1 minute)
- [ ] Click "Pages" tab
- [ ] Look for pages with a 🔒 lock icon
- [ ] Those pages should NOT have a delete button/icon
- [ ] Click "Edit" on a protected page
- [ ] The "Protected Page" checkbox should be checked
- [ ] The "Delete Page" button at bottom should be disabled/hidden

**How to check:** Lock icons present, delete buttons absent on protected pages

---

### 6. Create Something Simple (1 minute)
- [ ] Go to Taxonomy tab
- [ ] Click "Add Category"
- [ ] Type a test name like "Test Category"
- [ ] Click Save
- [ ] Should see green success message
- [ ] New category should appear in the list
- [ ] Delete the test category to clean up

**How to check:** You can add and see the new item without errors

---

### 7. Notifications Work (30 seconds)
- [ ] In Taxonomy, try to edit a category
- [ ] Change the name and save
- [ ] Green success message should appear at top
- [ ] Message should auto-dismiss after ~5 seconds

**How to check:** Green notification bar appears and disappears

---

## Full Smoke Test (15-20 minutes)

If you have more time, use the complete checklist in TEST_PLAN.md starting at line 453.

### Section-by-Section Guide

#### Admin Interface Load
```
✓ Open http://localhost:8888/admin-custom/
✓ Check Console tab - should see no red errors
✓ All sections should load in the navigation
```

#### Dashboard
```
✓ Click "Dashboard" tab
✓ Should see Quick Actions card
✓ Should see Site Information card
✓ Should see GitHub API Rate Limit card
✓ Should see Deployments card
```

#### Taxonomy
```
✓ Click "Taxonomy" tab
✓ Should see categories list
✓ Click "Tags" tab
✓ Should see tags list
✓ Click "Add Category"
✓ Add a test category
✓ Edit it
✓ Delete it
✓ Repeat for tags
```

#### Posts
```
✓ Click "Posts" tab
✓ Posts list loads
✓ Search box works
✓ Sort dropdown changes order
✓ Click "Edit" on a post
✓ Form loads with all fields populated
✓ Markdown editor appears
✓ Click "Back to Posts"
```

#### Pages
```
✓ Click "Pages" tab
✓ Pages list loads
✓ Protected pages show lock icon 🔒
✓ Click "Edit" on a regular page
✓ All fields populate
✓ Click "Edit" on a protected page
✓ Protected checkbox is checked
✓ Delete button is disabled
```

#### Media
```
✓ Click "Media Library" tab
✓ Media grid loads (or shows "no media")
✓ Upload button is visible
✓ Search box is present
```

#### Bin
```
✓ Click "Bin" tab
✓ Shows empty message OR list of deleted items
✓ If items exist, Restore button works
```

#### Settings
```
✓ Click "Settings" tab
✓ Admin Settings form visible
✓ All 5 admin settings fields have values
✓ Site Configuration form visible
✓ All site config fields have values from _config.yml
✓ Click "Reset to Defaults" - fields change
✓ Click "Save Admin Settings" - success message appears
```

---

## What to Do If You Find Issues

### Console Errors
```
If you see red errors in console:
1. Take a screenshot
2. Copy the full error message
3. Note which section/action caused it
4. Report it before deploying
```

### Fields Not Populating
```
If settings fields are empty:
1. Open DevTools Console
2. Type: localStorage.getItem('admin_settings')
3. Check if it returns valid JSON
4. Try clicking "Reset to Defaults"
5. If still empty, there's a bug
```

### Functions Not Working
```
If buttons don't work:
1. Check console for "is not a function" errors
2. This indicates a module loading issue
3. Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)
4. If persists, there's a timing bug
```

---

## Quick Pass/Fail Criteria

### ✅ PASS - Safe to Deploy
- Zero console errors on page load
- All sections load and display content
- Settings fields all have values
- Can create/edit/delete taxonomy items
- Notifications appear and dismiss
- No "undefined" or "not a function" errors

### ❌ FAIL - Do Not Deploy
- Red errors in console
- Any section shows blank/white page
- Settings fields are empty
- Cannot save changes
- Notifications don't appear
- "Module does not provide export" errors

---

## Automation (Future)

Eventually these manual checks will be automated with:
- **Playwright** or **Cypress** for browser automation
- **Vitest** for unit testing
- **GitHub Actions** for CI/CD

But for now, manual checking is the fastest way to catch issues before deployment.

---

## Checklist Tracking

You can copy this to a separate file and check off items as you go:

```markdown
## Today's Smoke Test - [DATE]

### Critical Items ✓
- [ ] No console errors on load
- [ ] All sections navigate correctly
- [ ] Settings fields populated
- [ ] Protected pages work correctly
- [ ] Can create/edit taxonomy
- [ ] Notifications appear

### Deployment Decision
- [ ] ✅ PASS - Safe to deploy
- [ ] ❌ FAIL - Issues found (list below)

### Issues Found
1.
2.
3.
```

---

## Time Estimates

- **Quick smoke test:** 5 minutes
- **Full smoke test:** 15-20 minutes
- **Deep testing:** 30-45 minutes

**Recommendation:** Run quick smoke test before every deploy, full smoke test after major changes.
