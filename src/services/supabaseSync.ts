import { type SQLiteDatabase } from 'expo-sqlite';
import { supabase } from './supabaseClient';
import { setSetting } from '../database/queries';

export interface SyncStats {
  pushed: number;
  pulled: number;
}

let isSyncInProgress = false;

/**
 * Pastikan user sudah terautentikasi (Anonymous auth atau login)
 * Jika belum ada session, gunakan signInAnonymously agar RLS auth.uid() valid
 */
export async function ensureSupabaseSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('Supabase signInAnonymously error:', error);
    throw error;
  }
  return data.session;
}

/**
 * 1. PUSH: Kirim data lokal SQLite ke Supabase Cloud
 */
export async function pushLocalDataToSupabase(db: SQLiteDatabase): Promise<number> {
  const session = await ensureSupabaseSession();
  const userId = session?.user?.id;
  if (!userId) return 0;

  let totalPushed = 0;

  // 1. Cashbooks
  const cashbooks = await db.getAllAsync<any>('SELECT * FROM cashbooks');
  if (cashbooks.length > 0) {
    const payload = cashbooks.map((b) => ({
      client_id: String(b.id),
      user_id: userId,
      name: b.name,
      icon: b.icon ?? '📖',
      color: b.color ?? '#0F766E',
      budget_limit: b.budget_limit,
      is_archived: b.is_archived ?? 0,
      is_default: b.is_default ?? 0,
      type: b.type ?? 'personal',
      created_at: b.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('cashbooks').upsert(payload, { onConflict: 'user_id,client_id' });
    if (!error) totalPushed += payload.length;
  }

  // 2. Categories
  const categories = await db.getAllAsync<any>('SELECT * FROM categories');
  if (categories.length > 0) {
    const payload = categories.map((c) => ({
      client_id: String(c.id),
      user_id: userId,
      name: c.name,
      icon: c.icon ?? '📦',
      is_default: c.is_default ?? 0,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('categories').upsert(payload, { onConflict: 'user_id,client_id' });
    if (!error) totalPushed += payload.length;
  }

  // 3. Accounts
  const accounts = await db.getAllAsync<any>('SELECT * FROM accounts');
  if (accounts.length > 0) {
    const payload = accounts.map((a) => ({
      client_id: String(a.id),
      cashbook_client_id: String(a.cashbook_id),
      user_id: userId,
      name: a.name,
      type: a.type,
      balance: a.balance ?? 0,
      min_balance: a.min_balance ?? 0,
      icon: a.icon ?? '💵',
      color: a.color ?? '#16A34A',
      is_default: a.is_default ?? 0,
      sort_order: a.sort_order ?? 0,
      created_at: a.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('accounts').upsert(payload, { onConflict: 'user_id,client_id' });
    if (!error) totalPushed += payload.length;
  }

  // 4. Transactions
  const transactions = await db.getAllAsync<any>('SELECT * FROM transactions');
  if (transactions.length > 0) {
    const payload = transactions.map((t) => ({
      client_id: String(t.id),
      cashbook_client_id: String(t.cashbook_id),
      account_client_id: t.account_id ? String(t.account_id) : null,
      category_client_id: String(t.category_id),
      user_id: userId,
      type: t.type,
      amount: t.amount,
      note: t.note ?? '',
      date: t.date,
      receipt_image_uri: t.receipt_image_uri ?? null,
      is_void: t.is_void ?? 0,
      void_reason: t.void_reason ?? null,
      voided_at: t.voided_at ?? null,
      created_at: t.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('transactions').upsert(payload, { onConflict: 'user_id,client_id' });
    if (!error) totalPushed += payload.length;
  }

  // 5. Transfers
  const transfers = await db.getAllAsync<any>('SELECT * FROM transfers');
  if (transfers.length > 0) {
    const payload = transfers.map((tr) => ({
      client_id: String(tr.id),
      cashbook_client_id: String(tr.cashbook_id),
      from_account_client_id: String(tr.from_account_id),
      to_account_client_id: String(tr.to_account_id),
      user_id: userId,
      amount: tr.amount,
      fee: tr.fee ?? 0,
      date: tr.date,
      note: tr.note ?? '',
      created_at: tr.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('transfers').upsert(payload, { onConflict: 'user_id,client_id' });
    if (!error) totalPushed += payload.length;
  }

  // 6. Debts
  const debts = await db.getAllAsync<any>('SELECT * FROM debts');
  if (debts.length > 0) {
    const payload = debts.map((d) => ({
      client_id: String(d.id),
      cashbook_client_id: String(d.cashbook_id),
      account_client_id: d.account_id ? String(d.account_id) : null,
      user_id: userId,
      type: d.type,
      person_name: d.person_name,
      amount: d.amount,
      note: d.note ?? '',
      due_date: d.due_date ?? null,
      is_paid: d.is_paid ?? 0,
      date: d.date,
      created_at: d.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('debts').upsert(payload, { onConflict: 'user_id,client_id' });
    if (!error) totalPushed += payload.length;
  }

  return totalPushed;
}

/**
 * 2. PULL: Ambil data dari Supabase Cloud dan sinkronkan ke SQLite lokal
 */
export async function pullCloudDataToLocal(db: SQLiteDatabase): Promise<number> {
  const session = await ensureSupabaseSession();
  if (!session?.user?.id) return 0;

  let pulledCount = 0;

  // 1. Tarik Cashbooks
  const { data: remoteBooks } = await supabase.from('cashbooks').select('*');
  if (remoteBooks && remoteBooks.length > 0) {
    for (const b of remoteBooks) {
      const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM cashbooks WHERE name = ?', b.name);
      if (!existing) {
        await db.runAsync(
          `INSERT INTO cashbooks (name, icon, color, budget_limit, is_archived, is_default, type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          b.name,
          b.icon ?? '📖',
          b.color ?? '#0F766E',
          b.budget_limit,
          b.is_archived ?? 0,
          b.is_default ?? 0,
          b.type ?? 'personal',
          b.created_at
        );
        pulledCount++;
      }
    }
  }

  // 2. Tarik Categories
  const { data: remoteCategories } = await supabase.from('categories').select('*');
  if (remoteCategories && remoteCategories.length > 0) {
    for (const c of remoteCategories) {
      const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE name = ?', c.name);
      if (!existing) {
        await db.runAsync(
          `INSERT INTO categories (name, icon, is_default) VALUES (?, ?, ?)`,
          c.name,
          c.icon ?? '📦',
          c.is_default ?? 0
        );
        pulledCount++;
      }
    }
  }

  // 3. Tarik Accounts
  const { data: remoteAccounts } = await supabase.from('accounts').select('*');
  if (remoteAccounts && remoteAccounts.length > 0) {
    for (const a of remoteAccounts) {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM accounts WHERE name = ?',
        a.name
      );
      if (!existing) {
        await db.runAsync(
          `INSERT INTO accounts (cashbook_id, name, type, balance, min_balance, icon, color, is_default, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          1,
          a.name,
          a.type,
          a.balance ?? 0,
          a.min_balance ?? 0,
          a.icon ?? '💵',
          a.color ?? '#16A34A',
          a.is_default ?? 0,
          a.sort_order ?? 0,
          a.created_at
        );
        pulledCount++;
      }
    }
  }

  // 4. Tarik Transactions
  const { data: remoteTxs } = await supabase.from('transactions').select('*');
  if (remoteTxs && remoteTxs.length > 0) {
    for (const t of remoteTxs) {
      const existing = await db.getFirstAsync<{ id: number; is_void: number }>(
        `SELECT id, is_void FROM transactions
         WHERE amount = ? AND date = ? AND created_at = ? AND note = ?`,
        t.amount,
        t.date,
        t.created_at,
        t.note ?? ''
      );

      if (!existing) {
        await db.runAsync(
          `INSERT INTO transactions (cashbook_id, account_id, type, amount, category_id, note, date, receipt_image_uri, is_void, void_reason, voided_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          1,
          1,
          t.type,
          t.amount,
          1,
          t.note ?? '',
          t.date,
          t.receipt_image_uri,
          t.is_void ?? 0,
          t.void_reason,
          t.voided_at,
          t.created_at
        );
        pulledCount++;
      } else if (t.is_void && !existing.is_void) {
        await db.runAsync(
          `UPDATE transactions SET is_void = 1, void_reason = ?, voided_at = ? WHERE id = ?`,
          t.void_reason ?? 'Void via Supabase',
          t.voided_at ?? new Date().toISOString(),
          existing.id
        );
      }
    }
  }

  return pulledCount;
}

/**
 * 3. SYNC LENGKAP: Pull lalu Push
 */
export async function syncWithSupabase(db: SQLiteDatabase): Promise<SyncStats> {
  if (isSyncInProgress) return { pushed: 0, pulled: 0 };
  try {
    isSyncInProgress = true;
    const pulled = await pullCloudDataToLocal(db);
    const pushed = await pushLocalDataToSupabase(db);
    await setSetting(db, 'last_supabase_sync', new Date().toISOString());
    return { pushed, pulled };
  } catch (err) {
    console.warn('syncWithSupabase error:', err);
    throw err;
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * 4. REALTIME CHANNEL LISTENER
 * Mendengarkan perubahan tabel secara instan dari perangkat lain via Supabase Realtime
 */
export function setupSupabaseRealtime(db: SQLiteDatabase, onDataChanged?: () => void) {
  const channel = supabase
    .channel('catatku-realtime-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      async () => {
        try {
          await pullCloudDataToLocal(db);
          if (onDataChanged) onDataChanged();
        } catch (e) {
          console.warn('Realtime sync handler error:', e);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
