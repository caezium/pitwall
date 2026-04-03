import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency } from "@pitwall/shared";

export default function AICostsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const summary = trpc.aiUsage.summary.useQuery();
  const syncMutation = trpc.aiUsage.syncNow.useMutation({
    onSuccess: () => summary.refetch(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await summary.refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>AI Costs</Text>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <Text style={styles.syncText}>
            {syncMutation.isPending ? "Syncing..." : "Sync"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Total */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Total MTD</Text>
        <Text style={styles.cardValue}>
          {formatCurrency(summary.data?.totalMtd ?? 0)}
        </Text>
        <Text style={styles.cardSub}>since {summary.data?.since}</Text>
      </View>

      {/* By Provider */}
      {summary.data?.byProvider.map((p) => (
        <View key={p.provider} style={styles.card}>
          <Text style={[styles.cardLabel, { textTransform: "capitalize" }]}>
            {p.provider}
          </Text>
          <Text style={styles.cardValue}>{formatCurrency(p.totalCost)}</Text>
          <Text style={styles.cardSub}>
            {(p.totalInput + p.totalOutput).toLocaleString()} tokens
          </Text>
        </View>
      ))}

      {/* By Model */}
      {summary.data?.byModel && summary.data.byModel.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Model</Text>
          {summary.data.byModel.map((m, i) => (
            <View key={i} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{m.model}</Text>
                <Text style={styles.rowSub}>{m.provider}</Text>
              </View>
              <Text style={styles.rowValue}>{formatCurrency(m.totalCost)}</Text>
            </View>
          ))}
        </View>
      )}

      {summary.data?.totalMtd === 0 && (
        <Text style={styles.empty}>
          No AI usage data. Configure API keys in the web app Settings page and
          tap Sync.
        </Text>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#fafafa" },
  syncButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  card: {
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
  rowLabel: { fontSize: 14, color: "#d4d4d8" },
  rowSub: { fontSize: 11, color: "#52525b", marginTop: 2 },
  rowValue: { fontSize: 14, color: "#fafafa", fontFamily: "monospace" },
  empty: { fontSize: 13, color: "#52525b", marginTop: 20 },
});
