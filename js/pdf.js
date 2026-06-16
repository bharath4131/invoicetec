/* ============================================================
   pdf.js — PDF Generation via pdfmake
   Expose: window.PDF
   ============================================================ */

window.PDF = (function () {
  'use strict';

  // ── Color Palettes ──────────────────────────────────────────

  var COLORS = {
    classic: {
      primary:    '#111827',
      secondary:  '#6b7280',
      headerBg:   '#f3f4f6',
      headerText: '#111827',
      border:     '#e5e7eb',
      totalBg:    '#f9fafb',
      accent:     '#374151'
    },
    modern: {
      primary:    '#6366f1',
      secondary:  '#64748b',
      headerBg:   '#6366f1',
      headerText: '#ffffff',
      border:     '#e2e8f0',
      altRow:     '#f9fafb',
      totalBg:    '#6366f1',
      totalText:  '#ffffff',
      accent:     '#6366f1'
    },
    bold: {
      primary:    '#1e1b4b',
      secondary:  '#475569',
      headerBg:   '#1e1b4b',
      headerText: '#ffffff',
      border:     '#1e1b4b',
      totalBg:    '#1e1b4b',
      totalText:  '#ffffff',
      accent:     '#1e1b4b'
    }
  };

  // ── Template List ───────────────────────────────────────────

  function getTemplateList() {
    return [
      { id: 'classic', name: 'Classic', description: 'Clean and minimal' },
      { id: 'modern',  name: 'Modern',  description: 'Colorful with accents' },
      { id: 'bold',    name: 'Bold',    description: 'Dark and striking' }
    ];
  }

  // ── Main Doc-Definition Builder ─────────────────────────────

  function generateDocDefinition(invoice, company, template) {
    template = template || 'classic';
    company  = company  || {};
    var c    = COLORS[template] || COLORS.classic;

    switch (template) {
      case 'modern': return _buildModern(invoice, company, c);
      case 'bold':   return _buildBold(invoice, company, c);
      default:       return _buildClassic(invoice, company, c);
    }
  }

  // ============================================================
  //  CLASSIC TEMPLATE
  // ============================================================

  function _buildClassic(inv, co, c) {
    var content = [];

    // Company + Invoice header row
    var headerLeft = [];
    if (co.logo) {
      headerLeft.push({ image: co.logo, width: 60, margin: [0, 0, 0, 8] });
    }
    headerLeft.push({ text: co.companyName || 'Company', style: 'companyName' });
    headerLeft.push({ text: _companyAddress(co), style: 'companyDetails' });

    var headerRight = [
      { text: 'INVOICE', style: 'invoiceTitle', alignment: 'right' },
      { text: inv.invoiceNumber || '', style: 'invoiceNumber', alignment: 'right', margin: [0, 4, 0, 0] },
      { text: 'Date: ' + _fmtDate(inv.date), alignment: 'right', margin: [0, 4, 0, 0], fontSize: 9, color: c.secondary },
      { text: 'Due: '  + _fmtDate(inv.dueDate), alignment: 'right', margin: [0, 2, 0, 0], fontSize: 9, color: c.secondary }
    ];

    content.push({
      columns: [
        { width: '*', stack: headerLeft },
        { width: 'auto', stack: headerRight }
      ],
      margin: [0, 0, 0, 20]
    });

    // Divider
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: c.border }], margin: [0, 0, 0, 20] });

    // Bill To
    content.push(_billTo(inv, c));

    // Items table
    content.push(_itemsTable(inv, c, 'classic'));

    // Totals
    content.push(_totals(inv, c, 'classic'));

    // Notes
    if (inv.notes) {
      content.push({ text: 'Notes', style: 'sectionLabel', margin: [0, 16, 0, 4] });
      content.push({ text: inv.notes, fontSize: 9, color: c.secondary });
    }

    // Footer
    content.push({ text: 'Thank you for your business!', alignment: 'center', margin: [0, 30, 0, 0], italics: true, color: c.secondary, fontSize: 10 });

    return _wrapDoc(content, c);
  }

  // ============================================================
  //  MODERN TEMPLATE
  // ============================================================

  function _buildModern(inv, co, c) {
    var content = [];

    // Header banner
    var bannerLeft = [];
    if (co.logo) {
      bannerLeft.push({ image: co.logo, width: 50, margin: [0, 0, 0, 6] });
    }
    bannerLeft.push({ text: co.companyName || 'Company', fontSize: 18, bold: true, color: '#ffffff' });
    bannerLeft.push({ text: _companyAddress(co), fontSize: 8, color: '#e0e7ff' });

    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [[
          { stack: bannerLeft, margin: [10, 10, 0, 10] },
          {
            stack: [
              { text: 'INVOICE', fontSize: 22, bold: true, color: '#ffffff', alignment: 'right' },
              { text: inv.invoiceNumber || '', fontSize: 11, color: '#e0e7ff', alignment: 'right', margin: [0, 4, 0, 0] },
              { text: 'Date: ' + _fmtDate(inv.date), fontSize: 9, color: '#e0e7ff', alignment: 'right', margin: [0, 2, 0, 0] },
              { text: 'Due: '  + _fmtDate(inv.dueDate), fontSize: 9, color: '#e0e7ff', alignment: 'right', margin: [0, 2, 0, 0] }
            ],
            margin: [0, 10, 10, 10]
          }
        ]]
      },
      layout: {
        fillColor: function () { return c.primary; },
        hLineWidth: function () { return 0; },
        vLineWidth: function () { return 0; },
        paddingLeft: function () { return 0; },
        paddingRight: function () { return 0; }
      },
      margin: [0, 0, 0, 20]
    });

    // Bill To
    content.push(_billTo(inv, c));

    // Items table
    content.push(_itemsTable(inv, c, 'modern'));

    // Totals
    content.push(_totals(inv, c, 'modern'));

    // Notes
    if (inv.notes) {
      content.push({ text: 'Notes', style: 'sectionLabel', margin: [0, 16, 0, 4], color: c.primary });
      content.push({ text: inv.notes, fontSize: 9, color: c.secondary });
    }

    // Footer
    content.push({ text: 'Thank you for your business!', alignment: 'center', margin: [0, 30, 0, 0], italics: true, color: c.primary, fontSize: 10 });

    return _wrapDoc(content, c);
  }

  // ============================================================
  //  BOLD TEMPLATE
  // ============================================================

  function _buildBold(inv, co, c) {
    var content = [];

    // Dark header block
    var bannerLeft = [];
    if (co.logo) {
      bannerLeft.push({ image: co.logo, width: 50, margin: [0, 0, 0, 6] });
    }
    bannerLeft.push({ text: co.companyName || 'Company', fontSize: 20, bold: true, color: '#ffffff' });
    bannerLeft.push({ text: _companyAddress(co), fontSize: 8, color: '#cbd5e1' });

    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [[
          { stack: bannerLeft, margin: [12, 12, 0, 12] },
          {
            stack: [
              { text: 'INVOICE', fontSize: 28, bold: true, color: '#ffffff', alignment: 'right' },
              { text: inv.invoiceNumber || '', fontSize: 14, bold: true, color: '#e2e8f0', alignment: 'right', margin: [0, 6, 0, 0] },
              { text: 'Date: ' + _fmtDate(inv.date), fontSize: 9, color: '#cbd5e1', alignment: 'right', margin: [0, 4, 0, 0] },
              { text: 'Due: '  + _fmtDate(inv.dueDate), fontSize: 9, color: '#cbd5e1', alignment: 'right', margin: [0, 2, 0, 0] }
            ],
            margin: [0, 12, 12, 12]
          }
        ]]
      },
      layout: {
        fillColor: function () { return c.primary; },
        hLineWidth: function () { return 0; },
        vLineWidth: function () { return 0; },
        paddingLeft: function () { return 0; },
        paddingRight: function () { return 0; }
      },
      margin: [0, 0, 0, 24]
    });

    // Bill To
    content.push(_billTo(inv, c));

    // Items table
    content.push(_itemsTable(inv, c, 'bold'));

    // Totals
    content.push(_totals(inv, c, 'bold'));

    // Notes
    if (inv.notes) {
      content.push({ text: 'Notes', style: 'sectionLabel', margin: [0, 16, 0, 4] });
      content.push({ text: inv.notes, fontSize: 9, color: c.secondary });
    }

    // Footer
    content.push({
      table: {
        widths: ['*'],
        body: [[{ text: 'Thank you for your business!', alignment: 'center', color: '#ffffff', fontSize: 10, italics: true, margin: [0, 8, 0, 8] }]]
      },
      layout: {
        fillColor: function () { return c.primary; },
        hLineWidth: function () { return 0; },
        vLineWidth: function () { return 0; }
      },
      margin: [0, 30, 0, 0]
    });

    return _wrapDoc(content, c);
  }

  // ============================================================
  //  SHARED COMPONENT HELPERS
  // ============================================================

  function _companyAddress(co) {
    var parts = [];
    if (co.address) parts.push(co.address);
    var cityLine = [co.city, co.state, co.zip].filter(Boolean).join(', ');
    if (cityLine) parts.push(cityLine);
    if (co.phone)  parts.push('Phone: ' + co.phone);
    if (co.email)  parts.push(co.email);
    if (co.website) parts.push(co.website);
    if (co.taxId)  parts.push('Tax ID: ' + co.taxId);
    return parts.join('\n');
  }

  function _billTo(inv, c) {
    var cust = inv.customer || {};
    var addr = [cust.address, [cust.city, cust.state, cust.zip].filter(Boolean).join(', '), cust.country].filter(Boolean).join('\n');
    return {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'Bill To', bold: true, fontSize: 10, color: c.accent || c.primary, margin: [0, 0, 0, 4] },
            { text: cust.name  || '', fontSize: 11, bold: true },
            { text: cust.email || '', fontSize: 9, color: c.secondary, margin: [0, 2, 0, 0] },
            { text: cust.phone || '', fontSize: 9, color: c.secondary, margin: [0, 1, 0, 0] },
            { text: addr,            fontSize: 9, color: c.secondary, margin: [0, 2, 0, 0] }
          ]
        },
        {
          width: 'auto',
          stack: [
            { text: 'Status', bold: true, fontSize: 10, color: c.accent || c.primary, alignment: 'right', margin: [0, 0, 0, 4] },
            { text: (inv.status || 'draft').toUpperCase(), fontSize: 11, bold: true, alignment: 'right', color: _statusColor(inv.status) }
          ]
        }
      ],
      margin: [0, 0, 0, 20]
    };
  }

  function _statusColor(status) {
    switch ((status || '').toLowerCase()) {
      case 'paid':      return '#16a34a';
      case 'overdue':   return '#dc2626';
      case 'sent':      return '#2563eb';
      case 'cancelled': return '#6b7280';
      default:          return '#f59e0b';
    }
  }

  // ── Items Table ─────────────────────────────────────────────

  function _itemsTable(inv, c, template) {
    var items = inv.items || [];

    var headerRow = [
      { text: '#',           bold: true, fontSize: 9, color: template === 'classic' ? c.primary : '#ffffff', alignment: 'center' },
      { text: 'Description', bold: true, fontSize: 9, color: template === 'classic' ? c.primary : '#ffffff' },
      { text: 'Qty',         bold: true, fontSize: 9, color: template === 'classic' ? c.primary : '#ffffff', alignment: 'center' },
      { text: 'Unit Price',  bold: true, fontSize: 9, color: template === 'classic' ? c.primary : '#ffffff', alignment: 'right' },
      { text: 'Discount',    bold: true, fontSize: 9, color: template === 'classic' ? c.primary : '#ffffff', alignment: 'center' },
      { text: 'Amount',      bold: true, fontSize: 9, color: template === 'classic' ? c.primary : '#ffffff', alignment: 'right' }
    ];

    var body = [headerRow];

    items.forEach(function (item, idx) {
      var discountText = item.discount ? item.discount + '%' : '0%';
      body.push([
        { text: '' + (idx + 1), fontSize: 9, alignment: 'center', color: c.secondary },
        { text: item.description || '', fontSize: 9 },
        { text: '' + (item.quantity || 0), fontSize: 9, alignment: 'center' },
        { text: _money(item.rate, inv.currency), fontSize: 9, alignment: 'right' },
        { text: discountText, fontSize: 9, alignment: 'center' },
        { text: _money(item.amount, inv.currency), fontSize: 9, alignment: 'right', bold: true }
      ]);
    });

    var layoutDef;
    if (template === 'classic') {
      layoutDef = {
        hLineWidth: function (i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? 0.5 : 0.3; },
        vLineWidth: function ()        { return 0; },
        hLineColor: function (i)       { return i === 1 ? c.primary : c.border; },
        fillColor:  function (i)       { return i === 0 ? c.headerBg : null; },
        paddingTop: function ()        { return 6; },
        paddingBottom: function ()     { return 6; }
      };
    } else if (template === 'modern') {
      layoutDef = {
        hLineWidth: function ()  { return 0; },
        vLineWidth: function ()  { return 0; },
        fillColor:  function (i) { return i === 0 ? c.headerBg : (i % 2 === 0 ? c.altRow : '#ffffff'); },
        paddingTop: function ()    { return 7; },
        paddingBottom: function () { return 7; }
      };
    } else {
      // bold
      layoutDef = {
        hLineWidth: function (i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5; },
        vLineWidth: function ()        { return 0; },
        hLineColor: function ()        { return c.primary; },
        fillColor:  function (i)       { return i === 0 ? c.headerBg : null; },
        paddingTop: function ()        { return 7; },
        paddingBottom: function ()     { return 7; }
      };
    }

    return {
      table: {
        headerRows: 1,
        widths: [20, '*', 35, 60, 45, 65],
        body: body
      },
      layout: layoutDef,
      margin: [0, 0, 0, 10]
    };
  }

  // ── Totals ──────────────────────────────────────────────────

  function _totals(inv, c, template) {
    var rows = [];

    rows.push([
      { text: 'Subtotal', alignment: 'right', fontSize: 9, color: c.secondary },
      { text: _money(inv.subtotal, inv.currency), alignment: 'right', fontSize: 9 }
    ]);

    if (inv.taxRate) {
      rows.push([
        { text: 'Tax (' + inv.taxRate + '%)', alignment: 'right', fontSize: 9, color: c.secondary },
        { text: _money(inv.taxAmount, inv.currency), alignment: 'right', fontSize: 9 }
      ]);
    }

    if (inv.discountAmount) {
      var discLabel = 'Discount';
      if (inv.discountType === 'percentage') {
        discLabel += ' (' + inv.discountValue + '%)';
      }
      rows.push([
        { text: discLabel, alignment: 'right', fontSize: 9, color: c.secondary },
        { text: '-' + _money(inv.discountAmount, inv.currency), alignment: 'right', fontSize: 9, color: '#dc2626' }
      ]);
    }

    // Total row
    var totalRowStyle;
    if (template === 'modern' || template === 'bold') {
      totalRowStyle = [
        { text: 'TOTAL', alignment: 'right', fontSize: 11, bold: true, color: c.totalText || '#ffffff' },
        { text: _money(inv.total, inv.currency), alignment: 'right', fontSize: 11, bold: true, color: c.totalText || '#ffffff' }
      ];
    } else {
      totalRowStyle = [
        { text: 'TOTAL', alignment: 'right', fontSize: 11, bold: true, color: c.primary },
        { text: _money(inv.total, inv.currency), alignment: 'right', fontSize: 11, bold: true, color: c.primary }
      ];
    }
    rows.push(totalRowStyle);

    return {
      table: {
        widths: ['*', 80],
        body: rows
      },
      layout: {
        hLineWidth: function (i, node) { return (i === node.table.body.length - 1) ? 0.8 : 0; },
        vLineWidth: function () { return 0; },
        hLineColor: function () { return c.border; },
        fillColor: function (i, node) {
          if (i === node.table.body.length - 1) {
            return (template === 'modern' || template === 'bold') ? c.totalBg : c.totalBg;
          }
          return null;
        },
        paddingTop:    function () { return 5; },
        paddingBottom: function () { return 5; }
      },
      margin: [250, 0, 0, 0]
    };
  }

  // ── Utility ─────────────────────────────────────────────────

  function _money(v, currencyCode) {
    var n = parseFloat(v) || 0;
    currencyCode = currencyCode || 'USD';
    var symbols = {
      USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'CA$', AUD: 'A$', JPY: '¥', SGD: 'S$'
    };
    var sym = symbols[currencyCode] || '$';
    return sym + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function _fmtDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var day = d.getDate();
    return months[d.getMonth()] + ' ' + (day < 10 ? '0' + day : day) + ', ' + d.getFullYear();
  }

  function _wrapDoc(content, c) {
    return {
      pageSize:    'A4',
      pageMargins: [40, 60, 40, 60],
      content:     content,
      defaultStyle: { fontSize: 10 },
      styles: {
        companyName:    { fontSize: 16, bold: true, color: c.primary },
        companyDetails: { fontSize: 8, color: c.secondary, lineHeight: 1.4 },
        invoiceTitle:   { fontSize: 22, bold: true, color: c.accent || c.primary },
        invoiceNumber:  { fontSize: 11, color: c.secondary },
        sectionLabel:   { fontSize: 10, bold: true, color: c.primary }
      }
    };
  }

  // ── Public Actions ──────────────────────────────────────────

  function download(invoice, company, template) {
    var docDef = generateDocDefinition(invoice, company, template);
    pdfMake.createPdf(docDef).download((invoice.invoiceNumber || 'invoice') + '.pdf');
  }

  function preview(invoice, company, template) {
    var docDef = generateDocDefinition(invoice, company, template);
    pdfMake.createPdf(docDef).getDataUrl(function (dataUrl) {
      var iframe = document.getElementById('pdf-preview-frame');
      if (iframe) {
        iframe.src = dataUrl;
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────

  return {
    generateDocDefinition: generateDocDefinition,
    download:              download,
    preview:               preview,
    getTemplateList:       getTemplateList
  };

})();
