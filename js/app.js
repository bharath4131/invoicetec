/**
 * app.js — Main Application Controller
 * Ties together all modules: Auth, Router, UI, Invoices, Customers, Company, Dashboard, PDF
 */

(function () {
    'use strict';

    // ─── State ────────────────────────────────────────
    let currentEditInvoiceId = null;
    let selectedTemplate = 'classic';

    // ─── Initialize App ───────────────────────────────
    async function init() {
        // Initialize theme
        UI.initTheme();

        // Set up auth tab switching
        setupAuthTabs();

        // Set up auth forms
        setupLoginForm();
        setupRegisterForm();

        // Set up navigation
        setupNavigation();

        // Set up sidebar
        setupSidebar();

        // Set up global events
        setupGlobalEvents();

        // Initialize router
        Router.init();
    }

    // ─── Auth Tabs ────────────────────────────────────
    function setupAuthTabs() {
        const loginTab = document.getElementById('login-tab-btn');
        const registerTab = document.getElementById('register-tab-btn');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');

        loginTab.addEventListener('click', () => {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.style.display = '';
            registerForm.style.display = 'none';
        });

        registerTab.addEventListener('click', () => {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.style.display = '';
            loginForm.style.display = 'none';
        });
    }

    // ─── Login Form ───────────────────────────────────
    function setupLoginForm() {
        const form = document.getElementById('login-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const btn = document.getElementById('login-submit');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Signing in...';

            try {
                await Auth.login(email, password);
                UI.showToast('Welcome back!', 'success');
                form.reset();
                window.location.hash = '#/dashboard';
            } catch (err) {
                UI.showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span>Sign In</span><span>→</span>';
            }
        });
    }

    // ─── Register Form ────────────────────────────────
    function setupRegisterForm() {
        const form = document.getElementById('register-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('register-name').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-confirm').value;
            const btn = document.getElementById('register-submit');

            if (password !== confirm) {
                UI.showToast('Passwords do not match', 'error');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Creating account...';

            try {
                await Auth.register(name, email, password);
                UI.showToast('Account created successfully!', 'success');
                form.reset();
                window.location.hash = '#/dashboard';
            } catch (err) {
                UI.showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span>Create Account</span><span>→</span>';
            }
        });
    }

    // ─── Navigation ───────────────────────────────────
    function setupNavigation() {
        // Sidebar nav items
        document.querySelectorAll('.nav-item[data-route]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const route = item.getAttribute('data-route');
                window.location.hash = route;
                closeSidebar();
            });
        });

        // Header dropdown items
        document.getElementById('menu-settings').addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = '#/settings';
            closeDropdown();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
            window.location.hash = '#/login';
            UI.showToast('Signed out successfully', 'info');
            closeDropdown();
        });

        // Dashboard buttons
        document.getElementById('dashboard-new-invoice').addEventListener('click', () => {
            window.location.hash = '#/create';
        });

        // Invoices page buttons
        document.getElementById('invoices-new-btn').addEventListener('click', () => {
            window.location.hash = '#/create';
        });
        document.getElementById('invoices-empty-create')?.addEventListener('click', () => {
            window.location.hash = '#/create';
        });

        // Customers page buttons
        document.getElementById('customers-add-btn').addEventListener('click', () => {
            openCustomerModal();
        });
        document.getElementById('customers-empty-add')?.addEventListener('click', () => {
            openCustomerModal();
        });
    }

    // ─── Sidebar ──────────────────────────────────────
    function setupSidebar() {
        const hamburger = document.getElementById('hamburger-btn');
        const overlay = document.getElementById('sidebar-overlay');

        hamburger.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', closeSidebar);
    }

    function toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-overlay').classList.toggle('active');
    }

    function closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }

    // ─── Dropdown ─────────────────────────────────────
    function closeDropdown() {
        document.getElementById('user-dropdown').classList.remove('active');
    }

    // ─── Global Events ────────────────────────────────
    function setupGlobalEvents() {
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            UI.toggleTheme();
        });

        // User dropdown
        document.getElementById('user-menu-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('user-dropdown').classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#user-dropdown')) {
                closeDropdown();
            }
        });

        // Settings logout
        document.getElementById('settings-logout-btn')?.addEventListener('click', () => {
            Auth.logout();
            window.location.hash = '#/login';
            UI.showToast('Signed out', 'info');
        });

        // Invoice form events
        setupInvoiceForm();

        // Invoice search
        const searchInput = document.getElementById('invoice-search');
        if (searchInput) {
            searchInput.addEventListener('input', UI.debounce(async () => {
                await renderInvoicesList();
            }, 300));
        }

        // Invoice filters
        document.querySelectorAll('.filter-btn[data-status]').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await renderInvoicesList();
            });
        });

        // Customer search
        const custSearch = document.getElementById('customer-search');
        if (custSearch) {
            custSearch.addEventListener('input', UI.debounce(async () => {
                await renderCustomersList();
            }, 300));
        }

        // Customer modal
        setupCustomerModal();

        // Privacy Policy modal
        setupPrivacyModal();

        // Company form
        setupCompanyForm();

        // Data management
        setupDataManagement();

        // Preview page events
        setupPreviewPage();

        // Invoice form template selector
        setupTemplateSelector('inv-template-selector');
    }

    // ─── Invoice Form ─────────────────────────────────
    function setupInvoiceForm() {
        // Add item button
        document.getElementById('add-item-btn').addEventListener('click', () => {
            addInvoiceItem();
        });

        // Save draft
        document.getElementById('invoice-save-draft-btn').addEventListener('click', async () => {
            await saveInvoice('draft');
        });

        // Save and send
        document.getElementById('invoice-save-btn').addEventListener('click', async () => {
            await saveInvoice('pending');
        });

        // Cancel
        document.getElementById('invoice-cancel-btn').addEventListener('click', () => {
            window.location.hash = '#/invoices';
        });

        // Currency change
        document.getElementById('inv-currency').addEventListener('change', () => {
            updateFormCurrencyLabels();
            recalculateTotals();
        });

        // Tax & discount recalculation
        document.getElementById('inv-tax-rate').addEventListener('input', recalculateTotals);
        document.getElementById('inv-discount-value').addEventListener('input', recalculateTotals);
        document.getElementById('inv-discount-type').addEventListener('change', recalculateTotals);

        // Customer selection
        document.getElementById('inv-customer').addEventListener('change', async () => {
            const custId = parseInt(document.getElementById('inv-customer').value);
            const preview = document.getElementById('inv-customer-preview');
            const details = document.getElementById('inv-customer-details');
            if (custId) {
                try {
                    const cust = await Customers.get(custId);
                    if (cust) {
                        details.innerHTML = `
                            <strong>${UI.escapeHtml(cust.name)}</strong><br>
                            ${cust.email ? UI.escapeHtml(cust.email) + '<br>' : ''}
                            ${cust.phone ? UI.escapeHtml(cust.phone) + '<br>' : ''}
                            ${cust.address ? UI.escapeHtml(cust.address) + '<br>' : ''}
                            ${cust.city ? UI.escapeHtml(cust.city) + ', ' : ''}${cust.state ? UI.escapeHtml(cust.state) + ' ' : ''}${cust.zip || ''}
                        `;
                        preview.style.display = 'block';
                    }
                } catch (e) {
                    preview.style.display = 'none';
                }
            } else {
                preview.style.display = 'none';
            }
        });

        // Add customer from invoice form
        document.getElementById('inv-add-customer-btn').addEventListener('click', () => {
            openCustomerModal(null, true);
        });

        // Prevent form submission on Enter
        document.getElementById('invoice-form').addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }

    function updateFormCurrencyLabels() {
        const currencyCode = document.getElementById('inv-currency').value;
        const symbol = UI.getCurrencySymbol(currencyCode);
        document.getElementById('th-unit-price').textContent = `Unit Price (${symbol})`;
        document.getElementById('th-amount').textContent = `Amount (${symbol})`;
    }

    function addInvoiceItem(item = null) {
        const currencyCode = document.getElementById('inv-currency').value;
        const tbody = document.getElementById('items-table-body');
        const row = document.createElement('tr');
        row.className = 'item-row animate-fadeIn';
        row.innerHTML = `
            <td><input type="text" class="form-input item-desc" placeholder="Item description" value="${item ? UI.escapeHtml(item.description) : ''}" required></td>
            <td><input type="number" class="form-input item-qty mono" value="${item ? item.quantity : 1}" min="1" step="1"></td>
            <td><input type="number" class="form-input item-rate mono" value="${item ? item.rate : 0}" min="0" step="0.01" placeholder="0.00"></td>
            <td><span class="item-amount mono">${item ? UI.formatCurrency(item.amount, currencyCode) : UI.formatCurrency(0, currencyCode)}</span></td>
            <td><button type="button" class="btn btn-icon remove-item-btn" title="Remove item">✕</button></td>
        `;

        // Events
        const qtyInput = row.querySelector('.item-qty');
        const rateInput = row.querySelector('.item-rate');
        const amountSpan = row.querySelector('.item-amount');
        const removeBtn = row.querySelector('.remove-item-btn');

        const updateAmount = () => {
            const currentCurrency = document.getElementById('inv-currency').value;
            const qty = parseFloat(qtyInput.value) || 0;
            const rate = parseFloat(rateInput.value) || 0;
            amountSpan.textContent = UI.formatCurrency(qty * rate, currentCurrency);
            recalculateTotals();
        };

        qtyInput.addEventListener('input', updateAmount);
        rateInput.addEventListener('input', updateAmount);
        removeBtn.addEventListener('click', () => {
            row.remove();
            recalculateTotals();
        });

        tbody.appendChild(row);
    }

    function recalculateTotals() {
        const currencyCode = document.getElementById('inv-currency').value;
        const rows = document.querySelectorAll('.item-row');
        let subtotal = 0;

        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
            const itemAmt = qty * rate;
            subtotal += itemAmt;
            row.querySelector('.item-amount').textContent = UI.formatCurrency(itemAmt, currencyCode);
        });

        const taxRate = parseFloat(document.getElementById('inv-tax-rate').value) || 0;
        const discountType = document.getElementById('inv-discount-type').value;
        const discountValue = parseFloat(document.getElementById('inv-discount-value').value) || 0;

        const taxAmount = subtotal * (taxRate / 100);
        let discountAmount = 0;
        if (discountType === 'percentage') {
            discountAmount = subtotal * (discountValue / 100);
        } else {
            discountAmount = discountValue;
        }

        const total = subtotal + taxAmount - discountAmount;

        document.getElementById('inv-subtotal').textContent = UI.formatCurrency(subtotal, currencyCode);
        document.getElementById('inv-tax-amount').textContent = UI.formatCurrency(taxAmount, currencyCode);
        document.getElementById('inv-discount-amount').textContent = '-' + UI.formatCurrency(discountAmount, currencyCode);
        document.getElementById('inv-total').textContent = UI.formatCurrency(total, currencyCode);
    }

    async function saveInvoice(btnType) {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const customerId = parseInt(document.getElementById('inv-customer').value);
        if (!customerId) {
            UI.showToast('Please select a customer', 'error');
            return;
        }

        const rows = document.querySelectorAll('.item-row');
        if (rows.length === 0) {
            UI.showToast('Please add at least one item', 'error');
            return;
        }

        // Collect items
        const items = [];
        let valid = true;
        rows.forEach(row => {
            const desc = row.querySelector('.item-desc').value.trim();
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
            if (!desc) { valid = false; }
            items.push({
                description: desc,
                quantity: qty,
                rate: rate,
                amount: qty * rate
            });
        });

        if (!valid) {
            UI.showToast('Please fill in all item descriptions', 'error');
            return;
        }

        // Calculate totals
        const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
        const taxRate = parseFloat(document.getElementById('inv-tax-rate').value) || 0;
        const discountType = document.getElementById('inv-discount-type').value;
        const discountValue = parseFloat(document.getElementById('inv-discount-value').value) || 0;
        const taxAmount = subtotal * (taxRate / 100);
        let discountAmount = discountType === 'percentage' ? subtotal * (discountValue / 100) : discountValue;
        const total = subtotal + taxAmount - discountAmount;

        // Get selected template
        const activeTemplate = document.querySelector('#inv-template-selector .template-option.active');
        const template = activeTemplate ? activeTemplate.getAttribute('data-template') : 'classic';

        // Determine status
        let status = document.getElementById('inv-status').value;
        console.log('[DEBUG] saveInvoice - btnType:', btnType);
        console.log('[DEBUG] saveInvoice - initial dropdown status:', status);
        console.log('[DEBUG] saveInvoice - currentEditInvoiceId:', currentEditInvoiceId);

        if (btnType === 'pending' && status === 'draft') {
            status = 'pending';
        }
        console.log('[DEBUG] saveInvoice - final computed status to save:', status);

        const invoiceData = {
            userId: user.id,
            customerId: customerId,
            invoiceNumber: document.getElementById('inv-number').value,
            date: document.getElementById('inv-date').value,
            dueDate: document.getElementById('inv-due-date').value,
            status: status,
            currency: document.getElementById('inv-currency').value,
            subtotal,
            taxRate,
            taxAmount,
            discountType,
            discountValue,
            discountAmount,
            total,
            notes: document.getElementById('inv-notes').value.trim(),
            template
        };

        try {
            console.log('[DEBUG] saveInvoice - invoiceData to save:', invoiceData);
            if (currentEditInvoiceId) {
                await Invoices.update(currentEditInvoiceId, invoiceData, items);
                console.log('[DEBUG] saveInvoice - Invoices.update completed successfully');
                UI.showToast('Invoice updated!', 'success');
            } else {
                const newId = await Invoices.create(invoiceData, items);
                console.log('[DEBUG] saveInvoice - Invoices.create completed successfully. New ID:', newId);
                UI.showToast('Invoice created!', 'success');
                currentEditInvoiceId = newId;
            }
            window.location.hash = '#/invoices';
        } catch (err) {
            UI.showToast('Error saving invoice: ' + err.message, 'error');
        }
    }

    // ─── Customer Modal ───────────────────────────────
    let customerModalCallback = null;

    function setupCustomerModal() {
        const overlay = document.getElementById('customer-modal-overlay');
        const closeBtn = document.getElementById('customer-modal-close');
        const cancelBtn = document.getElementById('customer-modal-cancel');
        const form = document.getElementById('customer-modal-form');

        closeBtn.addEventListener('click', closeCustomerModal);
        cancelBtn.addEventListener('click', closeCustomerModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeCustomerModal();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = Auth.getCurrentUser();
            if (!user) return;

            const id = document.getElementById('customer-modal-id').value;
            const data = {
                userId: user.id,
                name: document.getElementById('cust-name').value.trim(),
                email: document.getElementById('cust-email').value.trim(),
                phone: document.getElementById('cust-phone').value.trim(),
                address: document.getElementById('cust-address').value.trim(),
                city: document.getElementById('cust-city').value.trim(),
                state: document.getElementById('cust-state').value.trim(),
                zip: document.getElementById('cust-zip').value.trim(),
                country: document.getElementById('cust-country').value.trim()
            };

            try {
                if (id) {
                    await Customers.update(parseInt(id), data);
                    UI.showToast('Customer updated!', 'success');
                } else {
                    const newId = await Customers.add(data);
                    UI.showToast('Customer added!', 'success');
                    if (customerModalCallback) {
                        customerModalCallback(newId);
                    }
                }
                closeCustomerModal();
                // Refresh current page
                const hash = window.location.hash;
                if (hash.startsWith('#/customers')) {
                    await renderCustomersList();
                }
                // Also refresh customer dropdown if on invoice page
                await populateCustomerDropdown();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }

    function openCustomerModal(customer = null, fromInvoice = false) {
        const overlay = document.getElementById('customer-modal-overlay');
        const title = document.getElementById('customer-modal-title');
        const form = document.getElementById('customer-modal-form');

        form.reset();
        document.getElementById('customer-modal-id').value = '';

        if (customer) {
            title.textContent = 'Edit Customer';
            document.getElementById('customer-modal-id').value = customer.id;
            document.getElementById('cust-name').value = customer.name || '';
            document.getElementById('cust-email').value = customer.email || '';
            document.getElementById('cust-phone').value = customer.phone || '';
            document.getElementById('cust-address').value = customer.address || '';
            document.getElementById('cust-city').value = customer.city || '';
            document.getElementById('cust-state').value = customer.state || '';
            document.getElementById('cust-zip').value = customer.zip || '';
            document.getElementById('cust-country').value = customer.country || '';
        } else {
            title.textContent = 'Add Customer';
        }

        if (fromInvoice) {
            customerModalCallback = async (newId) => {
                await populateCustomerDropdown();
                document.getElementById('inv-customer').value = newId;
                document.getElementById('inv-customer').dispatchEvent(new Event('change'));
            };
        } else {
            customerModalCallback = null;
        }

        overlay.classList.add('active');
    }

    function closeCustomerModal() {
        document.getElementById('customer-modal-overlay').classList.remove('active');
        customerModalCallback = null;
    }

    // ─── Privacy Modal ────────────────────────────────
    function setupPrivacyModal() {
        const overlay = document.getElementById('privacy-modal-overlay');
        const closeBtn = document.getElementById('privacy-modal-close');
        const okBtn = document.getElementById('privacy-modal-ok');
        const authLink = document.getElementById('auth-privacy-link');
        const sidebarLink = document.getElementById('sidebar-privacy-link');
        const settingsBtn = document.getElementById('settings-privacy-btn');

        if (closeBtn) closeBtn.addEventListener('click', closePrivacyModal);
        if (okBtn) okBtn.addEventListener('click', closePrivacyModal);
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closePrivacyModal();
            });
        }

        if (authLink) {
            authLink.addEventListener('click', (e) => {
                e.preventDefault();
                openPrivacyModal();
            });
        }
        if (sidebarLink) {
            sidebarLink.addEventListener('click', (e) => {
                e.preventDefault();
                openPrivacyModal();
            });
        }
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openPrivacyModal();
            });
        }
    }

    function openPrivacyModal() {
        const overlay = document.getElementById('privacy-modal-overlay');
        if (overlay) overlay.classList.add('active');
    }

    function closePrivacyModal() {
        const overlay = document.getElementById('privacy-modal-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    // ─── Company Form ─────────────────────────────────
    function setupCompanyForm() {
        const form = document.getElementById('company-form');
        const logoUpload = document.getElementById('logo-upload');
        const logoInput = document.getElementById('company-logo-input');
        const logoPreview = document.getElementById('company-logo-preview');
        const logoPlaceholder = document.getElementById('logo-upload-placeholder');

        logoUpload.addEventListener('click', () => logoInput.click());

        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                UI.showToast('Logo must be under 2MB', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                logoPreview.src = ev.target.result;
                logoPreview.style.display = 'block';
                logoPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = Auth.getCurrentUser();
            if (!user) return;

            const data = {
                companyName: document.getElementById('company-name').value.trim(),
                email: document.getElementById('company-email').value.trim(),
                phone: document.getElementById('company-phone').value.trim(),
                website: document.getElementById('company-website').value.trim(),
                address: document.getElementById('company-address').value.trim(),
                city: document.getElementById('company-city').value.trim(),
                state: document.getElementById('company-state').value.trim(),
                zip: document.getElementById('company-zip').value.trim(),
                country: document.getElementById('company-country').value.trim(),
                taxId: document.getElementById('company-tax-id').value.trim(),
                logo: logoPreview.src && logoPreview.style.display !== 'none' ? logoPreview.src : null
            };

            try {
                await Company.save(user.id, data);
                UI.showToast('Company profile saved!', 'success');
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }

    // ─── Data Management ──────────────────────────────
    function setupDataManagement() {
        // Export
        document.getElementById('export-data-btn').addEventListener('click', async () => {
            try {
                const user = Auth.getCurrentUser();
                if (!user) return;

                const invoices = await Invoices.getAll(user.id);
                const customers = await Customers.getAll(user.id);
                const company = await Company.get(user.id);

                // Get items for each invoice
                const fullInvoices = [];
                for (const inv of invoices) {
                    const full = await Invoices.get(inv.id);
                    fullInvoices.push(full);
                }

                const exportData = {
                    exportDate: new Date().toISOString(),
                    version: '1.0',
                    invoices: fullInvoices,
                    customers,
                    company
                };

                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invoiceflow-export-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                UI.showToast('Data exported successfully!', 'success');
            } catch (err) {
                UI.showToast('Export failed: ' + err.message, 'error');
            }
        });

        // Import
        document.getElementById('import-data-btn').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });

        document.getElementById('import-file-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const user = Auth.getCurrentUser();
                if (!user) return;

                // Import customers
                if (data.customers && Array.isArray(data.customers)) {
                    for (const cust of data.customers) {
                        delete cust.id;
                        cust.userId = user.id;
                        await Customers.add(cust);
                    }
                }

                // Import company
                if (data.company) {
                    await Company.save(user.id, data.company);
                }

                // Import invoices
                if (data.invoices && Array.isArray(data.invoices)) {
                    for (const inv of data.invoices) {
                        const items = inv.items || [];
                        delete inv.id;
                        delete inv.items;
                        delete inv.customer;
                        inv.userId = user.id;
                        items.forEach(i => delete i.id);
                        await Invoices.create(inv, items);
                    }
                }

                UI.showToast('Data imported successfully!', 'success');
                // Refresh current page
                Router.navigate(window.location.hash);
            } catch (err) {
                UI.showToast('Import failed: ' + err.message, 'error');
            }

            e.target.value = '';
        });

        // Clear all data
        document.getElementById('clear-data-btn').addEventListener('click', () => {
            UI.confirmDialog('Are you sure you want to delete ALL data? This cannot be undone.', async () => {
                try {
                    const user = Auth.getCurrentUser();
                    if (!user) return;

                    // Delete user's invoices and items
                    const invoices = await Invoices.getAll(user.id);
                    for (const inv of invoices) {
                        await Invoices.delete(inv.id);
                    }

                    // Delete customers
                    const customers = await Customers.getAll(user.id);
                    for (const cust of customers) {
                        try { await Customers.delete(cust.id); } catch (e) { /* skip if has invoices */ }
                    }

                    UI.showToast('All data cleared', 'info');
                    Router.navigate(window.location.hash);
                } catch (err) {
                    UI.showToast('Error: ' + err.message, 'error');
                }
            });
        });
    }

    // ─── Preview Page ─────────────────────────────────
    function setupPreviewPage() {
        document.getElementById('preview-back-btn').addEventListener('click', () => {
            window.location.hash = '#/invoices';
        });

        document.getElementById('preview-edit-btn').addEventListener('click', () => {
            const id = Router.getParam('id');
            if (id) window.location.hash = `#/edit/${id}`;
        });

        document.getElementById('preview-duplicate-btn').addEventListener('click', async () => {
            const id = Router.getParam('id');
            if (!id) return;
            try {
                const newId = await Invoices.duplicate(parseInt(id));
                UI.showToast('Invoice duplicated!', 'success');
                window.location.hash = `#/edit/${newId}`;
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });

        document.getElementById('preview-download-btn').addEventListener('click', async () => {
            const id = Router.getParam('id');
            if (!id) return;
            try {
                const invoice = await Invoices.get(parseInt(id));
                const user = Auth.getCurrentUser();
                const company = await Company.get(user.id);
                const activeTemplate = document.querySelector('#preview-template-selector .template-option.active');
                const template = activeTemplate ? activeTemplate.getAttribute('data-template') : 'classic';
                PDF.download(invoice, company, template);
                UI.showToast('PDF downloading...', 'success');
            } catch (err) {
                UI.showToast('PDF generation failed: ' + err.message, 'error');
            }
        });

        document.getElementById('preview-email-btn').addEventListener('click', async () => {
            await shareInvoice('email');
        });

        document.getElementById('preview-whatsapp-btn').addEventListener('click', async () => {
            await shareInvoice('whatsapp');
        });

        document.getElementById('preview-share-btn').addEventListener('click', async () => {
            await shareInvoice('share');
        });

        // Template selector for preview
        setupTemplateSelector('preview-template-selector', async (template) => {
            await renderPreview();
        });
    }

    async function shareInvoice(method) {
        const id = Router.getParam('id');
        if (!id) return;

        try {
            const invoice = await Invoices.get(parseInt(id));
            if (!invoice) {
                UI.showToast('Invoice not found', 'error');
                return;
            }

            const user = Auth.getCurrentUser();
            const company = await Company.get(user.id);
            const customer = invoice.customer || {};
            const companyName = company ? company.companyName || 'our company' : 'our company';
            const formattedTotal = UI.formatCurrency(invoice.total, invoice.currency);
            
            const subject = `Invoice ${invoice.invoiceNumber} from ${companyName}`;

            function openComposer(downloadUrl) {
                var linkText = downloadUrl ? `\n\nDownload PDF: ${downloadUrl}` : '';
                var linkTextWA = downloadUrl ? `\n\n*Download PDF:* ${downloadUrl}` : '';

                if (method === 'email') {
                    var emailBody = `Hello ${customer.name || 'there'},\n\nHere is Invoice ${invoice.invoiceNumber} from ${companyName}.\n\nTotal Due: ${formattedTotal}\nDue Date: ${UI.formatDate(invoice.dueDate)}${linkText}\n\nThank you for your business!\n\nBest regards,\n${companyName}`;
                    var gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(customer.email || '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
                    window.open(gmailUrl, '_blank');
                } else if (method === 'whatsapp') {
                    var cleanPhone = (customer.phone || '').replace(/[^\d+]/g, '');
                    var waText = `Hello *${customer.name || 'there'}*,\n\nHere is *Invoice ${invoice.invoiceNumber}* from *${companyName}*.\n\n*Total Due:* ${formattedTotal}\n*Due Date:* ${UI.formatDate(invoice.dueDate)}${linkTextWA}\n\nThank you for your business!`;
                    var waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`;
                    window.open(waUrl, '_blank');
                }
            }

            if (method === 'share') {
                if (navigator.share && navigator.canShare) {
                    const activeTemplate = document.querySelector('#preview-template-selector .template-option.active');
                    const template = activeTemplate ? activeTemplate.getAttribute('data-template') : invoice.template || 'classic';
                    const docDef = PDF.generateDocDefinition(invoice, company, template);
                    
                    UI.showToast('Preparing PDF for sharing...', 'info');
                    pdfMake.createPdf(docDef).getBlob(async function (blob) {
                        try {
                            const filename = `Invoice_${invoice.invoiceNumber || 'invoice'}.pdf`;
                            const file = new File([blob], filename, { type: 'application/pdf' });
                            
                            if (navigator.canShare({ files: [file] })) {
                                var bodyText = `Hello ${customer.name || 'there'},\n\nHere is Invoice ${invoice.invoiceNumber} from ${companyName}.\n\nTotal Due: ${formattedTotal}\nDue Date: ${UI.formatDate(invoice.dueDate)}\n\nThank you for your business!\n\nBest regards,\n${companyName}`;
                                await navigator.share({
                                    files: [file],
                                    title: subject,
                                    text: bodyText
                                });
                                UI.showToast('Shared successfully!', 'success');
                            } else {
                                throw new Error('File sharing is not supported by your browser/device.');
                            }
                        } catch (shareErr) {
                            if (shareErr.name !== 'AbortError') {
                                UI.showToast('Sharing failed: ' + shareErr.message, 'error');
                            }
                        }
                    });
                } else {
                    UI.showToast('Web Share is not supported in this browser. Please download the PDF and share it manually.', 'warning');
                }
            } else {
                // Email or WhatsApp: Generate temporary download link
                const activeTemplate = document.querySelector('#preview-template-selector .template-option.active');
                const template = activeTemplate ? activeTemplate.getAttribute('data-template') : invoice.template || 'classic';
                const docDef = PDF.generateDocDefinition(invoice, company, template);

                UI.showToast('Generating secure PDF download link...', 'info');
                
                pdfMake.createPdf(docDef).getBlob(function (blob) {
                    var formData = new FormData();
                    formData.append('file', blob, `Invoice_${invoice.invoiceNumber || 'invoice'}.pdf`);

                    fetch('https://tmpfiles.org/api/v1/upload', {
                        method: 'POST',
                        body: formData
                    })
                    .then(res => {
                        if (!res.ok) throw new Error('Upload server returned error');
                        return res.json();
                    })
                    .then(data => {
                        if (data.status === 'success' && data.data && data.data.url) {
                            var viewUrl = data.data.url;
                            var downloadUrl = viewUrl.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
                            UI.showToast('Link generated successfully!', 'success');
                            openComposer(downloadUrl);
                        } else {
                            throw new Error('Invalid server response');
                        }
                    })
                    .catch(uploadErr => {
                        console.warn('PDF upload failed, falling back to text-only message:', uploadErr);
                        UI.showToast('Could not generate PDF link. Opening message without link.', 'warning');
                        openComposer(null);
                    });
                });
            }
        } catch (err) {
            UI.showToast('Failed to share: ' + err.message, 'error');
        }
    }

    function setupTemplateSelector(containerId, onChange) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.querySelectorAll('.template-option').forEach(opt => {
            opt.addEventListener('click', () => {
                container.querySelectorAll('.template-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                if (onChange) onChange(opt.getAttribute('data-template'));
            });
        });
    }

    // ═══════════════════════════════════════════════════
    // PAGE RENDERERS (called by Router)
    // ═══════════════════════════════════════════════════

    // ─── Show App Shell ───────────────────────────────
    window.showAppShell = function () {
        const user = Auth.getCurrentUser();
        if (!user) return;

        document.getElementById('auth-page').style.display = 'none';
        document.getElementById('app-shell').style.display = '';

        // Update user info in sidebar and header
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        document.getElementById('user-avatar').textContent = initials;
        document.getElementById('header-avatar').textContent = initials;
        document.getElementById('sidebar-user-name').textContent = user.name;
        document.getElementById('sidebar-user-email').textContent = user.email;
        document.getElementById('header-user-name').textContent = user.name;
    };

    window.showAuthPage = function () {
        document.getElementById('auth-page').style.display = '';
        document.getElementById('app-shell').style.display = 'none';
    };

    // ─── Dashboard ────────────────────────────────────
    window.showDashboard = async function () {
        showAppShell();
        document.getElementById('header-title').textContent = 'Dashboard';
        await Dashboard.render();
    };

    // ─── Invoices List ────────────────────────────────
    window.showInvoices = async function () {
        showAppShell();
        document.getElementById('header-title').textContent = 'Invoices';
        // Reset search and filter
        document.getElementById('invoice-search').value = '';
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-status="all"]').classList.add('active');
        await renderInvoicesList();
    };

    async function renderInvoicesList() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const query = document.getElementById('invoice-search').value.trim();
        const activeFilter = document.querySelector('.filter-btn.active');
        const status = activeFilter ? activeFilter.getAttribute('data-status') : 'all';

        let invoices;
        if (query) {
            invoices = await Invoices.search(user.id, query);
        } else if (status && status !== 'all') {
            invoices = await Invoices.filterByStatus(user.id, status);
        } else {
            invoices = await Invoices.getAll(user.id);
        }

        const tbody = document.getElementById('invoices-table-body');
        const emptyState = document.getElementById('invoices-empty');
        const table = document.getElementById('invoices-table');

        if (invoices.length === 0) {
            table.style.display = 'none';
            emptyState.style.display = '';
        } else {
            table.style.display = '';
            emptyState.style.display = 'none';

            tbody.innerHTML = invoices.map((inv, i) => `
                <tr class="invoice-row animate-fadeIn delay-${Math.min(i + 1, 5)}" data-id="${inv.id}">
                    <td class="invoice-number mono">${UI.escapeHtml(inv.invoiceNumber)}</td>
                    <td>${UI.escapeHtml(inv.customerName || 'Unknown')}</td>
                    <td>${UI.formatDate(inv.date)}</td>
                    <td>${UI.formatDate(inv.dueDate)}</td>
                    <td class="invoice-amount mono">${UI.formatCurrency(inv.total, inv.currency)}</td>
                    <td>${UI.getStatusBadge(inv.status)}</td>
                    <td class="invoice-actions">
                        <button class="btn btn-ghost btn-sm inv-view-btn" data-id="${inv.id}" title="View">👁️</button>
                        <button class="btn btn-ghost btn-sm inv-edit-btn" data-id="${inv.id}" title="Edit">✏️</button>
                        <button class="btn btn-ghost btn-sm inv-dup-btn" data-id="${inv.id}" title="Duplicate">📋</button>
                        <button class="btn btn-ghost btn-sm inv-del-btn" data-id="${inv.id}" title="Delete">🗑️</button>
                    </td>
                </tr>
            `).join('');

            // Attach row events
            tbody.querySelectorAll('.inv-view-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.location.hash = `#/preview/${btn.dataset.id}`;
                });
            });
            tbody.querySelectorAll('.inv-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.location.hash = `#/edit/${btn.dataset.id}`;
                });
            });
            tbody.querySelectorAll('.inv-dup-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        const newId = await Invoices.duplicate(parseInt(btn.dataset.id));
                        UI.showToast('Invoice duplicated!', 'success');
                        await renderInvoicesList();
                    } catch (err) {
                        UI.showToast(err.message, 'error');
                    }
                });
            });
            tbody.querySelectorAll('.inv-del-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    UI.confirmDialog('Delete this invoice? This cannot be undone.', async () => {
                        try {
                            await Invoices.delete(parseInt(btn.dataset.id));
                            UI.showToast('Invoice deleted', 'info');
                            await renderInvoicesList();
                        } catch (err) {
                            UI.showToast(err.message, 'error');
                        }
                    });
                });
            });

            // Click row to preview
            tbody.querySelectorAll('.invoice-row').forEach(row => {
                row.addEventListener('click', () => {
                    window.location.hash = `#/preview/${row.dataset.id}`;
                });
            });
        }
    }

    // ─── Create Invoice ───────────────────────────────
    window.showCreateInvoice = async function () {
        showAppShell();
        document.getElementById('header-title').textContent = 'New Invoice';
        document.getElementById('invoice-form-title').textContent = 'New Invoice';
        document.getElementById('invoice-form-subtitle').textContent = 'Fill in the details below';
        currentEditInvoiceId = null;

        // Reset form
        document.getElementById('invoice-form').reset();
        document.getElementById('items-table-body').innerHTML = '';
        document.getElementById('inv-customer-preview').style.display = 'none';

        // Set defaults
        const user = Auth.getCurrentUser();
        const nextNum = await Invoices.getNextInvoiceNumber(user.id);
        document.getElementById('inv-number').value = nextNum;
        document.getElementById('inv-date').value = UI.formatDateInput(new Date().toISOString());

        // Default due date: 30 days from now
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        document.getElementById('inv-due-date').value = UI.formatDateInput(dueDate.toISOString());

        document.getElementById('inv-status').value = 'draft';
        document.getElementById('inv-tax-rate').value = '0';
        document.getElementById('inv-discount-value').value = '0';
        document.getElementById('inv-discount-type').value = 'percentage';

        const company = await Company.get(user.id);
        const defaultCurrency = company ? company.defaultCurrency || 'USD' : 'USD';
        document.getElementById('inv-currency').value = defaultCurrency;
        updateFormCurrencyLabels();

        // Reset template selector
        document.querySelectorAll('#inv-template-selector .template-option').forEach(o => o.classList.remove('active'));
        document.querySelector('#inv-template-selector .template-option[data-template="classic"]').classList.add('active');

        // Add one empty item row
        addInvoiceItem();

        // Populate customer dropdown
        await populateCustomerDropdown();

        recalculateTotals();
    };

    // ─── Edit Invoice ─────────────────────────────────
    window.showEditInvoice = async function () {
        showAppShell();
        const id = Router.getParam('id');
        if (!id) { window.location.hash = '#/invoices'; return; }

        document.getElementById('header-title').textContent = 'Edit Invoice';
        document.getElementById('invoice-form-title').textContent = 'Edit Invoice';
        currentEditInvoiceId = parseInt(id);

        try {
            const invoice = await Invoices.get(currentEditInvoiceId);
            if (!invoice) {
                UI.showToast('Invoice not found', 'error');
                window.location.hash = '#/invoices';
                return;
            }

            document.getElementById('invoice-form-subtitle').textContent = invoice.invoiceNumber;

            // Populate fields
            document.getElementById('inv-number').value = invoice.invoiceNumber;
            document.getElementById('inv-date').value = UI.formatDateInput(invoice.date);
            document.getElementById('inv-due-date').value = UI.formatDateInput(invoice.dueDate);
            document.getElementById('inv-status').value = invoice.status;
            document.getElementById('inv-currency').value = invoice.currency || 'USD';
            updateFormCurrencyLabels();
            document.getElementById('inv-tax-rate').value = invoice.taxRate || 0;
            document.getElementById('inv-discount-type').value = invoice.discountType || 'percentage';
            document.getElementById('inv-discount-value').value = invoice.discountValue || 0;
            document.getElementById('inv-notes').value = invoice.notes || '';

            // Populate customer dropdown and select
            await populateCustomerDropdown();
            document.getElementById('inv-customer').value = invoice.customerId;
            document.getElementById('inv-customer').dispatchEvent(new Event('change'));

            // Set template
            const template = invoice.template || 'classic';
            document.querySelectorAll('#inv-template-selector .template-option').forEach(o => o.classList.remove('active'));
            const tmplOption = document.querySelector(`#inv-template-selector .template-option[data-template="${template}"]`);
            if (tmplOption) tmplOption.classList.add('active');

            // Populate items
            document.getElementById('items-table-body').innerHTML = '';
            if (invoice.items && invoice.items.length > 0) {
                invoice.items.forEach(item => addInvoiceItem(item));
            } else {
                addInvoiceItem();
            }

            recalculateTotals();
        } catch (err) {
            UI.showToast('Error loading invoice: ' + err.message, 'error');
            window.location.hash = '#/invoices';
        }
    };

    // ─── Preview Invoice ──────────────────────────────
    window.showPreviewInvoice = async function () {
        showAppShell();
        document.getElementById('header-title').textContent = 'Invoice Preview';
        await renderPreview();
    };

    async function renderPreview() {
        const id = Router.getParam('id');
        if (!id) { window.location.hash = '#/invoices'; return; }

        try {
            const invoice = await Invoices.get(parseInt(id));
            if (!invoice) {
                UI.showToast('Invoice not found', 'error');
                window.location.hash = '#/invoices';
                return;
            }

            document.getElementById('preview-invoice-number').textContent = invoice.invoiceNumber;

            const user = Auth.getCurrentUser();
            const company = await Company.get(user.id);

            const activeTemplate = document.querySelector('#preview-template-selector .template-option.active');
            const template = activeTemplate ? activeTemplate.getAttribute('data-template') : invoice.template || 'classic';

            // Set active template in selector
            document.querySelectorAll('#preview-template-selector .template-option').forEach(o => o.classList.remove('active'));
            const tmplOption = document.querySelector(`#preview-template-selector .template-option[data-template="${template}"]`);
            if (tmplOption) tmplOption.classList.add('active');

            PDF.preview(invoice, company, template);
        } catch (err) {
            UI.showToast('Error loading preview: ' + err.message, 'error');
        }
    }

    // ─── Customers ────────────────────────────────────
    window.showCustomers = async function () {
        showAppShell();
        document.getElementById('header-title').textContent = 'Customers';
        document.getElementById('customer-search').value = '';
        await renderCustomersList();
    };

    async function renderCustomersList() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const query = document.getElementById('customer-search').value.trim();
        let customers;
        if (query) {
            customers = await Customers.search(user.id, query);
        } else {
            customers = await Customers.getAll(user.id);
        }

        const grid = document.getElementById('customers-grid');
        const emptyState = document.getElementById('customers-empty');

        if (customers.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = '';
        } else {
            grid.style.display = '';
            emptyState.style.display = 'none';

            grid.innerHTML = customers.map((cust, i) => `
                <div class="card card-hover customer-card animate-fadeIn delay-${Math.min(i + 1, 5)}" data-id="${cust.id}">
                    <div class="customer-card-header">
                        <div class="avatar">${(cust.name || 'U').charAt(0).toUpperCase()}</div>
                        <div>
                            <h4 class="customer-card-name">${UI.escapeHtml(cust.name)}</h4>
                            <p class="customer-card-email">${UI.escapeHtml(cust.email || 'No email')}</p>
                        </div>
                    </div>
                    <div class="customer-card-body">
                        ${cust.phone ? `<p>📞 ${UI.escapeHtml(cust.phone)}</p>` : ''}
                        ${cust.address ? `<p>📍 ${UI.escapeHtml(cust.address)}${cust.city ? ', ' + UI.escapeHtml(cust.city) : ''}${cust.state ? ', ' + UI.escapeHtml(cust.state) : ''}</p>` : ''}
                    </div>
                    <div class="customer-card-actions">
                        <button class="btn btn-ghost btn-sm cust-edit-btn" data-id="${cust.id}">✏️ Edit</button>
                        <button class="btn btn-ghost btn-sm cust-del-btn" data-id="${cust.id}">🗑️ Delete</button>
                    </div>
                </div>
            `).join('');

            // Attach events
            grid.querySelectorAll('.cust-edit-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const cust = await Customers.get(parseInt(btn.dataset.id));
                    openCustomerModal(cust);
                });
            });
            grid.querySelectorAll('.cust-del-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    UI.confirmDialog('Delete this customer?', async () => {
                        try {
                            await Customers.delete(parseInt(btn.dataset.id));
                            UI.showToast('Customer deleted', 'info');
                            await renderCustomersList();
                        } catch (err) {
                            UI.showToast(err.message, 'error');
                        }
                    });
                });
            });
        }
    }

    // ─── Settings ─────────────────────────────────────
    window.showSettings = async function () {
        showAppShell();
        document.getElementById('header-title').textContent = 'Settings';

        const user = Auth.getCurrentUser();
        if (!user) return;

        // User info
        document.getElementById('settings-user-name').textContent = user.name;
        document.getElementById('settings-user-email').textContent = user.email;

        // Load company profile
        try {
            const company = await Company.get(user.id);
            if (company) {
                document.getElementById('company-name').value = company.companyName || '';
                document.getElementById('company-email').value = company.email || '';
                document.getElementById('company-phone').value = company.phone || '';
                document.getElementById('company-website').value = company.website || '';
                document.getElementById('company-address').value = company.address || '';
                document.getElementById('company-city').value = company.city || '';
                document.getElementById('company-state').value = company.state || '';
                document.getElementById('company-zip').value = company.zip || '';
                document.getElementById('company-country').value = company.country || '';
                document.getElementById('company-tax-id').value = company.taxId || '';
                document.getElementById('company-default-currency').value = company.defaultCurrency || 'USD';

                if (company.logo) {
                    document.getElementById('company-logo-preview').src = company.logo;
                    document.getElementById('company-logo-preview').style.display = 'block';
                    document.getElementById('logo-upload-placeholder').style.display = 'none';
                } else {
                    document.getElementById('company-logo-preview').style.display = 'none';
                    document.getElementById('logo-upload-placeholder').style.display = '';
                }
            }
        } catch (err) {
            console.error('Error loading company profile:', err);
        }
    };

    // ─── Helpers ──────────────────────────────────────
    async function populateCustomerDropdown() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const customers = await Customers.getAll(user.id);
        const select = document.getElementById('inv-customer');
        const currentValue = select.value;

        select.innerHTML = '<option value="">— Choose a customer —</option>';
        customers.forEach(cust => {
            select.innerHTML += `<option value="${cust.id}">${UI.escapeHtml(cust.name)}${cust.email ? ' (' + UI.escapeHtml(cust.email) + ')' : ''}</option>`;
        });

        if (currentValue) select.value = currentValue;
    }

    // ─── Start ────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);
})();
