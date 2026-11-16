import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, usePathname, type Href } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { BackHandler, Pressable, ScrollView, Text, TouchableOpacity, useWindowDimensions, View, type StyleProp, type ViewStyle, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/shared/appLib/AppContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
import { tutorialCardPlacement, tutorialHighlight, type TutorialRect } from '@/lib/tutorialGeometry';

type Tab = 'home' | 'crop' | 'fertilizer' | 'soil_moisture' | 'history';
type Measure = (callback: (rect: TutorialRect) => void) => void;
type TutorialApi = { open: (tab?: Tab) => void; openCurrent: () => void; register: (id: string, measure: Measure) => () => void };
const TutorialContext = createContext<TutorialApi>({ open: () => {}, openCurrent: () => {}, register: () => () => {} });
const routes: Record<Tab, Href> = { home: '/(drawer)/(tabs)/home', crop: '/(drawer)/(tabs)/crop/crops', fertilizer: '/(drawer)/(tabs)/fertilizer/fertilizers', soil_moisture: '/(drawer)/(tabs)/soil_moisture/soil_moistures', history: '/(drawer)/(tabs)/history/histories' };
const seenKey = (tab: Tab) => `geopulse:tutorial:v2:${tab}:seen`;

const TutorialScrollContext = createContext<((rect: TutorialRect) => void) | null>(null);

export function TutorialScrollView(props: ScrollViewProps) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const reveal = useCallback((rect: TutorialRect) => {
    ref.current?.measureInWindow((_x, y, _width, height) => {
      const usable = height - 32;
      if (rect.y < y + 16 || (rect.height < usable && rect.y + rect.height > y + height - 16)) {
        ref.current?.scrollTo({ y: Math.max(0, offset.current + rect.y - y - 16), animated: false });
      }
    });
  }, []);
  return <TutorialScrollContext.Provider value={reveal}><ScrollView {...props} ref={ref} scrollEventThrottle={16} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; props.onScroll?.(event); }} /></TutorialScrollContext.Provider>;
}

