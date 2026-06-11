InvoiceFlow — Modern Invoice Generator
InvoiceFlow is a premium, fully-featured, client-side Single Page Application (SPA) designed to help freelancers, contractors, and small business owners create, manage, and share professional invoices in seconds. It operates entirely inside the browser using IndexedDB for local data storage, ensuring 100% data privacy and speed.

🌟 Key Features
1. Interactive Financial Dashboard
Dynamic Stat Cards: Real-time visibility into Total Revenue, Outstanding balances, Paid invoices, and Draft counts.
Monthly & Yearly Analytics: Visually stunning bar charts showing monthly and yearly revenue performance with smooth micro-animations.
Global Currency Presentation: A dropdown selector lets you instantly convert all dashboard totals and historical charts into your preferred presentation currency (USD, EUR, GBP, INR, CAD, AUD, JPY, SGD) using live exchange rates.
2. Full Invoice Lifecycle
Dynamic Billing Forms: Add, remove, and update invoice line items. Subtotals, tax rates, flat or percentage discounts, and currency changes are calculated automatically in real-time.
Status Controls: Manage cash flow by changing invoice states between Draft, Pending, Paid, and Overdue.
Duplicate Invoices: Clone existing invoices with one click.
3. Professional PDF Design Templates
Real-time Preview Pane: Side-by-side interactive PDF preview frame updates dynamically as details change.
Premium Layouts: Toggle between Classic (minimalist), Modern (indigo accented), and Bold (navy header) styling templates.
Client-side PDF Compilation: Built using pdfmake to compile and export vector-quality PDFs.
4. Smart Sharing Shortcuts
Direct Gmail Link (with Auto-Upload): Compiles the invoice PDF, hosts it securely on a temporary host (tmpfiles.org), and opens a Gmail Web tab with the client email and download link prefilled.
WhatsApp Web Integration: Sends bold, formatted invoice summary texts and download links directly to customer phone numbers.
Native Web Share: Uses the device's native sharing menu to directly attach the raw PDF file to local apps (Slack, Telegram, Mail client, etc.).
5. Contact Directory & Branding Settings
Customer Directory: Save customer emails, billing addresses, and contact numbers. Autocompletes during invoice generation.
Company Profile: Upload your corporate logo (cached in local storage), specify business Tax IDs, websites, and set your default company currency.
Import/Export Data: Fully export all local invoices and customer profiles into a JSON backup file or import them back to migrate across devices.


🛠️ Technology Stack  
Frontend Structure: HTML5 (Semantic elements)  
Styling System: Vanilla CSS3 (Custom properties, CSS variables, Flexbox/Grid, transitions, and slide animations)  
Database: Dexie.js (A wrapper around browser IndexedDB for local-first storage)  
PDF Compilation: pdfmake (Client-side PDF compiler)  
External APIs:  
ExchangeRate-API: For live currency conversion rates.  
tmpfiles.org API: For temporary PDF upload hosting.  
