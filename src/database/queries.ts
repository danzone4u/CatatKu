import { type SQLiteDatabase } from 'expo-sqlite';

// Types
export interface Cashbook {
  id: number;
  name: string;
  icon: string;
  color: string;
  budget_limit: number | null;
  is_archived: number;
  is_default: number;
  type: 'personal' | 'organization' | 'business';
  created_at: string;
}

export interface CashbookStats extends Cashbook {
  total_income: number;
  total_expense: number;
  balance: number;
  transaction_count: number;
  recent_trend?: number[];
}

export interface Account {
  id: number;
  cashbook_id: number;
  name: string;
  type: 'cash' | 'bank' | 'ewallet';
  balance: number;
  min_balance?: number | null;
  icon: string;
  color: string;
  is_default: number;
  sort_order?: number;
  created_at: string;
}

export interface AccountWithCalculatedBalance extends Account {
  calculated_balance: number;
}

export interface Transaction {
  id: number;
  cashbook_id: number;
  account_id: number | null;
  type: 'income' | 'expense';
  amount: number;
  category_id: number;
  note: string;
  date: string;
  receipt_image_uri?: string | null;
  created_at: string;
}

export interface RecurringRule {
  id: number;
  cashbook_id: number;
  account_id: number | null;
  category_id: number;
  type: 'income' | 'expense';
  amount: number;
  note: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  next_due_date: string;
  last_processed: string | null;
  is_auto_execute: number; // 1 = otomatis potong/tambah saldo, 0 = manual konfirmasi tagihan
  last_paid_period: string | null; // format YYYY-MM
  is_active: number;
  created_at: string;
  category_name?: string;
  category_icon?: string;
  account_name?: string;
}

export interface TransactionWithCategory extends Transaction {
  category_name: string;
  category_icon: string;
  account_name?: string;
  account_icon?: string;
}

export interface Transfer {
  id: number;
  cashbook_id: number;
  from_account_id: number;
  to_account_id: number;
  amount: number;
  fee: number;
  date: string;
  note: string;
  created_at: string;
  from_account_name?: string;
  from_account_icon?: string;
  to_account_name?: string;
  to_account_icon?: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  is_default: number;
}

export interface Debt {
  id: number;
  cashbook_id: number;
  account_id: number | null;
  type: 'debt' | 'receivable';
  person_name: string;
  amount: number;
  note: string;
  due_date: string | null;
  is_paid: number;
  date: string;
  created_at: string;
}

export interface DebtWithPayments extends Debt {
  total_paid: number;
  remaining_amount: number;
}

export interface DebtPayment {
  id: number;
  debt_id: number;
  account_id: number;
  amount: number;
  date: string;
  note: string;
  created_at: string;
  account_name?: string;
}

export interface CategoryBudget {
  id: number;
  cashbook_id: number;
  category_id: number;
  monthly_limit: number;
  month: number;
  year: number;
  category_name?: string;
  category_icon?: string;
  spent_amount?: number;
}

export interface SavingsGoal {
  id: number;
  cashbook_id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  icon: string;
  color: string;
  is_achieved: number;
  created_at: string;
}

export interface Summary {
  total_income: number;
  total_expense: number;
  balance: number;
}

// ─── Cashbooks (Buku Kas) ───
export async function getCashbooks(db: SQLiteDatabase, includeArchived = false): Promise<Cashbook[]> {
  const query = includeArchived
    ? 'SELECT * FROM cashbooks ORDER BY is_default DESC, is_archived ASC, id ASC'
    : 'SELECT * FROM cashbooks WHERE is_archived = 0 ORDER BY is_default DESC, id ASC';
  return db.getAllAsync<Cashbook>(query);
}

export async function getCashbookById(db: SQLiteDatabase, id: number): Promise<Cashbook | null> {
  return db.getFirstAsync<Cashbook>('SELECT * FROM cashbooks WHERE id = ?', id);
}

