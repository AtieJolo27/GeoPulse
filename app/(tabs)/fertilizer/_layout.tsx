
import { HeaderActions } from '@/app/components/HeaderActions';
import { Stack } from "expo-router";
import "../../global.css";

export const unstable_settings = {
    initialRouteName: "index",
}
export default function RecommendationLayout(){
    return (
    <Stack screenOptions={{
      headerTitle:"Fertilizer Guide",
      headerTitleStyle: { fontWeight: 'bold', fontSize: 20, color: '#F0FDF4' },
      headerStyle: { backgroundColor: '#1B5E37' },
      headerTintColor: '#F0FDF4',
      headerRight: () => <HeaderActions />
    }}>
            <Stack.Screen name="fertilizers" options={{title:"Fertilizers"}} />
            <Stack.Screen name="reasoning" options={{ title: "Why this is recommended" }} />
        </Stack>
    );
}
