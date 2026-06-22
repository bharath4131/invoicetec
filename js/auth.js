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
  async register(name, email, password, recoveryPhrase = '') {
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
      if (!password || typeof password !== 'string' || password.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }
      // If recoveryPhrase is provided, it must be a 12-word mnemonic
      if (recoveryPhrase && recoveryPhrase.trim().split(/\s+/).length !== 12) {
        throw new Error('Recovery phrase must be exactly 12 words.');
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

            var tempSalt = crypto.getRandomValues(new Uint8Array(16));
            var tempHashed = recoveryPhrase ? await this.hashPassword(recoveryPhrase.trim().toLowerCase(), tempSalt) : null;

            if (existingUser) {
              existingUser.supabaseId = user.uid;
              existingUser.name = name.trim();
              existingUser.salt = this.bufferToHex(tempSalt);
              existingUser.recoveryHash = tempHashed ? this.bufferToHex(tempHashed) : null;
              await db.users.put(existingUser);
              localUserId = existingUser.id;
            } else {
              localUserId = await db.users.add({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                supabaseId: user.uid,
                salt: this.bufferToHex(tempSalt),
                recoveryHash: tempHashed ? this.bufferToHex(tempHashed) : null,
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
              throw new Error('Password must be at least 8 characters long.');
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

      const oldUser = this.getCurrentUser();
      const oldUserId = oldUser ? oldUser.id : null;

      var salt = crypto.getRandomValues(new Uint8Array(16));
      var hashedPassword = await this.hashPassword(password, salt);
      var hashedRecovery = recoveryPhrase ? await this.hashPassword(recoveryPhrase.trim().toLowerCase(), salt) : null;

      var userId = await db.users.add({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: this.bufferToHex(hashedPassword),
        salt: this.bufferToHex(salt),
        recoveryHash: hashedRecovery ? this.bufferToHex(hashedRecovery) : null,
        createdAt: new Date().toISOString()
      });

      var session = {
        id: userId,
        name: name.trim(),
        email: email.trim().toLowerCase()
      };
      sessionStorage.setItem('currentUser', JSON.stringify(session));

      // Migrate local offline data to user
      await this.migrateLocalDataToUser(userId, oldUserId);

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
            const normalizedEmail = user.email.trim().toLowerCase();

            // Prefer a direct index lookup over a full table scan
            let existingUser = await db.users.where('email').equals(normalizedEmail).first();
            if (!existingUser) {
              const allUsers = await db.users.toArray();
              existingUser = allUsers.find(u =>
                (u.supabaseId && u.supabaseId === user.uid) ||
                (u.email && u.email.trim().toLowerCase() === normalizedEmail)
              ) || null;
            }

            let localUserId;

            if (existingUser) {
              existingUser.supabaseId = user.uid;
              existingUser.email = normalizedEmail; // normalize casing
              if (user.displayName) {
                existingUser.name = user.displayName;
              }
              await db.users.put(existingUser);
              localUserId = existingUser.id;
            } else {
              try {
                localUserId = await db.users.add({
                  name: user.displayName || 'Cloud User',
                  email: normalizedEmail,
                  supabaseId: user.uid,
                  createdAt: new Date().toISOString()
                });
              } catch (constraintErr) {
                // Recover from a duplicate-email race condition
                console.warn('[Auth] Duplicate email on Firebase login add — recovering:', constraintErr.message);
                existingUser = await db.users.where('email').equals(normalizedEmail).first();
                if (existingUser) {
                  existingUser.supabaseId = user.uid;
                  if (user.displayName) existingUser.name = user.displayName;
                  await db.users.put(existingUser);
                  localUserId = existingUser.id;
                } else {
                  throw constraintErr;
                }
              }
            }

            const oldUser = this.getCurrentUser();
            const oldUserId = oldUser ? oldUser.id : null;

            // Store session
            var session = {
              id: localUserId,
              name: user.displayName || (existingUser ? existingUser.name : 'Cloud User'),
              email: normalizedEmail,
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

      const oldUser = this.getCurrentUser();
      const oldUserId = oldUser ? oldUser.id : null;

      var session = {
        id: user.id,
        name: user.name,
        email: user.email
      };
      sessionStorage.setItem('currentUser', JSON.stringify(session));

      // Migrate local offline data to user
      await this.migrateLocalDataToUser(user.id, oldUserId);

      return session;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Log in via Google provider.
   */
  async loginWithGoogle() {
    if (!window.Sync || !Sync.isEnabled()) {
      throw new Error('Google Login requires Cloud Sync. Please configure and enable Firebase in Settings first.');
    }
    
    const client = Sync.getClient();
    if (!client) {
      throw new Error('Firebase client failed to initialize. Please check your config in Settings.');
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await client.auth().signInWithPopup(provider);
      const user = result.user;

      // ── Step 1: Try a precise DB-index lookup by email first (most reliable) ──
      const normalizedEmail = user.email.trim().toLowerCase();
      let existingUser = await db.users.where('email').equals(normalizedEmail).first();

      // ── Step 2: Fallback — scan all users for supabaseId match (handles
      //    users whose email was stored with different casing) ──
      if (!existingUser) {
        const allUsers = await db.users.toArray();
        existingUser = allUsers.find(u =>
          (u.supabaseId && u.supabaseId === user.uid) ||
          (u.email && u.email.trim().toLowerCase() === normalizedEmail)
        ) || null;
      }

      let localUserId;
      const isNewUser = !existingUser;

      if (existingUser) {
        // Update the existing record in-place
        existingUser.supabaseId = user.uid;
        if (user.displayName) {
          existingUser.name = user.displayName;
        }
        existingUser.email = normalizedEmail; // Normalise casing in DB
        await db.users.put(existingUser);     // put() = upsert, never throws on duplicate
        localUserId = existingUser.id;
      } else {
        // Brand-new Google user — use put() with a generated record so a
        // duplicate-email race condition cannot crash the app
        try {
          localUserId = await db.users.add({
            name: user.displayName || 'Google User',
            email: normalizedEmail,
            supabaseId: user.uid,
            createdAt: new Date().toISOString()
          });
        } catch (constraintErr) {
          // Another record with this email slipped in (race or previous session) —
          // recover by doing a fresh lookup and updating that record instead
          console.warn('[Auth] Duplicate email on Google add — recovering:', constraintErr.message);
          existingUser = await db.users.where('email').equals(normalizedEmail).first();
          if (existingUser) {
            existingUser.supabaseId = user.uid;
            if (user.displayName) existingUser.name = user.displayName;
            await db.users.put(existingUser);
            localUserId = existingUser.id;
          } else {
            throw constraintErr; // Genuinely unexpected — re-throw
          }
        }
      }

      const oldUser = this.getCurrentUser();
      const oldUserId = oldUser ? oldUser.id : null;

      // Store session
      var session = {
        id: localUserId,
        name: user.displayName || (existingUser ? existingUser.name : 'Google User'),
        email: normalizedEmail,
        supabaseId: user.uid
      };
      sessionStorage.setItem('currentUser', JSON.stringify(session));

      // Migrate any offline data created before Google sign-in
      await this.migrateLocalDataToUser(localUserId, oldUserId);

      // Pull & Sync
      try {
        await Sync.pull(localUserId);
      } catch (syncErr) {
        console.error('Initial sync pull on Google login failed:', syncErr);
      }

      return { session: session, isNewUser: isNewUser };
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      throw new Error(err.message);
    }
  },

  /**
   * Migrate offline local database records from oldUserId to newUserId.
   * @param {number} newUserId - The new local user ID.
   * @param {number|null} oldUserId - The old local user ID.
   */
  async migrateLocalDataToUser(newUserId, oldUserId) {
    if (!newUserId || !oldUserId || newUserId === oldUserId) return;
    console.log(`[DEBUG] Starting local data migration from "${oldUserId}" to "${newUserId}"...`);

    try {
      await db.transaction('rw', db.invoices, db.customers, db.companyProfiles, db.products, db.settings, async () => {
        // Migrate invoices
        const invoices = await db.invoices.where('userId').equals(oldUserId).toArray();
        console.log(`[DEBUG] Found ${invoices.length} invoices to migrate for userId "${oldUserId}".`);
        for (const inv of invoices) {
          await db.invoices.update(inv.id, { userId: newUserId });
        }

        // Migrate customers
        const customers = await db.customers.where('userId').equals(oldUserId).toArray();
        console.log(`[DEBUG] Found ${customers.length} customers to migrate for userId "${oldUserId}".`);
        for (const cust of customers) {
          await db.customers.update(cust.id, { userId: newUserId });
        }

        // Migrate company profiles
        const profiles = await db.companyProfiles.where('userId').equals(oldUserId).toArray();
        console.log(`[DEBUG] Found ${profiles.length} company profiles to migrate for userId "${oldUserId}".`);
        for (const prof of profiles) {
          const existingProfile = await db.companyProfiles.where('userId').equals(newUserId).first();
          if (existingProfile) {
            await db.companyProfiles.delete(prof.id);
          } else {
            await db.companyProfiles.update(prof.id, { userId: newUserId });
          }
        }

        // Migrate products
        if (db.products) {
          const products = await db.products.where('userId').equals(oldUserId).toArray();
          console.log(`[DEBUG] Found ${products.length} products to migrate for userId "${oldUserId}".`);
          for (const prod of products) {
            await db.products.update(prod.id, { userId: newUserId });
          }
        }

        // Migrate settings
        if (db.settings) {
          const settings = await db.settings.where('userId').equals(oldUserId).toArray();
          console.log(`[DEBUG] Found ${settings.length} settings to migrate for userId "${oldUserId}".`);
          for (const set of settings) {
            const existingSettings = await db.settings.where('userId').equals(newUserId).first();
            if (existingSettings) {
              await db.settings.delete(set.id);
            } else {
              await db.settings.update(set.id, { userId: newUserId });
            }
          }
        }
      });
      console.log(`[DEBUG] Successfully migrated local data from userId "${oldUserId}" to "${newUserId}"`);
    } catch (err) {
      console.error('[DEBUG] Data migration failed:', err);
    }
  },

  /**
   * Get the currently logged-in user from session storage.
   * @returns {Object|null}
   */
  getCurrentUser() {
    try {
      var data = sessionStorage.getItem('currentUser');
      if (!data) {
        // Return a mock guest user to enable anonymous guest mode throughout the app
        return {
          id: 'guest',
          name: 'Guest User',
          email: 'guest@invoicetec.com'
        };
      }
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
    try {
      return sessionStorage.getItem('currentUser') !== null;
    } catch (e) {
      return false;
    }
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
          if (err.code === 'auth/requires-recent-login') {
            throw new Error('For security reasons, deleting your account requires you to have signed in recently. Please sign out, log back in, and try deleting your account again.');
          }
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

  WORDLIST: [
    "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
    "abuse", "access", "accident", "account", "accuse", "achieve", "acid", "acoustic",
    "acquire", "across", "act", "action", "actor", "actress", "actual", "adapt",
    "add", "addict", "address", "adjust", "admit", "adult", "advance", "advice",
    "aerobic", "affair", "afford", "afraid", "again", "age", "agent", "agree",
    "ahead", "aim", "air", "airport", "alarm", "album", "alcohol", "alert",
    "alien", "alike", "alive", "all", "alley", "allow", "almost", "alone",
    "along", "alpha", "already", "also", "alter", "always", "amateur", "amazing",
    "among", "amount", "amused", "analyst", "anchor", "ancient", "anger", "angle",
    "angry", "animal", "ankle", "announce", "annual", "another", "answer", "antenna",
    "antique", "anxiety", "any", "apart", "apology", "appear", "apple", "approve",
    "april", "arch", "arctic", "area", "arena", "argue", "arm", "armed",
    "armor", "army", "around", "arrange", "arrest", "arrive", "arrow", "art",
    "artefact", "artist", "artwork", "ask", "aspect", "assault", "asset", "assist",
    "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract"
  ],

  generateMnemonic() {
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    const words = [];
    for (let i = 0; i < 12; i++) {
      const wordIndex = array[i] % 128;
      words.push(this.WORDLIST[wordIndex]);
    }
    return words.join(' ');
  },

  async verifySeedAndResetPassword(email, seedPhrase, newPassword) {
    try {
      const emailLower = email.trim().toLowerCase();
      const users = await db.users.toArray();
      const user = users.find(u => u.email.toLowerCase() === emailLower);
      if (!user) {
        throw new Error('Account not found with this email.');
      }
      if (!user.recoveryHash) {
        throw new Error('Recovery phrase was not set up for this account.');
      }

      const salt = this.hexToBuffer(user.salt);
      const hashedRecovery = await this.hashPassword(seedPhrase.trim().toLowerCase(), salt);
      if (this.bufferToHex(hashedRecovery) !== user.recoveryHash) {
        return false;
      }

      // Reset
      const newSalt = crypto.getRandomValues(new Uint8Array(16));
      const hashedPassword = await this.hashPassword(newPassword, newSalt);
      const newHashedRecovery = await this.hashPassword(seedPhrase.trim().toLowerCase(), newSalt);

      user.passwordHash = this.bufferToHex(hashedPassword);
      user.salt = this.bufferToHex(newSalt);
      user.recoveryHash = this.bufferToHex(newHashedRecovery);

      await db.users.put(user);
      return true;
    } catch (e) {
      throw new Error(e.message);
    }
  },

  SECURITY_QUESTIONS: {
    pet: "What was the name of your first pet?",
    city: "In what city were you born?",
    friend: "What is the name of your childhood best friend?",
    school: "What was the name of your primary school?"
  },

  /**
   * Get the registered security question for a local user.
   */
  async getSecurityQuestion(email) {
    const emailLower = email.trim().toLowerCase();
    const users = await db.users.toArray();
    const user = users.find(u => u.email.toLowerCase() === emailLower);
    if (!user) return null;
    
    if (user.supabaseId) {
      return { isFirebase: true };
    }
    
    if (!user.securityQuestion) return null;
    const questionLabel = this.SECURITY_QUESTIONS[user.securityQuestion] || "Security verification question";
    return {
      question: user.securityQuestion,
      label: questionLabel
    };
  },

  /**
   * Verify the security answer for a local user.
   */
  async verifySecurityAnswer(email, answer) {
    const emailLower = email.trim().toLowerCase();
    const users = await db.users.toArray();
    const user = users.find(u => u.email.toLowerCase() === emailLower);
    if (!user || !user.securityAnswerHash || !user.salt) return false;
    
    const salt = this.hexToBuffer(user.salt);
    const hashed = await this.hashPassword(answer.trim().toLowerCase(), salt);
    return this.bufferToHex(hashed) === user.securityAnswerHash;
  },

  /**
   * Reset the password locally in IndexedDB.
   */
  async resetPasswordLocally(email, newPassword) {
    const emailLower = email.trim().toLowerCase();
    const users = await db.users.toArray();
    const user = users.find(u => u.email.toLowerCase() === emailLower);
    if (!user) throw new Error('User not found.');

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hashedPassword = await this.hashPassword(newPassword, salt);

    user.passwordHash = this.bufferToHex(hashedPassword);
    user.salt = this.bufferToHex(salt);
    
    await db.users.put(user);
    return true;
  },

  /**
   * Send a Firebase password reset email.
   */
  async sendPasswordResetEmail(email) {
    if (window.Sync && Sync.isEnabled()) {
      const client = Sync.getClient();
      if (client) {
        await client.auth().sendPasswordResetEmail(email.trim().toLowerCase());
        return true;
      }
    }
    return false;
  },

  /**
   * Require authentication. Redirects to login if not authenticated.
   * @returns {Object|null} Current user or null.
   */
  requireAuth() {
    if (!this.isLoggedIn()) {
      Router.go('/login');
      return null;
    }
    return this.getCurrentUser();
  }
};