export async function getCashbooksWithStats(db: SQLiteDatabase): Promise<CashbookStats[]> {
  try {
    let books = await getCashbooks(db, true);
    if (!books || books.length === 0) {
      try {
        await db.runAsync("INSERT OR IGNORE INTO cashbooks (id, name, icon, color, is_default, type) VALUES (1, 'Kas Pribadi', '👤', '#1C1917', 1, 'personal')");
        await db.runAsync(`
          INSERT OR IGNORE INTO accounts (cashbook_id, name, type, balance, icon, color, is_default)
          VALUES
            (1, 'Uang Tunai', 'cash', 0, '💵', '#16A34A', 1),
            (1, 'Rekening Bank', 'bank', 0, '🏦', '#2563EB', 0),
            (1, 'E-Wallet', 'ewallet', 0, '📱', '#9333EA', 0);
        `);
        books = await getCashbooks(db, true);
      } catch {}
    }

    const result: CashbookStats[] = [];

    for (const b of books) {
      const income = await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE cashbook_id = ? AND type = ?',
        b.id, 'income'
      );
      const expense = await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE cashbook_id = ? AND type = ?',
        b.id, 'expense'
      );
      const count = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM transactions WHERE cashbook_id = ?',
        b.id
      );

      // Ambil riwayat net amount dari 7 hari transaksi terakhir untuk line chart
      const recentDaily = await db.getAllAsync<{ daily_net: number }>(
        `SELECT (
           COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
         ) as daily_net
         FROM transactions
         WHERE cashbook_id = ?
         GROUP BY date
         ORDER BY date DESC
         LIMIT 7`,
        b.id
      );
      const recentTrend = recentDaily.map((r) => r.daily_net).reverse();

      const totalIncome = income?.total ?? 0;
      const totalExpense = expense?.total ?? 0;

      result.push({
        ...b,
        total_income: totalIncome,
        total_expense: totalExpense,
        balance: totalIncome - totalExpense,
        transaction_count: count?.count ?? 0,
        recent_trend: recentTrend,
      });
    }

    return result;
  } catch (err) {
    console.warn('getCashbooksWithStats error:', err);
    return [];
  }
}

export async function getTotalAllBalance(
  db: SQLiteDatabase,
  onlyPersonal?: boolean
): Promise<{ total_income: number; total_expense: number; net_worth: number }> {
  try {
    let incomeQuery = 'SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t';
    let expenseQuery = 'SELECT COALESCE(SUM(t.amount), 0) as total FROM transactions t';

    if (onlyPersonal) {
      incomeQuery += " JOIN cashbooks c ON t.cashbook_id = c.id WHERE c.type = 'personal' AND t.type = 'income'";
      expenseQuery += " JOIN cashbooks c ON t.cashbook_id = c.id WHERE c.type = 'personal' AND t.type = 'expense'";
    } else {
      incomeQuery += " WHERE t.type = 'income'";
      expenseQuery += " WHERE t.type = 'expense'";
    }

    const income = await db.getFirstAsync<{ total: number }>(incomeQuery);
    const expense = await db.getFirstAsync<{ total: number }>(expenseQuery);

    const totalIncome = income?.total ?? 0;
    const totalExpense = expense?.total ?? 0;

    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_worth: totalIncome - totalExpense,
    };
  } catch (err) {
    console.warn('getTotalAllBalance error:', err);
    return {
      total_income: 0,
      total_expense: 0,
      net_worth: 0,
    };
  }
}

export async function createCashbook(
  db: SQLiteDatabase,
  data: {
    name: string;
    icon: string;
    color: string;
    budget_limit?: number | null;
    type?: 'personal' | 'organization' | 'business';
  }
): Promise<number> {
  const bookType = data.type ?? 'personal';
  const result = await db.runAsync(
    'INSERT INTO cashbooks (name, icon, color, budget_limit, is_archived, is_default, type) VALUES (?, ?, ?, ?, 0, 0, ?)',
    data.name,
    data.icon,
    data.color,
    data.budget_limit ?? null,
    bookType
  );
  const newBookId = result.lastInsertRowId;

  // Buat default accounts untuk buku baru
  await db.runAsync(`
    INSERT INTO accounts (cashbook_id, name, type, balance, icon, color, is_default) VALUES
      (?, 'Uang Tunai', 'cash', 0, '💵', '#16A34A', 1),
      (?, 'Rekening Bank', 'bank', 0, '🏦', '#2563EB', 0),
      (?, 'E-Wallet', 'ewallet', 0, '📱', '#9333EA', 0);
  `, newBookId, newBookId, newBookId);

  return newBookId;
}

export async function updateCashbook(
  db: SQLiteDatabase,
  id: number,
  data: {
    name: string;
    icon: string;
    color: string;
    budget_limit?: number | null;
    type?: 'personal' | 'organization' | 'business';
  }
): Promise<void> {
  const bookType = data.type ?? 'personal';
  await db.runAsync(
    'UPDATE cashbooks SET name = ?, icon = ?, color = ?, budget_limit = ?, type = ? WHERE id = ?',
    data.name,
    data.icon,
    data.color,
    data.budget_limit ?? null,
    bookType,
    id
  );
}

export async function toggleArchiveCashbook(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE cashbooks SET is_archived = CASE WHEN is_archived = 0 THEN 1 ELSE 0 END WHERE id = ?', id);
}

export async function deleteCashbook(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM transactions WHERE cashbook_id = ?', id);
  await db.runAsync('DELETE FROM debts WHERE cashbook_id = ?', id);
  await db.runAsync('DELETE FROM accounts WHERE cashbook_id = ?', id);
  await db.runAsync('DELETE FROM transfers WHERE cashbook_id = ?', id);
  await db.runAsync('DELETE FROM category_budgets WHERE cashbook_id = ?', id);
  await db.runAsync('DELETE FROM savings_goals WHERE cashbook_id = ?', id);
  await db.runAsync('DELETE FROM cashbooks WHERE id = ?', id);
}

