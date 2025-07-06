import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    FlatList,
    Switch,
    TouchableOpacity,
    Alert,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { ref, onValue, push, set, update, remove, get } from "firebase/database";
import { db } from "@/lib/firebase-config";
import { useSession } from "@/context";
import Modal from "react-native-modal";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import axios from "axios";
import { getDatabase } from "firebase/database";

type Device = {
    id: string;
    name: string;
    type: string;
    state: boolean;
    logs?: string[];
    selected?: boolean;
    mode?: "solid" | "pulse";
    pulseDuration?: number;
};

const BASE_IP = "192.168.1.";
const DEVICE_DISCOVERY_ENDPOINT = "/discover";
const TIMEOUT = 1000; // ms

// Detect device type from name
const getDeviceTypeFromName = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes("lampu") || lower.includes("lamp")) return "light";
    if (lower.includes("kunci") || lower.includes("key") || lower.includes("lock")) return "lock";
    if (lower.includes("kipas") || lower.includes("fan")) return "fan";
    if (lower.includes("tv")) return "tv";
    if (lower.includes("jendela") || lower.includes("window")) return "window";
    if (lower.includes("colokan") || lower.includes("socket") || lower.includes("stop kontak")) return "socket";
    if (lower.includes("ac")) return "ac";
    return "other";
};

// Return icon based on type
const getIcon = (type: string, state: boolean) => {
    const color = state ? "#ffd33d" : "#ccc";
    switch (type) {
        case "light":
            return <Ionicons name="bulb-outline" size={32} color={color} />;
        case "lock":
            return <Ionicons name="lock-closed-outline" size={32} color={color} />;
        case "fan":
            return <MaterialCommunityIcons name="fan" size={32} color={color} />;
        case "tv":
            return <MaterialCommunityIcons name="television" size={32} color={color} />;
        case "window":
            return <MaterialCommunityIcons name="window-closed-variant" size={32} color={color} />;
        case "socket":
            return <MaterialCommunityIcons name="power-socket-eu" size={32} color={color} />;
        case "ac":
            return <MaterialCommunityIcons name="air-conditioner" size={32} color={color} />;
        default:
            return <Ionicons name="help-circle-outline" size={32} color={color} />;
    }
};

