/* ============================================================
   ui.js — Shared UI Utilities
   Expose: window.UI
   ============================================================ */

window.UI = (function () {
  'use strict';

  // ── Toast Notifications ─────────────────────────────────────

  var toastIcons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ'
  };

  function showToast(message, type) {
    type = type || 'success';
    if (typeof message === 'string') {
      message = message.replace(/firebase/gi, 'Cloud Database');
    }

    // Ensure container exists
    var container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    var icon = toastIcons[type] || 'ℹ';
    toast.innerHTML =
      '<span class="toast-icon">' + icon + '</span>' +
      '<span class="toast-message">' + escapeHtml(message) + '</span>' +
      '<button class="toast-close" aria-label="Close">&times;</button>';

    container.appendChild(toast);

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', function () {
      _dismissToast(toast);
    });

    // Auto-dismiss after 3 seconds
    setTimeout(function () {
      _dismissToast(toast);
    }, 3000);
  }

  function _dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('toast-slideOut');
    toast.addEventListener('animationend', function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
  }

  // ── Modal ───────────────────────────────────────────────────

  function showModal(options) {
    options = options || {};
    var title   = options.title   || '';
    var content = options.content || '';
    var footer  = options.footer  || '';
    var size    = options.size    || 'medium';

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    var sizeClass = 'modal-' + size;
    overlay.innerHTML =
      '<div class="modal ' + sizeClass + ' animate-fadeIn">' +
        '<div class="modal-header">' +
          '<h3 class="modal-title">' + title + '</h3>' +
          '<button class="modal-close" aria-label="Close modal">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' + content + '</div>' +
        (footer ? '<div class="modal-footer">' + footer + '</div>' : '') +
      '</div>';

    document.body.appendChild(overlay);

    var modalEl = overlay.querySelector('.modal');

    // Close helpers
    function close() {
      overlay.classList.remove('active');
      modalEl.classList.add('animate-fadeOut');
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    }

    // Close on overlay click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        if (options.onCancel) options.onCancel();
        close();
      }
    });

    // Close on X button
    overlay.querySelector('.modal-close').addEventListener('click', function () {
      if (options.onCancel) options.onCancel();
      close();
    });

    // Wire up confirm if footer has a .btn-primary
    if (options.onConfirm) {
      var confirmBtn = overlay.querySelector('.modal-footer .btn-primary');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
          options.onConfirm();
          close();
        });
      }
    }

    // Wire up cancel button in footer
    var cancelBtn = overlay.querySelector('.modal-footer .btn-secondary');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        if (options.onCancel) options.onCancel();
        close();
      });
    }

    return { close: close, overlay: overlay, modal: modalEl };
  }

  // ── Confirm Dialog ──────────────────────────────────────────

  function confirmDialog(message, onConfirm) {
    return showModal({
      title:   'Confirm',
      content: '<p>' + escapeHtml(message) + '</p>',
      footer:
        '<button class="btn btn-secondary">Cancel</button>' +
        '<button class="btn btn-primary">Confirm</button>',
      onConfirm: onConfirm
    });
  }

  // ── Theme Toggle ────────────────────────────────────────────

  function toggleTheme() {
    var html = document.documentElement;
    var current = html.getAttribute('data-theme') || 'light';
    var next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    _updateThemeIcon(next);
  }

  function initTheme() {
    var saved = localStorage.getItem('theme');
    if (!saved) {
      saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    document.documentElement.setAttribute('data-theme', saved);
    _updateThemeIcon(saved);
  }

  function _updateThemeIcon(theme) {
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('title', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    }
  }

  // ── Formatting Utilities ────────────────────────────────────

  var currencySymbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    CAD: 'CA$',
    AUD: 'A$',
    JPY: '¥',
    SGD: 'S$'
  };

  function getCurrencySymbol(code) {
    return currencySymbols[code] || '$';
  }

  function formatCurrency(amount, currencyCode) {
    amount = parseFloat(amount) || 0;
    currencyCode = currencyCode || 'USD';
    var locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style:    'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      var sym = getCurrencySymbol(currencyCode);
      return sym + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
    // Handle YYYY-MM-DD format directly to avoid timezone issues
    var parts = dateStr.toString().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (parts) {
      var monthIdx = parseInt(parts[2], 10) - 1;
      var day = parseInt(parts[3], 10);
      var dayStr = day < 10 ? '0' + day : '' + day;
      return months[monthIdx] + ' ' + dayStr + ', ' + parts[1];
    }
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var day2 = d.getDate();
    var dayStr2 = day2 < 10 ? '0' + day2 : '' + day2;
    return months[d.getMonth()] + ' ' + dayStr2 + ', ' + d.getFullYear();
  }

  function formatDateInput(dateStr) {
    if (!dateStr) return '';
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  // ── Security ────────────────────────────────────────────────

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Debounce ────────────────────────────────────────────────

  function debounce(fn, ms) {
    var timer;
    return function () {
      var ctx  = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms);
    };
  }

  // ── Status Badge ────────────────────────────────────────────

  function getStatusBadge(status) {
    if (!status) return '';
    var label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    return '<span class="badge badge-' + escapeHtml(status.toLowerCase()) + '">' + escapeHtml(label) + '</span>';
  }

  // ── Loading Spinner ─────────────────────────────────────────

  function showLoading(container) {
    if (!container) return;
    hideLoading(container); // prevent duplicates
    var spinner = document.createElement('div');
    spinner.className = 'spinner-wrapper';
    spinner.innerHTML =
      '<div class="spinner"></div>' +
      '<span class="spinner-text">Loading…</span>';
    container.appendChild(spinner);
  }

  function hideLoading(container) {
    if (!container) return;
    var existing = container.querySelector('.spinner-wrapper');
    if (existing) existing.parentNode.removeChild(existing);
  }

  // ── Sidebar Active State ────────────────────────────────────

  function updateSidebarActive(hash) {
    var items = document.querySelectorAll('.nav-item');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      item.classList.remove('active');
      var route = item.getAttribute('data-route');
      if (route && hash.indexOf(route) === 0) {
        item.classList.add('active');
      }
    }
  }

  // ── Public API ──────────────────────────────────────────────

  return {
    showToast:          showToast,
    showModal:          showModal,
    confirmDialog:      confirmDialog,
    toggleTheme:        toggleTheme,
    initTheme:          initTheme,
    formatCurrency:     formatCurrency,
    getCurrencySymbol:  getCurrencySymbol,
    formatDate:         formatDate,
    formatDateInput:    formatDateInput,
    escapeHtml:         escapeHtml,
    debounce:           debounce,
    getStatusBadge:     getStatusBadge,
    showLoading:        showLoading,
    hideLoading:        hideLoading,
    updateSidebarActive: updateSidebarActive
  };

})();
