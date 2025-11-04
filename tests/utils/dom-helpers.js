/**
 * DOM Helper Utilities for Tests
 *
 * Functions to create and manipulate DOM elements in tests.
 */

/**
 * Creates a basic HTML document structure
 * @returns {void}
 */
export function setupDocument() {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
}

/**
 * Creates a form element with inputs
 * @param {string} formId - Form ID
 * @param {Object} fields - Object mapping field names to values
 * @returns {HTMLFormElement}
 */
export function createForm(formId, fields = {}) {
  const form = document.createElement('form');
  form.id = formId;

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.name = name;
    input.id = `${formId}-${name}`;
    if (value !== undefined) {
      input.value = value;
    }
    form.appendChild(input);
  });

  document.body.appendChild(form);
  return form;
}

/**
 * Creates a notification element
 * @param {string} id - Element ID
 * @param {boolean} hidden - Whether to start hidden
 * @returns {HTMLDivElement}
 */
export function createNotificationElement(id, hidden = true) {
  const div = document.createElement('div');
  div.id = id;
  if (hidden) {
    div.classList.add('hidden');
  }

  const p = document.createElement('p');
  div.appendChild(p);

  document.body.appendChild(div);
  return div;
}

/**
 * Creates a button element
 * @param {string} id - Button ID
 * @param {string} text - Button text
 * @returns {HTMLButtonElement}
 */
export function createButton(id, text = 'Button') {
  const button = document.createElement('button');
  button.id = id;
  button.textContent = text;
  document.body.appendChild(button);
  return button;
}

/**
 * Waits for a condition to be true
 * @param {Function} condition - Function that returns boolean
 * @param {number} timeout - Maximum wait time in ms
 * @returns {Promise<void>}
 */
export async function waitFor(condition, timeout = 1000) {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

/**
 * Simulates a form submission event
 * @param {HTMLFormElement} form - The form to submit
 * @returns {Event}
 */
export function submitForm(form) {
  const event = new Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
}

/**
 * Gets form data as an object
 * @param {HTMLFormElement} form - The form element
 * @returns {Object}
 */
export function getFormData(form) {
  const formData = new FormData(form);
  const data = {};
  formData.forEach((value, key) => {
    data[key] = value;
  });
  return data;
}

/**
 * Creates a full settings form with all fields
 * @returns {HTMLFormElement}
 */
export function createAdminSettingsForm() {
  const form = createForm('admin-settings-form', {});

  const fields = [
    { id: 'admin-setting-deployment-poll-interval', name: 'deployment_poll_interval', value: '10000' },
    { id: 'admin-setting-deployment-history-poll-interval', name: 'deployment_history_poll_interval', value: '30000' },
    { id: 'admin-setting-deployment-timeout', name: 'deployment_timeout', value: '600' },
    { id: 'admin-setting-fetch-timeout', name: 'fetch_timeout', value: '30000' },
    { id: 'admin-setting-debounce-delay', name: 'debounce_delay', value: '300' },
  ];

  // Clear existing children
  form.innerHTML = '';

  fields.forEach(field => {
    const input = document.createElement('input');
    input.type = 'number';
    input.id = field.id;
    input.name = field.name;
    input.value = field.value;
    form.appendChild(input);
  });

  const button = document.createElement('button');
  button.id = 'admin-settings-save-btn';
  button.type = 'submit';
  button.textContent = 'Save Admin Settings';
  form.appendChild(button);

  return form;
}
