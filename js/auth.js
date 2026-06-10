/* ============================================================
   auth.js — Authentication Module
   Invoice Generator Application
   ============================================================ */

window.Auth = {

  /**
   * Hash a password using PBKDF2 with SHA-256.
   * @param {string} password - The plain-text password.
   * @param {Uint8Array} salt - A random salt.
   * @returns {Promise<Uint8Array>} The derived key bytes.
   */
  async hashPassword(password, salt) {
    try {
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );

      return new Uint8Array(derivedBits);
    } catch (error) {
      throw new Error('Password hashing failed: ' + error.message);
    }
  },

  /**
   * Convert a Uint8Array buffer to a hexadecimal string.
   * @param {Uint8Array} buffer
   * @returns {string}
   */
  bufferToHex(buffer) {
    return Array.from(buffer)
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  },

  /**
   * Convert a hexadecimal string to a Uint8Array.
   * @param {string} hex
   * @returns {Uint8Array}
   */
  hexToBuffer(hex) {
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return new Uint8Array(bytes);
  },

  /**
   * Register a new user.
   * @param {string} name
   * @param {string} email
   * @param {string} password
   * @returns {Promise<number>} The new user's id.
   */
  async register(name, email, password) {
    try {
      // --- Validation ---
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('Name is required.');
      }
      if (!email || typeof email !== 'string' || email.trim().length === 0) {
        throw new Error('Email is required.');
      }
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error('Please enter a valid email address.');
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      // --- Check for existing email ---
      var existing = await db.users.where('email').equals(email.trim().toLowerCase()).first();
      if (existing) {
        throw new Error('An account with this email already exists.');
      }

      // --- Hash password ---
      var salt = crypto.getRandomValues(new Uint8Array(16));
      var hashedPassword = await this.hashPassword(password, salt);

      // --- Create user ---
      var userId = await db.users.add({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: this.bufferToHex(hashedPassword),
        salt: this.bufferToHex(salt),
        createdAt: new Date().toISOString()
      });

      // --- Store session ---
      var session = {
        id: userId,
        name: name.trim(),
        email: email.trim().toLowerCase()
      };
      sessionStorage.setItem('currentUser', JSON.stringify(session));

      return userId;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Log in an existing user.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} The user object.
   */
  async login(email, password) {
    try {
      if (!email || typeof email !== 'string' || email.trim().length === 0) {
        throw new Error('Email is required.');
      }
      if (!password || typeof password !== 'string' || password.length === 0) {
        throw new Error('Password is required.');
      }

      // --- Find user ---
      var user = await db.users.where('email').equals(email.trim().toLowerCase()).first();
      if (!user) {
        throw new Error('No account found with this email address.');
      }

      // --- Verify password ---
      var salt = this.hexToBuffer(user.salt);
      var hashedPassword = await this.hashPassword(password, salt);
      var hashedHex = this.bufferToHex(hashedPassword);

      if (hashedHex !== user.passwordHash) {
        throw new Error('Incorrect password. Please try again.');
      }

      // --- Store session ---
      var session = {
        id: user.id,
        name: user.name,
        email: user.email
      };
      sessionStorage.setItem('currentUser', JSON.stringify(session));

      return user;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get the currently logged-in user from session storage.
   * @returns {Object|null}
   */
  getCurrentUser() {
    try {
      var data = sessionStorage.getItem('currentUser');
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  },

  /**
   * Check if a user is currently logged in.
   * @returns {boolean}
   */
  isLoggedIn() {
    return this.getCurrentUser() !== null;
  },

  /**
   * Log out the current user.
   */
  logout() {
    sessionStorage.removeItem('currentUser');
  },

  /**
   * Require authentication. Redirects to login if not authenticated.
   * @returns {Object|null} Current user or null.
   */
  requireAuth() {
    var user = this.getCurrentUser();
    if (!user) {
      window.location.hash = '#/login';
      return null;
    }
    return user;
  }
};
