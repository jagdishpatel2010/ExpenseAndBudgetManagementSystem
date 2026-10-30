/**
 * Add / Edit transaction screen.
 *
 * Used for both creating a new transaction and editing an existing one. When
 * navigated with route.params.editId it loads that transaction and switches to
 * edit mode. Handles type toggle (income/expense), amount, category selection,
 * note and date, with client-side validation and a budget-alert prompt when the
 * backend reports the expense breaches a budget.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CategoryApi, TransactionApi } from '../../api/services';
import { Button, Field, ErrorBanner, Loading } from '../../components/UI';
import { todayIso } from '../../utils/format';
import { colors, spacing, font, radius } from '../../theme';

export default function AddTransactionScreen({ navigation, route }) {
  const editId = route.params?.editId || null;
  const initialType = route.params?.type || 'expense';

  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayIso());
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editId ? 'Edit Transaction' : 'Add Transaction' });
  }, [editId, navigation]);

  useEffect(() => {
    // Load categories (and the transaction being edited, if any).
    (async () => {
      try {
        const catData = await CategoryApi.list();
        setCategories(catData.categories);
        if (editId) {
          const data = await TransactionApi.get(editId);
          const t = data.transaction;
          setType(t.type);
          setAmount(String(t.amount));
          setCategoryId(t.categoryId);
          setNote(t.note || '');
          setDate(t.date);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  // Categories relevant to the selected type.
  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  const validate = () => {
    const e = {};
    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) e.amount = 'Enter an amount greater than 0';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = 'Use date format YYYY-MM-DD';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSave = async () => {
    setError('');
    if (!validate()) return;
    setSaving(true);
    const payload = {
      type,
      amount: Number(amount),
      categoryId: categoryId ?? null,
      note: note.trim(),
      date,
    };
    try {
      if (editId) {
        await TransactionApi.update(editId, payload);
        navigation.goBack();
      } else {
        const result = await TransactionApi.create(payload);
        // Surface any budget alert returned by the backend.
        if (result.alert) {
          Alert.alert(result.alert.title, result.alert.body);
        }
        navigation.goBack();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ErrorBanner message={error} />

      {/* Type toggle */}
      <View style={styles.toggle}>
        <Pressable
          style={[styles.toggleBtn, type === 'expense' && styles.toggleActiveExpense]}
          onPress={() => { setType('expense'); setCategoryId(null); }}
        >
          <Text style={[styles.toggleText, type === 'expense' && styles.toggleTextActive]}>Expense</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, type === 'income' && styles.toggleActiveIncome]}
          onPress={() => { setType('income'); setCategoryId(null); }}
        >
          <Text style={[styles.toggleText, type === 'income' && styles.toggleTextActive]}>Income</Text>
        </Pressable>
      </View>

      <Field
        label="Amount (₹)"
        value={amount}
        onChangeText={setAmount}
        error={errors.amount}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.catWrap}>
        {visibleCategories.length === 0 ? (
          <Text style={styles.muted}>No {type} categories. Add one from Categories.</Text>
        ) : (
          visibleCategories.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.chip, categoryId === c.id && styles.chipActive]}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            >
              <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
            </Pressable>
          ))
        )}
      </View>

      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Lunch with Priya" maxLength={240} />
      <Field label="Date" value={date} onChangeText={setDate} error={errors.date} placeholder="YYYY-MM-DD" autoCapitalize="none" />

      <Button title={editId ? 'Save Changes' : 'Save Transaction'} onPress={onSave} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  toggle: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: radius.md, padding: 4, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  toggleBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.sm },
  toggleActiveExpense: { backgroundColor: colors.expense },
  toggleActiveIncome: { backgroundColor: colors.income },
  toggleText: { fontWeight: '700', color: colors.textMuted },
  toggleTextActive: { color: '#fff' },
  label: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.sm },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#fff' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: font.small },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: font.small },
});
