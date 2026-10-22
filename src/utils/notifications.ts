import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDebts, getMonthlyBills } from '../database/queries';
import { formatRupiah } from './currency';

// Konfigurasi notifikasi di foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

export interface DueReminderItem {
  id: string;
  title: string;
  description: string;
  amount: number;
  dueDateStr: string;
  daysRemaining: number;
  type: 'bill' | 'debt' | 'receivable';
}

export async function checkDueReminders(db: SQLiteDatabase, cashbookId: number): Promise<DueReminderItem[]> {
  const items: DueReminderItem[] = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12
  const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const currentDay = today.getDate();

  try {
    // 1. Tagihan Bulanan
    const bills = await getMonthlyBills(db, cashbookId);
    for (const b of bills) {
      if (b.is_active === 0) continue;
      // Cek apakah bulan ini sudah dibayar
      if (b.last_paid_month === currentMonthStr) continue;

      const daysDiff = b.due_day - currentDay;
      // Notifikasi jika jatuh tempo hari ini, besok, atau dalam 3 hari ke depan, atau sudah lewat
      if (daysDiff <= 3) {
        items.push({
          id: `bill-${b.id}`,
          title: `Tagihan: ${b.name}`,
          description: daysDiff < 0 
            ? `Sudah lewat jatuh tempo ${Math.abs(daysDiff)} hari!` 
            : daysDiff === 0 
            ? 'Jatuh tempo HARI INI!' 
            : `Jatuh tempo ${daysDiff} hari lagi (Tgl ${b.due_day})`,
          amount: b.amount,
          dueDateStr: `Tgl ${b.due_day} ${currentMonthStr}`,
          daysRemaining: daysDiff,
          type: 'bill',
        });
      }
    }

    // 2. Hutang / Piutang
    const debts = await getDebts(db, cashbookId, { is_paid: 0 });
    for (const d of debts) {
      if (!d.due_date) continue;
      const dueDate = new Date(d.due_date.replace(' ', 'T'));
      if (isNaN(dueDate.getTime())) continue;

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 3) {
        const isDebt = d.type === 'debt';
        items.push({
          id: `debt-${d.id}`,
          title: isDebt ? `Hutang ke ${d.person_name}` : `Piutang dari ${d.person_name}`,
          description: diffDays < 0 
            ? `Sudah lewat jatuh tempo ${Math.abs(diffDays)} hari!` 
            : diffDays === 0 
            ? 'Jatuh tempo HARI INI!' 
            : `Jatuh tempo ${diffDays} hari lagi`,
          amount: d.remaining_amount,
          dueDateStr: d.due_date.slice(0, 10),
          daysRemaining: diffDays,
          type: isDebt ? 'debt' : 'receivable',
        });
      }
    }
  } catch (e) {
    console.warn('Error checking due reminders:', e);
  }

  return items;
}

// Kirim notifikasi lokal sistem ke notification bar Android jika ada yang jatuh tempo
export async function triggerLocalNotificationIfDue(db: SQLiteDatabase, cashbookId: number): Promise<void> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const dueItems = await checkDueReminders(db, cashbookId);
  const urgentItems = dueItems.filter((i) => i.daysRemaining <= 1);

  if (urgentItems.length > 0) {
    const first = urgentItems[0];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ Pengingat: ${first.title}`,
        body: `${first.description} (${formatRupiah(first.amount)})`,
        sound: true,
      },
      trigger: null, // langsung kirim sekarang
    });
  }
}
