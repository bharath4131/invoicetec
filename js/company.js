/* ============================================================
   company.js — Company Profile Module
   Invoice Generator Application
   ============================================================ */

window.Company = {

  /**
   * Save (create or update) a company profile for a user.
   * @param {number} userId
   * @param {Object} data - { companyName, address, city, state, zip, country, phone, email, website, taxId, logo }
   */
  async save(userId, data) {
    try {
      if (!userId) {
        throw new Error('User ID is required to save company profile.');
      }

      var profileData = {
        userId: userId,
        companyName: (data.companyName || '').trim(),
        address: (data.address || '').trim(),
        city: (data.city || '').trim(),
        state: (data.state || '').trim(),
        zip: (data.zip || '').trim(),
        country: (data.country || '').trim(),
        phone: (data.phone || '').trim(),
        email: (data.email || '').trim().toLowerCase(),
        website: (data.website || '').trim(),
        taxId: (data.taxId || '').trim(),
        logo: data.logo || null,
        updatedAt: new Date().toISOString()
      };

      // Check if profile already exists
      var existing = await db.companyProfiles
        .where('userId')
        .equals(userId)
        .first();

      if (existing) {
        await db.companyProfiles.update(existing.id, profileData);
      } else {
        profileData.createdAt = new Date().toISOString();
        await db.companyProfiles.add(profileData);
      }
    } catch (error) {
      throw new Error('Failed to save company profile: ' + error.message);
    }
  },

  /**
   * Get the company profile for a user.
   * @param {number} userId
   * @returns {Promise<Object|null>}
   */
  async get(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required to retrieve company profile.');
      }

      var profile = await db.companyProfiles
        .where('userId')
        .equals(userId)
        .first();

      return profile || null;
    } catch (error) {
      throw new Error('Failed to retrieve company profile: ' + error.message);
    }
  },

  /**
   * Update only the logo field for a user's company profile.
   * @param {number} userId
   * @param {string|null} base64Logo - Base64-encoded logo or null to clear.
   */
  async updateLogo(userId, base64Logo) {
    try {
      if (!userId) {
        throw new Error('User ID is required to update logo.');
      }

      var existing = await db.companyProfiles
        .where('userId')
        .equals(userId)
        .first();

      if (!existing) {
        // Create a minimal profile with just the logo
        await db.companyProfiles.add({
          userId: userId,
          companyName: '',
          address: '',
          city: '',
          state: '',
          zip: '',
          country: '',
          phone: '',
          email: '',
          website: '',
          taxId: '',
          logo: base64Logo,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } else {
        await db.companyProfiles.update(existing.id, {
          logo: base64Logo,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      throw new Error('Failed to update company logo: ' + error.message);
    }
  }
};
