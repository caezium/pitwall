import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Providers } from "../components/providers";

export default function RootLayout() {
  return (
    <Providers>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#09090b" },
          headerTintColor: "#fafafa",
          contentStyle: { backgroundColor: "#09090b" },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
      </Stack>
    </Providers>
  );
}
