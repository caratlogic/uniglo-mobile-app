import { DiamondCard } from "@/components/inventory/DiamondCard";
import { DiamondCardSkeleton } from "@/components/inventory/DiamondCardSkeleton";
import { useAuth } from "@/context/AuthContext";
import {
    DiamondCartItem,
    getHoldItems,
    isDiamondCartItem,
} from "@/services/cartServices";
import { getUserQueries, InquiryQuery } from "@/services/inquiryServices";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Tab = "hold" | "enquiry";

interface GroupedEnquiry {
    stockRef: string;
    diamond: InquiryQuery["diamondId"];
    queries: InquiryQuery[];
    latestQuery: InquiryQuery;
    latestMessage: string;
    latestTimestamp: string;
    hasUnreplied: boolean;
    totalCount: number;
}

function formatTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? "pm" : "am";
        const h = hours % 12 || 12;
        const m = minutes.toString().padStart(2, "0");
        return `${h}:${m}${ampm}`;
    } else if (diffDays === 1) {
        return "Yesterday";
    } else if (diffDays < 7) {
        return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    }
}

function groupEnquiriesByStockRef(queries: InquiryQuery[]): GroupedEnquiry[] {
    const grouped: Record<string, InquiryQuery[]> = {};

    for (const q of queries) {
        if (!grouped[q.stockRef]) {
            grouped[q.stockRef] = [];
        }
        grouped[q.stockRef].push(q);
    }

    return (
        Object.entries(grouped)
            .map(([stockRef, stockQueries]) => {
                // Sort by createdAt descending to get latest first
                const sorted = [...stockQueries].sort(
                    (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                );

                const latestQuery = sorted[0];

                // Determine the latest message (admin reply or user query)
                // Check if admin replied after user's last query
                let latestMessage = "";
                let latestTimestamp = latestQuery.createdAt;

                if (latestQuery.adminReply && latestQuery.repliedAt) {
                    // Compare repliedAt with createdAt
                    const repliedTime = new Date(
                        latestQuery.repliedAt,
                    ).getTime();
                    const createdTime = new Date(
                        latestQuery.createdAt,
                    ).getTime();
                    if (repliedTime >= createdTime) {
                        latestMessage = `Admin: ${latestQuery.adminReply}`;
                        latestTimestamp = latestQuery.repliedAt;
                    } else {
                        latestMessage = latestQuery.query;
                    }
                } else {
                    latestMessage = latestQuery.query;
                }

                const hasUnreplied = sorted.some((q) => q.status === "pending");

                return {
                    stockRef,
                    diamond: latestQuery.diamondId,
                    queries: sorted,
                    latestQuery,
                    latestMessage,
                    latestTimestamp,
                    hasUnreplied,
                    totalCount: stockQueries.length,
                };
            })
            // Sort groups by latest timestamp descending
            .sort(
                (a, b) =>
                    new Date(b.latestTimestamp).getTime() -
                    new Date(a.latestTimestamp).getTime(),
            )
    );
}

function EnquiryGroupItem({ group }: { group: GroupedEnquiry }) {
    const router = useRouter();
    const diamond = group.diamond;
    const summary = diamond
        ? `${diamond.shape ?? ""} ${diamond.weight ?? ""} CT ${diamond.color ?? ""}${diamond.clarity ?? ""} ${diamond.cutGrade ?? ""}`.trim()
        : group.stockRef;

    const getStatusDot = (status: string) => {
        switch (status) {
            case "pending":
                return "bg-yellow-400";
            case "replied":
                return "bg-green-400";
            case "closed":
                return "bg-gray-400";
            default:
                return "bg-blue-400";
        }
    };

    return (
        <TouchableOpacity
            onPress={() =>
                router.push(`/enquiry/${encodeURIComponent(group.stockRef)}`)
            }
            activeOpacity={0.7}
            className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100"
        >
            {/* Avatar / Diamond image */}
            <View className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center overflow-hidden mr-3">
                {diamond?.webLink ? (
                    <Image
                        source={{ uri: diamond.webLink }}
                        className="w-10 h-10 rounded-full"
                        resizeMode="cover"
                    />
                ) : (
                    <Ionicons
                        name="diamond-outline"
                        size={20}
                        color="#9CA3AF"
                    />
                )}
            </View>

            {/* Summary & last message preview */}
            <View className="flex-1">
                <Text
                    className="text-sm font-latoBold text-gray-900"
                    numberOfLines={1}
                >
                    {summary}
                </Text>
                <Text
                    className="text-xs font-lato text-gray-500 mt-0.5"
                    numberOfLines={1}
                >
                    {group.latestMessage}
                </Text>
            </View>

            {/* Status dot, time & count */}
            <View className="items-end ml-2 gap-1">
                <Text className="text-xs font-lato text-gray-400">
                    {formatTime(group.latestTimestamp)}
                </Text>
                <View className="flex-row items-center gap-1.5">
                    {group.totalCount > 1 && (
                        <View className="bg-gray-200 rounded-full px-1.5 py-0.5 min-w-[18px] items-center">
                            <Text className="text-[10px] font-latoBold text-gray-600">
                                {group.totalCount}
                            </Text>
                        </View>
                    )}
                    <View
                        className={`w-2.5 h-2.5 rounded-full ${getStatusDot(group.latestQuery.status)}`}
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
}

export default function OperationsScreen() {
    const { isAuthenticated } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>("hold");

    // Hold stones state
    const [holdItems, setHoldItems] = useState<DiamondCartItem[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Enquiry state
    const [enquiries, setEnquiries] = useState<InquiryQuery[]>([]);
    const [enquiryLoading, setEnquiryLoading] = useState(true);
    const [enquiryRefreshing, setEnquiryRefreshing] = useState(false);

    if (!isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    const fetchHoldItems = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await getHoldItems();
            if (res.success) {
                setHoldItems(
                    (res.data.holdItems ?? []).filter(isDiamondCartItem),
                );
                setTotalItems(res.data.totalItems ?? 0);
            }
        } catch (err: any) {
            Alert.alert(
                "Error",
                err?.toString() ?? "Failed to load hold items",
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const fetchEnquiries = useCallback(async (silent = false) => {
        if (!silent) setEnquiryLoading(true);
        try {
            const res = await getUserQueries();
            if (res.success) {
                setEnquiries(res.data.queries ?? []);
            }
        } catch (err: any) {
            Alert.alert("Error", err?.toString() ?? "Failed to load enquiries");
        } finally {
            setEnquiryLoading(false);
            setEnquiryRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === "hold") {
            fetchHoldItems();
        } else {
            fetchEnquiries();
        }
    }, [activeTab, fetchHoldItems, fetchEnquiries]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchHoldItems(true);
    }, [fetchHoldItems]);

    const onEnquiryRefresh = useCallback(() => {
        setEnquiryRefreshing(true);
        fetchEnquiries(true);
    }, [fetchEnquiries]);

    const groupedEnquiries = groupEnquiriesByStockRef(enquiries);

    const renderHoldTab = () => {
        if (loading) {
            return (
                <ScrollView className="flex-1 px-4 pt-4">
                    {[...Array(4)].map((_, i) => (
                        <DiamondCardSkeleton key={i} />
                    ))}
                </ScrollView>
            );
        }

        if (holdItems.length === 0) {
            return (
                <View className="flex-1 items-center justify-center gap-4 px-8">
                    <Ionicons
                        name="diamond-outline"
                        size={72}
                        color="#d1d5db"
                    />
                    <Text className="text-lg font-latoBold text-gray-400">
                        No hold stones
                    </Text>
                    <Text className="text-sm font-lato text-gray-400 text-center">
                        Diamonds you put on hold will appear here.
                    </Text>
                </View>
            );
        }

        return (
            <View className="flex-1">
                {/* Summary row */}
                <View className="flex-row items-center justify-between px-4 py-3">
                    <Text className="text-sm font-lato text-gray-600">
                        Total Diamond: {totalItems}
                    </Text>
                </View>

                <FlatList
                    data={holdItems}
                    keyExtractor={(item) =>
                        item.diamondId ?? item.diamond._id
                    }
                    contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingBottom: 16,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#49214c"
                        />
                    }
                    renderItem={({ item }) => (
                        <DiamondCard diamond={item.diamond} />
                    )}
                />
            </View>
        );
    };

    const renderEnquiryTab = () => {
        if (enquiryLoading) {
            return (
                <ScrollView className="flex-1">
                    {[...Array(6)].map((_, i) => (
                        <View
                            key={i}
                            className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100"
                        >
                            <View className="w-10 h-10 rounded-full bg-gray-200 mr-3" />
                            <View className="flex-1 gap-1">
                                <View className="w-48 h-4 bg-gray-200 rounded" />
                                <View className="w-32 h-3 bg-gray-200 rounded" />
                            </View>
                            <View className="w-12 h-3 bg-gray-200 rounded" />
                        </View>
                    ))}
                </ScrollView>
            );
        }

        if (groupedEnquiries.length === 0) {
            return (
                <View className="flex-1 items-center justify-center gap-4 px-8">
                    <Ionicons name="mail-outline" size={72} color="#d1d5db" />
                    <Text className="text-lg font-latoBold text-gray-400">
                        No enquiries yet
                    </Text>
                    <Text className="text-sm font-lato text-gray-400 text-center">
                        Your enquiries will appear here.
                    </Text>
                </View>
            );
        }

        return (
            <FlatList
                data={groupedEnquiries}
                keyExtractor={(item) => item.stockRef}
                className="bg-white"
                refreshControl={
                    <RefreshControl
                        refreshing={enquiryRefreshing}
                        onRefresh={onEnquiryRefresh}
                        tintColor="#49214c"
                    />
                }
                renderItem={({ item }) => <EnquiryGroupItem group={item} />}
            />
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 ">
                {/* Title */}
                <View className="px-4 pb-2">
                    <Text className="text-2xl font-loraBold text-primary-purple">
                        My Operations
                    </Text>
                </View>

                {/* Tabs */}
                <View className="flex-row mx-4 mb-2 rounded-lg overflow-hidden border border-gray-200">
                    <TouchableOpacity
                        onPress={() => setActiveTab("hold")}
                        className={`flex-1 py-3 items-center ${
                            activeTab === "hold"
                                ? "bg-primary-purple"
                                : "bg-white"
                        }`}
                    >
                        <Text
                            className={`text-sm font-latoBold ${
                                activeTab === "hold"
                                    ? "text-white"
                                    : "text-gray-600"
                            }`}
                        >
                            HOLD STONES
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab("enquiry")}
                        className={`flex-1 py-3 items-center ${
                            activeTab === "enquiry"
                                ? "bg-primary-purple"
                                : "bg-white"
                        }`}
                    >
                        <Text
                            className={`text-sm font-latoBold ${
                                activeTab === "enquiry"
                                    ? "text-white"
                                    : "text-gray-600"
                            }`}
                        >
                            ENQUIRY
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Tab Content */}
                <View className="flex-1 bg-gray-50">
                    {activeTab === "hold"
                        ? renderHoldTab()
                        : renderEnquiryTab()}
                </View>
            </View>
        </SafeAreaView>
    );
}