// ─── Accounts (Dompet / Rekening) ───
export async function getAccounts(db: SQLiteDatabase, cashbookId: number): Promise<AccountWithCalculatedBalance[]> {
  const accounts = await db.getAllAsync<Account>(
    'SELECT * FROM accounts WHERE cashbook_id = ? ORDER BY is_default DESC, sort_order ASC, id ASC',
    cashbookId
  );

  const result: AccountWithCalculatedBalance[] = [];
  for (const acc of accounts) {
    // Hitung saldo: Saldo awal + Pemasukan - Pengeluaran + Transfer Masuk - Transfer Keluar (+ Fee) + Cicilan Piutang - Cicilan Hutang
    const income = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = ?',
      acc.id, 'income'
    );
    const expense = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE account_id = ? AND type = ?',
      acc.id, 'expense'
    );
    const transferIn = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM transfers WHERE to_account_id = ?',
      acc.id
    );
    const transferOut = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount + fee), 0) as total FROM transfers WHERE from_account_id = ?',
      acc.id
    );

    // Cicilan hutang: Jika bayar hutang (kita bayar -> uang berkurang). Jika terima piutang (orang bayar -> uang bertambah)
    const debtPaymentsOut = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(dp.amount), 0) as total FROM debt_payments dp
       JOIN debts d ON dp.debt_id = d.id
       WHERE dp.account_id = ? AND d.type = 'debt'`,
      acc.id
    );
    const debtPaymentsIn = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(dp.amount), 0) as total FROM debt_payments dp
       JOIN debts d ON dp.debt_id = d.id
       WHERE dp.account_id = ? AND d.type = 'receivable'`,
      acc.id
    );

    const calculated =
      acc.balance +
      (income?.total ?? 0) -
      (expense?.total ?? 0) +
      (transferIn?.total ?? 0) -
      (transferOut?.total ?? 0) -
      (debtPaymentsOut?.total ?? 0) +
      (debtPaymentsIn?.total ?? 0);

    result.push({
      ...acc,
      calculated_balance: calculated,
    });
  }

  return result;
}

export async function addAccount(
  db: SQLiteDatabase,
  data: {
    cashbook_id: number;
    name: string;
    type: 'cash' | 'bank' | 'ewallet';
    balance: number;
    min_balance?: number | null;
    icon: string;
    color: string;
  }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO accounts (cashbook_id, name, type, balance, min_balance, icon, color, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
    data.cashbook_id,
    data.name,
    data.type,
    data.balance,
    data.min_balance ?? 0,
    data.icon,
    data.color
  );
  return result.lastInsertRowId;
}

export async function updateAccount(
  db: SQLiteDatabase,
  id: number,
  data: {
    name: string;
    type: 'cash' | 'bank' | 'ewallet';
    balance: number;
    min_balance?: number | null;
    icon: string;
    color: string;
  }
): Promise<void> {
  await db.runAsync(
    'UPDATE accounts SET name = ?, type = ?, balance = ?, min_balance = ?, icon = ?, color = ? WHERE id = ?',
    data.name,
    data.type,
    data.balance,
    data.min_balance ?? 0,
    data.icon,
    data.color,
    id
  );
}

export async function deleteAccount(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM accounts WHERE id = ? AND is_default = 0', id);
}

export async function setDefaultAccount(db: SQLiteDatabase, cashbookId: number, accountId: number): Promise<void> {
  await db.runAsync('UPDATE accounts SET is_default = 0 WHERE cashbook_id = ?', cashbookId);
  await db.runAsync('UPDATE accounts SET is_default = 1 WHERE id = ?', accountId);
}

export async function updateAccountOrder(db: SQLiteDatabase, accountIds: number[]): Promise<void> {
  for (let i = 0; i < accountIds.length; i++) {
    await db.runAsync('UPDATE accounts SET sort_order = ? WHERE id = ?', i, accountIds[i]);
  }
}

// ─── Transfers (Pindah Saldo Antar Akun) ───
export async function getTransfers(db: SQLiteDatabase, cashbookId: number): Promise<Transfer[]> {
  return db.getAllAsync<Transfer>(`
    SELECT t.*,
           fa.name as from_account_name, fa.icon as from_account_icon,
           ta.name as to_account_name, ta.icon as to_account_icon
    FROM transfers t
    JOIN accounts fa ON t.from_account_id = fa.id
    JOIN accounts ta ON t.to_account_id = ta.id
    WHERE t.cashbook_id = ?
    ORDER BY t.date DESC, t.created_at DESC
  `, cashbookId);
}

