import { type SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface BackupPayload {
  app: string;
  version: number;
  timestamp: string;
  data: {
    cashbooks: any[];
    categories: any[];
    accounts: any[];
    transactions: any[];
    transfers: any[];
    debts: any[];
    debt_payments: any[];
    category_budgets: any[];
    savings_goals: any[];
    recurring_rules?: any[];
    app_settings: any[];
  };
}

export async function exportBackup(db: SQLiteDatabase): Promise<{ uri: string; filename: string }> {
  const [
    cashbooks,
    categories,
    accounts,
    transactions,
    transfers,
    debts,
    debt_payments,
    category_budgets,
    savings_goals,
    recurring_rules,
    app_settings,
  ] = await Promise.all([
    db.getAllAsync('SELECT * FROM cashbooks'),
    db.getAllAsync('SELECT * FROM categories'),
    db.getAllAsync('SELECT * FROM accounts'),
    db.getAllAsync('SELECT * FROM transactions'),
    db.getAllAsync('SELECT * FROM transfers'),
    db.getAllAsync('SELECT * FROM debts'),
    db.getAllAsync('SELECT * FROM debt_payments'),
    db.getAllAsync('SELECT * FROM category_budgets'),
    db.getAllAsync('SELECT * FROM savings_goals'),
    db.getAllAsync('SELECT * FROM recurring_rules'),
    db.getAllAsync('SELECT * FROM app_settings'),
  ]);

  const payload: BackupPayload = {
    app: 'CatatKu',
    version: 5,
    timestamp: new Date().toISOString(),
    data: {
      cashbooks,
      categories,
      accounts,
      transactions,
      transfers,
      debts,
      debt_payments,
      category_budgets,
      savings_goals,
      recurring_rules,
      app_settings,
    },
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  const filename = `CatatKu_Backup_${year}${month}${day}_${hours}${mins}${secs}.json`;

  const file = new File(Paths.document, filename);
  await file.write(jsonContent);

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Cadangkan Data Catatan',
      UTI: 'public.json',
    });
  }

  return { uri: file.uri, filename };
}

export async function exportBackupToLocalStorage(
  db: SQLiteDatabase
): Promise<{ success: boolean; filename: string; directoryName?: string }> {
  const [
    cashbooks,
    categories,
    accounts,
    transactions,
    transfers,
    debts,
    debt_payments,
    category_budgets,
    savings_goals,
    recurring_rules,
    app_settings,
  ] = await Promise.all([
    db.getAllAsync('SELECT * FROM cashbooks'),
    db.getAllAsync('SELECT * FROM categories'),
    db.getAllAsync('SELECT * FROM accounts'),
    db.getAllAsync('SELECT * FROM transactions'),
    db.getAllAsync('SELECT * FROM transfers'),
    db.getAllAsync('SELECT * FROM debts'),
    db.getAllAsync('SELECT * FROM debt_payments'),
    db.getAllAsync('SELECT * FROM category_budgets'),
    db.getAllAsync('SELECT * FROM savings_goals'),
    db.getAllAsync('SELECT * FROM recurring_rules'),
    db.getAllAsync('SELECT * FROM app_settings'),
  ]);

  const payload: BackupPayload = {
    app: 'CatatKu',
    version: 5,
    timestamp: new Date().toISOString(),
    data: {
      cashbooks,
      categories,
      accounts,
      transactions,
      transfers,
      debts,
      debt_payments,
      category_budgets,
      savings_goals,
      recurring_rules,
      app_settings,
    },
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  const filename = `CatatKu_Backup_${year}${month}${day}_${hours}${mins}${secs}.json`;

  if (Platform.OS === 'android' && StorageAccessFramework) {
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      return { success: false, filename };
    }

    const createdFileUri = await StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      filename,
      'application/json'
    );
    await StorageAccessFramework.writeAsStringAsync(createdFileUri, jsonContent);

    // Dapatkan nama folder dari URI
    const decodedUri = decodeURIComponent(permissions.directoryUri);
    const directoryName = decodedUri.split(':').pop() || 'Folder Pilihan';

    return { success: true, filename, directoryName };
  } else {
    // Fallback simpan ke folder Documents via File System
    const file = new File(Paths.document, filename);
    await file.write(jsonContent);

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Simpan Cadangan ke Perangkat',
        UTI: 'public.json',
      });
    }

    return { success: true, filename, directoryName: 'Documents' };
  }
}

