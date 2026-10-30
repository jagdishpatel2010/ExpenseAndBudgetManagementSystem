/**
 * Home dashboard screen.
 *
 * Shows the headline balance, total income/expense, period summaries (today /
 * week / month), quick-add buttons, and the latest transactions. Re-fetches on
 * focus so figures stay current after adding or editing a transaction.
 */
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { InsightsApi } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import { Card, Loading, ErrorBanner, EmptyState } from '../../components/UI';
import { formatCurrency, formatDate } from '../../utils/format';
import { colors, spacing, font, radius } from '../../theme';

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await InsightsApi.summary();
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload every time the tab gains focus.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) return <Loading />;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ErrorBanner message={error} onRetry={load} />

      <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'} 👋</Text>

      {/* Balance hero card */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Available Balance</Text>
        <Text style={styles.heroValue}>{formatCurrency(summary?.balance)}</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroCol}>
            <Text style={styles.heroColLabel}>Income</Text>
            <Text style={styles.heroIncome}>{formatCurrency(summary?.totalIncome)}</Text>
          </View>
          <View style={styles.heroCol}>
            <Text style={styles.heroColLabel}>Expense</Text>
            <Text style={styles.heroExpense}>{formatCurrency(summary?.totalExpense)}</Text>
          </View>
        </View>
      </View>

      {/* Quick add actions */}
      <View style={styles.quickRow}>
        <Pressable
          style={[styles.quickBtn, { backgroundColor: colors.income }]}
          onPress={() => navigation.navigate('AddTransaction', { type: 'income' })}
          accessibilityRole="button"
        >
          <Text style={styles.quickText}>＋ Add Income</Text>
        </Pressable>
        <Pressable
          style={[styles.quickBtn, { backgroundColor: colors.expense }]}
          onPress={() => navigation.navigate('AddTransaction', { type: 'expense' })}
          accessibilityRole="button"
        >
          <Text style={styles.quickText}>－ Add Expense</Text>
        </Pressable>
      </View>

      {/* Period summaries */}
      <Card>
        <Text style={styles.sectionTitle}>This Period</Text>
        <PeriodRow label="Today" data={summary?.today} />
        <PeriodRow label="This Week" data={summary?.week} />
        <PeriodRow label="This Month" data={summary?.month} />
      </Card>

      {/* Recent transactions */}
      <Card>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {summary?.recent?.length ? (
          summary.recent.map((t) => (
            <Pressable
              key={t.id}
              style={styles.txnRow}
              onPress={() => navigation.navigate('TransactionDetail', { id: t.id })}
            >
              <View style={styles.txnIcon}>
                <Text style={{ fontSize: 18 }}>{t.type === 'income' ? '⬇️' : '⬆️'}</Text>
              </View>
              <View style={styles.txnBody}>
                <Text style={styles.txnTitle}>{t.categoryName || 'Uncategorized'}</Text>
                <Text style={styles.txnSub}>
                  {t.note ? `${t.note} · ` : ''}
                  {formatDate(t.date)}
                </Text>
              </View>
              <Text style={[styles.txnAmount, { color: t.type === 'income' ? colors.income : colors.expense }]}>
                {t.type === 'income' ? '+' : '-'}
                {formatCurrency(t.amount, false)}
              </Text>
            </Pressable>
          ))
        ) : (
          <EmptyState
            title="No transactions yet"
            message="Add your first income or expense to get started."
            emoji="🧾"
          />
        )}
      </Card>
    </ScrollView>
  );
}

/**
 * One row of the "This Period" summary card.
 * @param {object} props
 * @param {string} props.label - Period label.
 * @param {{income:number, expense:number}} [props.data] - Period totals.
 */
function PeriodRow({ label, data }) {
  return (
    <View style={styles.periodRow}>
      <Text style={styles.periodLabel}>{label}</Text>
      <View style={styles.periodValues}>
        <Text style={styles.periodIncome}>+{formatCurrency(data?.income || 0, false)}</Text>
        <Text style={styles.periodExpense}>-{formatCurrency(data?.expense || 0, false)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  greeting: { fontSize: font.h2, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  heroLabel: { color: '#dbe7ff', fontSize: font.small },
  heroValue: { color: '#fff', fontSize: 34, fontWeight: '800', marginVertical: spacing.sm },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  heroCol: {},
  heroColLabel: { color: '#dbe7ff', fontSize: font.tiny },
  heroIncome: { color: '#bbf7d0', fontSize: font.h3, fontWeight: '700' },
  heroExpense: { color: '#fecaca', fontSize: font.h3, fontWeight: '700' },
  quickRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  quickBtn: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center' },
  quickText: { color: '#fff', fontWeight: '700', fontSize: font.body },
  sectionTitle: { fontSize: font.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  periodRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  periodLabel: { fontSize: font.body, color: colors.text },
  periodValues: { flexDirection: 'row', gap: spacing.md },
  periodIncome: { color: colors.income, fontWeight: '600' },
  periodExpense: { color: colors.expense, fontWeight: '600' },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  txnIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  txnBody: { flex: 1 },
  txnTitle: { fontSize: font.body, fontWeight: '600', color: colors.text },
  txnSub: { fontSize: font.small, color: colors.textMuted },
  txnAmount: { fontSize: font.body, fontWeight: '700' },
});