export async function addTransfer(
  db: SQLiteDatabase,
  data: { cashbook_id: number; from_account_id: number; to_account_id: number; amount: number; fee: number; date: string; note: string }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO transfers (cashbook_id, from_account_id, to_account_id, amount, fee, date, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    data.cashbook_id, data.from_account_id, data.to_account_id, data.amount, data.fee, data.date, data.note
  );
  return result.lastInsertRowId;
}

// ─── Categories ───
export async function getCategories(db: SQLiteDatabase): Promise<Category[]> {
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY is_default DESC, name ASC');
}

export async function addCategory(db: SQLiteDatabase, name: string, icon: string): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO categories (name, icon, is_default) VALUES (?, ?, 0)',
    name, icon
  );
  return result.lastInsertRowId;
}

export async function deleteCategory(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM categories WHERE id = ? AND is_default = 0', id);
}

// ─── Transactions (Per Cashbook) ───
export async function getTransactions(
  db: SQLiteDatabase,
  cashbookId: number,
  filters?: {
    type?: 'income' | 'expense';
    category_id?: number;
    account_id?: number;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
  }
): Promise<TransactionWithCategory[]> {
  let query = `
    SELECT t.*, c.name as category_name, c.icon as category_icon,
           a.name as account_name, a.icon as account_icon
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.cashbook_id = ?
  `;
  const params: (string | number)[] = [cashbookId];

  if (filters?.type) {
    query += ' AND t.type = ?';
    params.push(filters.type);
  }
  if (filters?.category_id) {
    query += ' AND t.category_id = ?';
    params.push(filters.category_id);
  }
  if (filters?.account_id) {
    query += ' AND t.account_id = ?';
    params.push(filters.account_id);
  }
  if (filters?.startDate) {
    query += ' AND t.date >= ?';
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    query += ' AND t.date <= ?';
    params.push(filters.endDate);
  }
  if (filters?.minAmount !== undefined && filters.minAmount !== null) {
    query += ' AND t.amount >= ?';
    params.push(filters.minAmount);
  }
  if (filters?.maxAmount !== undefined && filters.maxAmount !== null) {
    query += ' AND t.amount <= ?';
    params.push(filters.maxAmount);
  }
  if (filters?.search) {
    query += ' AND t.note LIKE ?';
    params.push(`%${filters.search}%`);
  }

  query += ' ORDER BY t.date DESC, t.created_at DESC';

  return db.getAllAsync<TransactionWithCategory>(query, params);
}

export async function addTransaction(
  db: SQLiteDatabase,
  data: {
    cashbook_id: number;
    account_id?: number | null;
    type: 'income' | 'expense';
    amount: number;
    category_id: number;
    note: string;
    date: string;
    receipt_image_uri?: string | null;
  }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO transactions (cashbook_id, account_id, type, amount, category_id, note, date, receipt_image_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    data.cashbook_id,
    data.account_id ?? 1,
    data.type,
    data.amount,
    data.category_id,
    data.note,
    data.date,
    data.receipt_image_uri ?? null
  );
  return result.lastInsertRowId;
}

export async function updateTransaction(
  db: SQLiteDatabase,
  id: number,
  data: {
    cashbook_id: number;
    account_id?: number | null;
    type: 'income' | 'expense';
    amount: number;
    category_id: number;
    note: string;
    date: string;
    receipt_image_uri?: string | null;
  }
): Promise<void> {
  await db.runAsync(
    'UPDATE transactions SET cashbook_id = ?, account_id = ?, type = ?, amount = ?, category_id = ?, note = ?, date = ?, receipt_image_uri = ? WHERE id = ?',
    data.cashbook_id,
    data.account_id ?? 1,
    data.type,
    data.amount,
    data.category_id,
    data.note,
    data.date,
    data.receipt_image_uri ?? null,
    id
  );
}

export async function deleteTransaction(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

// ─── Summary (Per Cashbook) ───
export async function getMonthlySummary(
  db: SQLiteDatabase,
  cashbookId: number,
  year: number,
  month: number
): Promise<Summary> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const income = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE cashbook_id = ? AND type = ? AND date >= ? AND date <= ?',
    cashbookId, 'income', startDate, endDate
  );
  const expense = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE cashbook_id = ? AND type = ? AND date >= ? AND date <= ?',
    cashbookId, 'expense', startDate, endDate
  );

  const totalIncome = income?.total ?? 0;
  const totalExpense = expense?.total ?? 0;

  return {
    total_income: totalIncome,
    total_expense: totalExpense,
    balance: totalIncome - totalExpense,
  };
}

