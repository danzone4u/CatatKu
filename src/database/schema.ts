import { type SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 5;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  try {
    // Pastikan integritas relasi tabel & performa WAL selalu aktif di setiap koneksi
    await db.execAsync(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = 'wal';
    `);

    const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    let currentDbVersion = result?.user_version ?? 0;

    if (currentDbVersion >= DATABASE_VERSION) {
      return;
    }

  if (currentDbVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cashbooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '📖',
        color TEXT NOT NULL DEFAULT '#0F766E',
        budget_limit REAL DEFAULT NULL,
        is_archived INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL DEFAULT 'personal',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        icon TEXT NOT NULL DEFAULT '📦',
        is_default INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('cash', 'bank', 'ewallet')),
        balance REAL NOT NULL DEFAULT 0,
        min_balance REAL NOT NULL DEFAULT 0,
        icon TEXT NOT NULL DEFAULT '💵',
        color TEXT NOT NULL DEFAULT '#16A34A',
        is_default INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL DEFAULT 1,
        account_id INTEGER DEFAULT 1,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL NOT NULL,
        category_id INTEGER NOT NULL,
        note TEXT DEFAULT '',
        date TEXT NOT NULL,
        receipt_image_uri TEXT,
        is_void INTEGER NOT NULL DEFAULT 0,
        void_reason TEXT DEFAULT NULL,
        voided_at TEXT DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL DEFAULT 1,
        from_account_id INTEGER NOT NULL,
        to_account_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        fee REAL NOT NULL DEFAULT 0,
        date TEXT NOT NULL,
        note TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE,
        FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL DEFAULT 1,
        account_id INTEGER DEFAULT 1,
        type TEXT NOT NULL CHECK(type IN ('debt', 'receivable')),
        person_name TEXT NOT NULL,
        amount REAL NOT NULL,
        note TEXT DEFAULT '',
        due_date TEXT,
        is_paid INTEGER NOT NULL DEFAULT 0,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS debt_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        note TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS category_budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        monthly_limit REAL NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        UNIQUE(cashbook_id, category_id, month, year),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        target_amount REAL NOT NULL,
        current_amount REAL NOT NULL DEFAULT 0,
        target_date TEXT,
        icon TEXT NOT NULL DEFAULT '🎯',
        color TEXT NOT NULL DEFAULT '#0F766E',
        is_achieved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      INSERT OR IGNORE INTO categories (name, icon, is_default) VALUES
        ('Gaji', '💰', 1),
        ('Makanan', '🍔', 1),
        ('Transport', '🚗', 1),
        ('Belanja', '🛒', 1),
        ('Hiburan', '🎮', 1),
        ('Kesehatan', '🏥', 1),
        ('Pendidikan', '📚', 1),
        ('Tagihan', '📄', 1),
        ('Investasi', '📈', 1),
        ('Tabungan', '🎯', 1),
        ('Lainnya', '📦', 1);
    `);
    currentDbVersion = DATABASE_VERSION;
  }

  if (currentDbVersion === 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cashbooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '📖',
        color TEXT NOT NULL DEFAULT '#0F766E',
        budget_limit REAL DEFAULT NULL,
        is_archived INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    try {
      await db.execAsync('ALTER TABLE transactions ADD COLUMN cashbook_id INTEGER NOT NULL DEFAULT 1;');
    } catch {}

    try {
      await db.execAsync('ALTER TABLE debts ADD COLUMN cashbook_id INTEGER NOT NULL DEFAULT 1;');
    } catch {}

    currentDbVersion = 2;
  }

  if (currentDbVersion === 2) {
    // Migrasi dari v2 ke v3
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('cash', 'bank', 'ewallet')),
        balance REAL NOT NULL DEFAULT 0,
        min_balance REAL NOT NULL DEFAULT 0,
        icon TEXT NOT NULL DEFAULT '💵',
        color TEXT NOT NULL DEFAULT '#16A34A',
        is_default INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL DEFAULT 1,
        from_account_id INTEGER NOT NULL,
        to_account_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        fee REAL NOT NULL DEFAULT 0,
        date TEXT NOT NULL,
        note TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE,
        FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS debt_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        note TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS category_budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        monthly_limit REAL NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        UNIQUE(cashbook_id, category_id, month, year),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        target_amount REAL NOT NULL,
        current_amount REAL NOT NULL DEFAULT 0,
        target_date TEXT,
        icon TEXT NOT NULL DEFAULT '🎯',
        color TEXT NOT NULL DEFAULT '#0F766E',
        is_achieved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    try {
      await db.execAsync('ALTER TABLE transactions ADD COLUMN account_id INTEGER DEFAULT 1;');
    } catch {}

    try {
      await db.execAsync('ALTER TABLE debts ADD COLUMN account_id INTEGER DEFAULT 1;');
    } catch {}

    // Populate default accounts untuk setiap cashbook yang sudah ada (jika buku belum punya akun)
    const existingBooks = await db.getAllAsync<{ id: number }>('SELECT id FROM cashbooks');
    for (const b of existingBooks) {
      const accCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM accounts WHERE cashbook_id = ?', b.id);
      if ((accCount?.count ?? 0) === 0) {
        await db.runAsync(`
          INSERT INTO accounts (cashbook_id, name, type, balance, icon, color, is_default)
          VALUES
            (?, 'Uang Tunai', 'cash', 0, '💵', '#16A34A', 1),
            (?, 'Rekening Bank', 'bank', 0, '🏦', '#2563EB', 0),
            (?, 'E-Wallet', 'ewallet', 0, '📱', '#9333EA', 0);
        `, b.id, b.id, b.id);
      }
    }
  }

  // Incremental safe migrations
  try {
    await db.execAsync("ALTER TABLE cashbooks ADD COLUMN type TEXT NOT NULL DEFAULT 'personal';");
  } catch {}

  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN receipt_image_uri TEXT;');
  } catch {}

  try {
    await db.execAsync('ALTER TABLE recurring_rules ADD COLUMN is_auto_execute INTEGER NOT NULL DEFAULT 1;');
  } catch {}

  try {
    await db.execAsync('ALTER TABLE recurring_rules ADD COLUMN last_paid_period TEXT;');
  } catch {}

  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;');
  } catch {}

  try {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN min_balance REAL NOT NULL DEFAULT 0;');
  } catch {}

  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN is_void INTEGER NOT NULL DEFAULT 0;');
  } catch {}

  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN void_reason TEXT DEFAULT NULL;');
  } catch {}

  try {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN voided_at TEXT DEFAULT NULL;');
  } catch {}

  // Migrasi aman data dari monthly_bills lama ke recurring_rules jika ada
  try {
    const oldBills = await db.getAllAsync<{
      id: number;
      cashbook_id: number;
      name: string;
      amount: number;
      due_day: number;
      category_id: number | null;
      account_id: number | null;
      last_paid_month: string | null;
      note: string | null;
      is_active: number;
    }>('SELECT * FROM monthly_bills');

    if (oldBills && oldBills.length > 0) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      for (const bill of oldBills) {
        // Cek kategori default jika null
        let catId = bill.category_id;
        if (!catId) {
          const firstCat = await db.getFirstAsync<{ id: number }>('SELECT id FROM categories LIMIT 1');
          catId = firstCat?.id ?? 1;
        }

        const dueDayClamped = Math.min(Math.max(bill.due_day || 1, 1), 28);
        const nextDueDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dueDayClamped).padStart(2, '0')}`;

        // Cek apakah sudah pernah dipindah (cek duplikasi nama + cashbook)
        const exists = await db.getFirstAsync(
          'SELECT id FROM recurring_rules WHERE cashbook_id = ? AND note = ? AND amount = ?',
          bill.cashbook_id,
          bill.name,
          bill.amount
        );

        if (!exists) {
          await db.runAsync(
            `INSERT INTO recurring_rules (cashbook_id, account_id, category_id, type, amount, note, frequency, next_due_date, is_auto_execute, last_paid_period, is_active)
             VALUES (?, ?, ?, 'expense', ?, ?, 'monthly', ?, 0, ?, ?)`,
            bill.cashbook_id,
            bill.account_id ?? 1,
            catId,
            bill.amount,
            bill.name,
            nextDueDate,
            bill.last_paid_month,
            bill.is_active ?? 1
          );
        }
      }
    }
  } catch {}

  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recurring_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL DEFAULT 1,
        account_id INTEGER,
        category_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL NOT NULL,
        note TEXT DEFAULT '',
        frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly')),
        next_due_date TEXT NOT NULL,
        last_processed TEXT,
        is_auto_execute INTEGER NOT NULL DEFAULT 1,
        last_paid_period TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS monthly_bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashbook_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        due_day INTEGER NOT NULL, -- 1-31 tiap bulan
        category_id INTEGER,
        account_id INTEGER,
        last_paid_month TEXT, -- Format: YYYY-MM
        icon TEXT NOT NULL DEFAULT '📄',
        color TEXT NOT NULL DEFAULT '#0F766E',
        note TEXT DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (cashbook_id) REFERENCES cashbooks(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      );
    `);
  } catch {}

    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  } catch (err) {
    console.warn('migrateDbIfNeeded error caught safely:', err);
  }
}
