/* ============================================================
   customers.js — Customer Management Module
   Invoice Generator Application
   ============================================================ */

window.Customers = {

  /**
   * Add a new customer.
   * @param {Object} customerData - { userId, name, email, phone, address, city, state, zip, country }
   * @returns {Promise<number>} The new customer's id.
   */
  async add(customerData) {
    try {
      if (!customerData.userId) {
        throw new Error('User ID is required to add a customer.');
      }
      if (!customerData.name || customerData.name.trim().length === 0) {
        throw new Error('Customer name is required.');
      }

      var id = await db.customers.add({
        userId: customerData.userId,
        name: customerData.name.trim(),
        email: (customerData.email || '').trim().toLowerCase(),
        phone: (customerData.phone || '').trim(),
        address: (customerData.address || '').trim(),
        city: (customerData.city || '').trim(),
        state: (customerData.state || '').trim(),
        zip: (customerData.zip || '').trim(),
        country: (customerData.country || '').trim(),
        createdAt: new Date().toISOString()
      });

      return id;
    } catch (error) {
      throw new Error('Failed to add customer: ' + error.message);
    }
  },

  /**
   * Update an existing customer.
   * @param {number} id - Customer id.
   * @param {Object} data - Fields to update.
   */
  async update(id, data) {
    try {
      var existing = await db.customers.get(id);
      if (!existing) {
        throw new Error('Customer not found.');
      }

      var updateData = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.email !== undefined) updateData.email = data.email.trim().toLowerCase();
      if (data.phone !== undefined) updateData.phone = data.phone.trim();
      if (data.address !== undefined) updateData.address = data.address.trim();
      if (data.city !== undefined) updateData.city = data.city.trim();
      if (data.state !== undefined) updateData.state = data.state.trim();
      if (data.zip !== undefined) updateData.zip = data.zip.trim();
      if (data.country !== undefined) updateData.country = data.country.trim();
      updateData.updatedAt = new Date().toISOString();

      await db.customers.update(id, updateData);
    } catch (error) {
      throw new Error('Failed to update customer: ' + error.message);
    }
  },

  /**
   * Delete a customer. Prevents deletion if invoices reference them.
   * @param {number} id - Customer id.
   */
  async delete(id) {
    try {
      var existing = await db.customers.get(id);
      if (!existing) {
        throw new Error('Customer not found.');
      }

      // Check for referencing invoices
      var referencingInvoices = await db.invoices
        .where('customerId')
        .equals(id)
        .count();

      if (referencingInvoices > 0) {
        throw new Error('Cannot delete customer with existing invoices.');
      }

      await db.customers.delete(id);
    } catch (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Get a single customer by id.
   * @param {number} id
   * @returns {Promise<Object|undefined>}
   */
  async get(id) {
    try {
      var customer = await db.customers.get(id);
      if (!customer) {
        throw new Error('Customer not found.');
      }
      return customer;
    } catch (error) {
      throw new Error('Failed to retrieve customer: ' + error.message);
    }
  },

  /**
   * Get all customers for a user, sorted by name ascending.
   * @param {number} userId
   * @returns {Promise<Array>}
   */
  async getAll(userId) {
    try {
      var customers = await db.customers
        .where('userId')
        .equals(userId)
        .toArray();

      customers.sort(function (a, b) {
        var nameA = (a.name || '').toLowerCase();
        var nameB = (b.name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      return customers;
    } catch (error) {
      throw new Error('Failed to retrieve customers: ' + error.message);
    }
  },

  /**
   * Search customers by name or email.
   * @param {number} userId
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async search(userId, query) {
    try {
      if (!query || query.trim().length === 0) {
        return this.getAll(userId);
      }

      var lowerQuery = query.trim().toLowerCase();

      var customers = await db.customers
        .where('userId')
        .equals(userId)
        .filter(function (customer) {
          var name = (customer.name || '').toLowerCase();
          var email = (customer.email || '').toLowerCase();
          return name.indexOf(lowerQuery) !== -1 || email.indexOf(lowerQuery) !== -1;
        })
        .toArray();

      customers.sort(function (a, b) {
        var nameA = (a.name || '').toLowerCase();
        var nameB = (b.name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      return customers;
    } catch (error) {
      throw new Error('Failed to search customers: ' + error.message);
    }
  }
};
