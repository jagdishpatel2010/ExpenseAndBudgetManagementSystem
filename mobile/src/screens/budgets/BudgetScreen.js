/**
 * Monthly budget setup & status screen.
 *
 * Shows each budgeted category with its spend, limit, a progress bar and an
 * alert state (ok / warning / exceeded). Lets the user set or update a budget
 * for an expense category for the current month. Progress bars are color-coded
 * so a user can see at a glance where they are against each limit.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BudgetApi, CategoryApi } from '../../api/services';
import { Button, Card, Field, ErrorBanner, Loading, EmptyState } from '../../components/UI';
import { formatCurrency, currentMonth } from '../../utils/format';
import { colors, spacing, font, radius } from '../../theme';

export default function BudgetScreen() {
  const month = currentMonth();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Set-budget form.
  const [categoryId, setCategoryId] = useState(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [budgetData, catData] = await Promise.all([
        BudgetApi.list(month),
        CategoryApi.list('expense'),
      ]);
      setBudgets(budgetData.budgets);
      setCategories(catData.categories);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSave = async () => {
    setFormError('');
    const amt = Number(amount);
    if (!categoryId) {
      setFormError('Select a category');
      return;
    }
    if (!amount || Number.isNaN(amt) || amt < 0) {
      setFormError('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await BudgetApi.set({ categoryId, month, amount: amt });
      setAmount('');
      setCategoryId(null);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ErrorBanner message={error} onRetry={load} />
      <Text style={styles.monthLabel}>Budgets for {month}</Text>

      <Card>
        <Text style={styles.sectionTitle}>Set a budget</Text>
        <ErrorBanner message={formError} />
        <Text style={styles.label}>Category</Text>
        <View style={styles.chipWrap}>
          {categories.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.chip, categoryId === c.id && styles.chipActive]}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            >
              <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Monthly limit (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
        <Button title="Save Budget" onPress={onSave} loading={saving} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Budget status</Text>
        {budgets.length === 0 ? (
          <EmptyState title="No budgets set" message="Set a monthly limit for a category above." emoji="🎯" />
        ) : (
          budgets.map((b) => <BudgetBar key={b.budgetId} budget={b} />)
        )}
      </Card>
    </ScrollView>
  );
}

/**
 * A single category budget row with a colored progress bar.
 * @param {object} props
 * @param {object} props.budget - Budget status object from the API
 *   ({ categoryName, spent, budget, percent, state }).
 */
function BudgetBar({ budget }) {
  // Map the server-computed state to a bar color.
  const barColor =
    budget.state === 'exceeded'
      ? colors.danger
      : budget.state === 'warning'
      ? colors.warning
      : colors.success;
  const width = Math.min(budget.percent, 100);

  return (
    <View style={styles.budgetRow}>
      <View style={styles.budgetHead}>
        <Text style={styles.budgetName}>{budget.categoryName}</Text>
        <Text style={styles.budgetPercent}>{budget.percent}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${width}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.budgetMeta}>
        {formatCurrency(budget.spent)} of {formatCurrency(budget.budget)}
        {budget.state === 'exceeded' ? '  ·  Over budget!' : budget.state === 'warning' ? '  ·  Approaching limit' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  monthLabel: { fontSize: font.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  label: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#fff' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: font.small },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  budgetRow: { marginBottom: spacing.lg },
  budgetHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  budgetName: { fontSize: font.body, fontWeight: '600', color: colors.text },
  budgetPercent: { fontSize: font.small, color: colors.textMuted, fontWeight: '700' },
  track: { height: 10, backgroundColor: colors.border, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 10, borderRadius: radius.pill },
  budgetMeta: { fontSize: font.small, color: colors.textMuted, marginTop: spacing.xs },
});
