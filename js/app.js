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

        // Set up landing page
        setupLandingPage();

        // Set up GDPR cookie banner
        setupGDPRCookieBanner();

        // Restore Firebase session if active
        if (window.Sync && Sync.isEnabled() && typeof Auth !== 'undefined') {
            try {
                const client = Sync.getClient();
                if (client) {
                    client.auth().onAuthStateChanged(async (firebaseUser) => {
                        if (firebaseUser) {
                            let existingUser = await db.users.where('email').equals(firebaseUser.email.toLowerCase()).first();
                            let localUserId;
                            if (existingUser) {
                                existingUser.supabaseId = firebaseUser.uid;
                                if (firebaseUser.displayName) {
                                    existingUser.name = firebaseUser.displayName;
                                }
                                await db.users.put(existingUser);
                                localUserId = existingUser.id;
                            } else {
                                localUserId = await db.users.add({
                                    name: firebaseUser.displayName || 'Cloud User',
                                    email: firebaseUser.email.toLowerCase(),
                                    supabaseId: firebaseUser.uid,
                                    createdAt: new Date().toISOString()
                                });
                            }
                            var sessionObj = {
                                id: localUserId,
                                name: firebaseUser.displayName || (existingUser ? existingUser.name : 'Cloud User'),
                                email: firebaseUser.email.toLowerCase(),
                                supabaseId: firebaseUser.uid
                            };
                            
                            const currentUser = Auth.getCurrentUser();
                            if (!currentUser || currentUser.email !== sessionObj.email) {
                                sessionStorage.setItem('currentUser', JSON.stringify(sessionObj));
                                try {
                                    await Sync.pull(localUserId);
                                    Router.navigate(window.location.hash);
                                } catch (syncErr) {
                                    console.error('Initial sync pull on auto-restore failed:', syncErr);
                                }
                            }
                        }
                    });
                }
            } catch (err) {
                console.error('Failed to auto-restore Firebase session:', err);
            }
        }

        // Pull latest sync data when window/tab gets focus (keeps Device A & Device B in sync)
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && window.Sync && Sync.isEnabled() && typeof Auth !== 'undefined') {
                const user = Auth.getCurrentUser();
                if (user) {
                    try {
                        await Sync.pull(user.id);
                        // Refresh the current page to display new data
                        Router.navigate(window.location.hash);
                    } catch (syncErr) {
                        console.error('Focus sync pull failed:', syncErr);
                    }
                }
            }
        });

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
        const emailInput = document.getElementById('login-email');
        if (emailInput) {
            emailInput.addEventListener('input', () => {
                emailInput.value = emailInput.value.toLowerCase();
            });
        }
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
        const emailInput = document.getElementById('register-email');
        if (emailInput) {
            emailInput.addEventListener('input', () => {
                emailInput.value = emailInput.value.toLowerCase();
            });
        }
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
                const res = await Auth.register(name, email, password);
                if (res && res.emailVerificationRequired) {
                    UI.showToast('Account registered! Please check your email to verify your account before logging in.', 'warning', 10000);
                    form.reset();
                    // Switch tab to login
                    const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
                    if (loginTab) loginTab.click();
                    const loginEmail = document.getElementById('login-email');
                    if (loginEmail) loginEmail.value = res.email;
                } else {
                    UI.showToast('Account created successfully!', 'success');
                    form.reset();
                    window.location.hash = '#/dashboard';
                }
            } catch (err) {
                UI.showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span>Create Account</span><span>→</span>';
            }
        });
    }

    // ─── Landing Page Events ───────────────────────────
    function setupLandingPage() {
        // FAQ Accordion Toggle
        const faqCards = document.querySelectorAll('.faq-card');
        faqCards.forEach(card => {
            card.addEventListener('click', () => {
                const isActive = card.classList.contains('active');
                faqCards.forEach(c => c.classList.remove('active'));
                if (!isActive) {
                    card.classList.add('active');
                }
            });
        });

        // Landing Page Legal Modal Event Listeners
        const privacyModal = document.getElementById('privacy-modal-overlay');
        const termsModal = document.getElementById('terms-modal-overlay');

        // Landing Privacy Link
        document.getElementById('landing-privacy-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            privacyModal.classList.add('active');
        });

        // Landing Terms Link
        document.getElementById('landing-terms-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            termsModal.classList.add('active');
        });

        // Terms Close Button
        document.getElementById('terms-modal-close')?.addEventListener('click', () => {
            termsModal.classList.remove('active');
        });

        // Terms OK Button
        document.getElementById('terms-modal-ok')?.addEventListener('click', () => {
            termsModal.classList.remove('active');
        });

        // Close Terms Modal on Overlay Click
        termsModal?.addEventListener('click', (e) => {
            if (e.target === termsModal) {
                termsModal.classList.remove('active');
            }
        });

        // Contact Form Submission
        const contactForm = document.getElementById('landing-contact-form');
        contactForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('contact-name').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            const message = document.getElementById('contact-message').value.trim();
            const submitBtn = document.getElementById('contact-submit-btn');

            if (!name || !email || !message) {
                UI.showToast('Please fill in all contact fields.', 'error');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending Message...';

            const formData = new FormData(contactForm);
            fetch('/', {
                method: 'POST',
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(formData).toString()
            })
            .then(response => {
                if (response.ok) {
                    UI.showToast(`Thank you, ${name}! Your message has been sent successfully.`, 'success');
                    contactForm.reset();
                } else {
                    throw new Error('Server returned an error');
                }
            })
            .catch(err => {
                console.error('Netlify form submission error:', err);
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') {
                    UI.showToast(`[Local Developer Mock] Thank you, ${name}! Your message has been sent successfully.`, 'success');
                    contactForm.reset();
                } else {
                    UI.showToast('Failed to send message. Please try again.', 'error');
                }
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Message';
            });
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
        document.getElementById('logout-btn').addEventListener('click', async (e) => {
            e.preventDefault();
            await Auth.logout();
            window.location.hash = '#/landing';
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

        // Products page buttons
        document.getElementById('products-add-btn').addEventListener('click', () => {
            openProductModal();
        });
        document.getElementById('products-empty-add')?.addEventListener('click', () => {
            openProductModal();
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
        document.getElementById('settings-logout-btn')?.addEventListener('click', async () => {
            await Auth.logout();
            window.location.hash = '#/landing';
            UI.showToast('Signed out', 'info');
        });

        // Settings delete account
        document.getElementById('delete-account-btn')?.addEventListener('click', () => {
            UI.confirmDialog('Are you sure you want to permanently delete your account? All your local invoices, customer details, and cloud sync records will be deleted forever. This cannot be undone.', async () => {
                try {
                    const btn = document.getElementById('delete-account-btn');
                    const originalHtml = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = 'Deleting...';
                    
                    await Auth.deleteAccount();
                    window.location.hash = '#/landing';
                    UI.showToast('Your account and all data have been permanently deleted.', 'warning');
                } catch (err) {
                    UI.showToast(err.message, 'error');
                    const btn = document.getElementById('delete-account-btn');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = '<span>⚠️</span><span>Delete Account</span>';
                    }
                }
            });
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

        // Product search
        const prodSearch = document.getElementById('product-search');
        if (prodSearch) {
            prodSearch.addEventListener('input', UI.debounce(async () => {
                await renderProductsList();
            }, 300));
        }

        // Customer modal
        setupCustomerModal();

        // Product modal
        setupProductModal();

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

        // Firebase sync form
        setupFirebaseSyncForm();

        // EmailJS settings form
        setupEmailJsForm();
    }

    // ─── Invoice Form ─────────────────────────────────
    function setupInvoiceForm() {
        // Add item button
        document.getElementById('add-item-btn').addEventListener('click', async () => {
            await addInvoiceItem();
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

        // Tax & discount recalculation with capping (Bug 6)
        document.getElementById('inv-tax-rate').addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                if (val < 0) e.target.value = 0;
                if (val > 100) e.target.value = 100;
            }
            recalculateTotals();
        });

        const capDiscountValue = () => {
            const valInput = document.getElementById('inv-discount-value');
            let val = parseFloat(valInput.value);
            if (!isNaN(val)) {
                if (val < 0) valInput.value = 0;
                const discountType = document.getElementById('inv-discount-type').value;
                if (discountType === 'percentage' && val > 100) {
                    valInput.value = 100;
                }
            }
        };

        document.getElementById('inv-discount-value').addEventListener('input', () => {
            capDiscountValue();
            recalculateTotals();
        });

        document.getElementById('inv-discount-type').addEventListener('change', () => {
            capDiscountValue();
            recalculateTotals();
        });

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

    async function addInvoiceItem(item = null) {
        const currencyCode = document.getElementById('inv-currency').value;
        const tbody = document.getElementById('items-table-body');
        const row = document.createElement('tr');
        row.className = 'item-row animate-fadeIn';

        // Fetch user products/services to build autocomplete dropdown
        const user = Auth.getCurrentUser();
        const products = user ? await Products.getAll(user.id) : [];
        const productOptions = products.map(p => `
            <option value="${p.id}" data-price="${p.price}" data-desc="${UI.escapeHtml(p.description || '')}">${UI.escapeHtml(p.name)}</option>
        `).join('');

        row.innerHTML = `
            <td>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <select class="form-input item-product-select" style="font-size: 0.85rem; padding: 6px 10px; height: auto;">
                        <option value="">-- Choose Product/Service --</option>
                        ${productOptions}
                    </select>
                    <input type="text" class="form-input item-desc" placeholder="Item description" value="${item ? UI.escapeHtml(item.description) : ''}" required>
                </div>
            </td>
            <td><input type="number" class="form-input item-qty mono" value="${item ? item.quantity : 1}" min="1" step="1"></td>
            <td><input type="number" class="form-input item-rate mono" value="${item ? item.rate : 0}" min="0" step="0.01" placeholder="0.00"></td>
            <td><span class="item-amount mono">${item ? UI.formatCurrency(item.amount, currencyCode) : UI.formatCurrency(0, currencyCode)}</span></td>
            <td><button type="button" class="btn btn-icon remove-item-btn" title="Remove item">✕</button></td>
        `;

        // Events
        const selectEl = row.querySelector('.item-product-select');
        const descInput = row.querySelector('.item-desc');
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

        selectEl.addEventListener('change', () => {
            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            if (selectedOpt && selectedOpt.value) {
                const price = parseFloat(selectedOpt.getAttribute('data-price')) || 0;
                const desc = selectedOpt.getAttribute('data-desc') || '';
                const name = selectedOpt.textContent.trim();

                rateInput.value = price;
                descInput.value = name + (desc ? ' - ' + desc : '');
                updateAmount();
            }
        });

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

        // Clear previous validation errors (Bug 5)
        document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
        document.querySelectorAll('.error-msg').forEach(el => el.remove());

        const showInlineError = (element, message) => {
            element.classList.add('input-error');
            const errDiv = document.createElement('span');
            errDiv.className = 'error-msg';
            errDiv.textContent = message;
            element.parentNode.appendChild(errDiv);
        };

        let hasErrors = false;

        const customerSelect = document.getElementById('inv-customer');
        const customerId = parseInt(customerSelect.value);
        if (!customerId) {
            showInlineError(customerSelect, 'Please select a customer');
            hasErrors = true;
        }

        const rows = document.querySelectorAll('.item-row');
        if (rows.length === 0) {
            const addItemBtn = document.getElementById('add-item-btn');
            showInlineError(addItemBtn, 'Please add at least one item');
            hasErrors = true;
        }

        // Collect and validate items
        const items = [];
        rows.forEach(row => {
            const descInput = row.querySelector('.item-desc');
            const desc = descInput.value.trim();
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
            if (!desc) {
                showInlineError(descInput, 'Description is required');
                hasErrors = true;
            }
            items.push({
                description: desc,
                quantity: qty,
                rate: rate,
                amount: qty * rate
            });
        });

        if (hasErrors) {
            UI.showToast('Please correct the highlighted errors', 'error');
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
            if (window.Sync && Sync.isEnabled()) {
                Sync.push(user.id);
            }

            if (btnType === 'pending') {
                const targetInvoiceId = currentEditInvoiceId;
                const modalHtml = `
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
                        <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 8px;">Your invoice has been saved successfully! How would you like to share it?</p>
                        <button class="btn btn-secondary share-opt-btn" data-share="email" style="width: 100%; justify-content: flex-start; gap: 12px; height: 44px; padding: 0 16px;">
                            <span>📧</span> Send via Gmail / Email
                        </button>
                        <button class="btn btn-secondary share-opt-btn" data-share="whatsapp" style="width: 100%; justify-content: flex-start; gap: 12px; height: 44px; padding: 0 16px;">
                            <span>💬</span> Send via WhatsApp
                        </button>
                        <button class="btn btn-secondary share-opt-btn" data-share="share" style="width: 100%; justify-content: flex-start; gap: 12px; height: 44px; padding: 0 16px;">
                            <span>🔗</span> Share Document Link / File
                        </button>
                        <button class="btn btn-primary share-opt-btn" data-share="download" style="width: 100%; justify-content: flex-start; gap: 12px; height: 44px; padding: 0 16px;">
                            <span>⬇️</span> Download PDF Copy
                        </button>
                    </div>
                `;

                const shareModal = UI.showModal({
                    title: 'Send Invoice',
                    content: modalHtml,
                    footer: '<button class="btn btn-secondary close-modal-btn">Done</button>'
                });

                shareModal.overlay.querySelectorAll('.share-opt-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const action = btn.dataset.share;
                        shareModal.close();
                        try {
                            if (action === 'download') {
                                const invoice = await Invoices.get(targetInvoiceId);
                                const company = await Company.get(user.id);
                                const template = invoice.template || 'classic';
                                PDF.download(invoice, company, template);
                                UI.showToast('PDF downloading...', 'success');
                            } else {
                                await shareInvoiceHelper(targetInvoiceId, action);
                            }
                        } catch (err) {
                            UI.showToast('Sharing failed: ' + err.message, 'error');
                        }
                        window.location.hash = '#/invoices';
                    });
                });

                shareModal.overlay.querySelector('.close-modal-btn')?.addEventListener('click', () => {
                    shareModal.close();
                    window.location.hash = '#/invoices';
                });
            } else {
                window.location.hash = '#/invoices';
            }
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
                if (window.Sync && Sync.isEnabled()) {
                    Sync.push(user.id);
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

    // ─── Product Modal ─────────────────────────────────
    let productModalCallback = null;

    function setupProductModal() {
        const overlay = document.getElementById('product-modal-overlay');
        const closeBtn = document.getElementById('product-modal-close');
        const cancelBtn = document.getElementById('product-modal-cancel');
        const form = document.getElementById('product-modal-form');

        closeBtn.addEventListener('click', closeProductModal);
        cancelBtn.addEventListener('click', closeProductModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeProductModal();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = Auth.getCurrentUser();
            if (!user) return;

            const id = document.getElementById('product-modal-id').value;
            const data = {
                userId: user.id,
                name: document.getElementById('prod-name').value.trim(),
                price: parseFloat(document.getElementById('prod-price').value),
                description: document.getElementById('prod-description').value.trim()
            };

            try {
                if (id) {
                    await Products.update(parseInt(id), data);
                    UI.showToast('Item updated!', 'success');
                } else {
                    const newId = await Products.add(data);
                    UI.showToast('Item added!', 'success');
                    if (productModalCallback) {
                        productModalCallback(newId);
                    }
                }
                if (window.Sync && Sync.isEnabled()) {
                    Sync.push(user.id);
                }
                closeProductModal();
                // Refresh current page
                const hash = window.location.hash;
                if (hash.startsWith('#/products')) {
                    await renderProductsList();
                }
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }

    function openProductModal(product = null) {
        const overlay = document.getElementById('product-modal-overlay');
        const title = document.getElementById('product-modal-title');
        const form = document.getElementById('product-modal-form');

        form.reset();
        document.getElementById('product-modal-id').value = '';

        if (product) {
            title.textContent = 'Edit Product/Service';
            document.getElementById('product-modal-id').value = product.id;
            document.getElementById('prod-name').value = product.name || '';
            document.getElementById('prod-price').value = product.price || 0;
            document.getElementById('prod-description').value = product.description || '';
        } else {
            title.textContent = 'Add Product/Service';
        }

        overlay.classList.add('active');
    }

    function closeProductModal() {
        document.getElementById('product-modal-overlay').classList.remove('active');
        productModalCallback = null;
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
                defaultCurrency: document.getElementById('company-default-currency').value,
                logo: logoPreview.src && logoPreview.style.display !== 'none' ? logoPreview.src : null
            };

            try {
                await Company.save(user.id, data);
                UI.showToast('Company profile saved!', 'success');
                if (window.Sync && Sync.isEnabled()) {
                    Sync.push(user.id);
                }
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }

    // ─── Firebase Sync Form ───────────────────────────
    function setupFirebaseSyncForm() {
        const form = document.getElementById('firebase-sync-form');
        const checkbox = document.getElementById('firebase-enabled');

        if (!form || !checkbox) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const enabled = checkbox.checked;
            const apiKey = document.getElementById('firebase-api-key').value.trim();
            const authDomain = document.getElementById('firebase-auth-domain').value.trim();
            const projectId = document.getElementById('firebase-project-id').value.trim();
            const storageBucket = document.getElementById('firebase-storage-bucket').value.trim();
            const messagingSenderId = document.getElementById('firebase-messaging-sender-id').value.trim();
            const appId = document.getElementById('firebase-app-id').value.trim();

            localStorage.setItem('firebase_enabled', enabled);
            localStorage.setItem('firebase_api_key', apiKey);
            localStorage.setItem('firebase_auth_domain', authDomain);
            localStorage.setItem('firebase_project_id', projectId);
            localStorage.setItem('firebase_storage_bucket', storageBucket);
            localStorage.setItem('firebase_messaging_sender_id', messagingSenderId);
            localStorage.setItem('firebase_app_id', appId);

            // Reset client so it re-initializes on next call
            Sync.resetClient();

            if (enabled) {
                const someFilled = apiKey || authDomain || projectId || storageBucket || messagingSenderId || appId;
                const allFilled = apiKey && authDomain && projectId && storageBucket && messagingSenderId && appId;

                if (someFilled && !allFilled) {
                    UI.showToast('Please fill out all 6 fields or leave them all blank to use the default config', 'error');
                    Sync.updateSyncStatusBadge('Credentials needed');
                    return;
                }

                if (Sync.isEnabled()) {
                    UI.showToast('Firebase settings saved and connected!', 'success');
                    Sync.updateSyncStatusBadge('Connected');

                    const user = Auth.getCurrentUser();
                    if (user) {
                        try {
                            await Sync.pull(user.id);
                            UI.showToast('Initial sync pull completed successfully!', 'success');
                            Router.navigate(window.location.hash);
                        } catch (err) {
                            UI.showToast('Initial sync pull failed: ' + err.message, 'error');
                        }
                    }
                } else {
                    UI.showToast('Settings saved, but Firebase client initialization failed', 'error');
                    Sync.updateSyncStatusBadge('Error');
                }
            } else {
                UI.showToast('Cloud sync disabled', 'info');
                Sync.updateSyncStatusBadge('Disconnected');
            }
        });
    }

    // ─── EmailJS Settings Form ────────────────────────
    function setupEmailJsForm() {
        const form = document.getElementById('emailjs-settings-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const publicKey = document.getElementById('emailjs-public-key').value.trim();
            const serviceId = document.getElementById('emailjs-service-id').value.trim();
            const templateId = document.getElementById('emailjs-template-id').value.trim();

            localStorage.setItem('emailjs_public_key', publicKey);
            localStorage.setItem('emailjs_service_id', serviceId);
            localStorage.setItem('emailjs_template_id', templateId);

            UI.showToast('EmailJS settings saved successfully!', 'success');
        });
    }

    // ─── GDPR Cookie Consent (Bug 7) ───────────────────
    function setupGDPRCookieBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        const acceptBtn = document.getElementById('cookie-accept-btn');
        const rejectBtn = document.getElementById('cookie-reject-btn');
        const privacyLink = document.getElementById('cookie-privacy-link');

        if (!banner || !acceptBtn || !rejectBtn) return;

        privacyLink?.addEventListener('click', (e) => {
            e.preventDefault();
            const privacyModal = document.getElementById('privacy-modal-overlay');
            if (privacyModal) privacyModal.classList.add('active');
        });

        const consent = localStorage.getItem('cookie-consent');

        if (!consent) {
            banner.style.display = 'flex';
        } else if (consent === 'accepted') {
            loadGoogleAds();
        }

        acceptBtn.addEventListener('click', () => {
            localStorage.setItem('cookie-consent', 'accepted');
            banner.style.display = 'none';
            loadGoogleAds();
            UI.showToast('Cookie settings updated. Thank you!', 'success');
        });

        rejectBtn.addEventListener('click', () => {
            localStorage.setItem('cookie-consent', 'rejected');
            banner.style.display = 'none';
            UI.showToast('Optional cookies rejected. Personalized ads disabled.', 'info');
        });
    }

    function loadGoogleAds() {
        if (window.adsenseLoaded) return;
        const script = document.createElement('script');
        script.async = true;
        script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3114500520120157";
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
        window.adsenseLoaded = true;
        console.log('Google AdSense script loaded dynamically after user consent.');
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
                    if (window.Sync && Sync.isEnabled()) {
                        Sync.push(user.id);
                    }
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

    async function shareInvoiceHelper(id, method) {
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
                    // Fallback to downloading (Bug 11)
                    try {
                        const activeTemplate = document.querySelector('#preview-template-selector .template-option.active');
                        const template = activeTemplate ? activeTemplate.getAttribute('data-template') : invoice.template || 'classic';
                        PDF.download(invoice, company, template);
                        UI.showToast('Web Share not supported. PDF downloaded automatically! 📎', 'success');
                    } catch (e) {
                        UI.showToast('Web Share is not supported and download failed: ' + e.message, 'warning');
                    }
                }
            } else {
                // Auto-download PDF in background so user has the actual document file ready to attach (User Request)
                try {
                    const template = invoice.template || 'classic';
                    PDF.download(invoice, company, template);
                    UI.showToast('Invoice PDF downloaded automatically! Attach it to your message 📎', 'success');
                } catch (pdfErr) {
                    console.error('PDF auto-download during share failed:', pdfErr);
                }

                if (method === 'email') {
                    var emailBody = `Hello ${customer.name || 'there'},\n\nHere is Invoice ${invoice.invoiceNumber} from ${companyName}.\n\nTotal Due: ${formattedTotal}\nDue Date: ${UI.formatDate(invoice.dueDate)}\n\nThank you for your business!\n\nBest regards,\n${companyName}`;
                    var gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(customer.email || '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

                    const emailjsPublicKey = localStorage.getItem('emailjs_public_key');
                    const emailjsServiceId = localStorage.getItem('emailjs_service_id');
                    const emailjsTemplateId = localStorage.getItem('emailjs_template_id');

                    if (emailjsPublicKey && emailjsServiceId && emailjsTemplateId) {
                        const activeTemplate = document.querySelector('#preview-template-selector .template-option.active');
                        const template = activeTemplate ? activeTemplate.getAttribute('data-template') : invoice.template || 'classic';
                        const docDef = PDF.generateDocDefinition(invoice, company, template);

                        UI.showToast('Generating PDF attachment...', 'info');
                        pdfMake.createPdf(docDef).getBase64(async function (base64Str) {
                            try {
                                UI.showToast('Sending email directly...', 'info');
                                emailjs.init({ publicKey: emailjsPublicKey });

                                const templateParams = {
                                    to_email: customer.email || '',
                                    client_name: customer.name || 'Valued Customer',
                                    invoice_number: invoice.invoiceNumber,
                                    invoice_pdf: `data:application/pdf;base64,${base64Str}`
                                };

                                await emailjs.send(emailjsServiceId, emailjsTemplateId, templateParams);
                                UI.showToast('Email sent directly to customer!', 'success');
                            } catch (err) {
                                console.error('EmailJS send error:', err);
                                UI.showToast('Direct sending failed. Opening Gmail instead...', 'warning');
                                window.open(gmailUrl, '_blank');
                            }
                        });
                    } else {
                        UI.showToast('To email in 1-click directly, configure EmailJS in Settings! Opening Gmail...', 'info');
                        window.open(gmailUrl, '_blank');
                    }
                } else if (method === 'whatsapp') {
                    var cleanPhone = (customer.phone || '').replace(/[^\d+]/g, '');
                    var waText = `Hello *${customer.name || 'there'}*,\n\nHere is *Invoice ${invoice.invoiceNumber}* from *${companyName}*.\n\n*Total Due:* ${formattedTotal}\n*Due Date:* ${UI.formatDate(invoice.dueDate)}\n\nThank you for your business!`;
                    var waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`;
                    window.open(waUrl, '_blank');
                }
            }
        } catch (err) {
            UI.showToast('Failed to share: ' + err.message, 'error');
        }
    }

    async function shareInvoice(method) {
        const id = Router.getParam('id');
        if (!id) return;
        await shareInvoiceHelper(parseInt(id), method);
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
        document.getElementById('landing-page').style.display = 'none';
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
        document.getElementById('landing-page').style.display = 'none';
    };

    window.showLandingPage = function () {
        document.getElementById('landing-page').style.display = '';
        document.getElementById('auth-page').style.display = 'none';
        document.getElementById('app-shell').style.display = 'none';

        // Dynamically toggle landing buttons based on authentication state
        const isLoggedIn = Auth.isLoggedIn();
        const signinBtn = document.getElementById('landing-signin-btn');
        const signupBtn = document.getElementById('landing-signup-btn');
        const heroPrimaryBtn = document.getElementById('landing-hero-primary-btn');

        if (isLoggedIn) {
            signinBtn.textContent = 'Dashboard';
            signinBtn.href = '#/dashboard';
            signupBtn.style.display = 'none';
            heroPrimaryBtn.textContent = 'Go to Dashboard';
            heroPrimaryBtn.href = '#/dashboard';
        } else {
            signinBtn.textContent = 'Sign In';
            signinBtn.href = '#/login';
            signupBtn.style.display = '';
            heroPrimaryBtn.textContent = 'Start Generating Free';
            heroPrimaryBtn.href = '#/login?tab=register';
        }
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
                            const user = Auth.getCurrentUser();
                            await Invoices.delete(parseInt(btn.dataset.id));
                            UI.showToast('Invoice deleted', 'info');
                            if (window.Sync && Sync.isEnabled() && user) {
                                Sync.push(user.id);
                            }
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
        await addInvoiceItem();

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
                for (const item of invoice.items) {
                    await addInvoiceItem(item);
                }
            } else {
                await addInvoiceItem();
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
                            const user = Auth.getCurrentUser();
                            await Customers.delete(parseInt(btn.dataset.id));
                            UI.showToast('Customer deleted', 'info');
                            if (window.Sync && Sync.isEnabled() && user) {
                                Sync.push(user.id);
                            }
                            await renderCustomersList();
                        } catch (err) {
                            UI.showToast(err.message, 'error');
                        }
                    });
                });
            });
        }
    }

    // ─── Products ──────────────────────────────────────
    window.showProducts = async function () {
        showAppShell();
        document.getElementById('header-title').textContent = 'Products & Services';
        document.getElementById('product-search').value = '';
        await renderProductsList();
    };

    async function renderProductsList() {
        const user = Auth.getCurrentUser();
        if (!user) return;

        const query = document.getElementById('product-search').value.trim();
        let products;
        if (query) {
            products = await Products.search(user.id, query);
        } else {
            products = await Products.getAll(user.id);
        }

        const tableCard = document.getElementById('products-table-card');
        const tbody = document.getElementById('products-table-body');
        const emptyState = document.getElementById('products-empty');

        if (products.length === 0) {
            tableCard.style.display = 'none';
            emptyState.style.display = '';
        } else {
            tableCard.style.display = '';
            emptyState.style.display = 'none';

            const company = await Company.get(user.id);
            const defaultCurrency = company ? company.defaultCurrency || 'USD' : 'USD';

            tbody.innerHTML = products.map((prod, i) => `
                <tr class="animate-fadeIn delay-${Math.min(i + 1, 5)}" data-id="${prod.id}">
                    <td style="font-weight: 600; color: var(--text-primary);">${UI.escapeHtml(prod.name)}</td>
                    <td style="color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${UI.escapeHtml(prod.description || '')}
                    </td>
                    <td class="mono" style="font-weight: 500;">${UI.formatCurrency(prod.price, defaultCurrency)}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-ghost btn-sm prod-edit-btn" style="padding: 4px 8px; margin-right: 4px;" data-id="${prod.id}">✏️ Edit</button>
                        <button class="btn btn-ghost btn-sm prod-del-btn" style="padding: 4px 8px; color: var(--status-overdue);" data-id="${prod.id}">🗑️ Delete</button>
                    </td>
                </tr>
            `).join('');

            // Attach events
            tbody.querySelectorAll('.prod-edit-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const prod = await Products.get(parseInt(btn.dataset.id));
                    openProductModal(prod);
                });
            });
            tbody.querySelectorAll('.prod-del-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    UI.confirmDialog('Delete this item from the catalog?', async () => {
                        try {
                            const user = Auth.getCurrentUser();
                            await Products.delete(parseInt(btn.dataset.id));
                            UI.showToast('Item deleted', 'info');
                            if (window.Sync && Sync.isEnabled() && user) {
                                Sync.push(user.id);
                            }
                            await renderProductsList();
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
        document.getElementById('settings-user-name').textContent = user.name || 'Not set';
        document.getElementById('settings-user-email').textContent = user.email || 'Not set';

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

        // Initialize Firebase Sync fields
        const firebaseEnabledCheckbox = document.getElementById('firebase-enabled');
        const firebaseApiKeyInput = document.getElementById('firebase-api-key');
        const firebaseAuthDomainInput = document.getElementById('firebase-auth-domain');
        const firebaseProjectIdInput = document.getElementById('firebase-project-id');
        const firebaseStorageBucketInput = document.getElementById('firebase-storage-bucket');
        const firebaseMessagingSenderIdInput = document.getElementById('firebase-messaging-sender-id');
        const firebaseAppIdInput = document.getElementById('firebase-app-id');

        if (firebaseEnabledCheckbox) {
            const enabled = localStorage.getItem('firebase_enabled') !== 'false';
            const apiKey = localStorage.getItem('firebase_api_key') || '';
            const authDomain = localStorage.getItem('firebase_auth_domain') || '';
            const projectId = localStorage.getItem('firebase_project_id') || '';
            const storageBucket = localStorage.getItem('firebase_storage_bucket') || '';
            const messagingSenderId = localStorage.getItem('firebase_messaging_sender_id') || '';
            const appId = localStorage.getItem('firebase_app_id') || '';

            firebaseEnabledCheckbox.checked = enabled;
            if (firebaseApiKeyInput) firebaseApiKeyInput.value = apiKey;
            if (firebaseAuthDomainInput) firebaseAuthDomainInput.value = authDomain;
            if (firebaseProjectIdInput) firebaseProjectIdInput.value = projectId;
            if (firebaseStorageBucketInput) firebaseStorageBucketInput.value = storageBucket;
            if (firebaseMessagingSenderIdInput) firebaseMessagingSenderIdInput.value = messagingSenderId;
            if (firebaseAppIdInput) firebaseAppIdInput.value = appId;

            const formElement = firebaseEnabledCheckbox.closest('form');
            if (formElement) {
                const detailsElement = formElement.querySelector('details');
                if (detailsElement) {
                    detailsElement.open = !!(apiKey || authDomain || projectId || storageBucket || messagingSenderId || appId);
                }
            }

            if (!enabled) {
                Sync.updateSyncStatusBadge('Disconnected');
            } else if (Sync.isEnabled()) {
                Sync.updateSyncStatusBadge('Connected');
            } else {
                const someFilled = apiKey || authDomain || projectId || storageBucket || messagingSenderId || appId;
                if (someFilled) {
                    Sync.updateSyncStatusBadge('Credentials needed');
                } else {
                    Sync.updateSyncStatusBadge('Error');
                }
            }
        }

        // Initialize EmailJS fields
        const emailjsPublicKey = document.getElementById('emailjs-public-key');
        const emailjsServiceId = document.getElementById('emailjs-service-id');
        const emailjsTemplateId = document.getElementById('emailjs-template-id');

        if (emailjsPublicKey) emailjsPublicKey.value = localStorage.getItem('emailjs_public_key') || '';
        if (emailjsServiceId) emailjsServiceId.value = localStorage.getItem('emailjs_service_id') || '';
        if (emailjsTemplateId) emailjsTemplateId.value = localStorage.getItem('emailjs_template_id') || '';
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
