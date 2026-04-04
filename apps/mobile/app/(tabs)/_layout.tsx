import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#09090b",
          borderTopColor: "#27272a",
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#71717a",
        headerStyle: { backgroundColor: "#09090b" },
        headerTintColor: "#fafafa",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Overview", tabBarLabel: "Home" }} />
      <Tabs.Screen name="expenses" options={{ title: "Expenses", tabBarLabel: "Expenses" }} />
      <Tabs.Screen name="ai-costs" options={{ title: "AI Costs", tabBarLabel: "AI" }} />
      <Tabs.Screen name="investments" options={{ title: "Investments", tabBarLabel: "Invest" }} />
      <Tabs.Screen name="budgets" options={{ title: "Budgets", tabBarLabel: "Budgets" }} />
    </Tabs>
  );
}
