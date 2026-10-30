/**
 * Transaction history screen.
 *
 * Lists all of the user's transactions with search (note/reference) and filters
 * for type and category. Uses a FlatList for efficient scrolling, pull-to-
 * refresh, and shows an empty state when no transactions match. Tapping a row
 * opens the transaction detail screen.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CategoryApi, TransactionApi } from '../../api/services';
import { EmptyState, ErrorBanner, Loading } from '../../components/UI';
import { formatCurrency, formatDate } from '../../utils/format';
import { colors, spacing, font, radius } from '../../theme';

export default function HistoryScreen({ navigation }) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters.
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // '', 'income', 'expense'
  const [categoryFilter, setCategoryFilter] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [txnData, catData] = await Promise.all([
        TransactionApi.list({
          q: search || undefined,
          type: typeFilter || undefined,
          categoryId: categoryFilter || undefined,
          limit: 200,
        }),
        categories.length ? Promise.resolve({ categories }) : CategoryApi.list(),
      ]);
      setTransactions(txnData.transactions);
      if (!categories.length) setCategories(catData.categories);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // categories intentionally omitted: it is cached after first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, categoryFilter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const expenseCategories = useMemo(
    () => categories.filter((c) => (typeFilter ? c.type === typeFilter : true)),
    [categories, typeFilter]
  );

  const renderItem = ({ item }) => (
    <Pressable
      style={styles.row}
      onPress={() => navigation.navigate('TransactionDetail', { id: item.id })}
      accessibilityRole="button"
    >
      <View style={styles.iconCircle}>
        <Text style={{ fontSize: 18 }}>{item.type === 'income' ? '⬇️' : '⬆️'}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{item.categoryName || 'Uncategorized'}</Text>
        <Text style={styles.sub}>
          {item.note ? `${item.note} · ` : ''}
          {formatDate(item.date)}
        </Text>
        <Text style={styles.ref}>{item.txnRef}</Text>
      </View>
      <Text style={[styles.amount, { color: item.type === 'income' ? colors.income : colors.expense }]}>
        {item.type === 'income' ? '+' : '-'}
        {formatCurrency(item.amount, false)}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.flex}>
      {/* Search + filters header */}
      <View style={styles.filters}>
        <TextInput
          style={styles.search}
          placeholder="Search note or transaction ID"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={load}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <View style={styles.chipRow}>
          <FilterChip label="All" active={typeFilter === ''} onPress={() => setTypeFilter('')} />
          <FilterChip label="Income" active={typeFilter === 'income'} onPress={() => setTypeFilter('income')} />
          <FilterChip label="Expense" active={typeFilter === 'expense'} onPress={() => setTypeFilter('expense')} />
        </View>
        <View style={styles.chipRowWrap}>
          <FilterChip label="Any category" active={!categoryFilter} onPress={() => setCategoryFilter(null)} />
          {expenseCategories.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              active={categoryFilter === c.id}
              onPress={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
            />
          ))}
        </View>
      </View>

      <ErrorBanner message={error} onRetry={load} />

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={transactions.length === 0 ? styles.emptyWrap : styles.listContent}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          ListEmptyComponent={
            <EmptyState
              title="No transactions found"
              message="Try adjusting your search or filters, or add a new transaction."
              emoji="🔍"
            />
          }
        />
      )}

      {/* Floating add button */}
      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddTransaction')} accessibilityLabel="Add transaction">
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

/**
 * A small toggleable filter chip.
 * @param {object} props
 * @param {string} props.label - Chip text.
 * @param {boolean} props.active - Whether the chip is selected.
 * @param {() => void} props.onPress - Toggle handler.
 */
function FilterChip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  filters: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  search: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: font.body,
    color: colors.text, marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.textMuted, fontSize: font.small },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  listContent: { padding: spacing.md },
  emptyWrap: { flexGrow: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  body: { flex: 1 },
  title: { fontSize: font.body, fontWeight: '600', color: colors.text },
  sub: { fontSize: font.small, color: colors.textMuted },
  ref: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: font.body, fontWeight: '700' },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.lg,
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: -2 },
});
