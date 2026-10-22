import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useThemeStore } from '../src/stores/useThemeStore';
import { useCashbookStore } from '../src/stores/useCashbookStore';
import {
  getMonthlyBills,
  addMonthlyBill,
  updateMonthlyBill,
  payMonthlyBill,
  deleteMonthlyBill,
  getAccounts,
  getCategories,
  type MonthlyBill,
  type AccountWithCalculatedBalance,
  type Category,
} from '../src/database/queries';
import { formatRupiah, formatNumberThousand, parseRupiahInput } from '../src/utils/currency';
import { getNowFull } from '../src/utils/date';
import { FONTS } from '../src/constants/theme';
import { BackArrowIcon, EditActionIcon } from '../src/components/ActionIcons';
import DatePickerModal from '../src/components/DatePickerModal';

export default function BillsScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const palette = useThemeStore((s) => s.palette);
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const activeCashbook = useCashbookStore((s) => s.activeCashbook);
  const cashbookId = activeCashbook?.id ?? 1;

  const [bills, setBills] = useState<MonthlyBill[]>([]);
  const [accounts, setAccounts] = useState<AccountWithCalculatedBalance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Modal Tambah / Edit Tagihan
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState(10);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [selectedAccId, setSelectedAccId] = useState<number | null>(null);

  // Modal Bayar Tagihan
  const [payingBill, setPayingBill] = useState<MonthlyBill | null>(null);
  const [payAccId, setPayAccId] = useState<number | null>(null);

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentDay = today.getDate();

  const loadData = useCallback(async () => {
    try {
      const [billList, accList, catList] = await Promise.all([
        getMonthlyBills(db, cashbookId),
        getAccounts(db, cashbookId),
        getCategories(db),
      ]);
      setBills(billList);
      setAccounts(accList);
      setCategories(catList);

      if (accList.length > 0 && !selectedAccId) {
        setSelectedAccId(accList[0].id);
        setPayAccId(accList[0].id);
      }
      if (catList.length > 0 && !selectedCatId) {
        setSelectedCatId(catList[0].id);
      }
    } catch (e) {
      console.warn('loadData Bills error:', e);
    }
  }, [db, cashbookId, selectedAccId, selectedCatId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openAddModal = () => {
    setEditingBillId(null);
    setName('');
    setAmount('');
    setDueDay(10);
    if (accounts.length > 0) setSelectedAccId(accounts[0].id);
    if (categories.length > 0) setSelectedCatId(categories[0].id);
    setShowFormModal(true);
  };

  const openEditModal = (bill: MonthlyBill) => {
    setEditingBillId(bill.id);
    setName(bill.name);
    setAmount(formatNumberThousand(bill.amount));
    setDueDay(bill.due_day);
    setSelectedCatId(bill.category_id ?? null);
    setSelectedAccId(bill.account_id ?? null);
    setShowFormModal(true);
  };

  const handleSaveBill = async () => {
    const numAmount = parseRupiahInput(amount);

    if (!name.trim()) {
      Alert.alert('Perhatian', 'Nama tagihan wajib diisi');
      return;
    }
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Perhatian', 'Nominal tagihan harus lebih dari 0');
      return;
    }
    if (dueDay < 1 || dueDay > 31) {
      Alert.alert('Perhatian', 'Tanggal jatuh tempo harus antara 1 - 31');
      return;
    }

    try {
      if (editingBillId) {
        await updateMonthlyBill(db, editingBillId, {
          name: name.trim(),
          amount: numAmount,
          due_day: dueDay,
          category_id: selectedCatId,
          account_id: selectedAccId,
        });
      } else {
        await addMonthlyBill(db, {
          cashbook_id: cashbookId,
          name: name.trim(),
          amount: numAmount,
          due_day: dueDay,
          category_id: selectedCatId,
          account_id: selectedAccId,
        });
      }

      setShowFormModal(false);
      loadData();
    } catch {
      Alert.alert('Error', 'Gagal menyimpan tagihan');
    }
  };

  const handleConfirmPay = async () => {
    if (!payingBill || !payAccId) return;

    try {
      await payMonthlyBill(db, payingBill.id, currentMonthStr, payAccId, getNowFull());
      Alert.alert('Sukses', `Tagihan "${payingBill.name}" bulan ini berhasil dibayar dan dicatat sebagai pengeluaran.`);
      setPayingBill(null);
      loadData();
    } catch {
      Alert.alert('Error', 'Gagal memproses pembayaran tagihan');
    }
  };

  const handleDelete = (bill: MonthlyBill) => {
    Alert.alert('Hapus Tagihan', `Yakin ingin menghapus jadwal tagihan "${bill.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await deleteMonthlyBill(db, bill.id);
          loadData();
        },
      },
    ]);
  };

  // Helper date string untuk DatePickerModal
  const pickerDateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

  return (
    <View style={[styles.container, { backgroundColor: palette.canvas }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <View style={[styles.headerInner, isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' }]}>
          <View style={styles.headerLeft}>
            <Pressable
              style={({ pressed }) => [styles.backBtn, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.7 }]}
              onPress={() => router.back()}
            >
              <BackArrowIcon color={palette.ink} size={18} />
            </Pressable>
            <View>
              <Text style={[styles.headerSub, { color: palette.primary }]}>{activeCashbook?.name ?? 'Catatan'}</Text>
              <Text style={[styles.headerTitle, { color: palette.ink }]}>Tagihan Rutin Bulanan</Text>
            </View>
          </View>

          <Pressable
            style={[styles.addTopBtn, { backgroundColor: palette.primary }]}
            onPress={openAddModal}
          >
            <Text style={styles.addTopBtnText}>+ Tambah</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={bills}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          isTablet && { maxWidth: 840, width: '100%', alignSelf: 'center' },
          { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={[styles.emptyTitle, { color: palette.ink }]}>Belum Ada Tagihan</Text>
            <Text style={[styles.emptySub, { color: palette.inkMuted }]}>
              Jadwalkan tagihan bulanan seperti listrik, wifi, sewa, asuransi agar terpantau rapi.
            </Text>
            <Pressable
              style={[styles.emptyBtn, { backgroundColor: palette.primary }]}
              onPress={openAddModal}
            >
              <Text style={styles.emptyBtnText}>+ Buat Tagihan Pertama</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const isPaidThisMonth = item.last_paid_month === currentMonthStr;
          const daysLeft = item.due_day - currentDay;

          return (
            <View style={[styles.billCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.cardTopRow}>
                <View style={[styles.iconBox, { backgroundColor: palette.cardMuted }]}>
                  <Text style={{ fontSize: 20 }}>{item.icon || '📄'}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.billName, { color: palette.ink }]}>{item.name}</Text>
                  <Text style={[styles.billDue, { color: palette.inkMuted }]}>
                    Jatuh tempo tiap tgl {item.due_day}
                  </Text>
                </View>

                <View style={styles.amountWrap}>
                  <Text style={[styles.billAmount, { color: palette.expense }]}>{formatRupiah(item.amount)}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isPaidThisMonth
                          ? isDarkMode ? '#064E3B' : '#DCFCE7'
                          : isDarkMode ? '#451A03' : '#FEF3C7',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color: isPaidThisMonth
                            ? isDarkMode ? '#6EE7B7' : '#059669'
                            : isDarkMode ? '#FBBF24' : '#B45309',
                        },
                      ]}
                    >
                      {isPaidThisMonth ? '✓ Lunas Bulan Ini' : daysLeft < 0 ? '⚠️ Terlewat' : daysLeft === 0 ? 'Hari Ini!' : `${daysLeft} hari lagi`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons: Edit, Hapus, Bayar */}
              <View style={[styles.cardBottomRow, { borderTopColor: palette.borderSubtle }]}>
                <View style={styles.cardLeftActions}>
                  <Pressable
                    style={({ pressed }) => [styles.actionIconBtn, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.7 }]}
                    onPress={() => openEditModal(item)}
                    hitSlop={6}
                  >
                    <EditActionIcon color={palette.primary} size={15} />
                    <Text style={[styles.actionBtnLabel, { color: palette.primary }]}>Edit</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.actionIconBtn, { backgroundColor: palette.cardMuted }, pressed && { opacity: 0.7 }]}
                    onPress={() => handleDelete(item)}
                    hitSlop={6}
                  >
                    <Text style={[styles.actionBtnLabel, { color: palette.expense }]}>Hapus</Text>
                  </Pressable>
                </View>

                {!isPaidThisMonth && (
                  <Pressable
                    style={[styles.payBtn, { backgroundColor: palette.primary }]}
                    onPress={() => setPayingBill(item)}
                  >
                    <Text style={styles.payBtnText}>Bayar Sekarang</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.footerWrap}>
            <Text style={[styles.footerText, { color: palette.inkMuted }]}>© 2026 CatatKu</Text>
          </View>
        }
      />

      {/* Modal Tambah / Edit Tagihan */}
      <Modal visible={showFormModal} transparent animationType="slide" onRequestClose={() => setShowFormModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }, isTablet && { maxWidth: 520 }]}>
            <Text style={[styles.modalTitle, { color: palette.ink }]}>
              {editingBillId ? 'Edit Jadwal Tagihan' : 'Jadwal Tagihan Baru'}
            </Text>

            <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Nama Tagihan</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
              placeholder="Contoh: Listrik PLN, WiFi Indihome"
              placeholderTextColor={palette.inkMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Nominal (Rp)</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: palette.cardMuted, borderColor: palette.border, color: palette.ink }]}
              placeholder="0"
              placeholderTextColor={palette.inkMuted}
              keyboardType="numeric"
              value={amount}
              onChangeText={(text) => setAmount(formatNumberThousand(text))}
            />

            <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Tanggal Jatuh Tempo Tiap Bulan</Text>
            <Pressable
              style={[styles.datePickerTrigger, { backgroundColor: palette.cardMuted, borderColor: palette.border }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ fontSize: 16 }}>📅</Text>
              <Text style={[styles.datePickerTriggerText, { color: palette.ink }]}>
                Tiap tanggal {dueDay} setiap bulan
              </Text>
              <Text style={[styles.datePickerChangeHint, { color: palette.primary }]}>Pilih</Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.cancelModalBtn, { borderColor: palette.border }]}
                onPress={() => setShowFormModal(false)}
              >
                <Text style={[styles.cancelModalBtnText, { color: palette.inkMuted }]}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.saveModalBtn, { backgroundColor: palette.primary }]}
                onPress={handleSaveBill}
              >
                <Text style={styles.saveModalBtnText}>
                  {editingBillId ? 'Perbarui Tagihan' : 'Simpan Tagihan'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* DatePicker Visual Modal */}
      <DatePickerModal
        visible={showDatePicker}
        value={pickerDateValue}
        onSelect={(newDateStr) => {
          const parts = newDateStr.split(' ')[0].split('-');
          if (parts.length >= 3) {
            const pickedDay = parseInt(parts[2], 10);
            if (!isNaN(pickedDay)) setDueDay(pickedDay);
          }
        }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Modal Konfirmasi Pembayaran */}
      <Modal visible={!!payingBill} transparent animationType="fade" onRequestClose={() => setPayingBill(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }, isTablet && { maxWidth: 520 }]}>
            <Text style={[styles.modalTitle, { color: palette.ink }]}>Bayar Tagihan</Text>
            <Text style={[styles.confirmSubtitle, { color: palette.inkMuted }]}>
              {payingBill?.name} • Periode {currentMonthStr}
            </Text>

            <View style={[styles.amountPreviewBox, { backgroundColor: palette.cardMuted }]}>
              <Text style={[styles.amountPreviewLabel, { color: palette.inkMuted }]}>Total Potong Saldo</Text>
              <Text style={[styles.amountPreviewVal, { color: palette.expense }]}>
                {formatRupiah(payingBill?.amount ?? 0)}
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: palette.inkSecondary }]}>Pilih Dompet Sumber Pembayaran</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accScroll}>
              {accounts.map((acc) => {
                const isSelected = payAccId === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    style={[
                      styles.accPill,
                      { backgroundColor: palette.cardMuted, borderColor: palette.border },
                      isSelected && { borderColor: palette.primary, backgroundColor: isDarkMode ? '#16313B' : '#EAF6F3' },
                    ]}
                    onPress={() => setPayAccId(acc.id)}
                  >
                    <Text style={{ fontSize: 16 }}>{acc.icon}</Text>
                    <View>
                      <Text style={[styles.accPillName, { color: palette.ink }]}>{acc.name}</Text>
                      <Text style={[styles.accPillBal, { color: palette.inkMuted }]}>
                        {formatRupiah(acc.calculated_balance)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.cancelModalBtn, { borderColor: palette.border }]}
                onPress={() => setPayingBill(null)}
              >
                <Text style={[styles.cancelModalBtnText, { color: palette.inkMuted }]}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.saveModalBtn, { backgroundColor: palette.primary }]}
                onPress={handleConfirmPay}
              >
                <Text style={styles.saveModalBtnText}>Konfirmasi Bayar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSub: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
  },
  addTopBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addTopBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    color: '#FAF8F5',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  billCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  billName: {
    fontFamily: FONTS.sansBold,
    fontSize: 15,
  },
  billDue: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
    marginTop: 2,
  },
  amountWrap: {
    alignItems: 'flex-end',
  },
  billAmount: {
    fontFamily: FONTS.sansBold,
    fontSize: 15,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  statusBadgeText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  cardLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 11,
  },
  payBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  payBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    color: '#FAF8F5',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: FONTS.sansRegular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: '#FAF8F5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
  },
  modalTitle: {
    fontFamily: FONTS.serifTitle,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  confirmSubtitle: {
    fontFamily: FONTS.sansRegular,
    fontSize: 13,
    marginTop: -10,
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
  },
  datePickerTrigger: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerTriggerText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    flex: 1,
    marginLeft: 8,
  },
  datePickerChangeHint: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  amountPreviewBox: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  amountPreviewLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    marginBottom: 4,
  },
  amountPreviewVal: {
    fontFamily: FONTS.sansBold,
    fontSize: 22,
    fontWeight: '800',
  },
  accScroll: {
    marginVertical: 10,
  },
  accPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
  },
  accPillName: {
    fontFamily: FONTS.sansBold,
    fontSize: 12,
  },
  accPillBal: {
    fontFamily: FONTS.sansRegular,
    fontSize: 11,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  cancelModalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelModalBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
  },
  saveModalBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveModalBtnText: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: '#FAF8F5',
  },
  footerWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 'auto',
  },
  footerText: {
    fontFamily: FONTS.sansRegular,
    fontSize: 12,
  },
});
