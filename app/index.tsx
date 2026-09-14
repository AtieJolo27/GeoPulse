import { useApp } from '@/app/lib/AppContext';
import { Redirect } from 'expo-router';

export default function Index() {
  const { user, loading } = useApp();

  if (loading) return null;

  return <Redirect href={user ? '/(tabs)/home' : '/profile'} />;
}