export async function getCategoryBreakdown(
  db: SQLiteDatabase,
  cashbookId: number,
  year: number,
  month: number,
  type: 'income' | 'expense'
): Promise<{ category_id: number; category_name: string; category_icon: string; total: number }[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  return db.getAllAsync<{ category_id: number; category_name: string; category_icon: string; total: number }>(
    `SELECT c.id as category_id, c.name as category_name, c.icon as category_icon, SUM(t.amount) as total
     FROM transactions t
     JOIN categories c ON t.category_id = c.id
     WHERE t.cashbook_id = ? AND t.type = ? AND t.date >= ? AND t.date <= ?
     GROUP BY c.id
     ORDER BY total DESC`,
    cashbookId, type, startDate, endDate
  );
}

// ─── Debts & Installment Payments ───
export async function getDebts(
  db: SQLiteDatabase,
  cashbookId: number,
  filters?: { type?: 'debt' | 'receivable'; is_paid?: number }
): Promise<DebtWithPayments[]> {
  let query = 'SELECT * FROM debts WHERE cashbook_id = ?';
  const params: (string | number)[] = [cashbookId];

  if (filters?.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters?.is_paid !== undefined) {
    query += ' AND is_paid = ?';
    params.push(filters.is_paid);
  }

  query += ' ORDER BY is_paid ASC, due_date ASC, created_at DESC';

  const debts = await db.getAllAsync<Debt>(query, params);
  const result: DebtWithPayments[] = [];

  for (const d of debts) {
    const paidRow = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM debt_payments WHERE debt_id = ?',
      d.id
    );
    const paid = paidRow?.total ?? 0;
    const remaining = Math.max(0, d.amount - paid);

    result.push({
      ...d,
      total_paid: paid,
      remaining_amount: remaining,
    });
  }

  return result;
}

export async function getDebtById(db: SQLiteDatabase, id: number): Promise<DebtWithPayments | null> {
  const d = await db.getFirstAsync<Debt>('SELECT * FROM debts WHERE id = ?', id);
  if (!d) return null;

  const paidRow = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM debt_payments WHERE debt_id = ?',
    d.id
  );
  const paid = paidRow?.total ?? 0;

  return {
    ...d,
    total_paid: paid,
    remaining_amount: Math.max(0, d.amount - paid),
  };
}

export async function addDebt(
  db: SQLiteDatabase,
  data: { cashbook_id: number; account_id?: number | null; type: 'debt' | 'receivable'; person_name: string; amount: number; note: string; due_date: string | null; date: string }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO debts (cashbook_id, account_id, type, person_name, amount, note, due_date, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    data.cashbook_id, data.account_id ?? 1, data.type, data.person_name, data.amount, data.note, data.due_date, data.date
  );
  return result.lastInsertRowId;
}

export async function updateDebt(
  db: SQLiteDatabase,
  id: number,
  data: {
    person_name: string;
    amount: number;
    note: string;
    due_date: string | null;
    date: string;
    account_id?: number | null;
  }
): Promise<void> {
  await db.runAsync(
    'UPDATE debts SET person_name = ?, amount = ?, note = ?, due_date = ?, date = ?, account_id = ? WHERE id = ?',
    data.person_name,
    data.amount,
    data.note,
    data.due_date,
    data.date,
    data.account_id ?? 1,
    id
  );
}

export async function addDebtPayment(
  db: SQLiteDatabase,
  data: { debt_id: number; account_id: number; amount: number; date: string; note: string }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO debt_payments (debt_id, account_id, amount, date, note) VALUES (?, ?, ?, ?, ?)',
    data.debt_id, data.account_id, data.amount, data.date, data.note
  );

  // Periksa apakah sudah lunas
  const d = await getDebtById(db, data.debt_id);
  if (d && d.remaining_amount <= 0) {
    await db.runAsync('UPDATE debts SET is_paid = 1 WHERE id = ?', data.debt_id);
  }

  return result.lastInsertRowId;
}

export async function getDebtPayments(db: SQLiteDatabase, debtId: number): Promise<DebtPayment[]> {
  return db.getAllAsync<DebtPayment>(`
    SELECT dp.*, a.name as account_name
    FROM debt_payments dp
    LEFT JOIN accounts a ON dp.account_id = a.id
    WHERE dp.debt_id = ?
    ORDER BY dp.date DESC, dp.created_at DESC
  `, debtId);
}

export async function toggleDebtPaid(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE debts SET is_paid = CASE WHEN is_paid = 0 THEN 1 ELSE 0 END WHERE id = ?', id);
}

export async function deleteDebt(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM debt_payments WHERE debt_id = ?', id);
  await db.runAsync('DELETE FROM debts WHERE id = ?', id);
}

export async function getDebtSummary(
  db: SQLiteDatabase,
  cashbookId: number
): Promise<{ total_debt: number; total_receivable: number }> {
  // Sisa hutang bersih (dikurangi cicilan)
  const debts = await getDebts(db, cashbookId, { is_paid: 0 });
  let totalDebt = 0;
  let totalReceivable = 0;

  for (const d of debts) {
    if (d.type === 'debt') {
      totalDebt += d.remaining_amount;
    } else {
      totalReceivable += d.remaining_amount;
    }
  }

  return {
    total_debt: totalDebt,
    total_receivable: totalReceivable,
  };
}

