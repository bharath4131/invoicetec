/* ============================================================
   products.js — Products & Services catalog management
   Invoice Generator Application
   ============================================================ */

window.Products = {

  /**
   * Add a new product/service to catalog.
   * @param {Object} productData - { userId, name, price, description }
   * @returns {Promise<number>} The new product's id.
   */
  async add(productData) {
    try {
      if (!productData.userId) {
        throw new Error('User ID is required to add a product.');
      }
      if (!productData.name || productData.name.trim().length === 0) {
        throw new Error('Product/Service name is required.');
      }
      var price = parseFloat(productData.price);
      if (isNaN(price) || price < 0) {
        throw new Error('Valid default price is required.');
      }

      var id = await db.products.add({
        userId: productData.userId,
        name: productData.name.trim(),
        price: price,
        description: (productData.description || '').trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return id;
    } catch (error) {
      throw new Error('Failed to add product: ' + error.message);
    }
  },

  /**
   * Update an existing product.
   * @param {number} id - Product id.
   * @param {Object} data - Fields to update.
   */
  async update(id, data) {
    try {
      var existing = await db.products.get(id);
      if (!existing) {
        throw new Error('Product not found.');
      }

      var updateData = {};
      if (data.name !== undefined) {
        if (!data.name.trim()) throw new Error('Product name cannot be empty.');
        updateData.name = data.name.trim();
      }
      if (data.price !== undefined) {
        var price = parseFloat(data.price);
        if (isNaN(price) || price < 0) throw new Error('Price must be a valid positive number.');
        updateData.price = price;
      }
      if (data.description !== undefined) {
        updateData.description = data.description.trim();
      }
      updateData.updatedAt = new Date().toISOString();

      await db.products.update(id, updateData);
    } catch (error) {
      throw new Error('Failed to update product: ' + error.message);
    }
  },

  /**
   * Delete a product from the catalog.
   * @param {number} id - Product id.
   */
  async delete(id) {
    try {
      var existing = await db.products.get(id);
      if (!existing) {
        throw new Error('Product not found.');
      }
      await db.products.delete(id);
    } catch (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Get a single product by id.
   * @param {number} id
   * @returns {Promise<Object|undefined>}
   */
  async get(id) {
    try {
      var product = await db.products.get(id);
      if (!product) {
        throw new Error('Product not found.');
      }
      return product;
    } catch (error) {
      throw new Error('Failed to retrieve product: ' + error.message);
    }
  },

  /**
   * Get all products for a user, sorted by name ascending.
   * @param {number} userId
   * @returns {Promise<Array>}
   */
  async getAll(userId) {
    try {
      var products = await db.products
        .where('userId')
        .equals(userId)
        .toArray();

      products.sort(function (a, b) {
        var nameA = (a.name || '').toLowerCase();
        var nameB = (b.name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      return products;
    } catch (error) {
      throw new Error('Failed to retrieve products: ' + error.message);
    }
  },

  /**
   * Search products by name or description.
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

      var products = await db.products
        .where('userId')
        .equals(userId)
        .filter(function (product) {
          var name = (product.name || '').toLowerCase();
          var desc = (product.description || '').toLowerCase();
          return name.indexOf(lowerQuery) !== -1 || desc.indexOf(lowerQuery) !== -1;
        })
        .toArray();

      products.sort(function (a, b) {
        var nameA = (a.name || '').toLowerCase();
        var nameB = (b.name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      return products;
    } catch (error) {
      throw new Error('Failed to search products: ' + error.message);
    }
  }
};
