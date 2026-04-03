import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "@pitwall/shared";

export default function OverviewScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const overview = trpc.dashboard.overview.useQuery();

  const onRefresh = async () => {
    setRefreshing(true);
    await overview.refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Pitwall</Text>

      {/* Summary Cards */}
      <View style={styles.cardRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Monthly Burn</Text>
          <Text style={styles.cardValue}>
            {formatCurrency(overview.data?.monthlyBurn ?? 0)}
          </Text>
          <Text style={styles.cardSub}>
            {overview.data?.monthlyTransactions ?? 0} transactions
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>AI Costs (MTD)</Text>
          <Text style={styles.cardValue}>
            {formatCurrency(overview.data?.aiCostsMtd ?? 0)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Portfolio</Text>
        <Text style={styles.cardValue}>
          {overview.data?.portfolio
            ? formatCurrency(overview.data.portfolio.netLiquidation)
            : "Not connected"}
        </Text>
        {overview.data?.portfolio && (
          <Text style={styles.cardSub}>
            as of {overview.data.portfolio.date}
          </Text>
        )}
      </View>

      {/* Domain Breakdown */}
      {overview.data?.domainBreakdown &&
        overview.data.domainBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spending by Domain</Text>
            {overview.data.domainBreakdown.map((item) => (
              <View key={item.domain ?? "other"} style={styles.row}>
                <Text style={styles.rowLabel}>
                  {item.domain ?? "Uncategorized"}
                </Text>
                <Text style={styles.rowValue}>
                  {formatCurrency(item.total)}
                </Text>
              </View>
            ))}
          </View>
        )}

      {/* Recent Expenses */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Expenses</Text>
        {overview.data?.recentExpenses.length === 0 ? (
          <Text style={styles.empty}>No expenses yet</Text>
        ) : (
          overview.data?.recentExpenses.map((e) => (
            <View key={e.id} style={styles.row}>
              <View>
                <Text style={styles.rowLabel}>{e.description}</Text>
                <Text style={styles.rowSub}>
                  {e.date} · {e.category?.name ?? "Uncategorized"}
                </Text>
              </View>
              <Text style={[styles.rowValue, { color: "#f87171" }]}>
                -{formatCurrency(e.amount)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fafafa",
    marginBottom: 20,
  },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    marginBottom: 12,
  },
  cardLabel: { fontSize: 13, color: "#a1a1aa" },
  cardValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fafafa",
    marginTop: 4,
  },
  cardSub: { fontSize: 11, color: "#52525b", marginTop: 2 },
  section: {
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fafafa",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a50",
  },
  rowLabel: { fontSize: 14, color: "#d4d4d8", textTransform: "capitalize" },
  rowSub: { fontSize: 11, color: "#52525b", marginTop: 2 },
  rowValue: { fontSize: 14, color: "#fafafa", fontFamily: "monospace" },
  empty: { fontSize: 13, color: "#52525b" },
});
