/* ============================================================
   pdf.js — PDF Generation via pdfmake
   Expose: window.PDF
   ============================================================ */

window.PDF = (function () {
  'use strict';

  if (typeof pdfMake !== 'undefined') {
    pdfMake.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italic: 'Roboto-Italic.ttf',
        bolditalic: 'Roboto-MediumItalic.ttf'
      },
      Helvetica: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italic: 'Roboto-Italic.ttf',
        bolditalic: 'Roboto-MediumItalic.ttf'
      },
      'Times-Roman': {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italic: 'Roboto-Italic.ttf',
        bolditalic: 'Roboto-MediumItalic.ttf'
      },
      Courier: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italic: 'Roboto-Italic.ttf',
        bolditalic: 'Roboto-MediumItalic.ttf'
      }
    };
  }

  var currentPreviewUrl = null;

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
    var baseColor = COLORS[template] || COLORS.classic;
    var c = Object.assign({}, baseColor);

    if (invoice.accentColor) {
      c.primary = invoice.accentColor;
      c.accent = invoice.accentColor;
      if (template === 'modern') {
        c.headerBg = invoice.accentColor;
        c.totalBg = invoice.accentColor;
      } else if (template === 'bold') {
        c.headerBg = invoice.accentColor;
        c.border = invoice.accentColor;
        c.totalBg = invoice.accentColor;
      }
    }

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

    // Header left (logo if exists) & right (meta info)
    var headerLeft = [];
    if (co.logo) {
      headerLeft.push({ image: co.logo, width: 60 });
    }

    var headerRight = [
      { text: 'INVOICE', style: 'invoiceTitle', alignment: 'right' },
      { text: inv.invoiceNumber || '', style: 'invoiceNumber', alignment: 'right', margin: [0, 4, 0, 0] },
      { text: 'Date: ' + _fmtDate(inv.date), alignment: 'right', margin: [0, 4, 0, 0], fontSize: 8.5, color: '#475569' },
      { text: 'Due: '  + _fmtDate(inv.dueDate), alignment: 'right', margin: [0, 2, 0, 0], fontSize: 8.5, color: '#475569' }
    ];

    content.push({
      columns: [
        { width: '*', stack: headerLeft },
        { width: 'auto', stack: headerRight }
      ],
      margin: [0, 0, 0, 20]
    });

    // Divider
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 0, 0, 20] });

    // Side-by-side addresses
    content.push(_addressesBlock(inv, co, c));

    // Items table
    content.push(_itemsTable(inv, c, 'classic'));

    // Totals
    content.push(_totals(inv, c, 'classic'));

    // Notes
    if (inv.notes) {
      content.push({ text: 'NOTES', style: 'sectionLabel', margin: [0, 20, 0, 6] });
      content.push({ text: inv.notes, fontSize: 8.5, color: '#475569', lineHeight: 1.4 });
    }

    return _wrapDoc(content, c, inv.fontFamily, inv.showWatermark);
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
    bannerLeft.push({ text: co.companyName || 'Company', fontSize: 13, bold: true, color: '#ffffff' });

    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [[
          { stack: bannerLeft, margin: [15, 15, 0, 15] },
          {
            stack: [
              { text: 'INVOICE', fontSize: 20, bold: true, color: '#ffffff', alignment: 'right' },
              { text: inv.invoiceNumber || '', fontSize: 11, bold: true, color: '#ffffff', alignment: 'right', margin: [0, 4, 0, 0] },
              { text: 'Date: ' + _fmtDate(inv.date), fontSize: 8.5, color: '#ffffff', alignment: 'right', margin: [0, 4, 0, 0], opacity: 0.95 },
              { text: 'Due: '  + _fmtDate(inv.dueDate), fontSize: 8.5, color: '#ffffff', alignment: 'right', margin: [0, 2, 0, 0], opacity: 0.95 }
            ],
            margin: [0, 15, 15, 15]
          }
        ]]
      },
      layout: {
        fillColor: function () { return c.primary; },
        hLineWidth: function () { return 0; },
        vLineWidth: function () { return 0; }
      },
      margin: [0, 0, 0, 25]
    });

    // Side-by-side addresses
    content.push(_addressesBlock(inv, co, c));

    // Items table
    content.push(_itemsTable(inv, c, 'modern'));

    // Totals
    content.push(_totals(inv, c, 'modern'));

    // Notes
    if (inv.notes) {
      content.push({ text: 'NOTES', style: 'sectionLabel', margin: [0, 20, 0, 6] });
      content.push({ text: inv.notes, fontSize: 8.5, color: '#475569', lineHeight: 1.4 });
    }

    return _wrapDoc(content, c, inv.fontFamily, inv.showWatermark);
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
    bannerLeft.push({ text: co.companyName || 'Company', fontSize: 13, bold: true, color: '#ffffff' });

    content.push({
      table: {
        widths: ['*', 'auto'],
        body: [[
          { stack: bannerLeft, margin: [15, 15, 0, 15] },
          {
            stack: [
              { text: 'INVOICE', fontSize: 22, bold: true, color: '#ffffff', alignment: 'right' },
              { text: inv.invoiceNumber || '', fontSize: 11, bold: true, color: '#ffffff', alignment: 'right', margin: [0, 4, 0, 0] },
              { text: 'Date: ' + _fmtDate(inv.date), fontSize: 8.5, color: '#cbd5e1', alignment: 'right', margin: [0, 4, 0, 0] },
              { text: 'Due: '  + _fmtDate(inv.dueDate), fontSize: 8.5, color: '#cbd5e1', alignment: 'right', margin: [0, 2, 0, 0] }
            ],
            margin: [0, 15, 15, 15]
          }
        ]]
      },
      layout: {
        fillColor: function () { return '#1e293b'; },
        hLineWidth: function () { return 0; },
        vLineWidth: function () { return 0; }
      },
      margin: [0, 0, 0, 25]
    });

    // Side-by-side addresses
    content.push(_addressesBlock(inv, co, c));

    // Items table
    content.push(_itemsTable(inv, c, 'bold'));

    // Totals
    content.push(_totals(inv, c, 'bold'));

    // Notes
    if (inv.notes) {
      content.push({ text: 'NOTES', style: 'sectionLabel', margin: [0, 20, 0, 6] });
      content.push({ text: inv.notes, fontSize: 8.5, color: '#475569', lineHeight: 1.4 });
    }

    return _wrapDoc(content, c, inv.fontFamily, inv.showWatermark);
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

  function _addressesBlock(inv, co, c) {
    var cust = inv.customer || {};
    var custAddr = [cust.address, [cust.city, cust.state, cust.zip].filter(Boolean).join(', '), cust.country].filter(Boolean).join('\n');
    var coAddr = [co.address, [co.city, co.state, co.zip].filter(Boolean).join(', '), co.country].filter(Boolean).join('\n');

    return {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'BILL TO', style: 'sectionLabel', margin: [0, 0, 0, 6] },
            { text: cust.name || 'Valued Customer', style: 'addressName' },
            { text: [cust.email, cust.phone, custAddr].filter(Boolean).join('\n'), style: 'addressDetails', margin: [0, 2, 0, 0] }
          ]
        },
        {
          width: '*',
          stack: [
            { text: 'FROM', style: 'sectionLabel', margin: [0, 0, 0, 6] },
            { text: co.companyName || 'Company', style: 'addressName' },
            { text: [co.email, co.phone, coAddr].filter(Boolean).join('\n'), style: 'addressDetails', margin: [0, 2, 0, 0] }
          ]
        },
        {
          width: 'auto',
          stack: [
            { text: 'STATUS', style: 'sectionLabel', alignment: 'right', margin: [0, 0, 0, 6] },
            _statusBadge(inv.status)
          ]
        }
      ],
      margin: [0, 0, 0, 25]
    };
  }

  function _statusBadge(status) {
    var stat = (status || 'draft').toUpperCase();
    var bg, textCol;
    switch (stat.toLowerCase()) {
      case 'paid':
        bg = '#eafaf1'; textCol = '#16a34a'; break;
      case 'overdue':
        bg = '#fef2f2'; textCol = '#dc2626'; break;
      case 'sent':
        bg = '#eff6ff'; textCol = '#2563eb'; break;
      case 'cancelled':
        bg = '#f3f4f6'; textCol = '#6b7280'; break;
      default:
        bg = '#fffbeb'; textCol = '#d97706'; break;
    }
    return {
      table: {
        widths: ['auto'],
        body: [[
          { text: stat, fontSize: 8, bold: true, color: textCol, margin: [8, 4, 8, 4], alignment: 'center' }
        ]]
      },
      layout: {
        fillColor: function () { return bg; },
        hLineWidth: function () { return 0; },
        vLineWidth: function () { return 0; }
      },
      alignment: 'right'
    };
  }

  // ── Items Table ─────────────────────────────────────────────

  function _itemsTable(inv, c, template) {
    var items = inv.items || [];
    var isDarkHeader = (template === 'modern' || template === 'bold');

    var headerRow = [
      { text: '#',           style: 'tableHeader', alignment: 'center', color: isDarkHeader ? '#ffffff' : '#475569' },
      { text: 'DESCRIPTION', style: 'tableHeader', color: isDarkHeader ? '#ffffff' : '#475569' },
      { text: 'QTY',         style: 'tableHeader', alignment: 'center', color: isDarkHeader ? '#ffffff' : '#475569' },
      { text: 'UNIT PRICE',  style: 'tableHeader', alignment: 'right', color: isDarkHeader ? '#ffffff' : '#475569' },
      { text: 'DISCOUNT',    style: 'tableHeader', alignment: 'center', color: isDarkHeader ? '#ffffff' : '#475569' },
      { text: 'AMOUNT',      style: 'tableHeader', alignment: 'right', color: isDarkHeader ? '#ffffff' : '#475569' }
    ];

    var body = [headerRow];

    items.forEach(function (item, idx) {
      var discountText = item.discount ? item.discount + '%' : '0%';
      body.push([
        { text: '' + (idx + 1), style: 'tableCell', alignment: 'center', color: '#475569' },
        { text: item.description || '', style: 'tableCell' },
        { text: '' + (item.quantity || 0), style: 'tableCell', alignment: 'center' },
        { text: _money(item.rate, inv.currency), style: 'tableCell', alignment: 'right' },
        { text: discountText, style: 'tableCell', alignment: 'center' },
        { text: _money(item.amount, inv.currency), style: 'tableCellBold', alignment: 'right' }
      ]);
    });

    var layoutDef;
    if (template === 'classic') {
      layoutDef = {
        hLineWidth: function (i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5; },
        vLineWidth: function ()        { return 0; },
        hLineColor: function (i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? '#cbd5e1' : '#f1f5f9'; },
        fillColor:  function (i)       { return i === 0 ? '#f8fafc' : null; },
        paddingTop: function ()        { return 8; },
        paddingBottom: function ()     { return 8; }
      };
    } else if (template === 'modern') {
      layoutDef = {
        hLineWidth: function (i, node) { return i === node.table.body.length ? 1 : 0; },
        vLineWidth: function ()  { return 0; },
        hLineColor: function ()  { return '#e2e8f0'; },
        fillColor:  function (i) { return i === 0 ? c.headerBg : (i % 2 === 0 ? '#f8fafc' : '#ffffff'); },
        paddingTop: function ()    { return 8; },
        paddingBottom: function () { return 8; }
      };
    } else {
      // bold
      layoutDef = {
        hLineWidth: function (i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5; },
        vLineWidth: function ()        { return 0; },
        hLineColor: function (i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? '#0f172a' : '#cbd5e1'; },
        fillColor:  function (i)       { return i === 0 ? c.headerBg : null; },
        paddingTop: function ()        { return 8; },
        paddingBottom: function ()     { return 8; }
      };
    }

    return {
      table: {
        headerRows: 1,
        widths: [20, '*', 35, 60, 45, 65],
        body: body
      },
      layout: layoutDef,
      margin: [0, 0, 0, 15]
    };
  }

  // ── Totals ──────────────────────────────────────────────────

  function _totals(inv, c, template) {
    var rows = [];

    rows.push([
      { text: 'Subtotal', style: 'totalLabel' },
      { text: _money(inv.subtotal, inv.currency), style: 'totalVal' }
    ]);

    if (inv.taxRate) {
      rows.push([
        { text: 'Tax (' + inv.taxRate + '%)', style: 'totalLabel' },
        { text: _money(inv.taxAmount, inv.currency), style: 'totalVal' }
      ]);
    }

    if (inv.discountAmount) {
      var discLabel = 'Discount';
      if (inv.discountType === 'percentage') {
        discLabel += ' (' + inv.discountValue + '%)';
      }
      rows.push([
        { text: discLabel, style: 'totalLabel' },
        { text: '-' + _money(inv.discountAmount, inv.currency), style: 'totalVal', color: '#dc2626' }
      ]);
    }

    // Total row
    var totalRowStyle;
    if (template === 'modern' || template === 'bold') {
      totalRowStyle = [
        { text: 'TOTAL DUE', style: 'grandTotalLabel', color: '#ffffff' },
        { text: _money(inv.total, inv.currency), style: 'grandTotalVal', color: '#ffffff' }
      ];
    } else {
      totalRowStyle = [
        { text: 'TOTAL DUE', style: 'grandTotalLabel' },
        { text: _money(inv.total, inv.currency), style: 'grandTotalVal', color: c.primary }
      ];
    }
    rows.push(totalRowStyle);

    return {
      table: {
        widths: ['*', 90],
        body: rows
      },
      layout: {
        hLineWidth: function (i, node) { return (i === node.table.body.length - 1) ? 1.5 : 0; },
        vLineWidth: function () { return 0; },
        hLineColor: function (i, node) { return (i === node.table.body.length - 1) ? c.primary : '#cbd5e1'; },
        fillColor: function (i, node) {
          if (i === node.table.body.length - 1) {
            return (template === 'modern' || template === 'bold') ? c.primary : null;
          }
          return null;
        },
        paddingTop:    function () { return 6; },
        paddingBottom: function () { return 6; }
      },
      margin: [250, 10, 0, 0]
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

  function _wrapDoc(content, c, fontFamily, showWatermark) {
    var pdfFont = 'Roboto';
    if (fontFamily) {
      var fontLower = fontFamily.toLowerCase();
      if (fontLower.indexOf('inter') !== -1 || fontLower.indexOf('outfit') !== -1) {
        pdfFont = 'Helvetica';
      } else if (fontLower.indexOf('playfair') !== -1 || fontLower.indexOf('lora') !== -1) {
        pdfFont = 'Times-Roman';
      } else if (fontLower.indexOf('jetbrains') !== -1 || fontLower.indexOf('mono') !== -1) {
        pdfFont = 'Courier';
      }
    }

    var footerFn = function (currentPage, pageCount) {
      if (showWatermark === false) {
        return null;
      }
      return {
        text: 'Created with InvoiceTec — Professional Local-First Invoices',
        alignment: 'center',
        fontSize: 7.5,
        color: '#94a3b8',
        margin: [40, 30, 40, 0]
      };
    };

    return {
      pageSize:    'A4',
      pageMargins: [40, 60, 40, 80],
      content:     content,
      defaultStyle: { fontSize: 9.5, font: pdfFont },
      styles: {
        companyName:    { fontSize: 13, bold: true, color: '#0f172a', font: pdfFont },
        companyDetails: { fontSize: 8.5, color: '#475569', lineHeight: 1.35, font: pdfFont },
        invoiceTitle:   { fontSize: 20, bold: true, color: '#0f172a', font: pdfFont },
        invoiceNumber:  { fontSize: 11, bold: true, color: '#475569', font: pdfFont },
        sectionLabel:   { fontSize: 7.5, bold: true, color: '#64748b', font: pdfFont },
        addressName:    { fontSize: 9.5, bold: true, color: '#0f172a', font: pdfFont },
        addressDetails: { fontSize: 8.5, color: '#475569', lineHeight: 1.35, font: pdfFont },
        tableHeader:    { fontSize: 8.5, bold: true, color: '#1e293b', font: pdfFont },
        tableCell:      { fontSize: 8.5, bold: true, color: '#0f172a', font: pdfFont },
        tableCellBold:  { fontSize: 8.5, bold: true, color: '#0f172a', font: pdfFont },
        totalLabel:     { fontSize: 9, bold: true, color: '#334155', font: pdfFont },
        totalVal:       { fontSize: 9, bold: true, color: '#0f172a', font: pdfFont },
        grandTotalLabel:{ fontSize: 11, bold: true, color: '#0f172a', font: pdfFont },
        grandTotalVal:  { fontSize: 11, bold: true, color: c.primary, font: pdfFont }
      },
      footer: footerFn
    };
  }

  // ── Public Actions ──────────────────────────────────────────

  function showErrorInPreview(msg) {
    var iframe = document.getElementById('pdf-preview-frame');
    if (iframe) {
      try {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write('<div style="color:#ef4444;font-family:system-ui,sans-serif;padding:24px;background:#fef2f2;border:1px solid #fee2e2;border-radius:8px;margin:20px;">' +
                  '<h3 style="margin-top:0;">PDF Preview Generation Failed</h3>' +
                  '<p style="font-size:14px;line-height:1.5;">' + msg + '</p>' +
                  '</div>');
        doc.close();
      } catch (e) {
        alert(msg);
      }
    } else {
      alert(msg);
    }
  }

  function openPdf(invoice, company, template) {
    try {
      if (typeof pdfMake === 'undefined') {
        throw new Error('pdfMake library is not loaded. Check your internet connection.');
      }
      var docDef = generateDocDefinition(invoice, company, template);
      pdfMake.createPdf(docDef).open();
    } catch (err) {
      console.error('[PDF ERROR] open failed:', err);
      alert('Failed to open PDF: ' + err.message);
    }
  }

  function download(invoice, company, template) {
    try {
      if (typeof pdfMake === 'undefined') {
        throw new Error('pdfMake library is not loaded. Check your internet connection.');
      }
      var docDef = generateDocDefinition(invoice, company, template);
      pdfMake.createPdf(docDef).download((invoice.invoiceNumber || 'invoice') + '.pdf');
    } catch (err) {
      console.error('[PDF ERROR] download failed:', err);
      alert('Failed to download PDF: ' + err.message);
    }
  }

  function preview(invoice, company, template) {
    try {
      if (typeof pdfMake === 'undefined') {
        throw new Error('pdfMake library is not loaded. Please verify CDN script connections.');
      }
      if (!pdfMake.vfs) {
        throw new Error('pdfMake virtual file system (vfs) is not initialized. Please ensure vfs_fonts.js loads.');
      }

      console.log('[PDF DEBUG] pdfMake.vfs keys:', Object.keys(pdfMake.vfs));

      var docDef = generateDocDefinition(invoice, company, template);
      var pdfDoc = pdfMake.createPdf(docDef);
      pdfDoc.getBlob(function (blob) {
        var iframe = document.getElementById('pdf-preview-frame');
        if (iframe) {
          if (currentPreviewUrl) {
            try {
              URL.revokeObjectURL(currentPreviewUrl);
            } catch (e) {
              console.warn('[PDF] Failed to revoke old preview URL:', e);
            }
          }
          currentPreviewUrl = URL.createObjectURL(blob);
          iframe.src = currentPreviewUrl;
        }
      });
    } catch (err) {
      console.error('[PDF ERROR] preview failed:', err);
      showErrorInPreview(err.message);
    }
  }

  // ── Public API ──────────────────────────────────────────────

  return {
    generateDocDefinition: generateDocDefinition,
    download:              download,
    open:                  openPdf,
    preview:               preview,
    getTemplateList:       getTemplateList
  };

})();