export default function DevicesScreen() {
    const { user } = useSession();
    const [activeTab, setActiveTab] = useState<"control" | "scan">("control");
    
    // Control tab states
    const [devices, setDevices] = useState<Device[]>([]);
    const [newName, setNewName] = useState("");
    const [deleteMode, setDeleteMode] = useState(false);
    const [showLogsMap, setShowLogsMap] = useState<{ [key: string]: boolean }>({});
    const [showModeModal, setShowModeModal] = useState(false);
    const [pendingName, setPendingName] = useState("");
    const [selectedMode, setSelectedMode] = useState<"solid" | "pulse" | null>(null);
    const [pulseDuration, setPulseDuration] = useState(300);
    
    // Scan tab states
    const [isScanning, setIsScanning] = useState(false);
    const [foundDevices, setFoundDevices] = useState<any[]>([]);

    if (!user) return null;
    const userId = user.uid;
    const devicesRef = ref(db, `users/${userId}/devices`);

    useEffect(() => {
        const unsubscribe = onValue(devicesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const parsed: Device[] = Object.entries(data)
                    .map(([key, value]) => ({ id: key, ...(value as Omit<Device, "id">) }))
                    .reverse();
                setDevices(parsed);
            } else {
                setDevices([]);
            }
        });
        return () => unsubscribe();
    }, [userId]);

    // Control tab functions
    const addDevice = () => {
        if (!newName.trim()) return;
        setPendingName(newName.trim());
        setShowModeModal(true);
    };

    const createDeviceWithMode = async () => {
        if (!pendingName.trim()) return;
        try {
            const deviceId = pendingName.trim();
            const sourceRef = ref(db, `deviceMeta/${deviceId}`);
            const snapshot = await get(sourceRef);
            if (!snapshot.exists()) {
                Alert.alert("Gagal", `Perangkat dengan ID ${deviceId} tidak ditemukan di deviceMeta.`);
                return;
            }
            const metaData = snapshot.val();
            const targetRef = ref(db, `users/${user.uid}/devices/${deviceId}`);
            await set(targetRef, {
                ...metaData,
                state: false,
                logs: [],
                mode: selectedMode,
                ...(selectedMode === "pulse" && { pulseDuration }),
            });
            setNewName("");
            setPendingName("");
            setSelectedMode(null);
            setPulseDuration(300);
            setShowModeModal(false);
            Alert.alert("Berhasil", `Perangkat ${deviceId} berhasil ditambahkan.`);
        } catch (err) {
            console.error(err);
            Alert.alert("Gagal", "Terjadi kesalahan saat menambahkan perangkat.");
        }
    };

    const toggleDevice = async (device: Device) => {
        const deviceRef = ref(db, `users/${userId}/devices/${device.id}`);
        const timestamp = new Date();
        const formatted = timestamp.toLocaleString("id-ID", {
            weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
        });

        if (device.mode === "pulse") {
            const log = `${formatted} • ${device.name} dipicu (pulse ${device.pulseDuration ?? 300}ms)`;
            const logs = [...(device.logs || []), log];
            await update(deviceRef, { state: true, logs });
            setTimeout(() => update(deviceRef, { state: false }), device.pulseDuration ?? 300);
        } else {
            const newState = !device.state;
            const action = newState ? "dinyalakan" : "dimatikan";
            const log = `${formatted} • ${device.name} ${action}`;
            const logs = [...(device.logs || []), log];
            await update(deviceRef, { state: newState, logs });
        }
    };

    const handleLongPress = (id: string) => {
        setDeleteMode(true);
        setDevices((prev) => prev.map((item) => ({ ...item, selected: item.id === id })));
    };

    const toggleSelect = (id: string) => {
        setDevices((prev) => prev.map((item) => item.id === id ? { ...item, selected: !item.selected } : item));
    };

    const deleteSelectedDevices = async () => {
        const confirmed = await new Promise((resolve) => {
            Alert.alert("Konfirmasi", "Yakin ingin menghapus perangkat terpilih?", [
                { text: "Batal", onPress: () => resolve(false), style: "cancel" },
                { text: "Hapus", onPress: () => resolve(true) },
            ]);
        });
        if (!confirmed) return;
        const toDelete = devices.filter((d) => d.selected);
        await Promise.all(toDelete.map((d) => remove(ref(db, `users/${userId}/devices/${d.id}`))));
        setDeleteMode(false);
    };

    // Scan tab functions
    const scanSubnet = async (baseIp: string) => {
        const responses: any[] = [];

        const requests = Array.from({ length: 255 }, (_, i) => {
            const ip = `${baseIp}${i}`;
            return axios
                .get(`http://${ip}${DEVICE_DISCOVERY_ENDPOINT}`, { timeout: TIMEOUT })
                .then((res) => {
                    responses.push({ ip, data: res.data });
                })
                .catch(() => { });
        });

        await Promise.all(requests);
        return responses;
    };

    const scanNetwork = async () => {
        setIsScanning(true);
        setFoundDevices([]);

        try {
            const results1 = await scanSubnet("192.168.1.");
            const combined = [...results1];
            setFoundDevices(combined);
        } catch (error) {
            console.error("❌ Error scanning network:", error);
            Alert.alert("Gagal Memindai", "Terjadi kesalahan saat pemindaian jaringan.");
        } finally {
            setIsScanning(false);
        }
    };

    const handleDevicePress = async (device: any) => {
        if (!user?.uid) {
            Alert.alert("Error", "User not logged in");
            return;
        }

        try {
            const db = getDatabase();
            const deviceUid = device.data.uid;

            // Check deviceMeta to see if it has already been claimed
            const ownerRef = ref(db, `deviceMeta/${deviceUid}/owner`);
            const ownerSnapshot = await get(ownerRef);

            if (ownerSnapshot.exists()) {
                const existingOwner = ownerSnapshot.val();
                if (existingOwner === user.uid) {
                    Alert.alert("⚠️ Sudah Terhubung", "Perangkat ini sudah terhubung ke akun Anda.");
                } else {
                    Alert.alert("🚫 Akses Ditolak", "Perangkat ini sudah terhubung ke akun lain.");
                }
                return;
            }

            // Claim the device by writing userId into deviceMeta
            await set(ownerRef, user.uid);

            // Add to user's devices
            const deviceRef = ref(db, `/users/${user.uid}/devices/${device.data.uid}`);

            await set(deviceRef, {
                name: device.data.name || "Perangkat",
                type: device.data.type || "unknown",
                ip: device.ip,
                discoveredAt: new Date().toISOString(),
                state: false, // Initialize state
            });

            Alert.alert("✅ Terhubung", `Perangkat '${device.data.name}' berhasil ditambahkan.`);
        } catch (error) {
            Alert.alert("❌ Gagal", "Tidak bisa menambahkan perangkat.");
            console.error(error);
        }
    };

    useEffect(() => {
        if (activeTab === "scan") {
            scanNetwork();
        }
    }, [activeTab]);

    const renderControlTab = () => (
        <View className="flex-1">
            {/* input + tambah */}
            {!deleteMode && (
                <View className="flex-row items-center mb-4">
                    <TextInput
                        value={newName}
                        onChangeText={setNewName}
                        placeholder="Nama perangkat (contoh: lampu tidur)"
                        placeholderTextColor="#aaa"
                        className="flex-1 border border-gray-600 bg-white rounded px-3 py-2 mr-2"
                    />
                    <Pressable onPress={addDevice} className="bg-[#ffd33d] px-4 py-2 rounded">
                        <Text className="text-black font-semibold">Tambah</Text>
                    </Pressable>
                </View>
            )}

            {/* Delete mode controls */}
            {deleteMode && (
                <View className="flex-row justify-between items-center mb-4">
                    <Pressable
                        onPress={() => setDeleteMode(false)}
                        className="bg-gray-500 px-4 py-2 rounded"
                    >
                        <Text className="text-white font-semibold">Batal</Text>
                    </Pressable>
                    <Pressable
                        onPress={deleteSelectedDevices}
                        className="bg-red-500 px-4 py-2 rounded"
                    >
                        <Text className="text-white font-semibold">Hapus Terpilih</Text>
                    </Pressable>
                </View>
            )}

            {/* daftar device */}
            <FlatList
                data={devices}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const isLogVisible = showLogsMap[item.id] || false;
                    return (
                        <TouchableOpacity
                            onLongPress={() => handleLongPress(item.id)}
                            onPress={() => deleteMode && toggleSelect(item.id)}
                            activeOpacity={1}
                        >
                            <View className={`bg-white p-4 mb-3 rounded-xl ${item.selected ? "border-2 border-yellow-400" : "shadow"}`}>
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-row items-center">
                                        {getIcon(item.type, item.state)}
                                        <Text className="ml-2 text-lg text-gray-800">{item.name}</Text>
                                    </View>
                                    {item.mode && (
                                        <View className="ml-2 px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: item.mode === "solid" ? "#ffd33d" : "#3b82f6" }}>
                                            <Text style={{ fontSize: 12, fontWeight: "bold", color: item.mode === "solid" ? "#000" : "#fff" }}>
                                                {item.mode.toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {item.type === "lock" && (
                                    <Pressable
                                        onPress={() => router.push({
                                            pathname: "/rfidManager",
                                            params: {
                                                deviceUid: item.id,
                                                deviceName: item.name,
                                            },
                                        })}
                                        className="mt-2"
                                    >
                                        <Text className="text-blue-500 underline text-sm">Kelola Kartu RFID & PIN</Text>
                                    </Pressable>
                                )}

                                {item.logs?.length > 0 && (
                                    <Pressable onPress={() => setShowLogsMap((prev) => ({ ...prev, [item.id]: !isLogVisible }))} className="mt-2">
                                        <Text className="text-sm text-blue-600 font-medium">
                                            {isLogVisible ? "Sembunyikan Log" : "Lihat Log"}
                                        </Text>
                                    </Pressable>
                                )}

                                {isLogVisible && item.logs && (
                                    <View className="mt-2 pl-2 border-l-2 border-yellow-300">
                                        <ScrollView nestedScrollEnabled scrollEnabled style={{ maxHeight: 100 }}>
                                            {item.logs.slice().reverse().map((log, index) => (
                                                <Text key={index} className="text-sm text-gray-700 mb-1">• {log}</Text>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                <View className="mt-2 flex-row justify-end">
                                    {!deleteMode ? (
                                        <Switch
                                            value={item.state}
                                            onValueChange={() => toggleDevice(item)}
                                            trackColor={{ true: "#ffd33d", false: "#ccc" }}
                                            thumbColor={item.state ? "#fff" : "#eee"}
                                        />
                                    ) : (
                                        <Ionicons
                                            name={item.selected ? "checkbox-outline" : "square-outline"}
                                            size={24}
                                            color={item.selected ? "#ffd33d" : "#999"}
                                        />
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );

    const renderScanTab = () => (
        <ScrollView className="flex-1">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-white text-xl font-bold">Pindai Perangkat Wi-Fi</Text>
                <Pressable
                    onPress={scanNetwork}
                    className="bg-yellow-400 px-4 py-2 rounded-xl"
                >
                    <Text className="text-black font-bold">Pindai Lagi</Text>
                </Pressable>
            </View>

            {isScanning && (
                <View className="items-center my-8">
                    <ActivityIndicator size="large" color="#ffd33d" />
                    <Text className="text-white mt-3">Memindai jaringan lokal...</Text>
                </View>
            )}

            {!isScanning && foundDevices.length === 0 && (
                <Text className="text-white text-center mt-10">Tidak ada perangkat ditemukan</Text>
            )}

            {foundDevices.map((device, index) => (
                <Pressable
                    key={index}
                    onPress={() => handleDevicePress(device)}
                    className="bg-white/10 p-4 rounded-xl mb-3 border border-yellow-500"
                >
                    <View className="flex-row justify-between items-center">
                        <View>
                            <Text className="text-white font-bold text-lg">{device.data.name || "Perangkat"}</Text>
                            <Text className="text-gray-300 text-sm">{device.ip}</Text>
                        </View>
                        <Ionicons name="wifi" size={24} color="#ffd33d" />
                    </View>
                </Pressable>
            ))}
        </ScrollView>
    );

    return (
        <View className="flex-1 bg-[#25292e]">
            {/* Tab Header */}
            <View className="flex-row bg-[#2c2f34] mx-4 mt-4 rounded-xl">
                <Pressable
                    onPress={() => setActiveTab("control")}
                    className={`flex-1 py-3 items-center rounded-xl ${activeTab === "control" ? "bg-[#ffd33d]" : ""}`}
                >
                    <Text className={`font-semibold ${activeTab === "control" ? "text-black" : "text-white"}`}>
                        Kontrol Perangkat
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setActiveTab("scan")}
                    className={`flex-1 py-3 items-center rounded-xl ${activeTab === "scan" ? "bg-[#ffd33d]" : ""}`}
                >
                    <Text className={`font-semibold ${activeTab === "scan" ? "text-black" : "text-white"}`}>
                        Pindai Perangkat
                    </Text>
                </Pressable>
            </View>

            {/* Tab Content */}
            <View className="flex-1 p-4">
                {activeTab === "control" ? renderControlTab() : renderScanTab()}
            </View>

            {/* Modal for device mode selection */}
            <Modal isVisible={showModeModal} onBackdropPress={() => setShowModeModal(false)}>
                <View className="bg-[#2c2f34] rounded-lg p-5">
                    <Text className="text-white text-lg font-semibold mb-3">Pilih Mode Perangkat</Text>
                    <View className="flex-row justify-around mb-4">
                        {["solid", "pulse"].map((mode) => (
                            <Pressable
                                key={mode}
                                onPress={() => setSelectedMode(mode as "solid" | "pulse")}
                                className={`px-4 py-2 rounded ${selectedMode === mode ? "bg-[#ffd33d]" : "bg-[#444]"}`}
                            >
                                <Text className={`font-semibold ${selectedMode === mode ? "text-black" : "text-white"}`}>
                                    {mode === "solid" ? "Solid (ON/OFF)" : "Pulse"}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {selectedMode === "pulse" && (
                        <View className="mb-4">
                            <Text className="text-white mb-2">Durasi Pulse:</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {[300, 1000, 5000, 10000].map((ms) => (
                                    <Pressable key={ms} onPress={() => setPulseDuration(ms)}
                                        className={`px-3 py-1 rounded ${pulseDuration === ms ? "bg-[#ffd33d]" : "bg-[#555]"}`}>
                                        <Text className={`text-sm ${pulseDuration === ms ? "text-black" : "text-white"}`}>
                                            {ms} ms
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    )}

                    <View className="flex-row justify-end mt-2">
                        <Pressable onPress={() => setShowModeModal(false)} className="bg-gray-500 px-4 py-2 rounded mr-2">
                            <Text className="text-white font-semibold">Batal</Text>
                        </Pressable>
                        <Pressable onPress={createDeviceWithMode} disabled={!selectedMode} className="bg-[#ffd33d] px-4 py-2 rounded">
                            <Text className="text-black font-semibold">Tambah</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}