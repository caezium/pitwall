import { View, Text, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "@pitwall/shared";

export default function BudgetsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const budgetStatus = trpc.budgets.status.useQuery();

  const onRefresh = async () => {
    setRefreshing(true);
    await budgetStatus.refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Budgets</Text>

      {budgetStatus.data?.length === 0 ? (
        <Text style={styles.empty}>No budgets. Create budgets on the web app.</Text>
      ) : (
        budgetStatus.data?.map((b: any) => (
          <View key={b.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{b.name}</Text>
              <Text style={[styles.cardStatus, { color: b.overBudget ? "#f87171" : "#4ade80" }]}>
                {b.overBudget ? `Over by ${formatCurrency(Math.abs(b.remaining))}` : `${formatCurrency(b.remaining)} left`}
              </Text>
            </View>
            <Text style={styles.cardSub}>{b.period} · {b.category?.name ?? "All expenses"}</Text>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(b.percentUsed, 100)}%`,
                    backgroundColor: b.overBudget ? "#ef4444" : b.percentUsed > 80 ? "#eab308" : "#22c55e",
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {formatCurrency(b.spent)} / {formatCurrency(b.amount)}
            </Text>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", color: "#fafafa", marginBottom: 16 },
  empty: { fontSize: 13, color: "#52525b" },
  card: {
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#fafafa" },
  cardStatus: { fontSize: 12, fontWeight: "500" },
  cardSub: { fontSize: 11, color: "#52525b", marginTop: 2, textTransform: "capitalize" },
  progressBg: { height: 6, backgroundColor: "#27272a", borderRadius: 3, marginTop: 10, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressText: { fontSize: 12, color: "#a1a1aa", marginTop: 6 },
});