export async function restoreBackup(
  db: SQLiteDatabase,
  jsonText: string
): Promise<{ success: boolean; count: number; message: string }> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Format file backup tidak valid (bukan JSON yang sah)');
  }

  if (!parsed || !parsed.data) {
    throw new Error('File tidak memiliki data Catatan');
  }

  const { data } = parsed;

  await db.withTransactionAsync(async () => {
    // 1. Bersihkan tabel-tabel lama
    await db.execAsync(`
      DELETE FROM recurring_rules;
      DELETE FROM debt_payments;
      DELETE FROM debts;
      DELETE FROM transfers;
      DELETE FROM transactions;
      DELETE FROM accounts;
      DELETE FROM category_budgets;
      DELETE FROM savings_goals;
      DELETE FROM categories;
      DELETE FROM cashbooks;
      DELETE FROM app_settings;
    `);

    // 2. Restore cashbooks
    if (Array.isArray(data.cashbooks)) {
      for (const b of data.cashbooks) {
        await db.runAsync(
          `INSERT INTO cashbooks (id, name, icon, color, budget_limit, is_archived, is_default, type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          b.id,
          b.name,
          b.icon ?? '📖',
          b.color ?? '#2563EB',
          b.budget_limit ?? null,
          b.is_archived ?? 0,
          b.is_default ?? 0,
          b.type ?? 'personal',
          b.created_at ?? new Date().toISOString()
        );
      }
    }

    // 3. Restore categories
    if (Array.isArray(data.categories)) {
      for (const c of data.categories) {
        await db.runAsync(
          `INSERT INTO categories (id, name, icon, is_default)
           VALUES (?, ?, ?, ?)`,
          c.id,
          c.name,
          c.icon ?? '📦',
          c.is_default ?? 0
        );
      }
    }

    // 4. Restore accounts
    if (Array.isArray(data.accounts)) {
      for (const a of data.accounts) {
        await db.runAsync(
          `INSERT INTO accounts (id, cashbook_id, name, type, balance, min_balance, icon, color, is_default, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          a.id,
          a.cashbook_id,
          a.name,
          a.type,
          a.balance ?? 0,
          a.min_balance ?? 0,
          a.icon ?? '💵',
          a.color ?? '#16A34A',
          a.is_default ?? 0,
          a.sort_order ?? 0,
          a.created_at ?? new Date().toISOString()
        );
      }
    }

    // 5. Restore transactions
    if (Array.isArray(data.transactions)) {
      for (const t of data.transactions) {
        await db.runAsync(
          `INSERT INTO transactions (id, cashbook_id, account_id, type, amount, category_id, note, date, receipt_image_uri, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          t.id,
          t.cashbook_id,
          t.account_id ?? null,
          t.type,
          t.amount,
          t.category_id,
          t.note ?? '',
          t.date,
          t.receipt_image_uri ?? null,
          t.created_at ?? new Date().toISOString()
        );
      }
    }

    // 6. Restore transfers
    if (Array.isArray(data.transfers)) {
      for (const tr of data.transfers) {
        await db.runAsync(
          `INSERT INTO transfers (id, cashbook_id, from_account_id, to_account_id, amount, fee, date, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          tr.id,
          tr.cashbook_id,
          tr.from_account_id,
          tr.to_account_id,
          tr.amount,
          tr.fee ?? 0,
          tr.date,
          tr.note ?? '',
          tr.created_at ?? new Date().toISOString()
        );
      }
    }

    // 7. Restore debts
    if (Array.isArray(data.debts)) {
      for (const d of data.debts) {
        await db.runAsync(
          `INSERT INTO debts (id, cashbook_id, account_id, type, person_name, amount, note, due_date, is_paid, date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          d.id,
          d.cashbook_id,
          d.account_id ?? null,
          d.type,
          d.person_name,
          d.amount,
          d.note ?? '',
          d.due_date ?? null,
          d.is_paid ?? 0,
          d.date,
          d.created_at ?? new Date().toISOString()
        );
      }
    }

    // 8. Restore debt_payments
    if (Array.isArray(data.debt_payments)) {
      for (const p of data.debt_payments) {
        await db.runAsync(
          `INSERT INTO debt_payments (id, debt_id, account_id, amount, date, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          p.id,
          p.debt_id,
          p.account_id,
          p.amount,
          p.date,
          p.note ?? '',
          p.created_at ?? new Date().toISOString()
        );
      }
    }

    // 9. Restore category_budgets
    if (Array.isArray(data.category_budgets)) {
      for (const cb of data.category_budgets) {
        await db.runAsync(
          `INSERT INTO category_budgets (id, cashbook_id, category_id, monthly_limit, month, year)
           VALUES (?, ?, ?, ?, ?, ?)`,
          cb.id,
          cb.cashbook_id,
          cb.category_id,
          cb.monthly_limit,
          cb.month,
          cb.year
        );
      }
    }

    // 10. Restore savings_goals
    if (Array.isArray(data.savings_goals)) {
      for (const sg of data.savings_goals) {
        await db.runAsync(
          `INSERT INTO savings_goals (id, cashbook_id, name, target_amount, current_amount, target_date, icon, color, is_achieved, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          sg.id,
          sg.cashbook_id,
          sg.name,
          sg.target_amount,
          sg.current_amount ?? 0,
          sg.target_date ?? null,
          sg.icon ?? '🎯',
          sg.color ?? '#2563EB',
          sg.is_achieved ?? 0,
          sg.created_at ?? new Date().toISOString()
        );
      }
    }

    // 11. Restore recurring_rules
    if (Array.isArray(data.recurring_rules)) {
      for (const rr of data.recurring_rules) {
        await db.runAsync(
          `INSERT INTO recurring_rules (id, cashbook_id, account_id, category_id, type, amount, note, frequency, next_due_date, last_processed, is_auto_execute, last_paid_period, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          rr.id,
          rr.cashbook_id,
          rr.account_id ?? null,
          rr.category_id,
          rr.type ?? 'expense',
          rr.amount,
          rr.note ?? '',
          rr.frequency ?? 'monthly',
          rr.next_due_date,
          rr.last_processed ?? null,
          rr.is_auto_execute ?? 1,
          rr.last_paid_period ?? null,
          rr.is_active ?? 1,
          rr.created_at ?? new Date().toISOString()
        );
      }
    }

    // 12. Restore app_settings
    if (Array.isArray(data.app_settings)) {
      for (const s of data.app_settings) {
        await db.runAsync(
          `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
          s.key,
          s.value
        );
      }
    }
  });

  const txCount = Array.isArray(data.transactions) ? data.transactions.length : 0;
  const bookCount = Array.isArray(data.cashbooks) ? data.cashbooks.length : 0;

  return {
    success: true,
    count: txCount,
    message: `Berhasil memulihkan ${bookCount} Catatan dan ${txCount} Transaksi.`,
  };
}

// ─── Ekspor & Impor Khusus 1 Buku Kas (P2P Kas Organisasi / Tim) ───
export async function exportSingleCashbook(
  db: SQLiteDatabase,
  cashbookId: number
): Promise<{ uri: string; filename: string }> {
  const cashbook = await db.getFirstAsync<any>('SELECT * FROM cashbooks WHERE id = ?', cashbookId);
  if (!cashbook) {
    throw new Error('Catatan tidak ditemukan');
  }

  const [categories, accounts, transactions, transfers, debts, debt_payments] = await Promise.all([
    db.getAllAsync('SELECT * FROM categories'),
    db.getAllAsync('SELECT * FROM accounts WHERE cashbook_id = ?', cashbookId),
    db.getAllAsync('SELECT * FROM transactions WHERE cashbook_id = ?', cashbookId),
    db.getAllAsync('SELECT * FROM transfers WHERE cashbook_id = ?', cashbookId),
    db.getAllAsync('SELECT * FROM debts WHERE cashbook_id = ?', cashbookId),
    db.getAllAsync(`
      SELECT dp.* FROM debt_payments dp
      JOIN debts d ON dp.debt_id = d.id
      WHERE d.cashbook_id = ?
    `, cashbookId),
  ]);

  const payload = {
    type: 'single_cashbook',
    app: 'CatatKu',
    version: 5,
    timestamp: new Date().toISOString(),
    data: {
      cashbook,
      categories,
      accounts,
      transactions,
      transfers,
      debts,
      debt_payments,
    },
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const filename = `CatatKu_Backup_${year}${month}${day}_${hours}${mins}.json`;

  const file = new File(Paths.document, filename);
  await file.write(jsonContent);

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: `Bagikan Catatan: ${cashbook.name}`,
    });
  }

  return { uri: file.uri, filename };
}

export async function importSingleCashbook(
  db: SQLiteDatabase,
  jsonText: string
): Promise<{ success: boolean; cashbookName: string; txCount: number }> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('File catatan tidak valid (bukan JSON yang sah)');
  }

  if (!parsed || !parsed.data || !parsed.data.cashbook) {
    throw new Error('File tidak memiliki data catatan tunggal');
  }

  const { cashbook, categories, accounts, transactions, transfers, debts } = parsed.data;

  let newBookId = 0;
  let txCount = 0;

  await db.withTransactionAsync(async () => {
    // Buat catatan baru dengan nama unik jika sudah ada
    const originalName = cashbook.name;
    const existing = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM cashbooks WHERE name = ?',
      originalName
    );
    const finalName = (existing?.count ?? 0) > 0 ? `${originalName} (Impor)` : originalName;

    const res = await db.runAsync(
      `INSERT INTO cashbooks (name, icon, color, budget_limit, is_archived, is_default, type, created_at)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
      finalName,
      cashbook.icon ?? '📖',
      cashbook.color ?? '#2563EB',
      cashbook.budget_limit ?? null,
      cashbook.type ?? 'organization',
      new Date().toISOString()
    );
    newBookId = res.lastInsertRowId;

    // Pastikan kategori yang dibutuhkan ada
    const categoryIdMap = new Map<number, number>();
    if (Array.isArray(categories)) {
      for (const cat of categories) {
        const found = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM categories WHERE name = ?',
          cat.name
        );
        if (found) {
          categoryIdMap.set(cat.id, found.id);
        } else {
          const insertCat = await db.runAsync(
            'INSERT INTO categories (name, icon, is_default) VALUES (?, ?, 0)',
            cat.name,
            cat.icon ?? '📦'
          );
          categoryIdMap.set(cat.id, insertCat.lastInsertRowId);
        }
      }
    }

    // Buat accounts untuk buku baru dan petakan ID-nya
    const accountIdMap = new Map<number, number>();
    if (Array.isArray(accounts)) {
      for (const acc of accounts) {
        const insertAcc = await db.runAsync(
          `INSERT INTO accounts (cashbook_id, name, type, balance, min_balance, icon, color, is_default, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newBookId,
          acc.name,
          acc.type,
          acc.balance ?? 0,
          acc.min_balance ?? 0,
          acc.icon ?? '💵',
          acc.color ?? '#16A34A',
          acc.is_default ?? 0,
          acc.sort_order ?? 0,
          new Date().toISOString()
        );
        accountIdMap.set(acc.id, insertAcc.lastInsertRowId);
      }
    }

    // Default account jika tidak ada account
    let defaultAccId = 1;
    const firstAcc = await db.getFirstAsync<{ id: number }>('SELECT id FROM accounts WHERE cashbook_id = ?', newBookId);
    if (firstAcc) defaultAccId = firstAcc.id;

    // Impor transaksi
    if (Array.isArray(transactions)) {
      for (const t of transactions) {
        const mappedCatId = categoryIdMap.get(t.category_id) ?? 1;
        const mappedAccId = t.account_id ? (accountIdMap.get(t.account_id) ?? defaultAccId) : defaultAccId;

        await db.runAsync(
          `INSERT INTO transactions (cashbook_id, account_id, type, amount, category_id, note, date, receipt_image_uri, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newBookId,
          mappedAccId,
          t.type,
          t.amount,
          mappedCatId,
          t.note ?? '',
          t.date,
          t.receipt_image_uri ?? null,
          t.created_at ?? new Date().toISOString()
        );
        txCount++;
      }
    }

    // Impor transfer
    if (Array.isArray(transfers)) {
      for (const tr of transfers) {
        const fromAcc = accountIdMap.get(tr.from_account_id) ?? defaultAccId;
        const toAcc = accountIdMap.get(tr.to_account_id) ?? defaultAccId;

        await db.runAsync(
          `INSERT INTO transfers (cashbook_id, from_account_id, to_account_id, amount, fee, date, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          newBookId,
          fromAcc,
          toAcc,
          tr.amount,
          tr.fee ?? 0,
          tr.date,
          tr.note ?? '',
          tr.created_at ?? new Date().toISOString()
        );
      }
    }

    // Impor hutang
    if (Array.isArray(debts)) {
      for (const d of debts) {
        const accId = d.account_id ? (accountIdMap.get(d.account_id) ?? defaultAccId) : defaultAccId;
        await db.runAsync(
          `INSERT INTO debts (cashbook_id, account_id, type, person_name, amount, note, due_date, is_paid, date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newBookId,
          accId,
          d.type,
          d.person_name,
          d.amount,
          d.note ?? '',
          d.due_date ?? null,
          d.is_paid ?? 0,
          d.date,
          d.created_at ?? new Date().toISOString()
        );
      }
    }
  });

  return {
    success: true,
    cashbookName: cashbook.name,
    txCount,
  };
}
