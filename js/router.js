/* ============================================================
   router.js — HTML5 History API SPA Router
   Expose: window.Router
   ============================================================ */

window.Router = (function () {
  'use strict';

  // ── Route definitions ───────────────────────────────────────
  // Maps URL paths to { pageId, handler }
  var routeDefs = [
    { pattern: '/',             pageId: 'landing-page',         handler: 'showLandingPage',    isPublic: true },
    { pattern: '/login',        pageId: 'auth-page',            handler: 'showAuthPage',       isPublic: true },
    { pattern: '/dashboard',    pageId: 'dashboard-page',       handler: 'showDashboard' },
    { pattern: '/invoices',     pageId: 'invoices-page',        handler: 'showInvoices' },
    { pattern: '/create',       pageId: 'create-invoice-page',  handler: 'showCreateInvoice',  isPublic: true },
    { pattern: '/edit/:id',     pageId: 'create-invoice-page',  handler: 'showEditInvoice',    isPublic: true },
    { pattern: '/preview/:id',  pageId: 'preview-invoice-page', handler: 'showPreviewInvoice', isPublic: true },
    { pattern: '/customers',    pageId: 'customers-page',       handler: 'showCustomers' },
    { pattern: '/products',     pageId: 'products-page',        handler: 'showProducts' },
    { pattern: '/settings',     pageId: 'settings-page',        handler: 'showSettings' },
    { pattern: '/guide/how-to-write-an-invoice', pageId: 'guide-invoice-page', handler: 'showGuideInvoicePage', isPublic: true },
    { pattern: '/guide/payment-terms-explained', pageId: 'guide-terms-page',    handler: 'showGuideTermsPage',    isPublic: true },
    { pattern: '/generator/software-developer', pageId: 'landing-page',        handler: 'showDeveloperGenerator', isPublic: true },
    { pattern: '/generator/graphic-designer',   pageId: 'landing-page',        handler: 'showDesignerGenerator',  isPublic: true },
    { pattern: '/generator/photographer',       pageId: 'landing-page',        handler: 'showPhotographerGenerator', isPublic: true },
    { pattern: '/tools/rate-calculator',        pageId: 'tools-rate-page',     handler: 'showRateCalculator', isPublic: true },
    { pattern: '/hourly-rate-calculator',        pageId: 'tools-rate-page',     handler: 'showRateCalculator', isPublic: true },
    { pattern: '/blog/how-to-write-invoice',     pageId: 'guide-invoice-page',  handler: 'showGuideInvoicePage', isPublic: true },
    { pattern: '/blog/payment-terms-explained',  pageId: 'guide-terms-page',    handler: 'showGuideTermsPage',    isPublic: true },
    { pattern: '/privacy',                       pageId: 'privacy-page',        handler: 'showPrivacyPage',       isPublic: true },
    { pattern: '/tools/time-tracker',            pageId: 'tools-time-tracker-page', handler: 'showPublicTimeTracker', isPublic: true }
  ];

  var routeMeta = {
    '/': {
      title: 'InvoiceTec — Professional Invoice Generator',
      desc: 'Create, manage, and download beautiful invoices as PDF. Free, fast, and fully private.'
    },
    '/login': {
      title: 'Sign In | InvoiceTec',
      desc: 'Access your InvoiceTec dashboard, sign in with email or Google, and manage your invoices.'
    },
    '/dashboard': {
      title: 'Dashboard | InvoiceTec',
      desc: 'Analyze monthly earnings, check top clients, and see recent activity trends in your dashboard.'
    },
    '/invoices': {
      title: 'Manage Invoices | InvoiceTec',
      desc: 'View your invoices, filter by status, and create new client billing bills.'
    },
    '/create': {
      title: 'New Invoice | InvoiceTec',
      desc: 'Draft a new professional invoice using customizable layouts and dynamic currencies.'
    },
    '/edit/:id': {
      title: 'Edit Invoice | InvoiceTec',
      desc: 'Modify invoice details, edit line items, and adjust taxes or discounts.'
    },
    '/preview/:id': {
      title: 'Preview Invoice | InvoiceTec',
      desc: 'Preview the print-ready PDF invoice template, download it locally, or share it.'
    },
    '/customers': {
      title: 'Client Directory | InvoiceTec',
      desc: 'Manage your customer list, billing addresses, contact details, and transactions.'
    },
    '/products': {
      title: 'Product Catalog | InvoiceTec',
      desc: 'Manage your catalog items, standard prices, and barcode associations.'
    },
    '/settings': {
      title: 'Settings | InvoiceTec',
      desc: 'Configure company profile, invoice default currencies, tax defaults, and Cloud Sync.'
    },
    '/guide/how-to-write-an-invoice': {
      title: 'How to Write an Invoice: Free Guide for Freelancers | InvoiceTec',
      desc: 'Learn step-by-step how to write a professional invoice. Discover required billing fields, layout choices, and payment terms to get paid faster.'
    },
    '/guide/payment-terms-explained': {
      title: 'Invoice Payment Terms Explained: Net 30, Net 15 & More | InvoiceTec',
      desc: 'Understand invoice payment terms. Learn what Net 30, Net 15, PIA, and COD mean, and how to choose the right terms for your freelance business.'
    },
    '/generator/software-developer': {
      title: 'Free Invoice Generator for Software Developers & Engineers | InvoiceTec',
      desc: 'Create, manage, and download professional developer invoices. Local-first, private billing templates built for programmers and dev agencies.'
    },
    '/generator/graphic-designer': {
      title: 'Free Invoice Generator for Graphic Designers & Creatives | InvoiceTec',
      desc: 'Create beautiful design invoices for your clients. Elegant, private invoice templates built for freelance designers and branding studios.'
    },
    '/generator/photographer': {
      title: 'Free Photography Invoice Generator & Receipt Maker | InvoiceTec',
      desc: 'Draft photography invoices instantly. Choose templates, manage customer listings, and generate print-ready PDF invoices for photo shoots.'
    },
    '/tools/rate-calculator': {
      title: 'Free Freelance Hourly Rate Calculator | InvoiceTec',
      desc: 'Calculate your ideal freelance hourly and daily rate based on desired income, taxes, vacation time, and business expenses. Free pricing calculator for freelancers.'
    },
    '/hourly-rate-calculator': {
      title: 'Free Freelance Hourly Rate Calculator | InvoiceTec',
      desc: 'Calculate your ideal freelance hourly and daily rate based on desired income, taxes, vacation time, and business expenses. Free pricing calculator for freelancers.'
    },
    '/blog/how-to-write-invoice': {
      title: 'How to Write an Invoice: Free Guide for Freelancers | InvoiceTec',
      desc: 'Learn step-by-step how to write a professional invoice. Discover required billing fields, layout choices, and payment terms to get paid faster.'
    },
    '/blog/payment-terms-explained': {
      title: 'Invoice Payment Terms Explained: Net 30, Net 15 & More | InvoiceTec',
      desc: 'Understand invoice payment terms. Learn what Net 30, Net 15, PIA, and COD mean, and how to choose the right terms for your freelance business.'
    },
    '/privacy': {
      title: 'Privacy Policy & Local-First Security | InvoiceTec',
      desc: 'Learn about our local-first browser storage structure using IndexedDB, our Wave/Zoho comparisons, and our offline BIP-39 recovery seed verification.'
    },
    '/tools/time-tracker': {
      title: 'Free Freelancer Time Tracker | InvoiceTec',
      desc: 'Track billable client hours offline. Save task duration, rate per hour, and export logs to invoice sandbox in one click.'
    }
  };

  // ── Helpers ──────────────────────────────────────────────────

  /**
   * Parse a route pattern like '/edit/:id' and return
   * { regex, paramNames } so we can match against the current pathname.
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

  function navigate(path) {
    path = path || window.location.pathname + window.location.search || '/';

    // Separate pathname and query/search string
    var cleanPath = path;
    var qIndex = path.indexOf('?');
    if (qIndex !== -1) {
      cleanPath = path.substring(0, qIndex);
    }

    // If path is exactly /landing, redirect to /
    if (cleanPath === '/landing') {
      go('/');
      return;
    }

    // Default / empty → dashboard (if logged in) or stay on / (if guest)
    if (!cleanPath || cleanPath === '/' || cleanPath === '/index.html') {
      if (window.Auth && Auth.isLoggedIn()) {
        go('/dashboard');
        return;
      }
      cleanPath = '/';
    }

    // Auth guard: if logged in and going to login → dashboard
    if (cleanPath === '/login' && window.Auth && Auth.isLoggedIn()) {
      go('/dashboard');
      return;
    }

    // Match route
    var matched = null;
    for (var i = 0; i < compiledRoutes.length; i++) {
      var route = compiledRoutes[i];
      var m = cleanPath.match(route.regex);
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
      go('/dashboard');
      return;
    }

    // Protected-route guard
    if (!matched.isPublic) {
      if (window.Auth && !Auth.isLoggedIn()) {
        go('/login');
        return;
      }
    }

    // Update sidebar active state
    if (window.UI && UI.updateSidebarActive) {
      UI.updateSidebarActive(cleanPath);
    }

    // Show the target page panel
    showPage(matched.pageId);

    // Update Document Title and Meta Description for SEO
    var meta = routeMeta[matched.pattern] || routeMeta['/'];
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

  // ── go (history navigation) ─────────────────────────────────

  function go(path) {
    var currentPath = window.location.pathname + window.location.search;
    if (currentPath !== path) {
      window.history.pushState(null, '', path);
    }
    navigate(path);
  }

  // ── getParam ────────────────────────────────────────────────

  function getParam(name) {
    return currentParams[name] || null;
  }

  // ── getQueryParam ───────────────────────────────────────────

  function getQueryParam(name) {
    var search = window.location.search;
    if (!search) {
      var qIndex = window.location.href.indexOf('?');
      if (qIndex !== -1) {
        search = window.location.href.substring(qIndex);
      }
    }
    if (!search) return null;
    var params = new URLSearchParams(search);
    return params.get(name);
  }

  // ── init ────────────────────────────────────────────────────

  function init() {
    window.addEventListener('popstate', function () {
      navigate(window.location.pathname + window.location.search);
    });

    // Intercept internal relative anchor links for smooth SPA navigation
    document.addEventListener('click', function (e) {
      var target = e.target.closest('a');
      if (target) {
        var href = target.getAttribute('href');
        // Handle path routes starting with '/' (but not external links)
        if (href && href.startsWith('/') && !href.startsWith('//')) {
          e.preventDefault();
          go(href);
        }
      }
    });

    // Initial navigation
    navigate(window.location.pathname + window.location.search);
  }

  // ── Public API ──────────────────────────────────────────────

  return {
    init:      init,
    navigate:  navigate,
    go:        go,
    getParam:  getParam,
    getQueryParam: getQueryParam,
    showPage:  showPage
  };

})();
