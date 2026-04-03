import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from "react-native";
import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { formatCurrency, formatDate } from "@pitwall/shared";

export default function ExpensesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    eventName: "",
    trackName: "",
  });

  const utils = trpc.useUtils();
  const expenses = trpc.expenses.list.useQuery({ limit: 30 });
  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: () => {
      utils.expenses.list.invalidate();
      setShowForm(false);
      setForm({
        description: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        eventName: "",
        trackName: "",
      });
    },
  });
  const deleteExpense = trpc.expenses.delete.useMutation({
    onSuccess: () => utils.expenses.list.invalidate(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await expenses.refetch();
    setRefreshing(false);
  };

  const handleSubmit = () => {
    if (!form.description || !form.amount) {
      Alert.alert("Missing fields", "Description and amount are required.");
      return;
    }
    createExpense.mutate({
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
      eventName: form.eventName || undefined,
      trackName: form.trackName || undefined,
    });
  };

  const handleDelete = (id: string, desc: string) => {
    Alert.alert("Delete expense", `Delete "${desc}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteExpense.mutate({ id }),
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={styles.addButtonText}>
            {showForm ? "Cancel" : "+ Add"}
          </Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Description"
            placeholderTextColor="#52525b"
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
          />
          <TextInput
            style={styles.input}
            placeholder="Amount"
            placeholderTextColor="#52525b"
            keyboardType="decimal-pad"
            value={form.amount}
            onChangeText={(t) => setForm({ ...form, amount: t })}
          />
          <TextInput
            style={styles.input}
            placeholder="Date (YYYY-MM-DD)"
            placeholderTextColor="#52525b"
            value={form.date}
            onChangeText={(t) => setForm({ ...form, date: t })}
          />
          <TextInput
            style={styles.input}
            placeholder="Event Name (optional)"
            placeholderTextColor="#52525b"
            value={form.eventName}
            onChangeText={(t) => setForm({ ...form, eventName: t })}
          />
          <TextInput
            style={styles.input}
            placeholder="Track Name (optional)"
            placeholderTextColor="#52525b"
            value={form.trackName}
            onChangeText={(t) => setForm({ ...form, trackName: t })}
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={createExpense.isPending}
          >
            <Text style={styles.submitText}>
              {createExpense.isPending ? "Saving..." : "Save Expense"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {expenses.data?.length === 0 ? (
        <Text style={styles.empty}>No expenses yet. Tap + Add to start.</Text>
      ) : (
        expenses.data?.map((e) => (
          <TouchableOpacity
            key={e.id}
            style={styles.expenseRow}
            onLongPress={() => handleDelete(e.id, e.description)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.expenseDesc}>{e.description}</Text>
              <Text style={styles.expenseMeta}>
                {formatDate(e.date)} · {e.category?.name ?? "Uncategorized"}
                {e.eventName ? ` · ${e.eventName}` : ""}
              </Text>
            </View>
            <Text style={styles.expenseAmount}>
              -{formatCurrency(e.amount)}
            </Text>
          </TouchableOpacity>
        ))
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
  addButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  form: {
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    gap: 10,
  },
  input: {
    backgroundColor: "#27272a",
    borderRadius: 8,
    padding: 12,
    color: "#fafafa",
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: "#16a34a",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  expenseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  expenseDesc: { fontSize: 14, color: "#fafafa" },
  expenseMeta: { fontSize: 11, color: "#52525b", marginTop: 2 },
  expenseAmount: {
    fontSize: 14,
    color: "#f87171",
    fontFamily: "monospace",
  },
  empty: { fontSize: 13, color: "#52525b", marginTop: 20 },
});