// ─── Category Budgets ───
export async function getCategoryBudgets(
  db: SQLiteDatabase,
  cashbookId: number,
  year: number,
  month: number
): Promise<CategoryBudget[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const rows = await db.getAllAsync<CategoryBudget>(`
    SELECT cb.*, c.name as category_name, c.icon as category_icon,
           COALESCE((
             SELECT SUM(amount) FROM transactions
             WHERE cashbook_id = cb.cashbook_id
               AND category_id = cb.category_id
               AND type = 'expense'
               AND date >= ? AND date <= ?
           ), 0) as spent_amount
    FROM category_budgets cb
    JOIN categories c ON cb.category_id = c.id
    WHERE cb.cashbook_id = ? AND cb.month = ? AND cb.year = ?
    ORDER BY cb.monthly_limit DESC
  `, startDate, endDate, cashbookId, month, year);

  return rows;
}

export async function setCategoryBudget(
  db: SQLiteDatabase,
  data: { cashbook_id: number; category_id: number; monthly_limit: number; month: number; year: number }
): Promise<void> {
  await db.runAsync(`
    INSERT INTO category_budgets (cashbook_id, category_id, monthly_limit, month, year)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(cashbook_id, category_id, month, year)
    DO UPDATE SET monthly_limit = excluded.monthly_limit
  `, data.cashbook_id, data.category_id, data.monthly_limit, data.month, data.year);
}

export async function deleteCategoryBudget(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM category_budgets WHERE id = ?', id);
}

// ─── Savings Goals (Target Nabung) ───
export async function getSavingsGoals(db: SQLiteDatabase, cashbookId: number): Promise<SavingsGoal[]> {
  return db.getAllAsync<SavingsGoal>(
    'SELECT * FROM savings_goals WHERE cashbook_id = ? ORDER BY is_achieved ASC, created_at DESC',
    cashbookId
  );
}

export async function addSavingsGoal(
  db: SQLiteDatabase,
  data: { cashbook_id: number; name: string; target_amount: number; current_amount: number; target_date: string | null; icon: string; color: string }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO savings_goals (cashbook_id, name, target_amount, current_amount, target_date, icon, color, is_achieved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    data.cashbook_id, data.name, data.target_amount, data.current_amount, data.target_date, data.icon, data.color, data.current_amount >= data.target_amount ? 1 : 0
  );
  return result.lastInsertRowId;
}

export async function updateSavingsGoalDeposit(
  db: SQLiteDatabase,
  id: number,
  depositAmount: number,
  options?: {
    accountId?: number | null;
    isWithdrawal?: boolean;
    note?: string;
  }
): Promise<void> {
  const goal = await db.getFirstAsync<SavingsGoal>('SELECT * FROM savings_goals WHERE id = ?', id);
  if (!goal) return;

  const actualDelta = options?.isWithdrawal ? -Math.abs(depositAmount) : Math.abs(depositAmount);
  const newCurrent = Math.max(0, goal.current_amount + actualDelta);
  const isAchieved = newCurrent >= goal.target_amount ? 1 : 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE savings_goals SET current_amount = ?, is_achieved = ? WHERE id = ?',
      newCurrent,
      isAchieved,
      id
    );

    // Jika rekening dipilih, buat transaksi mutasi
    if (options?.accountId) {
      let category = await db.getFirstAsync<Category>("SELECT * FROM categories WHERE name = 'Tabungan' LIMIT 1");
      let categoryId = category?.id;
      if (!categoryId) {
        const catRes = await db.runAsync("INSERT INTO categories (name, icon, is_default) VALUES ('Tabungan', '🎯', 1)");
        categoryId = catRes.lastInsertRowId;
      }

      const isOut = !options.isWithdrawal; // setor nabung = uang keluar dari dompet masuk ke tabungan
      const txType: 'income' | 'expense' = isOut ? 'expense' : 'income';
      const actionLabel = isOut ? 'Setor ke Impian' : 'Tarik dari Impian';
      const txNote = options.note ? `${actionLabel} [${goal.name}]: ${options.note}` : `${actionLabel} [${goal.name}]`;
      const nowStr = new Date().toISOString();

      await db.runAsync(
        'INSERT INTO transactions (cashbook_id, account_id, type, amount, category_id, note, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        goal.cashbook_id,
        options.accountId,
        txType,
        Math.abs(depositAmount),
        categoryId,
        txNote,
        nowStr
      );
    }
  });
}

