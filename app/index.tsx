import { useApp } from '@/app/lib/AppContext';
import { Redirect } from 'expo-router';

export default function IndexScreen() {
  const { user, loading } = useApp();

  // The root layout displays the loading indicator while restoring the session.
  if (loading) return null;

  return <Redirect href={user ? '/(drawer)/(tabs)/home' : '/profile'} />;
}
