/* ============================================================
   invoices.js — Invoice Management Module
   Invoice Generator Application
   ============================================================ */

window.Invoices = {

  /**
   * Generate the next invoice number for a user.
   * Finds the highest existing invoice number and increments.
   * @param {number} userId
   * @returns {Promise<string>} e.g. 'INV-0001'
   */
  async getNextInvoiceNumber(userId) {
    try {
      var invoices = await db.invoices
        .where('userId')
        .equals(userId)
        .toArray();

      if (!invoices || invoices.length === 0) {
        return 'INV-0001';
      }

      // Sort invoices by date/id descending to find the latest invoice pattern
      invoices.sort(function (a, b) {
        var dateA = new Date(a.date || a.createdAt || 0);
        var dateB = new Date(b.date || b.createdAt || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
        return (b.id || 0) - (a.id || 0);
      });

      var latestInvoice = invoices.find(function (inv) {
        return inv.invoiceNumber && typeof inv.invoiceNumber === 'string' && /(\d+)$/.test(inv.invoiceNumber);
      });

      if (!latestInvoice) {
        return 'INV-0001';
      }

      var lastNumStr = latestInvoice.invoiceNumber;
      var match = lastNumStr.match(/^(.*?)(\d+)$/);
      if (match) {
        var prefix = match[1];
        var numStr = match[2];
        var nextVal = parseInt(numStr, 10) + 1;
        var padding = numStr.length;
        var nextNumStr = String(nextVal).padStart(padding, '0');
        return prefix + nextNumStr;
      }

      return 'INV-0001';
    } catch (error) {
      throw new Error('Failed to generate invoice number: ' + error.message);
    }
  },

  /**
   * Create a new invoice with its line items atomically.
   * @param {Object} invoiceData
   * @param {Array} items
   * @returns {Promise<number>} The new invoice id.
   */
  async create(invoiceData, items) {
    try {
      var invoiceId = await db.transaction('rw', db.invoices, db.invoiceItems, async function () {
        var id = await db.invoices.add({
          userId: invoiceData.userId,
          customerId: invoiceData.customerId,
          invoiceNumber: invoiceData.invoiceNumber,
          date: invoiceData.date,
          dueDate: invoiceData.dueDate,
          status: invoiceData.status || 'draft',
          subtotal: invoiceData.subtotal || 0,
          taxRate: invoiceData.taxRate || 0,
          taxAmount: invoiceData.taxAmount || 0,
          discountType: invoiceData.discountType || 'percentage',
          discountValue: invoiceData.discountValue || 0,
          discountAmount: invoiceData.discountAmount || 0,
          total: invoiceData.total || 0,
          notes: invoiceData.notes || '',
          template: invoiceData.template || 'default',
          currency: invoiceData.currency || 'USD',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        if (items && items.length > 0) {
          var itemsToAdd = items.map(function (item) {
            return {
              invoiceId: id,
              description: item.description || '',
              quantity: item.quantity || 0,
              rate: item.rate || 0,
              amount: item.amount || 0
            };
          });
          await db.invoiceItems.bulkAdd(itemsToAdd);
        }

        return id;
      });

      return invoiceId;
    } catch (error) {
      throw new Error('Failed to create invoice: ' + error.message);
    }
  },

  /**
   * Update an existing invoice and replace its line items.
   * @param {number} id - Invoice id.
   * @param {Object} invoiceData
   * @param {Array} items
   */
  async update(id, invoiceData, items) {
    try {
      await db.transaction('rw', db.invoices, db.invoiceItems, async function () {
        // Update the invoice record
        await db.invoices.update(id, {
          customerId: invoiceData.customerId,
          invoiceNumber: invoiceData.invoiceNumber,
          date: invoiceData.date,
          dueDate: invoiceData.dueDate,
          status: invoiceData.status,
          subtotal: invoiceData.subtotal || 0,
          taxRate: invoiceData.taxRate || 0,
          taxAmount: invoiceData.taxAmount || 0,
          discountType: invoiceData.discountType || 'percentage',
          discountValue: invoiceData.discountValue || 0,
          discountAmount: invoiceData.discountAmount || 0,
          total: invoiceData.total || 0,
          notes: invoiceData.notes || '',
          template: invoiceData.template || 'default',
          currency: invoiceData.currency || 'USD',
          updatedAt: new Date().toISOString()
        });

        // Delete old items
        var oldItems = await db.invoiceItems.where('invoiceId').equals(id).toArray();
        var oldIds = oldItems.map(function (item) { return item.id; });
        if (oldIds.length > 0) {
          await db.invoiceItems.bulkDelete(oldIds);
        }

        // Add new items
        if (items && items.length > 0) {
          var itemsToAdd = items.map(function (item) {
            return {
              invoiceId: id,
              description: item.description || '',
              quantity: item.quantity || 0,
              rate: item.rate || 0,
              amount: item.amount || 0
            };
          });
          await db.invoiceItems.bulkAdd(itemsToAdd);
        }
      });
    } catch (error) {
      throw new Error('Failed to update invoice: ' + error.message);
    }
  },

  /**
   * Delete an invoice and all its line items.
   * @param {number} id - Invoice id.
   */
  async delete(id) {
    try {
      await db.transaction('rw', db.invoices, db.invoiceItems, async function () {
        // Delete items first
        var items = await db.invoiceItems.where('invoiceId').equals(id).toArray();
        var itemIds = items.map(function (item) { return item.id; });
        if (itemIds.length > 0) {
          await db.invoiceItems.bulkDelete(itemIds);
        }

        // Delete invoice
        await db.invoices.delete(id);
      });
    } catch (error) {
      throw new Error('Failed to delete invoice: ' + error.message);
    }
  },

  /**
   * Get a single invoice with its items and customer.
   * @param {number} id - Invoice id.
   * @returns {Promise<Object>} Invoice with items and customer attached.
   */
  async get(id) {
    try {
      var invoice = await db.invoices.get(id);
      if (!invoice) {
        throw new Error('Invoice not found.');
      }

      var items = await db.invoiceItems.where('invoiceId').equals(id).toArray();
      var customer = invoice.customerId
        ? await db.customers.get(invoice.customerId)
        : null;

      return Object.assign({}, invoice, {
        items: items,
        customer: customer || null
      });
    } catch (error) {
      throw new Error('Failed to retrieve invoice: ' + error.message);
    }
  },

  /**
   * Get all invoices for a user, sorted by date descending,
   * with customer name attached.
   * @param {number} userId
   * @returns {Promise<Array>}
   */
  async getAll(userId) {
    try {
      var invoices = await db.invoices
        .where('userId')
        .equals(userId)
        .toArray();

      // Sort by date descending
      invoices.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });

      // Attach customer name to each invoice
      var results = [];
      for (var i = 0; i < invoices.length; i++) {
        var inv = invoices[i];
        var customerName = '';
        if (inv.customerId) {
          var customer = await db.customers.get(inv.customerId);
          if (customer) {
            customerName = customer.name;
          }
        }
        results.push(Object.assign({}, inv, { customerName: customerName }));
      }

      return results;
    } catch (error) {
      throw new Error('Failed to retrieve invoices: ' + error.message);
    }
  },

  /**
   * Search invoices by invoice number or customer name.
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

      // Get all invoices for user
      var invoices = await db.invoices
        .where('userId')
        .equals(userId)
        .toArray();

      // Get all customers for efficient lookup
      var customers = await db.customers
        .where('userId')
        .equals(userId)
        .toArray();

      var customerMap = {};
      customers.forEach(function (c) {
        customerMap[c.id] = c;
      });

      // Filter by invoice number or customer name
      var filtered = invoices.filter(function (inv) {
        // Check invoice number
        if (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().indexOf(lowerQuery) !== -1) {
          return true;
        }
        // Check customer name
        if (inv.customerId && customerMap[inv.customerId]) {
          var name = customerMap[inv.customerId].name || '';
          if (name.toLowerCase().indexOf(lowerQuery) !== -1) {
            return true;
          }
        }
        return false;
      });

      // Sort by date descending
      filtered.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });

      // Attach customer names
      return filtered.map(function (inv) {
        var customerName = '';
        if (inv.customerId && customerMap[inv.customerId]) {
          customerName = customerMap[inv.customerId].name;
        }
        return Object.assign({}, inv, { customerName: customerName });
      });
    } catch (error) {
      throw new Error('Failed to search invoices: ' + error.message);
    }
  },

  /**
   * Filter invoices by status using the compound index.
   * @param {number} userId
   * @param {string} [status] - 'draft'|'pending'|'paid'|'overdue' or falsy for all.
   * @returns {Promise<Array>}
   */
  async filterByStatus(userId, status) {
    try {
      var invoices;

      if (status) {
        // Use the compound index [userId+status]
        invoices = await db.invoices
          .where('[userId+status]')
          .equals([userId, status])
          .toArray();
      } else {
        invoices = await db.invoices
          .where('userId')
          .equals(userId)
          .toArray();
      }

      // Sort by date descending
      invoices.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });

      // Attach customer names
      var results = [];
      for (var i = 0; i < invoices.length; i++) {
        var inv = invoices[i];
        var customerName = '';
        if (inv.customerId) {
          var customer = await db.customers.get(inv.customerId);
          if (customer) {
            customerName = customer.name;
          }
        }
        results.push(Object.assign({}, inv, { customerName: customerName }));
      }

      return results;
    } catch (error) {
      throw new Error('Failed to filter invoices: ' + error.message);
    }
  },

  /**
   * Duplicate an existing invoice with a new number and today's date.
   * @param {number} id - The invoice id to duplicate.
   * @returns {Promise<number>} The new invoice id.
   */
  async duplicate(id) {
    try {
      var original = await this.get(id);
      if (!original) {
        throw new Error('Invoice not found for duplication.');
      }

      var newNumber = await this.getNextInvoiceNumber(original.userId);
      var today = new Date().toISOString().split('T')[0];

      var newInvoiceData = {
        userId: original.userId,
        customerId: original.customerId,
        invoiceNumber: newNumber,
        date: today,
        dueDate: original.dueDate,
        status: 'draft',
        currency: original.currency || 'USD',
        subtotal: original.subtotal,
        taxRate: original.taxRate,
        taxAmount: original.taxAmount,
        discountType: original.discountType,
        discountValue: original.discountValue,
        discountAmount: original.discountAmount,
        total: original.total,
        notes: original.notes,
        template: original.template
      };

      var newItems = (original.items || []).map(function (item) {
        return {
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount
        };
      });

      return await this.create(newInvoiceData, newItems);
    } catch (error) {
      throw new Error('Failed to duplicate invoice: ' + error.message);
    }
  },

  /**
   * Calculate dashboard statistics for a user.
   * @param {number} userId
   * @returns {Promise<Object>} Stats object.
   */
  async getStats(userId) {
    try {
      var invoices = await db.invoices
        .where('userId')
        .equals(userId)
        .toArray();

      var totalRevenue = 0;
      var outstandingAmount = 0;
      var overdueAmount = 0;
      var totalInvoices = invoices.length;
      var paidCount = 0;
      var pendingCount = 0;
      var overdueCount = 0;
      var draftCount = 0;

      invoices.forEach(function (inv) {
        var total = parseFloat(inv.total) || 0;
        switch (inv.status) {
          case 'paid':
            totalRevenue += total;
            paidCount++;
            break;
          case 'pending':
            outstandingAmount += total;
            pendingCount++;
            break;
          case 'overdue':
            overdueAmount += total;
            overdueCount++;
            break;
          case 'draft':
            draftCount++;
            break;
        }
      });

      // Calculate monthly revenue for last 6 months (paid invoices only)
      var monthlyRevenue = [];
      var now = new Date();

      for (var m = 5; m >= 0; m--) {
        var targetDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
        var targetMonth = targetDate.getMonth();
        var targetYear = targetDate.getFullYear();
        var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        var monthAmount = 0;
        invoices.forEach(function (inv) {
          if (inv.status === 'paid' && inv.date) {
            var invDate = new Date(inv.date);
            if (invDate.getMonth() === targetMonth && invDate.getFullYear() === targetYear) {
              monthAmount += parseFloat(inv.total) || 0;
            }
          }
        });

        monthlyRevenue.push({
          month: monthNames[targetMonth],
          year: targetYear,
          amount: monthAmount
        });
      }

      return {
        totalRevenue: totalRevenue,
        outstandingAmount: outstandingAmount,
        overdueAmount: overdueAmount,
        totalInvoices: totalInvoices,
        paidCount: paidCount,
        pendingCount: pendingCount,
        overdueCount: overdueCount,
        draftCount: draftCount,
        monthlyRevenue: monthlyRevenue
      };
    } catch (error) {
      throw new Error('Failed to calculate invoice statistics: ' + error.message);
    }
  }
};