export function TutorialTarget({ id, children, style, persistent = false }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle>; persistent?: boolean }) {
  const { register } = useContext(TutorialContext);
  const reveal = useContext(TutorialScrollContext);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const attach = useCallback(() => register(id, callback => {
    ref.current?.measureInWindow((x, y, width, height) => { const rect = { x, y, width, height }; reveal?.(rect); callback(rect); });
  }), [id, register, reveal]);
  useEffect(() => { if (persistent) return attach(); }, [attach, persistent]);
  useFocusEffect(useCallback(() => { if (!persistent) return attach(); }, [attach, persistent]));
  return <View ref={ref} collapsable={false} style={style}>{children}</View>;
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, loading, t, fontScale } = useApp();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const currentTab = (Object.keys(routes) as Tab[]).find(tab => pathname.split('/').includes(tab));
  const targets = useRef(new Map<string, Measure>());
  const [dismissed, setDismissed] = useState<Set<Tab>>(new Set());
  const overlay = useRef<ComponentRef<typeof View>>(null);
  const [selectedTab, setSelectedTab] = useState<Tab>('home');
  const [visible, setVisible] = useState(false);
  const [picker, setPicker] = useState(false);
  const [index, setIndex] = useState(0);
  const [viewport, setViewport] = useState({ width, height });
  const [rect, setRect] = useState<TutorialRect | null>(null);
  const overview = [
    { target: 'home', icon: 'home-outline' as const, title: t('Your field at a glance', 'Ang iyong bukid sa isang tingin'), text: t('Home shows the latest readings for your selected zone. Choose a zone to view its soil conditions. Viewing a zone does not move the sensor\'s collection zone.', 'Makikita sa Home ang pinakahuling datos ng napiling sona. Pumili ng sona para makita ang kondisyon ng lupa. Hindi nito inililipat ang sona ng sensor.') },
    { target: 'sensor', icon: 'cloud-done-outline' as const, title: t('Check your sensor', 'Suriin ang iyong sensor'), text: t('Green means readings arrived within 60 seconds. Red means no recent readings; amber means checking or unavailable. Tap the icon when offline for setup: join Geopulse-setup, open 192.168.4.1, then choose your Wi-Fi and enter its password.', 'Berde kapag may datos sa loob ng 60 segundo. Pula kapag walang bagong datos; dilaw kapag sinusuri o hindi makuha ang status. Pindutin kapag offline: kumonekta sa Geopulse-setup, buksan ang 192.168.4.1, piliin ang Wi-Fi at ilagay ang password.') },
    { target: 'crop', icon: 'leaf-outline' as const, title: t('Explore crop suggestions', 'Suriin ang mga mungkahing pananim'), text: t('Crops suggests options using your selected zone\'s soil readings. Use Refresh to request updated suggestions when new readings arrive.', 'Nagbibigay ang Crops ng mungkahi batay sa datos ng napiling sona. Pindutin ang I-refresh para sa bagong mungkahi kapag may bagong datos.') },
    { target: 'fertilizer', icon: 'nutrition-outline' as const, title: t('Review fertilizer guidance', 'Suriin ang gabay sa pataba'), text: t('Fertilizers explains nutrient needs and possible options. Review the sources and confirm application decisions with a calibrated soil test and local agricultural staff.', 'Ipinapaliwanag ng Fertilizers ang sustansya at mga pagpipilian. Suriin ang mga sanggunian at kumpirmahin ang paggamit sa soil test at lokal na kawani ng agrikultura.') },
    { target: 'soil_moisture', icon: 'water-outline' as const, title: t('Check soil moisture', 'Suriin ang halumigmig ng lupa'), text: t('Soil Moisture shows the current moisture reading and irrigation guidance. GeoPulse provides advice; it does not turn watering equipment on or off.', 'Ipinapakita ng Soil Moisture ang halumigmig at gabay sa patubig. Nagbibigay ng payo ang GeoPulse; hindi nito binubuksan o pinapatay ang kagamitan sa patubig.') },
    { target: 'history', icon: 'grid-outline' as const, title: t('Plan and save your work', 'Magplano at mag-save ng tala'), text: t('Manage contains your calendar, sensor tests, history, reports, and harvest results. Start a test to record a time window, Pause when repositioning within the same zone, Resume after settling, and Finish to save averages. These controls do not power the sensor or start uploads.', 'Nasa Manage ang kalendaryo, mga test, kasaysayan, report at ani. Magsimula ng test, i-pause kapag inililipat sa loob ng sona, ipagpatuloy kapag handa, at tapusin para i-save ang average. Hindi nito kinokontrol ang kuryente o pagpapadala ng sensor.') },
    { target: 'sidebar', icon: 'menu-outline' as const, title: t('Help is always here', 'Laging may gabay dito'), text: t('Open this menu for your Profile, Tips and Guides, Settings, and Tutorial. Replay this walkthrough anytime by choosing Tutorial.', 'Buksan ang menu para sa Profile, Mga Tip at Gabay, Mga Setting, at Tutorial. Piliin ang Tutorial upang ulitin ang gabay anumang oras.') },
  ];
  const tours = {
    home: [overview[0], overview[1], overview[2], overview[3], overview[4], overview[5],
      { target: 'home-health', icon: 'pulse-outline' as const, title: t('Understand the overall soil condition', 'Unawain ang kondisyon ng lupa'), text: t('The sensor condition index averages six equally weighted scores: moisture, soil temperature, pH, nitrogen, phosphorus and potassium. All six must be valid or the index stays unavailable. Tap the information icon on the index card to review its breakdown. This provisional index is not a soil-health percentage or a promise of crop success.', 'Average ng anim na pantay na iskor ang index: moisture, temperatura ng lupa, pH, nitrogen, phosphorus at potassium. Kailangan ang anim na wastong datos. Pindutin ang information icon sa card para sa detalye. Pansamantalang index ito, hindi porsiyento ng kalusugan ng lupa o garantiya ng ani.') },
      { target: 'home-health-details', icon: 'information-circle-outline' as const, title: t('Open the score breakdown', 'Buksan ang detalye ng iskor'), text: t('After closing the tutorial, tap this information button to see the individual factor scores, reference ranges and interpretation of the current index.', 'Pagkatapos isara ang tutorial, pindutin ang information button para sa iskor ng bawat parameter, batayan at paliwanag ng index.') },
      { target: 'home-parameters', icon: 'analytics-outline' as const, title: t('Read your soil parameters', 'Basahin ang mga parameter'), text: t('Moisture shows water content (%); soil temperature is in degrees Celsius. pH describes acidity or alkalinity. Nitrogen, phosphorus and potassium are nutrient readings in ppm. Compare each value with its reference band and warning, using calibrated sensor readings. Soil type affects the bands. Check the last-recorded timestamp because old readings can still be displayed.', 'Moisture ang tubig sa lupa (%), at Celsius ang temperatura. Ang pH ay asim o alkalinity. Nasa ppm ang nitrogen, phosphorus at potassium. Ihambing sa batayan at babala gamit ang calibrated na sensor. Nakaaapekto ang uri ng lupa sa batayan. Suriin ang oras dahil maaaring lumang datos ang nakikita.') },
      { target: 'home-export', icon: 'document-text-outline' as const, title: t('Save your dashboard report', 'I-save ang ulat ng dashboard'), text: t('Tap Export PDF to save the displayed zone, current readings, condition index and alerts. Pull down on Home to refresh. Viewing another zone does not move the physical sensor; confirm its assignment separately after moving it.', 'Pindutin ang Export PDF para sa sona, datos, index at babala. Hilahin pababa sa Home para mag-refresh. Hindi inililipat ng pagpili ng sona ang pisikal na sensor; kumpirmahin ang assignment matapos ilipat.') }, overview[6]],
    crop: [overview[2], { target: 'crop-tips', icon: 'sunny-outline' as const, title: t('Daily care for your planted crop', 'Araw-araw na payo sa pananim'), text: t('Daily Tips appears above the recommendations when this zone has a planted crop. Read the advice cards and swipe for more tips. The advice uses the planted crop and date; set those on Home if tips are missing.', 'Nasa itaas ang Daily Tips kapag may nakatanim sa sona. Basahin at i-swipe ang mga payo. Batay ito sa pananim at petsa; itakda sa Home kung walang payo.') }, { target: 'crop-refresh', icon: 'refresh-outline' as const, title: t('Refresh crop suggestions', 'I-refresh ang mungkahi'), text: t('Use this button after new readings arrive. The spinner means a request is running. Your selected zone is shown above the results.', 'Gamitin ang button kapag may bagong datos. Ang spinner ay nangangahulugang kumukuha pa ng mungkahi. Makikita sa itaas ang napiling sona.') }, { target: 'crop-card', icon: 'leaf-outline' as const, title: t('Read the ranked options', 'Basahin ang mga pagpipilian'), text: t('The crop cards show a picture, name, rank and model score; the leading card includes a short summary. Tap anywhere on a card or Review details to open its detailed explanation for the selected zone and source reading. Model scores rank the options; they are not chances of a successful harvest. Collect readings first if no cards appear.', 'May larawan, pangalan, ranggo at iskor ang mga card. Pindutin ang card o Suriin ang detalye para sa paliwanag batay sa sona at datos. Hindi tsansa ng matagumpay na ani ang iskor. Mangolekta muna ng datos kung walang card.') }],
    fertilizer: [overview[3], { target: 'fertilizer-refresh', icon: 'refresh-outline' as const, title: t('Refresh fertilizer advice', 'I-refresh ang payo sa pataba'), text: t('Request new advice when soil readings or your planted crop change. A loading indicator means advice is still being prepared.', 'Kumuha ng bagong payo kapag nagbago ang datos o pananim. Ang loading indicator ay nangangahulugang inihahanda pa ang payo.') }, { target: 'fertilizer-intro', icon: 'nutrition-outline' as const, title: t('Check context and sources', 'Suriin ang batayan at sanggunian'), text: t('Review the planted crop, source reading timestamp, nutrient values, assessment, and references before using the advice.', 'Suriin ang pananim, oras ng datos, sustansya, pagsusuri at sanggunian bago gamitin ang payo.') }],
    soil_moisture: [overview[4], { target: 'moisture-refresh', icon: 'refresh-outline' as const, title: t('Update moisture readings', 'I-update ang halumigmig'), text: t('Tap Refresh or pull down to load the latest irrigation data for the selected zone. If the sensor has not sent new measurements, the value stays unchanged.', 'Pindutin ang I-refresh o hilahin pababa para sa bagong datos ng napiling sona. Hindi magbabago ang halaga kung walang bagong sukat ang sensor.') }, { target: 'moisture-summary', icon: 'water-outline' as const, title: t('Read the moisture assessment', 'Basahin ang pagsusuri'), text: t('Check the moisture percentage, status and guidance together. The planted crop watering guide comes from the dataset. The target range matches both the planted crop and the zone soil type. Compare the current value with its minimum and maximum. Scroll down for timestamps and previous readings.', 'Suriin nang magkasama ang porsiyento, status at gabay. Mula sa dataset ang saklaw para sa pananim at uri ng lupa. Ihambing ang datos sa pinakamababa at pinakamataas na target. Mag-scroll para sa oras at mga nakaraang sukat.') }],
    history: [overview[5], { target: 'manage-categories', icon: 'grid-outline' as const, title: t('Choose a workspace', 'Pumili ng gawain'), text: t('Use these category buttons for Calendar, Sensor tests, History & reports, or Harvest results. Swipe the category row sideways if a button is offscreen.', 'Piliin ang Calendar, Sensor tests, History & reports o Harvest results. I-swipe ang hanay kung hindi nakikita ang ibang button.') }, { target: 'manage-zone', icon: 'location-outline' as const, title: t('Check the selected zone', 'Suriin ang napiling sona'), text: t('Records belong to the zone selected on Home. In Calendar, save crop events and reminders. In Sensor tests, use Start, Pause, Resume and Finish. History & reports lets you export readings; Harvest results records completed growing cycles.', 'Ang mga tala ay para sa sonang pinili sa Home. Sa Calendar, mag-save ng gawain at paalala. Sa Sensor tests, gamitin ang Start, Pause, Resume at Finish. Mag-export sa History & reports at itala ang ani sa Harvest results.') }],
  };
  const steps = tours[selectedTab];
  const labels: Record<Tab, string> = { home: t('Home', 'Home'), crop: t('Crops', 'Mga Pananim'), fertilizer: t('Fertilizers', 'Mga Pataba'), soil_moisture: t('Soil Moisture', 'Halumigmig ng Lupa'), history: t('Manage', 'Pamamahala') };
  const register = useCallback((id: string, measure: Measure) => {
    targets.current.set(id, measure);
    return () => { if (targets.current.get(id) === measure) targets.current.delete(id); };
  }, []);
  const open = useCallback((tab?: Tab) => {
    if (!tab) { setPicker(true); return; }
    setDismissed(previous => new Set(previous).add(tab));
    router.navigate(routes[tab]);
    setSelectedTab(tab);
    setIndex(0);
    setRect(null);
    setPicker(false);
    setVisible(true);
  }, []);
  const close = useCallback(() => {
    setDismissed(previous => new Set(previous).add(selectedTab));
    try { localStorage.setItem(seenKey(selectedTab), 'true'); } catch { /* Session-only when storage is unavailable. */ }
    setVisible(false);
  }, [selectedTab]);
  useEffect(() => {
    if (loading || !user || !currentTab || visible || picker || dismissed.has(currentTab)) return;
    try { if (localStorage.getItem(seenKey(currentTab)) === 'true') return; } catch { /* Session-only. */ }
    const timer = setTimeout(() => { setSelectedTab(currentTab); setIndex(0); setRect(null); setVisible(true); }, 900);
    return () => clearTimeout(timer);
  }, [loading, user, currentTab, visible, picker, dismissed]);
  const target = steps[index].target;
  useEffect(() => {
    if (!visible || currentTab !== selectedTab) return;
    let active = true;
    const measure = () => {
      const control = targets.current.get(target);
      if (!control) { setRect(null); return; }
      overlay.current?.measureInWindow((x, y, overlayWidth, overlayHeight) => {
        control(value => {
          if (!active) return;
          const next = tutorialHighlight(value, { x, y }, { width: overlayWidth, height: overlayHeight });
          setRect(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
        });
      });
    };
    const initial = setTimeout(measure, 400);
    const timer = setInterval(measure, 250);
    return () => { active = false; clearTimeout(initial); clearInterval(timer); };
  }, [visible, target, width, height, currentTab, selectedTab]);
  useEffect(() => {
    if (!visible && !picker) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (picker) setPicker(false); else close(); return true; });
    return () => listener.remove();
  }, [visible, picker, close]);
  const placement = tutorialCardPlacement(picker ? null : rect, viewport, insets);
  const step = steps[index];
  const shade = 'rgba(0,0,0,0.68)';
  return <TutorialContext.Provider value={{ open, openCurrent: () => open(currentTab), register }}>
    <View style={{ flex: 1 }}>
      {children}
      {(visible || picker) && !!user && <View ref={overlay} collapsable={false} onLayout={event => { const { width, height } = event.nativeEvent.layout; setViewport(previous => previous.width === width && previous.height === height ? previous : { width, height }); }} accessibilityViewIsModal onAccessibilityEscape={() => { if (picker) setPicker(false); else close(); }} style={{ position: 'absolute', inset: 0, zIndex: 10000, elevation: 100, justifyContent: 'center', padding: 20 }}>
        <Pressable accessible={false} style={{ position: 'absolute', inset: 0 }} onPress={() => {}} />
        {!rect || picker ? <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: shade }} /> : <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: rect.y, backgroundColor: shade }} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: rect.y + rect.height, bottom: 0, backgroundColor: shade }} />
          <View style={{ position: 'absolute', left: 0, top: rect.y, width: rect.x, height: rect.height, backgroundColor: shade }} />
          <View style={{ position: 'absolute', left: rect.x + rect.width, right: 0, top: rect.y, height: rect.height, backgroundColor: shade }} />
          <View style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderWidth: 2, borderColor: '#86EFAC', borderRadius: 12 }} />
        </View>}
        <View style={{ position: 'absolute', left: Math.max(16, (viewport.width - 480) / 2), right: Math.max(16, (viewport.width - 480) / 2), top: placement.top, maxHeight: placement.maxHeight, padding: 16, borderRadius: 24, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: colors.subText, fontSize: 13 * fontScale }}>{picker ? t('Tutorials', 'Mga Tutorial') : `${labels[selectedTab]} - ${index + 1}/${steps.length}`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Close tutorial', 'Isara ang tutorial')} onPress={() => { if (picker) setPicker(false); else close(); }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={22} color={colors.subText} /></Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
            {picker ? (Object.keys(routes) as Tab[]).map(tab => <TouchableOpacity key={tab} accessibilityRole="button" onPress={() => open(tab)} style={{ minHeight: 48, padding: 14, borderRadius: 14, backgroundColor: colors.cardBgAlt, flexDirection: 'row', alignItems: 'center', gap: 12 }}><Ionicons name={tours[tab][0].icon} color={colors.greenText} size={22} /><Text style={{ flex: 1, color: colors.text, fontSize: 15 * fontScale, fontWeight: '700' }}>{labels[tab]}</Text><Ionicons name="chevron-forward" color={colors.greenText} size={20} /></TouchableOpacity>) : <>
              <Ionicons name={step.icon} size={26} color={colors.greenText} />
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 22 * fontScale, fontWeight: '800' }}>{step.title}</Text>
              <Text style={{ color: colors.subText, fontSize: 15 * fontScale, lineHeight: 23 * fontScale }}>{step.text}</Text>
            </>}
          </ScrollView>
          {!picker && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
            <TouchableOpacity accessibilityRole="button" onPress={index > 0 ? () => { setRect(null); setIndex(index - 1); } : close} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}><Text style={{ color: colors.greenText, fontSize: 14 * fontScale, fontWeight: '700' }}>{index > 0 ? t('Back', 'Bumalik') : t('Skip', 'Laktawan')}</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={index === steps.length - 1 ? close : () => { setRect(null); setIndex(index + 1); }} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 22, borderRadius: 14, backgroundColor: colors.primary }}><Text style={{ color: '#FFFFFF', fontSize: 14 * fontScale, fontWeight: '700' }}>{index === steps.length - 1 ? t('Finish', 'Tapos') : t('Next', 'Susunod')}</Text></TouchableOpacity>
          </View>}
        </View>
      </View>}
    </View>
  </TutorialContext.Provider>;
}

export const useTutorial = () => useContext(TutorialContext);
