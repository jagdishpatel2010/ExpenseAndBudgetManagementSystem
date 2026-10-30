/**
 * Expense analysis screen.
 *
 * Visualizes the user's spending with charts (react-native-chart-kit):
 * - a pie chart of expenses by category for the current month
 * - a line chart of daily expense trend within the month
 * - a bar chart comparing income vs expense over recent months
 *
 * Falls back to friendly empty states when there is not enough data to plot.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { InsightsApi } from '../../api/services';
import { Card, Loading, ErrorBanner, EmptyState } from '../../components/UI';
import { formatCurrency, currentMonth } from '../../utils/format';
import { colors, spacing, font } from '../../theme';

const screenWidth = Dimensions.get('window').width;

// Chart-kit configuration shared by all charts.
const chartConfig = {
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(31, 111, 235, ${opacity})`,
  labelColor: () => colors.textMuted,
  propsForDots: { r: '4' },
};

// A rotating palette for the pie slices.
const PALETTE = ['#1f6feb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

export default function AnalysisScreen() {
  const month = currentMonth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await InsightsApi.charts(month);
      setData(res);
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

  // Build the pie dataset from the by-category totals.
  const pieData = useMemo(() => {
    if (!data?.byCategory) return [];
    return data.byCategory.map((c, i) => ({
      name: c.category,
      amount: c.total,
      color: PALETTE[i % PALETTE.length],
      legendFontColor: colors.text,
      legendFontSize: 12,
    }));
  }, [data]);

  if (loading) return <Loading />;

  const hasCategoryData = pieData.length > 0;
  const hasDaily = (data?.dailyTrend?.length || 0) > 0;
  const hasMonthly = (data?.monthlyTrend?.length || 0) > 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ErrorBanner message={error} onRetry={load} />
      <Text style={styles.monthLabel}>Analysis for {month}</Text>

      <Card>
        <Text style={styles.sectionTitle}>Spending by category</Text>
        {hasCategoryData ? (
          <PieChart
            data={pieData}
            width={screenWidth - 2 * spacing.lg - 2 * spacing.lg}
            height={210}
            chartConfig={chartConfig}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="0"
            absolute
          />
        ) : (
          <EmptyState title="No expense data" message="Add expenses this month to see the breakdown." emoji="📊" />
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Daily expense trend</Text>
        {hasDaily ? (
          <LineChart
            data={{
              // Show the day-of-month as the x label.
              labels: data.dailyTrend.map((d) => d.date.slice(8)),
              datasets: [{ data: data.dailyTrend.map((d) => d.total) }],
            }}
            width={screenWidth - 2 * spacing.lg - 2 * spacing.lg}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            fromZero
          />
        ) : (
          <EmptyState title="No daily data" message="Daily spending will appear here." emoji="📈" />
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Income vs Expense</Text>
        {hasMonthly ? (
          <BarChart
            data={{
              labels: data.monthlyTrend.map((m) => m.month.slice(5)),
              datasets: [{ data: data.monthlyTrend.map((m) => m.expense) }],
            }}
            width={screenWidth - 2 * spacing.lg - 2 * spacing.lg}
            height={220}
            chartConfig={{ ...chartConfig, color: (o = 1) => `rgba(220, 38, 38, ${o})` }}
            style={styles.chart}
            fromZero
            showValuesOnTopOfBars
          />
        ) : (
          <EmptyState title="Not enough data" message="Monthly comparison needs more history." emoji="📉" />
        )}
        {hasMonthly ? (
          <View style={styles.legendRow}>
            {data.monthlyTrend.map((m) => (
              <View key={m.month} style={styles.legendItem}>
                <Text style={styles.legendMonth}>{m.month.slice(5)}</Text>
                <Text style={styles.legendIncome}>+{formatCurrency(m.income, false)}</Text>
                <Text style={styles.legendExpense}>-{formatCurrency(m.expense, false)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  monthLabel: { fontSize: font.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  chart: { borderRadius: 12 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  legendItem: { alignItems: 'center' },
  legendMonth: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '700' },
  legendIncome: { fontSize: font.tiny, color: colors.income },
  legendExpense: { fontSize: font.tiny, color: colors.expense },
});