export async function updateSavingsGoal(
  db: SQLiteDatabase,
  id: number,
  data: {
    name: string;
    target_amount: number;
    target_date: string | null;
    icon: string;
    color: string;
  }
): Promise<void> {
  const goal = await db.getFirstAsync<SavingsGoal>('SELECT current_amount FROM savings_goals WHERE id = ?', id);
  const currentAmount = goal?.current_amount ?? 0;
  await db.runAsync(
    'UPDATE savings_goals SET name = ?, target_amount = ?, target_date = ?, icon = ?, color = ?, is_achieved = ? WHERE id = ?',
    data.name,
    data.target_amount,
    data.target_date,
    data.icon,
    data.color,
    currentAmount >= data.target_amount ? 1 : 0,
    id
  );
}

export async function deleteSavingsGoal(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM savings_goals WHERE id = ?', id);
}

// ─── App Settings (PIN & Preferences) ───
export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, value
  );
}

// ─── Recurring Rules (Transaksi Berulang) ───
export async function getRecurringRules(db: SQLiteDatabase, cashbookId: number): Promise<RecurringRule[]> {
  return db.getAllAsync<RecurringRule>(`
    SELECT r.*, c.name as category_name, c.icon as category_icon, a.name as account_name
    FROM recurring_rules r
    JOIN categories c ON r.category_id = c.id
    LEFT JOIN accounts a ON r.account_id = a.id
    WHERE r.cashbook_id = ?
    ORDER BY r.next_due_date ASC, r.created_at DESC
  `, cashbookId);
}

export async function addRecurringRule(
  db: SQLiteDatabase,
  data: {
    cashbook_id: number;
    account_id?: number | null;
    category_id: number;
    type: 'income' | 'expense';
    amount: number;
    note: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    next_due_date: string;
    is_auto_execute?: number;
    last_paid_period?: string | null;
  }
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO recurring_rules (cashbook_id, account_id, category_id, type, amount, note, frequency, next_due_date, is_auto_execute, last_paid_period, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
    data.cashbook_id,
    data.account_id ?? 1,
    data.category_id,
    data.type,
    data.amount,
    data.note,
    data.frequency,
    data.next_due_date,
    data.is_auto_execute ?? 1,
    data.last_paid_period ?? null
  );
  return result.lastInsertRowId;
}

export async function updateRecurringRule(
  db: SQLiteDatabase,
  id: number,
  data: {
    category_id: number;
    account_id: number;
    type: 'income' | 'expense';
    amount: number;
    note: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    next_due_date: string;
    is_auto_execute?: number;
    last_paid_period?: string | null;
  }
): Promise<void> {
  await db.runAsync(
    'UPDATE recurring_rules SET category_id = ?, account_id = ?, type = ?, amount = ?, note = ?, frequency = ?, next_due_date = ?, is_auto_execute = COALESCE(?, is_auto_execute), last_paid_period = COALESCE(?, last_paid_period) WHERE id = ?',
    data.category_id,
    data.account_id,
    data.type,
    data.amount,
    data.note,
    data.frequency,
    data.next_due_date,
    data.is_auto_execute !== undefined ? data.is_auto_execute : null,
    data.last_paid_period !== undefined ? data.last_paid_period : null,
    id
  );
}

// Konfirmasi bayar tagihan manual: catat transaksi dan tandai periode lunas
export async function payScheduledBill(
  db: SQLiteDatabase,
  ruleId: number,
  periodStr: string,
  targetAccountId: number,
  payDate: string
): Promise<void> {
  const rule = await db.getFirstAsync<RecurringRule>('SELECT * FROM recurring_rules WHERE id = ?', ruleId);
  if (!rule) return;

  // Catat transaksi pengeluaran / pemasukan
  await db.runAsync(
    'INSERT INTO transactions (cashbook_id, account_id, type, amount, category_id, note, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    rule.cashbook_id,
    targetAccountId,
    rule.type,
    rule.amount,
    rule.category_id,
    rule.note
      ? (rule.type === 'income' ? `Pemasukan Rutin: ${rule.note}` : `Pengeluaran Rutin: ${rule.note}`)
      : (rule.type === 'income' ? 'Pemasukan Rutin' : 'Pengeluaran Rutin'),
    payDate
  );

  // Tandai last_paid_period
  await db.runAsync('UPDATE recurring_rules SET last_paid_period = ? WHERE id = ?', periodStr, ruleId);
}

export async function toggleRecurringRule(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE recurring_rules SET is_active = CASE WHEN is_active = 0 THEN 1 ELSE 0 END WHERE id = ?', id);
}

export async function deleteRecurringRule(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM recurring_rules WHERE id = ?', id);
}

