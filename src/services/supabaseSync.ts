import { type SQLiteDatabase } from 'expo-sqlite';
import { supabase } from './supabaseClient';
import { setSetting } from '../database/queries';
import { getCurrentGoogleUser, type GoogleUserInfo } from '../utils/googleDrive';

export interface SyncStats {
  pushed: number;
  pulled: number;
}

let isSyncInProgress = false;

function getDeterministicPassword(googleUser: GoogleUserInfo): string {
  return `CatatKu_Sec!_${googleUser.id}_${googleUser.email.toLowerCase()}`;
}

export async function linkGoogleAccountToSupabase(googleUser: GoogleUserInfo) {
  const email = googleUser.email.toLowerCase().trim();
  const password = getDeterministicPassword(googleUser);

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!signInError && signInData?.session) {
    return signInData.session;
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        google_id: googleUser.id,
        display_name: googleUser.name ?? '',
      },
    },
  });

  if (signUpError) {
    console.warn('Supabase linkGoogleAccount signUp error:', signUpError);
  }

  if (signUpData?.session) {
    return signUpData.session;
  }

  const { data: retryData } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return retryData?.session || null;
}

export async function unlinkSupabaseSession() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('unlinkSupabaseSession error:', e);
  }
}

export async function ensureSupabaseSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session;

  const googleUser = await getCurrentGoogleUser();
  if (googleUser) {
    const linkedSession = await linkGoogleAccountToSupabase(googleUser);
    if (linkedSession) return linkedSession;
  }

  try {
    const { data } = await supabase.auth.signInAnonymously();
    if (data?.session) return data.session;
  } catch {}

  return null;
}

export async function pushLocalDataToSupabase(db: SQLiteDatabase): Promise<number> {
  const session = await ensureSupabaseSession();
  const userId = session?.user?.id;
  if (!userId) return 0;

  let totalPushed = 0;

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

export async function pullCloudDataToLocal(db: SQLiteDatabase): Promise<number> {
  const session = await ensureSupabaseSession();
  if (!session?.user?.id) return 0;

  let pulledCount = 0;

  const { data: remoteBooks } = await supabase.from('cashbooks').select('*');
  const bookMap = new Map<string, number>();
  if (remoteBooks && remoteBooks.length > 0) {
    for (const b of remoteBooks) {
      const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM cashbooks WHERE name = ?', b.name);
      if (existing) {
        bookMap.set(b.client_id, existing.id);
      } else {
        const ins = await db.runAsync(
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
        bookMap.set(b.client_id, ins.lastInsertRowId);
        pulledCount++;
      }
    }
  }

  const { data: remoteCategories } = await supabase.from('categories').select('*');
  const categoryMap = new Map<string, number>();
  if (remoteCategories && remoteCategories.length > 0) {
    for (const c of remoteCategories) {
      const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE name = ?', c.name);
      if (existing) {
        categoryMap.set(c.client_id, existing.id);
      } else {
        const ins = await db.runAsync(
          `INSERT INTO categories (name, icon, is_default) VALUES (?, ?, ?)`,
          c.name,
          c.icon ?? '📦',
          c.is_default ?? 0
        );
        categoryMap.set(c.client_id, ins.lastInsertRowId);
        pulledCount++;
      }
    }
  }

  const defaultBook = await db.getFirstAsync<{ id: number }>('SELECT id FROM cashbooks ORDER BY id ASC LIMIT 1');
  const defaultCategory = await db.getFirstAsync<{ id: number }>('SELECT id FROM categories ORDER BY id ASC LIMIT 1');
  const fallbackBookId = defaultBook?.id ?? 1;
  const fallbackCategoryId = defaultCategory?.id ?? 1;

  const { data: remoteAccounts } = await supabase.from('accounts').select('*');
  const accountMap = new Map<string, number>();
  if (remoteAccounts && remoteAccounts.length > 0) {
    for (const a of remoteAccounts) {
      const targetBookId = bookMap.get(a.cashbook_client_id) || fallbackBookId;
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM accounts WHERE name = ? AND cashbook_id = ?',
        a.name,
        targetBookId
      );
      if (existing) {
        accountMap.set(a.client_id, existing.id);
      } else {
        const ins = await db.runAsync(
          `INSERT INTO accounts (cashbook_id, name, type, balance, min_balance, icon, color, is_default, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          targetBookId,
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
        accountMap.set(a.client_id, ins.lastInsertRowId);
        pulledCount++;
      }
    }
  }

  const defaultAccount = await db.getFirstAsync<{ id: number }>('SELECT id FROM accounts ORDER BY id ASC LIMIT 1');
  const fallbackAccountId = defaultAccount?.id ?? 1;

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
        const resolvedBookId = bookMap.get(t.cashbook_client_id) || fallbackBookId;
        const resolvedAccId = (t.account_client_id && accountMap.get(t.account_client_id)) || fallbackAccountId;
        const resolvedCatId = categoryMap.get(t.category_client_id) || fallbackCategoryId;

        await db.runAsync(
          `INSERT INTO transactions (cashbook_id, account_id, type, amount, category_id, note, date, receipt_image_uri, is_void, void_reason, voided_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          resolvedBookId,
          resolvedAccId,
          t.type,
          t.amount,
          resolvedCatId,
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
          t.void_reason ?? 'Void via Supabase Cloud',
          t.voided_at ?? new Date().toISOString(),
          existing.id
        );
      }
    }
  }

  const { data: remoteTransfers } = await supabase.from('transfers').select('*');
  if (remoteTransfers && remoteTransfers.length > 0) {
    for (const tr of remoteTransfers) {
      const existing = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM transfers WHERE amount = ? AND date = ? AND created_at = ?`,
        tr.amount,
        tr.date,
        tr.created_at
      );
      if (!existing) {
        const resolvedBookId = bookMap.get(tr.cashbook_client_id) || fallbackBookId;
        const resolvedFrom = accountMap.get(tr.from_account_client_id) || fallbackAccountId;
        const resolvedTo = accountMap.get(tr.to_account_client_id) || fallbackAccountId;

        await db.runAsync(
          `INSERT INTO transfers (cashbook_id, from_account_id, to_account_id, amount, fee, date, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          resolvedBookId,
          resolvedFrom,
          resolvedTo,
          tr.amount,
          tr.fee ?? 0,
          tr.date,
          tr.note ?? '',
          tr.created_at
        );
        pulledCount++;
      }
    }
  }

  const { data: remoteDebts } = await supabase.from('debts').select('*');
  if (remoteDebts && remoteDebts.length > 0) {
    for (const d of remoteDebts) {
      const existing = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM debts WHERE person_name = ? AND amount = ? AND created_at = ?`,
        d.person_name,
        d.amount,
        d.created_at
      );
      if (!existing) {
        const resolvedBookId = bookMap.get(d.cashbook_client_id) || fallbackBookId;
        const resolvedAccId = (d.account_client_id && accountMap.get(d.account_client_id)) || fallbackAccountId;

        await db.runAsync(
          `INSERT INTO debts (cashbook_id, account_id, type, person_name, amount, note, due_date, is_paid, date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          resolvedBookId,
          resolvedAccId,
          d.type,
          d.person_name,
          d.amount,
          d.note ?? '',
          d.due_date,
          d.is_paid ?? 0,
          d.date,
          d.created_at
        );
        pulledCount++;
      }
    }
  }

  return pulledCount;
}

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
