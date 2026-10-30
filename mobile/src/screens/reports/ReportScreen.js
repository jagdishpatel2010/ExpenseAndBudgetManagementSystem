/**
 * Monthly report screen.
 *
 * Fetches the structured monthly report (totals, per-category breakdown, budget
 * comparison and the transaction list) and renders it. Also offers an "export"
 * action that opens the CSV endpoint: on web it triggers a download, and on
 * native it opens the CSV URL in the system browser so the file can be saved
 * or shared.
 */
import React, { useCallback, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { InsightsApi } from '../../api/services';
import { API_BASE_URL, getToken } from '../../api/client';
import { Button, Card, Loading, ErrorBanner, EmptyState } from '../../components/UI';
import { formatCurrency, formatDate, currentMonth } from '../../utils/format';
import { colors, spacing, font } from '../../theme';

export default function ReportScreen() {
  const month = currentMonth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await InsightsApi.monthlyReport(month);
      setReport(data);
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

  /**
   * Export the report as CSV. The CSV endpoint requires the auth token; since a
   * plain link cannot carry an Authorization header, the token is passed as a
   * query param that the browser request will include. On web we open it to
   * trigger a download; on native we hand it to the OS browser.
   */
  const onExport = async () => {
    const token = getToken();
    const url = `${API_BASE_URL}/api/reports/monthly?month=${month}&format=csv&token=${token}`;
    try {
      await Linking.openURL(url);
    } catch {
      setError('Unable to open the export. Please try again.');
    }
  };

  if (loading) return <Loading />;
  if (!report) {
    return (
      <View style={styles.flex}>
        <ErrorBanner message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ErrorBanner message={error} onRetry={load} />
      <Text style={styles.monthLabel}>Report for {report.month}</Text>

      <Card>
        <View style={styles.totalsRow}>
          <Totals label="Income" value={report.totals.income} color={colors.income} />
          <Totals label="Expense" value={report.totals.expense} color={colors.expense} />
          <Totals label="Balance" value={report.totals.balance} color={colors.primary} />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Expense by category</Text>
        {report.byCategory.length === 0 ? (
          <EmptyState title="No expenses" message="No expenses recorded this month." emoji="🧾" />
        ) : (
          report.byCategory.map((c) => (
            <View key={c.category} style={styles.catRow}>
              <Text style={styles.catName}>{c.category}</Text>
              <Text style={styles.catAmount}>{formatCurrency(c.total)}</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Transactions ({report.transactions.length})</Text>
        {report.transactions.length === 0 ? (
          <Text style={styles.muted}>No transactions this month.</Text>
        ) : (
          report.transactions.map((t) => (
            <View key={t.txnRef} style={styles.txnRow}>
              <View style={styles.txnLeft}>
                <Text style={styles.txnCat}>{t.category}</Text>
                <Text style={styles.txnMeta}>
                  {formatDate(t.date)} · {t.note || t.txnRef}
                </Text>
              </View>
              <Text style={[styles.txnAmt, { color: t.type === 'income' ? colors.income : colors.expense }]}>
                {t.type === 'income' ? '+' : '-'}
                {formatCurrency(t.amount, false)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Button title="Export as CSV" onPress={onExport} />
      <Text style={styles.exportHint}>
        {Platform.OS === 'web'
          ? 'Downloads a CSV of this month\u2019s transactions.'
          : 'Opens the CSV report in your browser to save or share.'}
      </Text>
    </ScrollView>
  );
}

/**
 * A totals cell in the summary card.
 * @param {object} props
 * @param {string} props.label - Totals label.
 * @param {number} props.value - Amount.
 * @param {string} props.color - Accent color.
 */
function Totals({ label, value, color }) {
  return (
    <View style={styles.totalsCell}>
      <Text style={styles.totalsLabel}>{label}</Text>
      <Text style={[styles.totalsValue, { color }]}>{formatCurrency(value, false)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  monthLabel: { fontSize: font.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalsCell: { alignItems: 'center', flex: 1 },
  totalsLabel: { fontSize: font.small, color: colors.textMuted },
  totalsValue: { fontSize: font.h3, fontWeight: '800', marginTop: spacing.xs },
  sectionTitle: { fontSize: font.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  catName: { fontSize: font.body, color: colors.text },
  catAmount: { fontSize: font.body, fontWeight: '700', color: colors.expense },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  txnLeft: { flex: 1 },
  txnCat: { fontSize: font.body, color: colors.text, fontWeight: '600' },
  txnMeta: { fontSize: font.small, color: colors.textMuted },
  txnAmt: { fontSize: font.body, fontWeight: '700', marginLeft: spacing.md },
  muted: { color: colors.textMuted, fontSize: font.small },
  exportHint: { textAlign: 'center', color: colors.textMuted, fontSize: font.tiny, marginTop: spacing.sm },
});