// Otomatis generate transaksi jika tanggal jatuh tempo sudah terlewati / hari ini
export async function processDueRecurringTransactions(db: SQLiteDatabase): Promise<number> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const dueRules = await db.getAllAsync<RecurringRule>(
      'SELECT * FROM recurring_rules WHERE is_active = 1 AND is_auto_execute = 1 AND next_due_date <= ?',
      today
    );

    let processedCount = 0;

    for (const rule of dueRules) {
      // Buat transaksi baru
      await db.runAsync(
        'INSERT INTO transactions (cashbook_id, account_id, type, amount, category_id, note, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        rule.cashbook_id,
        rule.account_id ?? 1,
        rule.type,
        rule.amount,
        rule.category_id,
        rule.note ? `${rule.note} (Otomatis Rutin)` : '(Otomatis Rutin)',
        rule.next_due_date
      );

      // Hitung tanggal jatuh tempo berikutnya
      const currentDue = new Date(rule.next_due_date);
      if (rule.frequency === 'daily') {
        currentDue.setDate(currentDue.getDate() + 1);
      } else if (rule.frequency === 'weekly') {
        currentDue.setDate(currentDue.getDate() + 7);
      } else if (rule.frequency === 'monthly') {
        currentDue.setMonth(currentDue.getMonth() + 1);
      }
      const nextDateStr = currentDue.toISOString().slice(0, 10);

      await db.runAsync(
        'UPDATE recurring_rules SET next_due_date = ?, last_processed = ? WHERE id = ?',
        nextDateStr,
        today,
        rule.id
      );

      processedCount++;
    }

    return processedCount;
  } catch (err) {
    console.warn('processDueRecurringTransactions error:', err);
    return 0;
  }
}

export interface MonthlyBill {
  id: number;
  cashbook_id: number;
  name: string;
  amount: number;
  due_day: number;
  category_id: number | null;
  account_id: number | null;
  last_paid_month: string | null;
  icon: string;
  color: string;
  note: string;
  is_active: number;
  created_at: string;
  category_name?: string;
  category_icon?: string;
  account_name?: string;
}

export async function getMonthlyBills(db: SQLiteDatabase, cashbookId: number): Promise<MonthlyBill[]> {
  return db.getAllAsync<MonthlyBill>(`
    SELECT mb.*, c.name as category_name, c.icon as category_icon, a.name as account_name
    FROM monthly_bills mb
    LEFT JOIN categories c ON mb.category_id = c.id
    LEFT JOIN accounts a ON mb.account_id = a.id
    WHERE mb.cashbook_id = ?
    ORDER BY mb.due_day ASC
  `, cashbookId);
}

export async function addMonthlyBill(
  db: SQLiteDatabase,
  data: {
    cashbook_id: number;
    name: string;
    amount: number;
    due_day: number;
    category_id?: number | null;
    account_id?: number | null;
    icon?: string;
    color?: string;
    note?: string;
  }
): Promise<number> {
  const result = await db.runAsync(`
    INSERT INTO monthly_bills (cashbook_id, name, amount, due_day, category_id, account_id, icon, color, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    data.cashbook_id,
    data.name,
    data.amount,
    data.due_day,
    data.category_id ?? null,
    data.account_id ?? null,
    data.icon ?? '📄',
    data.color ?? '#0F766E',
    data.note ?? ''
  );
  return result.lastInsertRowId;
}

export async function updateMonthlyBill(
  db: SQLiteDatabase,
  id: number,
  data: {
    name: string;
    amount: number;
    due_day: number;
    category_id?: number | null;
    account_id?: number | null;
    icon?: string;
    color?: string;
    note?: string;
  }
): Promise<void> {
  await db.runAsync(`
    UPDATE monthly_bills
    SET name = ?, amount = ?, due_day = ?, category_id = ?, account_id = ?, icon = ?, color = ?, note = ?
    WHERE id = ?
  `,
    data.name,
    data.amount,
    data.due_day,
    data.category_id ?? null,
    data.account_id ?? null,
    data.icon ?? '📄',
    data.color ?? '#0F766E',
    data.note ?? '',
    id
  );
}

export async function payMonthlyBill(
  db: SQLiteDatabase,
  billId: number,
  targetMonth: string,
  accountId: number,
  paidDate: string
): Promise<void> {
  const bill = await db.getFirstAsync<MonthlyBill>('SELECT * FROM monthly_bills WHERE id = ?', billId);
  if (!bill) return;

  await db.runAsync(`
    INSERT INTO transactions (cashbook_id, account_id, type, amount, category_id, note, date)
    VALUES (?, ?, 'expense', ?, ?, ?, ?)
  `,
    bill.cashbook_id,
    accountId,
    bill.amount,
    bill.category_id ?? 1,
    `Bayar Tagihan: ${bill.name} (${targetMonth})`,
    paidDate
  );

  await db.runAsync('UPDATE monthly_bills SET last_paid_month = ? WHERE id = ?', targetMonth, billId);
}

export async function deleteMonthlyBill(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM monthly_bills WHERE id = ?', id);
}

export async function toggleMonthlyBillActive(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE monthly_bills SET is_active = CASE WHEN is_active = 0 THEN 1 ELSE 0 END WHERE id = ?', id);
}
