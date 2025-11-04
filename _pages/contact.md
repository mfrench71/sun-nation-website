---
layout: 
title: Contact Us
permalink: /contact/
date: 2023-06-06T10:08
last_modified_at: 2025-11-04 21:40:31
---

We'd love to hear from you! Fill out the form below and we'll get back to you as soon as possible.

<form name="contact" method="POST" netlify netlify-honeypot="bot-field" class="contact-form">
  <input type="hidden" name="form-name" value="contact" />

  <!-- Honeypot for spam prevention -->
  <p class="hidden">
    <label>Don't fill this out if you're human: <input name="bot-field" /></label>
  </p>

  <div class="form-group">
    <label for="name">Name <span class="required">*</span></label>
    <input type="text" id="name" name="name" required />
  </div>

  <div class="form-group">
    <label for="email">Email <span class="required">*</span></label>
    <input type="email" id="email" name="email" required />
  </div>

  <div class="form-group">
    <label for="phone">Phone</label>
    <input type="tel" id="phone" name="phone" />
  </div>

  <div class="form-group">
    <label for="subject">Subject <span class="required">*</span></label>
    <input type="text" id="subject" name="subject" required />
  </div>

  <div class="form-group">
    <label for="message">Message <span class="required">*</span></label>
    <textarea id="message" name="message" rows="6" required></textarea>
  </div>

  <div class="form-group">
    <button type="submit" class="btn btn-primary">Send Message</button>
  </div>
</form>

<style>
.contact-form {
  max-width: 600px;
  margin: 2rem 0;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.required {
  color: #e74c3c;
}

.form-group input[type="text"],
.form-group input[type="email"],
.form-group input[type="tel"],
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.btn-primary {
  background-color: #3498db;
  color: white;
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary:hover {
  background-color: #2980b9;
}

.hidden {
  display: none;
}
</style>