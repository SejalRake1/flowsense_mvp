import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="phone-login" />
      <Stack.Screen name="permission-setup" />
      <Stack.Screen name="ready" />
    </Stack>
  );
}
