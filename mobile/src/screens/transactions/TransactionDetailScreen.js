/**
 * Transaction detail screen.
 *
 * Shows the full detail of a single transaction (amount, type, category, note,
 * date, unique reference and timestamps) and offers Edit and Delete actions.
 * Delete asks for confirmation before calling the API, then navigates back.
 */
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TransactionApi } from '../../api/services';
import { Button, Card, Loading, ErrorBanner, Badge } from '../../components/UI';
import { formatCurrency, formatDate } from '../../utils/format';
import { colors, spacing, font } from '../../theme';

export default function TransactionDetailScreen({ navigation, route }) {
  const { id } = route.params;
  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await TransactionApi.get(id);
      setTxn(data.transaction);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Reload on focus so edits made on the edit screen are reflected on return.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onDelete = () => {
    Alert.alert('Delete transaction', 'This action cannot be undone. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await TransactionApi.remove(id);
            navigation.goBack();
          } catch (err) {
            setError(err.message);
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) return <Loading />;
  if (!txn) {
    return (
      <View style={styles.flex}>
        <ErrorBanner message={error || 'Transaction not found'} onRetry={load} />
      </View>
    );
  }

  const isIncome = txn.type === 'income';

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ErrorBanner message={error} />
      <Card>
        <Text style={styles.amountLabel}>{isIncome ? 'Income' : 'Expense'}</Text>
        <Text style={[styles.amount, { color: isIncome ? colors.income : colors.expense }]}>
          {isIncome ? '+' : '-'}
          {formatCurrency(txn.amount)}
        </Text>
        <Badge label={txn.type} color={isIncome ? colors.income : colors.expense} />
      </Card>

      <Card>
        <DetailRow label="Category" value={txn.categoryName || 'Uncategorized'} />
        <DetailRow label="Date" value={formatDate(txn.date)} />
        <DetailRow label="Note" value={txn.note || '—'} />
        <DetailRow label="Transaction ID" value={txn.txnRef} mono />
        <DetailRow label="Created" value={txn.createdAt} />
        {txn.updatedAt && txn.updatedAt !== txn.createdAt ? (
          <DetailRow label="Last updated" value={txn.updatedAt} />
        ) : null}
      </Card>

      <Button title="Edit" onPress={() => navigation.navigate('AddTransaction', { editId: txn.id })} />
      <View style={{ height: spacing.sm }} />
      <Button title="Delete" variant="danger" onPress={onDelete} loading={deleting} />
    </ScrollView>
  );
}

/**
 * Labeled key/value row within a detail card.
 * @param {object} props
 * @param {string} props.label - Row label.
 * @param {string} props.value - Row value.
 * @param {boolean} [props.mono=false] - Render value in a monospace style.
 */
function DetailRow({ label, value, mono = false }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  amountLabel: { color: colors.textMuted, fontSize: font.small },
  amount: { fontSize: 34, fontWeight: '800', marginVertical: spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { color: colors.textMuted, fontSize: font.body },
  detailValue: { color: colors.text, fontSize: font.body, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  mono: { fontFamily: 'monospace' },
});
