/* ============================================================
   auth.js — Authentication Module (Local PBKDF2)
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
   * @returns {Promise<Object|number>} The new user's id or registration result object.
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

      // --- Firebase Sign Up if Enabled ---
      if (window.Sync && Sync.isEnabled()) {
        const client = Sync.getClient();
        if (client) {
          try {
            const userCredential = await client.auth().createUserWithEmailAndPassword(
              email.trim().toLowerCase(),
              password
            );
            const user = userCredential.user;
            
            // Set displayName in Firebase Auth
            await user.updateProfile({
              displayName: name.trim()
            });

            // Match or create local user
            let users = await db.users.toArray();
            let existingUser = users.find(u => u.email.trim().toLowerCase() === email.trim().toLowerCase() || (u.supabaseId && u.supabaseId === user.uid));
            let localUserId;

            if (existingUser) {
              existingUser.supabaseId = user.uid;
              existingUser.name = name.trim();
              await db.users.put(existingUser);
              localUserId = existingUser.id;
            } else {
              localUserId = await db.users.add({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                supabaseId: user.uid,
                createdAt: new Date().toISOString()
              });
            }

            const oldUser = this.getCurrentUser();
            const oldUserId = oldUser ? oldUser.id : null;

            var session = {
              id: localUserId,
              name: name.trim(),
              email: email.trim().toLowerCase(),
              supabaseId: user.uid
            };
            sessionStorage.setItem('currentUser', JSON.stringify(session));

            // Migrate local offline data to user
            await this.migrateLocalDataToUser(localUserId, oldUserId);

            // Trigger initial sync push
            try {
              await Sync.push(localUserId);
            } catch (syncErr) {
              console.error('Initial sync push on registration failed:', syncErr);
            }

            return localUserId;
          } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
              throw new Error('An account with this email already exists.');
            } else if (err.code === 'auth/weak-password') {
              throw new Error('Password must be at least 6 characters long.');
            } else if (err.code === 'auth/invalid-email') {
              throw new Error('Please enter a valid email address.');
            } else {
              throw new Error(err.message);
            }
          }
        }
      }

      // --- Fallback Local Registration ---
      let users = await db.users.toArray();
      var existing = users.find(u => u.email.trim().toLowerCase() === email.trim().toLowerCase());
      if (existing) {
        throw new Error('An account with this email already exists.');
      }

      var salt = crypto.getRandomValues(new Uint8Array(16));
      var hashedPassword = await this.hashPassword(password, salt);

      var userId = await db.users.add({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: this.bufferToHex(hashedPassword),
        salt: this.bufferToHex(salt),
        createdAt: new Date().toISOString()
      });

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
   * @returns {Promise<Object>} The user session object.
   */
  async login(email, password) {
    try {
      if (!email || typeof email !== 'string' || email.trim().length === 0) {
        throw new Error('Email is required.');
      }
      if (!password || typeof password !== 'string' || password.length === 0) {
        throw new Error('Password is required.');
      }

      // --- Firebase Sign In if Enabled ---
      if (window.Sync && Sync.isEnabled()) {
        const client = Sync.getClient();
        if (client) {
          try {
            const userCredential = await client.auth().signInWithEmailAndPassword(
              email.trim().toLowerCase(),
              password
            );
            const user = userCredential.user;

            // Match or create local user
            let users = await db.users.toArray();
            let existingUser = users.find(u => u.email.trim().toLowerCase() === email.trim().toLowerCase() || (u.supabaseId && u.supabaseId === user.uid));
            let localUserId;

            if (existingUser) {
              existingUser.supabaseId = user.uid;
              if (user.displayName) {
                existingUser.name = user.displayName;
              }
              await db.users.put(existingUser);
              localUserId = existingUser.id;
            } else {
              localUserId = await db.users.add({
                name: user.displayName || 'Cloud User',
                email: user.email.toLowerCase(),
                supabaseId: user.uid,
                createdAt: new Date().toISOString()
              });
            }

            const oldUser = this.getCurrentUser();
            const oldUserId = oldUser ? oldUser.id : null;

            // Store session
            var session = {
              id: localUserId,
              name: user.displayName || (existingUser ? existingUser.name : 'Cloud User'),
              email: user.email.toLowerCase(),
              supabaseId: user.uid
            };
            sessionStorage.setItem('currentUser', JSON.stringify(session));

            // Migrate local offline data to user
            await this.migrateLocalDataToUser(localUserId, oldUserId);

            // Pull & Sync
            try {
              await Sync.pull(localUserId);
            } catch (syncErr) {
              console.error('Initial sync pull on login failed:', syncErr);
            }

            return session;
          } catch (err) {
            if (err.code === 'auth/user-not-found') {
              throw new Error('Account not found');
            } else if (err.code === 'auth/wrong-password') {
              throw new Error('Incorrect password. Please try again.');
            } else if (err.code === 'auth/invalid-credential') {
              // Firebase returns this combined code for security. To support new devices,
              // we display a combined error message.
              throw new Error('Incorrect email or password. Please try again.');
            } else {
              throw new Error(err.message);
            }
          }
        }
      }

      // --- Fallback Local PBKDF2 Login ---
      let users = await db.users.toArray();
      var user = users.find(u => u.email.trim().toLowerCase() === email.trim().toLowerCase());
      if (!user) {
        throw new Error('No account found with this email address.');
      }

      var salt = this.hexToBuffer(user.salt);
      var hashedPassword = await this.hashPassword(password, salt);
      var hashedHex = this.bufferToHex(hashedPassword);

      if (hashedHex !== user.passwordHash) {
        throw new Error('Incorrect password. Please try again.');
      }

      var session = {
        id: user.id,
        name: user.name,
        email: user.email
      };
      sessionStorage.setItem('currentUser', JSON.stringify(session));

      return session;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Migrate offline local database records from oldUserId to newUserId.
   * @param {number} newUserId - The new local user ID.
   * @param {number|null} oldUserId - The old local user ID.
   */
  async migrateLocalDataToUser(newUserId, oldUserId) {
    if (!newUserId || !oldUserId || newUserId === oldUserId) return;

    try {
      await db.transaction('rw', db.invoices, db.customers, db.companyProfiles, async () => {
        // Migrate invoices
        const invoices = await db.invoices.where('userId').equals(oldUserId).toArray();
        for (const inv of invoices) {
          await db.invoices.update(inv.id, { userId: newUserId });
        }

        // Migrate customers
        const customers = await db.customers.where('userId').equals(oldUserId).toArray();
        for (const cust of customers) {
          await db.customers.update(cust.id, { userId: newUserId });
        }

        // Migrate company profiles
        const profiles = await db.companyProfiles.where('userId').equals(oldUserId).toArray();
        for (const prof of profiles) {
          await db.companyProfiles.update(prof.id, { userId: newUserId });
        }
      });
      console.log(`Successfully migrated local data from userId ${oldUserId} to ${newUserId}`);
    } catch (err) {
      console.error('Data migration failed:', err);
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
  async logout() {
    sessionStorage.removeItem('currentUser');
    if (window.Sync && Sync.isEnabled()) {
      try {
        const client = Sync.getClient();
        if (client) {
          await client.auth().signOut();
        }
      } catch (err) {
        console.error('Firebase signOut failed:', err);
      }
    }
  },

  /**
   * Delete the current user's account permanently.
   */
  async deleteAccount() {
    const user = this.getCurrentUser();
    if (!user) throw new Error('No user is currently logged in.');

    // 1. If Firebase is enabled, delete in the cloud first
    if (window.Sync && Sync.isEnabled()) {
      const client = Sync.getClient();
      if (client) {
        try {
          const currentUser = client.auth().currentUser;
          if (currentUser) {
            // Delete Firestore sync document first
            const firestoreDb = client.firestore();
            await firestoreDb.collection('user_sync').doc(currentUser.uid).delete();
            // Delete Auth account
            await currentUser.delete();
          }
        } catch (err) {
          throw new Error('Failed to delete account from cloud: ' + err.message);
        }
      }
    }

    // 2. Delete all user data in local IndexedDB
    // Delete user's invoices and items
    if (window.Invoices) {
      const invoices = await Invoices.getAll(user.id);
      for (const inv of invoices) {
        await Invoices.delete(inv.id);
      }
    }

    // Delete customers
    if (window.Customers) {
      const customers = await Customers.getAll(user.id);
      for (const cust of customers) {
        try { await Customers.delete(cust.id); } catch (e) { /* skip */ }
      }
    }

    // Delete local user profile
    await db.users.delete(user.id);

    // 3. Clear session storage and sign out
    sessionStorage.removeItem('currentUser');
    if (window.Sync && Sync.isEnabled()) {
      try {
        const client = Sync.getClient();
        if (client) {
          await client.auth().signOut();
        }
      } catch (err) {
        console.error('Firebase signOut during account deletion failed:', err);
      }
    }
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
