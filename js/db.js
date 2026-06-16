/* ============================================================
   db.js — Dexie Database Initialization
   Invoice Generator Application
   ============================================================ */

const db = new Dexie('InvoiceGeneratorDB');

db.version(1).stores({
  users: '++id, &email, name',
  companyProfiles: '++id, userId',
  customers: '++id, userId, name, email',
  invoices: '++id, userId, customerId, invoiceNumber, date, dueDate, status, [userId+status]',
  invoiceItems: '++id, invoiceId',
  settings: '++id, userId'
});

db.version(2).stores({
  users: '++id, &email, name',
  companyProfiles: '++id, userId',
  customers: '++id, userId, name, email',
  invoices: '++id, userId, customerId, invoiceNumber, date, dueDate, status, [userId+status]',
  invoiceItems: '++id, invoiceId',
  settings: '++id, userId',
  products: '++id, userId, name, price, description, createdAt'
});

window.db = db;

