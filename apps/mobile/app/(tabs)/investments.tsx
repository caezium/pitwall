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

export default function InvestmentsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const performance = trpc.investments.performance.useQuery();
  const positions = trpc.investments.positions.useQuery();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([performance.refetch(), positions.refetch()]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Investments</Text>

      {/* Summary */}
      <View style={styles.cardRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Net Liquidation</Text>
          <Text style={styles.cardValue}>
            {formatCurrency(performance.data?.netLiquidation ?? 0)}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Unrealized P&L</Text>
          <Text
            style={[
              styles.cardValue,
              {
                color:
                  (performance.data?.totalUnrealizedPnl ?? 0) >= 0
                    ? "#4ade80"
                    : "#f87171",
              },
            ]}
          >
            {formatCurrency(performance.data?.totalUnrealizedPnl ?? 0)}
          </Text>
        </View>
      </View>

      <View style={styles.cardRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Cash</Text>
          <Text style={styles.cardValue}>
            {formatCurrency(performance.data?.cash ?? 0)}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Return</Text>
          <Text
            style={[
              styles.cardValue,
              {
                color:
                  (performance.data?.totalReturn ?? 0) >= 0
                    ? "#4ade80"
                    : "#f87171",
              },
            ]}
          >
            {(performance.data?.totalReturn ?? 0).toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* Positions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Positions</Text>
        {positions.data?.length === 0 ? (
          <Text style={styles.empty}>
            No positions. Import via CSV or connect IBKR Gateway.
          </Text>
        ) : (
          positions.data?.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.symbol}>{p.symbol}</Text>
                <Text style={styles.rowSub}>
                  {p.quantity} shares @ {formatCurrency(p.avgCost)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.rowValue}>
                  {formatCurrency(p.marketValue)}
                </Text>
                <Text
                  style={[
                    styles.rowSub,
                    { color: p.unrealizedPnl >= 0 ? "#4ade80" : "#f87171" },
                  ]}
                >
                  {formatCurrency(p.unrealizedPnl)}
                </Text>
              </View>
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
    fontSize: 24,
    fontWeight: "bold",
    color: "#fafafa",
    marginBottom: 16,
  },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  cardLabel: { fontSize: 13, color: "#a1a1aa" },
  cardValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fafafa",
    marginTop: 4,
  },
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a50",
  },
  symbol: { fontSize: 15, fontWeight: "bold", color: "#fafafa" },
  rowSub: { fontSize: 11, color: "#52525b", marginTop: 2 },
  rowValue: {
    fontSize: 14,
    color: "#fafafa",
    fontFamily: "monospace",
  },
  empty: { fontSize: 13, color: "#52525b" },
});
