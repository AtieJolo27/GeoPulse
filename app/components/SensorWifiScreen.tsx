/**
 * SensorWifiScreen.js
 *
 * Expo Go compatible screen that:
 *   1. Shows which Wi-Fi network the ESP32 soil sensor is currently
 *      connected to (SSID + IP), by calling the sensor's own
 *      /wifi/status HTTP endpoint over the local network.
 *   2. Lets the user trigger a Wi-Fi reset on the sensor, then walks
 *      them through re-provisioning it to a different network
 *      (scan -> pick network -> enter password -> connect).
 *
 * IMPORTANT - how the network flow actually works:
 *
 *   - While the sensor is connected normally to your home Wi-Fi, this
 *     phone must ALSO be on that same Wi-Fi network to reach it at
 *     STATUS_MODE_IP (its LAN IP, e.g. 192.168.1.22).
 *
 *   - After you tap "Baguhin ang Wi-Fi", the sensor erases its saved
 *     credentials and reboots into its own Access Point
 *     ("SOIL-SENSOR-XXXX"). You must manually switch your PHONE's
 *     Wi-Fi (in the phone's system Wi-Fi settings, outside this app)
 *     to join that AP before the app can talk to it again - Expo Go
 *     cannot switch the phone's Wi-Fi network for you.
 *
 *   - Once your phone is joined to the sensor's AP, the sensor is
 *     always reachable at 192.168.4.1 for scanning/connecting to a
 *     new network.
 *
 * No native modules are required - everything here uses plain
 * fetch(), so this works inside Expo Go without a custom dev client.
 */

import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const AP_MODE_IP = "192.168.4.1"; // Fixed IP of the sensor's own provisioning AP

