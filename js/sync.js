/* ============================================================
   sync.js — Cloud Database Synchronization Module (Firebase)
   Invoice Generator Application
   ============================================================ */

window.Sync = (function () {
  'use strict';

  let firebaseApp = null;

  /**
   * Update the cloud sync status badge in UI.
   */
  function updateSyncStatusBadge(status) {
    const badge = document.getElementById('sync-status-badge');
    if (!badge) return;

    if (status === 'Connected') {
      badge.textContent = 'Status: Connected';
      badge.style.background = 'rgba(16, 185, 129, 0.1)';
      badge.style.color = '#10b981';
    } else if (status === 'Error') {
      badge.textContent = 'Status: Sync Error';
      badge.style.background = 'rgba(239, 68, 68, 0.1)';
      badge.style.color = '#ef4444';
    } else if (status === 'Credentials needed') {
      badge.textContent = 'Status: Configuration Required';
      badge.style.background = 'rgba(245, 158, 11, 0.1)';
      badge.style.color = '#f59e0b';
    } else if (status === 'Syncing') {
      badge.textContent = 'Status: Syncing...';
      badge.style.background = 'rgba(59, 130, 246, 0.1)';
      badge.style.color = '#3b82f6';
    } else {
      badge.textContent = 'Status: Disconnected';
      badge.style.background = 'var(--bg-tertiary)';
      badge.style.color = 'var(--text-secondary)';
    }
  }

  /**
   * Get or initialize the Firebase client dynamically.
   */
  function getClient() {
    if (firebaseApp) return firebaseApp;

    const enabled = localStorage.getItem('firebase_enabled') !== 'false';
    const apiKey = localStorage.getItem('firebase_api_key') || 'AIzaSyCQf96-MWKkE9xxZDNl2cClVYGmpF2zkNA';
    const authDomain = localStorage.getItem('firebase_auth_domain') || 'invoicetec-8fc9e.firebaseapp.com';
    const projectId = localStorage.getItem('firebase_project_id') || 'invoicetec-8fc9e';
    const storageBucket = localStorage.getItem('firebase_storage_bucket') || 'invoicetec-8fc9e.firebasestorage.app';
    const messagingSenderId = localStorage.getItem('firebase_messaging_sender_id') || '779812352421';
    const appId = localStorage.getItem('firebase_app_id') || '1:779812352421:web:a5ce5a6f494a2e8227384c';

    if (enabled && apiKey && authDomain && projectId && storageBucket && messagingSenderId && appId) {
      try {
        if (typeof firebase !== 'undefined') {
          if (firebase.apps.length > 0) {
            firebaseApp = firebase.app();
          } else {
            firebaseApp = firebase.initializeApp({
              apiKey: apiKey,
              authDomain: authDomain,
              projectId: projectId,
              storageBucket: storageBucket,
              messagingSenderId: messagingSenderId,
              appId: appId
            });
          }
          return firebaseApp;
        }
      } catch (err) {
        console.error('Failed to initialize Firebase client:', err);
      }
    }
    return null;
  }

  /**
   * Reset client instance (used when settings change).
   */
  function resetClient() {
    firebaseApp = null;
  }

  /**
   * Check if sync is enabled and properly configured.
   */
  function isEnabled() {
    return getClient() !== null;
  }

  /**
   * Merge local and remote tables to ensure no data loss.
   * Compares timestamps and unique business identifiers.
   */
  function mergeData(local, remote) {
    const merged = {
      invoices: [],
      invoiceItems: [],
      customers: [],
      companyProfile: null,
      products: []
    };

    const localInvoices = local.invoices || [];
    const remoteInvoices = remote.invoices || [];
    const localItems = local.invoiceItems || [];
    const remoteItems = remote.invoiceItems || [];
    const localCustomers = local.customers || [];
    const remoteCustomers = remote.customers || [];
    const localProducts = local.products || [];
    const remoteProducts = remote.products || [];

    // --- 1. Merge Company Profile ---
    const localComp = local.companyProfile;
    const remoteComp = remote.companyProfile;
    if (localComp && remoteComp) {
      const localTime = new Date(localComp.updatedAt || localComp.createdAt || 0).getTime();
      const remoteTime = new Date(remoteComp.updatedAt || remoteComp.createdAt || 0).getTime();
      merged.companyProfile = localTime >= remoteTime ? localComp : remoteComp;
    } else {
      merged.companyProfile = localComp || remoteComp;
    }

    // --- 2. Merge Invoices ---
    const allInvoiceNums = new Set([
      ...localInvoices.map(i => i.invoiceNumber),
      ...remoteInvoices.map(i => i.invoiceNumber)
    ]);

    allInvoiceNums.forEach(invoiceNum => {
      const localInv = localInvoices.find(i => i.invoiceNumber === invoiceNum);
      const remoteInv = remoteInvoices.find(i => i.invoiceNumber === invoiceNum);

      let selectedInv = null;
      if (localInv && remoteInv) {
        const localTime = new Date(localInv.updatedAt || localInv.createdAt || 0).getTime();
        const remoteTime = new Date(remoteInv.updatedAt || remoteInv.createdAt || 0).getTime();
        selectedInv = localTime >= remoteTime ? localInv : remoteInv;
      } else {
        selectedInv = localInv || remoteInv;
      }

      if (selectedInv) {
        // Map old items associated with this invoice
        const isRemoteSelected = (selectedInv === remoteInv);
        const sourceItems = isRemoteSelected ? remoteItems : localItems;
        const matchingItems = sourceItems.filter(item => item.invoiceId === selectedInv.id);

        merged.invoices.push(selectedInv);
        matchingItems.forEach(item => {
          merged.invoiceItems.push({
            ...item,
            invoiceId: selectedInv.id // preserve association
          });
        });
      }
    });

    // --- 3. Merge Customers ---
    const allCustomerEmails = new Set([
      ...localCustomers.map(c => c.email).filter(Boolean),
      ...remoteCustomers.map(c => c.email).filter(Boolean)
    ]);

    allCustomerEmails.forEach(email => {
      const localCust = localCustomers.find(c => c.email === email);
      const remoteCust = remoteCustomers.find(c => c.email === email);

      let selectedCust = null;
      if (localCust && remoteCust) {
        const localTime = new Date(localCust.updatedAt || localCust.createdAt || 0).getTime();
        const remoteTime = new Date(remoteCust.updatedAt || remoteCust.createdAt || 0).getTime();
        selectedCust = localTime >= remoteTime ? localCust : remoteCust;
      } else {
        selectedCust = localCust || remoteCust;
      }

      if (selectedCust) {
        merged.customers.push(selectedCust);
      }
    });

    // Handle customers who don't have emails (match by name)
    const localNoEmail = localCustomers.filter(c => !c.email);
    const remoteNoEmail = remoteCustomers.filter(c => !c.email);

    const allNoEmailNames = new Set([
      ...localNoEmail.map(c => c.name),
      ...remoteNoEmail.map(c => c.name)
    ]);

    allNoEmailNames.forEach(name => {
      const localCust = localNoEmail.find(c => c.name === name);
      const remoteCust = remoteNoEmail.find(c => c.name === name);

      let selectedCust = null;
      if (localCust && remoteCust) {
        const localTime = new Date(localCust.updatedAt || localCust.createdAt || 0).getTime();
        const remoteTime = new Date(remoteCust.updatedAt || remoteCust.createdAt || 0).getTime();
        selectedCust = localTime >= remoteTime ? localCust : remoteCust;
      } else {
        selectedCust = localCust || remoteCust;
      }

      if (selectedCust) {
        merged.customers.push(selectedCust);
      }
    });

    // --- 4. Merge Products ---
    const allProductNames = new Set([
      ...localProducts.map(p => p.name).filter(Boolean),
      ...remoteProducts.map(p => p.name).filter(Boolean)
    ]);

    allProductNames.forEach(name => {
      const localProd = localProducts.find(p => p.name === name);
      const remoteProd = remoteProducts.find(p => p.name === name);

      let selectedProd = null;
      if (localProd && remoteProd) {
        const localTime = new Date(localProd.updatedAt || localProd.createdAt || 0).getTime();
        const remoteTime = new Date(remoteProd.updatedAt || remoteProd.createdAt || 0).getTime();
        selectedProd = localTime >= remoteTime ? localProd : remoteProd;
      } else {
        selectedProd = localProd || remoteProd;
      }

      if (selectedProd) {
        merged.products.push(selectedProd);
      }
    });

    return merged;
  }

  /**
   * Read all data from IndexedDB for a given userId.
   */
  async function getLocalData(userId) {
    const invoices = await db.invoices.where('userId').equals(userId).toArray();
    const invoiceIds = invoices.map(i => i.id);
    const invoiceItems = await db.invoiceItems.where('invoiceId').anyOf(invoiceIds).toArray();
    const customers = await db.customers.where('userId').equals(userId).toArray();
    const companyProfile = await db.companyProfiles.where('userId').equals(userId).first();
    const products = await db.products.where('userId').equals(userId).toArray();

    return {
      invoices,
      invoiceItems,
      customers,
      companyProfile: companyProfile || null,
      products: products || []
    };
  }

  /**
   * Save merged dataset into local IndexedDB for a given userId in-place.
   */
  async function saveLocalData(userId, data) {
    await db.transaction('rw', db.invoices, db.invoiceItems, db.customers, db.companyProfiles, db.products, async () => {
      // 1. Save Company Profile
      if (data.companyProfile) {
        const existingProfile = await db.companyProfiles.where('userId').equals(userId).first();
        if (existingProfile) {
          const profileId = existingProfile.id;
          await db.companyProfiles.put({
            ...data.companyProfile,
            id: profileId,
            userId: userId
          });
        } else {
          const profileCopy = { ...data.companyProfile };
          delete profileCopy.id;
          profileCopy.userId = userId;
          await db.companyProfiles.add(profileCopy);
        }
      }

      // 2. Save Customers and build mapping from original IDs to local IDs
      const customerIdMap = new Map();
      const existingCustomers = await db.customers.where('userId').equals(userId).toArray();

      for (const cust of data.customers) {
        let matched = null;
        if (cust.email) {
          matched = existingCustomers.find(c => c.email === cust.email);
        } else {
          matched = existingCustomers.find(c => !c.email && c.name === cust.name);
        }

        let localCustId;
        if (matched) {
          localCustId = matched.id;
          await db.customers.put({
            ...cust,
            id: localCustId,
            userId: userId
          });
        } else {
          const custCopy = { ...cust };
          const originalId = custCopy.id;
          delete custCopy.id;
          custCopy.userId = userId;
          localCustId = await db.customers.add(custCopy);
        }

        if (cust.id) {
          customerIdMap.set(cust.id, localCustId);
        }
      }

      // 3. Save Invoices and map customer IDs
      const existingInvoices = await db.invoices.where('userId').equals(userId).toArray();

      for (const inv of data.invoices) {
        const matched = existingInvoices.find(i => i.invoiceNumber === inv.invoiceNumber);
        let invoiceId;

        const localCustomerId = inv.customerId ? (customerIdMap.get(inv.customerId) || null) : null;

        const invoiceDataToSave = {
          ...inv,
          userId: userId,
          customerId: localCustomerId,
          updatedAt: inv.updatedAt || inv.createdAt || new Date().toISOString()
        };

        if (matched) {
          invoiceId = matched.id;
          await db.invoices.put({
            ...invoiceDataToSave,
            id: invoiceId
          });
        } else {
          const invCopy = { ...invoiceDataToSave };
          delete invCopy.id;
          invoiceId = await db.invoices.add(invCopy);
        }

        // Delete old items for this invoiceId and re-add from snapshot
        await db.invoiceItems.where('invoiceId').equals(invoiceId).delete();

        const matchingItems = data.invoiceItems.filter(item => item.invoiceId === inv.id);
        for (const item of matchingItems) {
          const itemCopy = { ...item };
          delete itemCopy.id;
          itemCopy.invoiceId = invoiceId;
          await db.invoiceItems.add(itemCopy);
        }
      }

      // 4. Save Products
      const existingProducts = await db.products.where('userId').equals(userId).toArray();
      const productsToSave = data.products || [];

      for (const prod of productsToSave) {
        const matched = existingProducts.find(p => p.name === prod.name);
        
        const prodDataToSave = {
          userId: userId,
          name: prod.name,
          price: prod.price,
          description: prod.description || '',
          createdAt: prod.createdAt || new Date().toISOString(),
          updatedAt: prod.updatedAt || new Date().toISOString()
        };

        if (matched) {
          await db.products.put({
            ...prodDataToSave,
            id: matched.id
          });
        } else {
          await db.products.add(prodDataToSave);
        }
      }
    });
  }

  /**
   * Push current IndexedDB data to Firebase database.
   */
  async function push(localUserId) {
    const client = getClient();
    if (!client || !localUserId) return;

    try {
      updateSyncStatusBadge('Syncing');
      const user = await db.users.get(localUserId);
      if (!user || !user.supabaseId) {
        console.warn('Sync.push: User or firebase UID not found locally for userId:', localUserId);
        updateSyncStatusBadge('Disconnected');
        return;
      }
      const firebaseUid = user.supabaseId;

      const localData = await getLocalData(localUserId);
      const firestoreDb = client.firestore();
      
      await firestoreDb.collection('user_sync').doc(firebaseUid).set({
        data: localData,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.log('Database snapshot synchronized to cloud.');
      updateSyncStatusBadge('Connected');
    } catch (err) {
      console.error('Cloud synchronization failed:', err);
      updateSyncStatusBadge('Error');
    }
  }

  /**
   * Pull, merge, and overwrite local data with cloud data.
   */
  async function pull(localUserId) {
    const client = getClient();
    if (!client || !localUserId) return;

    try {
      updateSyncStatusBadge('Syncing');
      const user = await db.users.get(localUserId);
      if (!user || !user.supabaseId) {
        console.warn('Sync.pull: User or firebase UID not found locally for userId:', localUserId);
        updateSyncStatusBadge('Disconnected');
        return;
      }
      const firebaseUid = user.supabaseId;

      // 1. Fetch remote data
      const firestoreDb = client.firestore();
      const docRef = firestoreDb.collection('user_sync').doc(firebaseUid);
      const docSnap = await docRef.get();

      const remoteData = docSnap.exists ? docSnap.data().data : null;
      const localData = await getLocalData(localUserId);

      // If remote record exists, merge
      if (remoteData) {
        const merged = mergeData(localData, remoteData);
        await saveLocalData(localUserId, merged);
        await push(localUserId);
      } else {
        await push(localUserId);
      }
      updateSyncStatusBadge('Connected');
    } catch (err) {
      console.error('Cloud pull failed:', err);
      updateSyncStatusBadge('Error');
      throw err;
    }
  }

  return {
    getClient: getClient,
    resetClient: resetClient,
    isEnabled: isEnabled,
    push: push,
    pull: pull,
    updateSyncStatusBadge: updateSyncStatusBadge
  };

})();
