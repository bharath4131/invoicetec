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
    { pattern: '#/login',        pageId: 'auth-page',            handler: 'showAuthPage',       isPublic: true },
    { pattern: '#/dashboard',    pageId: 'dashboard-page',       handler: 'showDashboard' },
    { pattern: '#/invoices',     pageId: 'invoices-page',        handler: 'showInvoices' },
    { pattern: '#/create',       pageId: 'create-invoice-page',  handler: 'showCreateInvoice' },
    { pattern: '#/edit/:id',     pageId: 'create-invoice-page',  handler: 'showEditInvoice' },
    { pattern: '#/preview/:id',  pageId: 'preview-invoice-page', handler: 'showPreviewInvoice' },
    { pattern: '#/customers',    pageId: 'customers-page',       handler: 'showCustomers' },
    { pattern: '#/settings',     pageId: 'settings-page',        handler: 'showSettings' }
  ];

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

    // Default / empty → dashboard
    if (!hash || hash === '#' || hash === '#/') {
      window.location.hash = '#/dashboard';
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