export default function SensorWifiScreen() {
  // The sensor's LAN IP while connected to your home Wi-Fi.
  // There's no reliable auto-discovery without mDNS/native modules,
  // so we let the user type it in once (e.g. from their router's
  // client list, or from whatever your FastAPI/Supabase backend logs).
  const [sensorIp, setSensorIp] = useState("");

  const [status, setStatus] = useState(null); // { connected, ssid, ip, failed }
  const [loadingStatus, setLoadingStatus] = useState(false);

  const [mode, setMode] = useState("normal"); // "normal" | "waiting_for_ap" | "provisioning"

  const [networks, setNetworks] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [selectedSsid, setSelectedSsid] = useState(null);
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);

  /* ---------------------------------------------------------
   * NORMAL MODE: check current status via the sensor's LAN IP
   * --------------------------------------------------------- */
  const checkStatus = useCallback(async () => {
    if (!sensorIp) {
      Alert.alert("Kailangan ng IP", "I-type muna ang LAN IP ng sensor (hal. 192.168.1.22).");
      return;
    }

    setLoadingStatus(true);

    try {
      const res = await fetch(`http://${sensorIp}/wifi/status`, { cache: "no-store" });
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      Alert.alert(
        "Hindi ma-reach ang sensor",
        "Siguraduhing magkasama kayo sa parehong Wi-Fi network, at tama ang IP address."
      );
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, [sensorIp]);

  /* ---------------------------------------------------------
   * Trigger the sensor to forget its Wi-Fi and reboot into AP mode
   * --------------------------------------------------------- */
  const resetWifi = useCallback(async () => {
    if (!sensorIp) {
      Alert.alert("Kailangan ng IP", "I-type muna ang LAN IP ng sensor.");
      return;
    }

    Alert.alert(
      "Palitan ang Wi-Fi?",
      "Ire-restart ang sensor at kakalimutan nito ang kasalukuyang Wi-Fi. Sigurado ka ba?",
      [
        { text: "Kanselahin", style: "cancel" },
        {
          text: "Oo, ituloy",
          style: "destructive",
          onPress: async () => {
            try {
              await fetch(`http://${sensorIp}/wifi/reset`, { cache: "no-store" });
            } catch (err) {
              // The sensor restarts almost immediately after responding,
              // so a network error here is expected/harmless.
            }

            setMode("waiting_for_ap");
            setStatus(null);
          },
        },
      ]
    );
  }, [sensorIp]);

  /* ---------------------------------------------------------
   * PROVISIONING MODE (phone joined to sensor's own AP)
   * --------------------------------------------------------- */
  const startScan = useCallback(async () => {
    setScanning(true);
    setNetworks([]);

    try {
      await fetch(`http://${AP_MODE_IP}/scan/start`, { cache: "no-store" });

      // Poll for results
      let done = false;
      for (let i = 0; i < 15 && !done; i++) {
        await new Promise((r) => setTimeout(r, 1200));

        const res = await fetch(`http://${AP_MODE_IP}/scan/status`, { cache: "no-store" });
        const data = await res.json();

        if (data.status === "complete") {
          done = true;
        } else if (data.status === "failed") {
          throw new Error("Scan failed");
        }
      }

      const resultsRes = await fetch(`http://${AP_MODE_IP}/scan/results`, { cache: "no-store" });
      const resultsData = await resultsRes.json();
      setNetworks(resultsData.networks || []);
    } catch (err) {
      Alert.alert(
        "Hindi ma-scan",
        "Siguraduhing naka-connect ang phone mo sa Wi-Fi ng sensor (SOIL-SENSOR-XXXX)."
      );
    } finally {
      setScanning(false);
    }
  }, []);

  const connectToNetwork = useCallback(async () => {
    if (!selectedSsid) return;

    setConnecting(true);

    try {
      const url = `http://${AP_MODE_IP}/connect?ssid=${encodeURIComponent(
        selectedSsid
      )}&password=${encodeURIComponent(password)}`;

      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      if (data.status === "connecting") {
        Alert.alert(
          "Kumokonekta na ang sensor",
          "Balik ka sa Wi-Fi settings ng phone mo, kumonekta ulit sa dati mong home Wi-Fi, pagkatapos i-check dito ang status."
        );
        setMode("normal");
        setSelectedSsid(null);
        setPassword("");
      } else {
        Alert.alert("May mali", data.message || "Hindi na-set ang Wi-Fi.");
      }
    } catch (err) {
      Alert.alert(
        "Hindi ma-reach ang sensor",
        "Siguraduhing naka-connect ka pa rin sa SOIL-SENSOR-XXXX network."
      );
    } finally {
      setConnecting(false);
    }
  }, [selectedSsid, password]);

  const openWifiSettings = () => {
    if (Platform.OS === "ios") {
      Linking.openURL("App-Prefs:root=WIFI");
    } else {
      Linking.sendIntent("android.settings.WIFI_SETTINGS");
    }
  };

  /* ---------------------------------------------------------
   * RENDER
   * --------------------------------------------------------- */

  if (mode === "waiting_for_ap") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Sumali sa Wi-Fi ng Sensor</Text>
        <Text style={styles.paragraph}>
          Nire-restart ngayon ang sensor. Sa Wi-Fi settings ng phone mo, sumali sa network na
          nagsisimula sa{" "}
          <Text style={{ fontWeight: "700" }}>SOIL-SENSOR-</Text> (ilang segundo bago ito
          lumabas).
        </Text>
        <TouchableOpacity style={styles.buttonSecondary} onPress={openWifiSettings}>
          <Text style={styles.buttonSecondaryText}>Buksan ang Wi-Fi Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setMode("provisioning")}
        >
          <Text style={styles.buttonText}>Nakakonekta na ako sa SOIL-SENSOR-XXXX</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === "provisioning") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Piliin ang Bagong Wi-Fi</Text>

        <TouchableOpacity style={styles.button} onPress={startScan} disabled={scanning}>
          {scanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Mag-scan ng Wi-Fi</Text>
          )}
        </TouchableOpacity>

        <FlatList
          data={networks}
          keyExtractor={(item) => item.ssid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.networkRow,
                selectedSsid === item.ssid && styles.networkRowSelected,
              ]}
              onPress={() => setSelectedSsid(item.ssid)}
            >
              <Text style={styles.networkName}>
                {item.auth === 0 ? "\u{1F513}" : "\u{1F512}"} {item.ssid}
              </Text>
              <Text style={styles.networkInfo}>{item.rssi} dBm</Text>
            </TouchableOpacity>
          )}
          style={{ marginTop: 12, maxHeight: 260 }}
        />

        {selectedSsid && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.paragraph}>Napili: {selectedSsid}</Text>
            <TextInput
              style={styles.input}
              placeholder="Wi-Fi password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.button} onPress={connectToNetwork} disabled={connecting}>
              {connecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Ikonekta ang Sensor</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // mode === "normal"
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wi-Fi ng Soil Sensor</Text>

      <Text style={styles.label}>LAN IP ng sensor</Text>
      <TextInput
        style={styles.input}
        placeholder="hal. 192.168.1.22"
        value={sensorIp}
        onChangeText={setSensorIp}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />

      <TouchableOpacity style={styles.button} onPress={checkStatus} disabled={loadingStatus}>
        {loadingStatus ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>I-check ang Status</Text>
        )}
      </TouchableOpacity>

      {status && (
        <View style={styles.statusBox}>
          {status.connected ? (
            <>
              <Text style={styles.statusLine}>
                \u2705 Nakakonekta sa: <Text style={{ fontWeight: "700" }}>{status.ssid}</Text>
              </Text>
              <Text style={styles.statusLine}>IP: {status.ip}</Text>
            </>
          ) : (
            <Text style={styles.statusLine}>\u26A0\uFE0F Hindi kumonekta ang sensor sa Wi-Fi.</Text>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.buttonDanger} onPress={resetWifi}>
        <Text style={styles.buttonText}>Palitan ang Wi-Fi</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f4f7f5" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16, color: "#222" },
  label: { fontSize: 14, color: "#555", marginBottom: 6 },
  paragraph: { fontSize: 15, color: "#333", marginBottom: 16, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#198754",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonSecondary: {
    backgroundColor: "#e9ecef",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonSecondaryText: { color: "#222", fontWeight: "600", fontSize: 15 },
  buttonDanger: {
    backgroundColor: "#dc3545",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  statusBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginTop: 16,
  },
  statusLine: { fontSize: 15, color: "#222", marginBottom: 4 },
  networkRow: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  networkRowSelected: { borderColor: "#198754", backgroundColor: "#eafaf1" },
  networkName: { fontSize: 15, fontWeight: "600", color: "#222" },
  networkInfo: { fontSize: 13, color: "#777" },
});
