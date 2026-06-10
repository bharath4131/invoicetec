/* ============================================================
   dashboard.js — Dashboard Page Renderer
   Expose: window.Dashboard
   ============================================================ */

window.Dashboard = (function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────

  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];

  var EXCHANGE_RATES = null;
  var FALLBACK_RATES = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
    INR: 83.5,
    CAD: 1.37,
    AUD: 1.51,
    JPY: 156.0,
    SGD: 1.35
  };

  async function _getExchangeRates() {
    if (EXCHANGE_RATES) return EXCHANGE_RATES;
    try {
      var res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error('API response error');
      var data = await res.json();
      if (data && data.rates) {
        EXCHANGE_RATES = data.rates;
        return EXCHANGE_RATES;
      }
    } catch (e) {
      console.warn('Failed to fetch live exchange rates, using fallback rates:', e);
    }
    EXCHANGE_RATES = FALLBACK_RATES;
    return EXCHANGE_RATES;
  }

  function _convertAmount(amount, from, to, rates) {
    amount = parseFloat(amount) || 0;
    from = from || 'USD';
    to = to || 'USD';
    if (from === to) return amount;
    
    var rateFrom = rates[from] || FALLBACK_RATES[from] || 1;
    var rateTo = rates[to] || FALLBACK_RATES[to] || 1;
    
    var amountInUSD = amount / rateFrom;
    return amountInUSD * rateTo;
  }

  /**
   * Build an array of the last N month labels/keys
   * ending with the current month.
   */
  function _getLastMonths(n) {
    var now    = new Date();
    var months = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: monthNames[d.getMonth()],
        key:   d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1)
      });
    }
    return months;
  }

  /**
   * Build monthly revenue from a list of invoices.
   * Returns { 'YYYY-MM': total, … }
   */
  function _aggregateMonthlyRevenue(invoices, presentationCurrency, rates) {
    var map = {};
    invoices.forEach(function (inv) {
      if (inv.status !== 'paid') return;
      var d = new Date(inv.date);
      if (isNaN(d.getTime())) return;
      var key = d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
      var convertedTotal = _convertAmount(inv.total, inv.currency, presentationCurrency, rates);
      map[key] = (map[key] || 0) + convertedTotal;
    });
    return map;
  }

  function _calculateStats(invoices, presentationCurrency, rates) {
    var totalRevenue = 0;
    var outstandingAmount = 0;
    var overdueAmount = 0;
    var totalInvoices = invoices.length;
    var paidCount = 0;
    var pendingCount = 0;
    var overdueCount = 0;
    var draftCount = 0;

    invoices.forEach(function (inv) {
      var amountInPresentation = _convertAmount(inv.total, inv.currency, presentationCurrency, rates);
      switch (inv.status) {
        case 'paid':
          totalRevenue += amountInPresentation;
          paidCount++;
          break;
        case 'pending':
          outstandingAmount += amountInPresentation;
          pendingCount++;
          break;
        case 'overdue':
          overdueAmount += amountInPresentation;
          overdueCount++;
          break;
        case 'draft':
          draftCount++;
          break;
      }
    });

    return {
      totalRevenue: totalRevenue,
      outstandingAmount: outstandingAmount,
      overdueAmount: overdueAmount,
      totalInvoices: totalInvoices,
      paidCount: paidCount,
      pendingCount: pendingCount,
      overdueCount: overdueCount,
      draftCount: draftCount
    };
  }

  // ── Render ──────────────────────────────────────────────────

  async function render() {
    var container = document.querySelector('#dashboard-page .content-area');
    if (!container) return;

    UI.showLoading(container);

    try {
      var user     = Auth.getCurrentUser();
      var userId   = user ? user.id : null;
      var company  = await Company.get(userId);
      var defaultCurrency = company ? company.defaultCurrency || 'USD' : 'USD';
      
      var selectedCurrency = localStorage.getItem('dashboard_presentation_currency') || defaultCurrency;
      
      var select = document.getElementById('dashboard-currency-select');
      if (select) {
        select.value = selectedCurrency;
        if (!select.dataset.listenerAttached) {
          select.addEventListener('change', function () {
            localStorage.setItem('dashboard_presentation_currency', select.value);
            render();
          });
          select.dataset.listenerAttached = 'true';
        }
      }

      var rates = await _getExchangeRates();
      var allInvoices = await Invoices.getAll(userId);
      var stats = _calculateStats(allInvoices, selectedCurrency, rates);

      UI.hideLoading(container);

      var html = '';

      // ── 1. Stat Cards ────────────────────────────────────────
      html += '<div class="dashboard-grid animate-fadeIn">';
      html += _statCard('💰', UI.formatCurrency(stats.totalRevenue      || 0, selectedCurrency), 'Total Revenue',     'revenue');
      html += _statCard('⏳', UI.formatCurrency(stats.outstandingAmount || 0, selectedCurrency), 'Outstanding',       'outstanding');
      html += _statCard('✅', (stats.paidCount    || 0),                      'Paid Invoices',     'paid');
      html += _statCard('📄', (stats.totalInvoices || 0),                     'Total Invoices',    'total');
      html += '</div>';

      // ── 2. Revenue Chart (Monthly / Yearly) ──────────────────
      var chartPeriod = localStorage.getItem('dashboard_chart_period') || 'monthly';
      html += _renderChart(allInvoices, selectedCurrency, rates, chartPeriod);

      // ── 3. Recent Invoices Table ─────────────────────────────
      html += _renderRecentTable(allInvoices);

      // ── 4. Quick Actions ─────────────────────────────────────
      html += _renderQuickActions();

      container.innerHTML = html;

      // Wire up quick action buttons
      var newInvBtn = document.getElementById('quick-new-invoice');
      if (newInvBtn) {
        newInvBtn.addEventListener('click', function () {
          window.location.hash = '#/create';
        });
      }
      var newCustBtn = document.getElementById('quick-new-customer');
      if (newCustBtn) {
        newCustBtn.addEventListener('click', function () {
          if (window.CustomersPage && CustomersPage.openAddModal) {
            CustomersPage.openAddModal();
          } else {
            window.location.hash = '#/customers';
          }
        });
      }

      // Wire up table row clicks
      var rows = container.querySelectorAll('.data-table tbody tr[data-id]');
      rows.forEach(function (row) {
        row.addEventListener('click', function () {
          window.location.hash = '#/preview/' + row.getAttribute('data-id');
        });
      });

      // Wire up chart period toggle buttons
      var btnMonthly = document.getElementById('chart-btn-monthly');
      var btnYearly = document.getElementById('chart-btn-yearly');
      if (btnMonthly && btnYearly) {
        btnMonthly.addEventListener('click', function () {
          localStorage.setItem('dashboard_chart_period', 'monthly');
          render();
        });
        btnYearly.addEventListener('click', function () {
          localStorage.setItem('dashboard_chart_period', 'yearly');
          render();
        });
      }

    } catch (err) {
      UI.hideLoading(container);
      container.innerHTML = '<p class="error-text">Failed to load dashboard. ' + UI.escapeHtml(err.message) + '</p>';
    }
  }

  // ── Component Builders ──────────────────────────────────────

  function _statCard(icon, value, label, modifier) {
    return (
      '<div class="stat-card ' + modifier + ' animate-fadeIn">' +
        '<div class="stat-card-icon">' + icon + '</div>' +
        '<div class="stat-card-value">' + value + '</div>' +
        '<div class="stat-card-label">' + UI.escapeHtml(label) + '</div>' +
      '</div>'
    );
  }

  function _getLastYears(n) {
    var currentYear = new Date().getFullYear();
    var years = [];
    for (var i = n - 1; i >= 0; i--) {
      years.push(currentYear - i);
    }
    return years;
  }

  function _aggregateYearlyRevenue(invoices, presentationCurrency, rates) {
    var map = {};
    invoices.forEach(function (inv) {
      if (inv.status !== 'paid') return;
      var d = new Date(inv.date);
      if (isNaN(d.getTime())) return;
      var key = d.getFullYear().toString();
      var convertedTotal = _convertAmount(inv.total, inv.currency, presentationCurrency, rates);
      map[key] = (map[key] || 0) + convertedTotal;
    });
    return map;
  }

  function _renderChart(invoices, presentationCurrency, rates, period) {
    period = period || 'monthly';
    var labels = [];
    var values = [];

    if (period === 'yearly') {
      var years = _getLastYears(5);
      var revenue = _aggregateYearlyRevenue(invoices, presentationCurrency, rates);
      labels = years.map(function (y) { return { label: y.toString(), key: y.toString() }; });
      values = years.map(function (y) { return revenue[y.toString()] || 0; });
    } else {
      var months = _getLastMonths(6);
      var revenue = _aggregateMonthlyRevenue(invoices, presentationCurrency, rates);
      labels = months.map(function (m) { return { label: m.label, key: m.key }; });
      values = months.map(function (m) { return revenue[m.key] || 0; });
    }

    var max = Math.max.apply(null, values) || 1;

    var bars = '';
    labels.forEach(function (lbl, i) {
      var val     = values[i];
      var pct     = Math.round((val / max) * 100);
      var height  = Math.max(pct, 4); // minimum visible bar
      bars +=
        '<div class="chart-bar-wrapper animate-fadeIn delay-' + (i + 1) + '">' +
          '<div class="chart-bar-amount">' + UI.formatCurrency(val, presentationCurrency) + '</div>' +
          '<div class="chart-bar" style="height:' + height + '%" title="' + UI.formatCurrency(val, presentationCurrency) + '"></div>' +
          '<div class="chart-bar-label">' + lbl.label + '</div>' +
        '</div>';
    });

    var title = period === 'yearly' ? 'Yearly Revenue' : 'Monthly Revenue';

    return (
      '<div class="card chart-card animate-fadeIn delay-2">' +
        '<div class="card-header-flex" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">' +
          '<h3 class="card-title" style="margin:0;">' + title + '</h3>' +
          '<div class="btn-group chart-toggle-group" style="display:flex; gap:4px; background:var(--bg-secondary); padding:4px; border-radius:var(--radius-md);">' +
            '<button class="btn btn-sm ' + (period === 'monthly' ? 'btn-primary' : 'btn-ghost') + '" id="chart-btn-monthly" style="padding: 4px 12px; font-size:var(--font-xs);">Monthly</button>' +
            '<button class="btn btn-sm ' + (period === 'yearly' ? 'btn-primary' : 'btn-ghost') + '" id="chart-btn-yearly" style="padding: 4px 12px; font-size:var(--font-xs);">Yearly</button>' +
          '</div>' +
        '</div>' +
        '<div class="chart-container">' + bars + '</div>' +
      '</div>'
    );
  }

  function _renderRecentTable(invoices) {
    // Sort by date descending and take first 5
    var sorted = invoices.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
    var recent = sorted.slice(0, 5);

    if (recent.length === 0) {
      return (
        '<div class="card animate-fadeIn delay-3">' +
          '<h3 class="card-title">Recent Invoices</h3>' +
          '<p class="empty-state-text">No invoices yet. Create your first one!</p>' +
        '</div>'
      );
    }

    var rows = '';
    recent.forEach(function (inv, i) {
      var customerName = inv.customerName || (inv.customer ? (inv.customer.name || 'N/A') : 'N/A');
      rows +=
        '<tr data-id="' + inv.id + '" class="animate-fadeIn delay-' + (i + 1) + '" style="cursor:pointer;">' +
          '<td class="font-medium">' + UI.escapeHtml(inv.invoiceNumber || '') + '</td>' +
          '<td>' + UI.escapeHtml(customerName) + '</td>' +
          '<td>' + UI.formatDate(inv.date) + '</td>' +
          '<td class="font-medium">' + UI.formatCurrency(inv.total, inv.currency) + '</td>' +
          '<td>' + UI.getStatusBadge(inv.status) + '</td>' +
          '<td>' +
            '<a href="#/preview/' + inv.id + '" class="btn btn-sm btn-ghost" title="View Invoice" onclick="event.stopPropagation();">' +
              '👁️ View' +
            '</a>' +
          '</td>' +
        '</tr>';
    });

    return (
      '<div class="card animate-fadeIn delay-3">' +
        '<h3 class="card-title">Recent Invoices</h3>' +
        '<div class="table-responsive">' +
          '<table class="data-table">' +
            '<thead>' +
              '<tr>' +
                '<th>Invoice #</th>' +
                '<th>Customer</th>' +
                '<th>Date</th>' +
                '<th>Amount</th>' +
                '<th>Status</th>' +
                '<th>Actions</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'
    );
  }

  function _renderQuickActions() {
    return (
      '<div class="quick-actions animate-fadeIn delay-4">' +
        '<button id="quick-new-invoice" class="btn btn-primary btn-lg">' +
          '<span class="btn-icon">+</span> New Invoice' +
        '</button>' +
        '<button id="quick-new-customer" class="btn btn-secondary btn-lg">' +
          '<span class="btn-icon">+</span> New Customer' +
        '</button>' +
      '</div>'
    );
  }

  // ── Public API ──────────────────────────────────────────────

  return {
    render: render
  };

})();
