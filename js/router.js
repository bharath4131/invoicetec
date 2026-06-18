/* ============================================================
   router.js — Hash-based SPA Router
   Expose: window.Router
   ============================================================ */

window.Router = (function () {
  'use strict';

  // ── Route definitions ───────────────────────────────────────
  // Maps hash patterns to { pageId, handler }
  // handler is the global function name from app.js
  var routeDefs = [
    { pattern: '#/landing',      pageId: 'landing-page',         handler: 'showLandingPage',    isPublic: true },
    { pattern: '#/login',        pageId: 'auth-page',            handler: 'showAuthPage',       isPublic: true },
    { pattern: '#/dashboard',    pageId: 'dashboard-page',       handler: 'showDashboard' },
    { pattern: '#/invoices',     pageId: 'invoices-page',        handler: 'showInvoices' },
    { pattern: '#/create',       pageId: 'create-invoice-page',  handler: 'showCreateInvoice' },
    { pattern: '#/edit/:id',     pageId: 'create-invoice-page',  handler: 'showEditInvoice' },
    { pattern: '#/preview/:id',  pageId: 'preview-invoice-page', handler: 'showPreviewInvoice' },
    { pattern: '#/customers',    pageId: 'customers-page',       handler: 'showCustomers' },
    { pattern: '#/products',     pageId: 'products-page',        handler: 'showProducts' },
    { pattern: '#/settings',     pageId: 'settings-page',        handler: 'showSettings' }
  ];

  var routeMeta = {
    '#/landing': {
      title: 'InvoiceFlow — Professional Invoice Generator',
      desc: 'Create, manage, and download beautiful invoices as PDF. Free, fast, and fully private.'
    },
    '#/login': {
      title: 'Sign In | InvoiceFlow',
      desc: 'Access your InvoiceFlow dashboard, sign in with email or Google, and manage your invoices.'
    },
    '#/dashboard': {
      title: 'Dashboard | InvoiceFlow',
      desc: 'Analyze monthly earnings, check top clients, and see recent activity trends in your dashboard.'
    },
    '#/invoices': {
      title: 'Manage Invoices | InvoiceFlow',
      desc: 'View your invoices, filter by status, and create new client billing bills.'
    },
    '#/create': {
      title: 'New Invoice | InvoiceFlow',
      desc: 'Draft a new professional invoice using customizable layouts and dynamic currencies.'
    },
    '#/edit/:id': {
      title: 'Edit Invoice | InvoiceFlow',
      desc: 'Modify invoice details, edit line items, and adjust taxes or discounts.'
    },
    '#/preview/:id': {
      title: 'Preview Invoice | InvoiceFlow',
      desc: 'Preview the print-ready PDF invoice template, download it locally, or share it.'
    },
    '#/customers': {
      title: 'Client Directory | InvoiceFlow',
      desc: 'Manage your customer list, billing addresses, contact details, and transactions.'
    },
    '#/products': {
      title: 'Product Catalog | InvoiceFlow',
      desc: 'Manage your catalog items, standard prices, and barcode associations.'
    },
    '#/settings': {
      title: 'Settings | InvoiceFlow',
      desc: 'Configure company profile, invoice default currencies, tax defaults, and Cloud Sync.'
    }
  };

  // ── Helpers ──────────────────────────────────────────────────

  /**
   * Parse a route pattern like '#/edit/:id' and return
   * { regex, paramNames } so we can match against the current hash.
   */
  function _parsePattern(pattern) {
    var paramNames = [];
    var regexStr = pattern.replace(/:([^/]+)/g, function (_, name) {
      paramNames.push(name);
      return '([^/]+)';
    });
    return { regex: new RegExp('^' + regexStr + '$'), paramNames: paramNames };
  }

  // Pre-compile patterns once
  var compiledRoutes = [];
  routeDefs.forEach(function (def) {
    var parsed = _parsePattern(def.pattern);
    compiledRoutes.push({
      pattern:    def.pattern,
      pageId:     def.pageId,
      regex:      parsed.regex,
      paramNames: parsed.paramNames,
      handler:    def.handler,
      isPublic:   !!def.isPublic
    });
  });

  // Store extracted params from the last navigate() call
  var currentParams = {};

  // ── showPage — visibility + animation ───────────────────────

  function showPage(pageId) {
    // Hide all pages inside .content
    var contentPages = document.querySelectorAll('.content > .page');
    for (var i = 0; i < contentPages.length; i++) {
      contentPages[i].classList.remove('active', 'page-transition');
      contentPages[i].style.display = 'none';
    }
    var target = document.getElementById(pageId);
    if (target) {
      target.style.display = 'block';
      // Force reflow so the animation replays
      void target.offsetWidth;
      target.classList.add('active', 'page-transition');
    }
  }

  // ── navigate ────────────────────────────────────────────────

  function navigate(hash) {
    hash = hash || window.location.hash || '#/';

    // Default / empty → landing (if not logged in) or dashboard (if logged in)
    if (!hash || hash === '#' || hash === '#/') {
      if (window.Auth && Auth.isLoggedIn()) {
        window.location.hash = '#/dashboard';
      } else {
        window.location.hash = '#/landing';
      }
      return;
    }

    // Auth guard: if logged in and going to login → dashboard
    if (hash === '#/login' && window.Auth && Auth.isLoggedIn()) {
      window.location.hash = '#/dashboard';
      return;
    }

    // Match route
    var matched = null;
    for (var i = 0; i < compiledRoutes.length; i++) {
      var route = compiledRoutes[i];
      var m = hash.match(route.regex);
      if (m) {
        // Extract params
        currentParams = {};
        for (var j = 0; j < route.paramNames.length; j++) {
          currentParams[route.paramNames[j]] = m[j + 1];
        }
        matched = route;
        break;
      }
    }

    if (!matched) {
      // Unknown route → dashboard
      window.location.hash = '#/dashboard';
      return;
    }

    // Protected-route guard
    if (!matched.isPublic) {
      if (window.Auth && !Auth.isLoggedIn()) {
        window.location.hash = '#/login';
        return;
      }
    }

    // Update sidebar active state
    if (window.UI && UI.updateSidebarActive) {
      UI.updateSidebarActive(hash);
    }

    // Show the target page panel
    showPage(matched.pageId);

    // Update Document Title and Meta Description for SEO
    var meta = routeMeta[matched.pattern] || routeMeta['#/landing'];
    document.title = meta.title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', meta.desc);
    }

    // Call the handler function from app.js (e.g., window.showDashboard)
    var handlerFn = window[matched.handler];
    if (typeof handlerFn === 'function') {
      handlerFn();
    }
  }

  // ── getParam ────────────────────────────────────────────────

  function getParam(name) {
    return currentParams[name] || null;
  }

  // ── init ────────────────────────────────────────────────────

  function init() {
    window.addEventListener('hashchange', function () {
      navigate(window.location.hash);
    });
    // Initial navigation
    navigate(window.location.hash);
  }

  // ── Public API ──────────────────────────────────────────────

  return {
    init:      init,
    navigate:  navigate,
    getParam:  getParam,
    showPage:  showPage
  };

})();
