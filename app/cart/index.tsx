import { DiamondCardSkeleton } from "@/components/inventory/DiamondCardSkeleton";
import { AppHeader } from "@/components/shared/AppHeader";
import { useAuth } from "@/context/AuthContext";
import {
    clearCart,
    DiamondCartItem,
    getCart,
    holdDiamond,
    isDiamondCartItem,
    removeFromCart,
} from "@/services/cartServices";
import { Diamond } from "@/services/diamondService";
import { SHAPES } from "@/types/diamond.types";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    GestureHandlerRootView,
    PanGestureHandler,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Non-interactive Diamond Card for Cart ─────────────────────────────────────

function CartDiamondCard({ diamond }: { diamond: Diamond }) {
    const getShapeName = (code: string) => {
        const shapeObj = SHAPES.find((s) => s.value === code);
        return shapeObj ? shapeObj.label.toUpperCase() : code.toUpperCase();
    };

    // Format the top header string dynamically
    const headerDetails = [
        getShapeName(diamond.shape),
        diamond.weight?.toFixed(2),
        diamond.color,
        diamond.clarity,
        diamond.lab,
        diamond.fluorescenceColor || "NON",
    ]
        .filter(Boolean)
        .join(" | ");

    const ratio =
        diamond.length && diamond.width
            ? (diamond.length / diamond.width).toFixed(2)
            : null;
    return (
        <View className="bg-white rounded-lg border border-primary-purple/60 mb-3 overflow-hidden">
            {/* Top Header Row */}
            <View className="flex-row justify-between items-center p-3 border-b border-primary-purple/60 font-lato">
                <Text className="font-bold text-black text-sm tracking-wider">
                    {headerDetails}
                </Text>
                <Text className="font-bold text-black text-sm">
                    {diamond.stockRef}
                </Text>
            </View>

            {/* Details Body */}
            <View className="flex-row p-3">
                {/* Column 1: Specs */}
                <View className="flex-[1.4] pr-1">
                    <View className="flex-row mb-2">
                        <Text className="text-gray-400 text-sm w-11">
                            C-P-S
                        </Text>
                        <Text className="font-bold text-black text-sm">
                            {diamond.cutGrade || "-"}-{diamond.polish || "-"}-
                            {diamond.symmetry || "-"}
                        </Text>
                    </View>
                    <View className="flex-row mb-2">
                        <Text className="text-gray-400 text-sm w-11">MEAS</Text>
                        <Text
                            className="font-bold text-black text-sm"
                            numberOfLines={1}
                        >
                            {diamond.measurements || "-"}
                        </Text>
                    </View>
                    <View className="flex-row">
                        <Text className="text-gray-400 text-sm w-11">
                            RATIO
                        </Text>
                        <Text className="font-bold text-black text-sm">
                            {ratio || "-"}
                        </Text>
                    </View>
                </View>

                {/* Column 2: Proportions & Location */}
                <View className="flex-[0.9]">
                    <View className="flex-row mb-2">
                        <Text className="text-gray-400 text-sm w-8">T</Text>
                        <Text className="font-bold text-black text-sm">
                            {diamond.tablePerc?.toFixed(2) || "-"} %
                        </Text>
                    </View>
                    <View className="flex-row mb-2">
                        <Text className="text-gray-400 text-sm w-8">D</Text>
                        <Text className="font-bold text-black text-sm">
                            {diamond.depthPerc?.toFixed(2) || "-"} %
                        </Text>
                    </View>
                    <View className="flex-row">
                        <Text className="text-gray-400 text-sm w-8">LOC</Text>
                        <Text className="font-bold text-black text-sm">
                            {diamond.country || "-"}
                        </Text>
                    </View>
                </View>

                {/* Vertical Divider Line */}
                <View className="w-[1px] bg-primary-purple mx-2 opacity-80" />

                {/* Column 3: Pricing */}
                <View className="flex-[1.2]">
                    <View className="flex-row justify-between mb-2">
                        <Text className="text-gray-400 text-sm">$/CTS:</Text>
                        <Text className="font-bold text-primary-purple text-sm">
                            {diamond.pricePerCts?.toFixed(2) || "-"}
                        </Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                        <Text className="text-gray-400 text-sm">DISC(%):</Text>
                        <Text
                            className={`font-bold ${diamond.discPerc && diamond.discPerc < 0 ? "text-red-600" : "text-green-600"} text-sm`}
                        >
                            {diamond.discPerc?.toFixed(2) || "-"}
                        </Text>
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-gray-400 text-sm">$TOTAL:</Text>
                        <Text className="font-bold text-black text-sm">
                            {diamond.priceListUSD?.toFixed(2) || "-"}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

// ── Swipeable Card ────────────────────────────────────────────────────────────

interface SwipeableCartCardProps {
    item: DiamondCartItem;
    onRemove: () => void;
    actionLoading: boolean;
    isSelected: boolean;
    onToggleSelect: () => void;
    selectionMode: boolean;
}

function SwipeableCartCard({
    item,
    onRemove,
    actionLoading,
    isSelected,
    onToggleSelect,
    selectionMode,
}: SwipeableCartCardProps) {
    const translateX = useRef(new Animated.Value(0)).current;
    const DELETE_THRESHOLD = -80;
    const MAX_SWIPE = -100;

    const onGestureEvent = Animated.event(
        [{ nativeEvent: { translationX: translateX } }],
        { useNativeDriver: true },
    );

    const onHandlerStateChange = ({ nativeEvent }: any) => {
        // State 5 = END
        if (nativeEvent.state === 5) {
            if (nativeEvent.translationX < DELETE_THRESHOLD) {
                Animated.spring(translateX, {
                    toValue: MAX_SWIPE,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                }).start();
            } else {
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 100,
                    friction: 8,
                }).start();
            }
        }
    };

    const handleDelete = () => {
        Animated.timing(translateX, {
            toValue: -500,
            duration: 250,
            useNativeDriver: true,
        }).start(() => onRemove());
    };

    const clampedTranslateX = translateX.interpolate({
        inputRange: [-200, 0],
        outputRange: [-200, 0],
        extrapolate: "clamp",
    });

    const deleteOpacity = translateX.interpolate({
        inputRange: [-100, -40],
        outputRange: [1, 0],
        extrapolate: "clamp",
    });

    const handlePress = () => {
        if (selectionMode) {
            onToggleSelect();
        } else {
            // Navigate to diamond detail
            router.push(
                `/diamond/${encodeURIComponent(item.diamond.stockRef)}`,
            );
        }
    };

    return (
        <View className="mb-3 overflow-hidden rounded-lg">
            {/* Delete background */}
            <Animated.View
                style={{ opacity: deleteOpacity }}
                className="absolute right-0 top-0 bottom-0 w-24 rounded-lg items-center justify-center border border-gray-200 bg-gray-50"
            >
                <TouchableOpacity
                    onPress={handleDelete}
                    disabled={actionLoading}
                    className="flex-1 w-full items-center justify-center gap-1"
                >
                    <Ionicons name="trash-outline" size={22} color="gray" />
                    <Text className="text-gray-400 text-xs font-latoBold">
                        Remove
                    </Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Swipeable card */}
            <PanGestureHandler
                onGestureEvent={onGestureEvent}
                onHandlerStateChange={onHandlerStateChange}
                activeOffsetX={[-10, 10]}
                failOffsetY={[-15, 15]}
                enabled={!selectionMode}
            >
                <Animated.View
                    style={{ transform: [{ translateX: clampedTranslateX }] }}
                >
                    <Pressable
                        onPress={handlePress}
                        onLongPress={onToggleSelect}
                        delayLongPress={400}
                    >
                        <View
                            className={`${
                                isSelected
                                    ? "border-2 border-[#c9a84c] rounded-xl"
                                    : ""
                            }`}
                        >
                            {/* Selection checkbox overlay */}
                            {selectionMode && (
                                <View className="absolute top-2 right-2 z-10">
                                    <View
                                        className={`w-6 h-6 rounded-full items-center justify-center ${
                                            isSelected
                                                ? "bg-[#c9a84c]"
                                                : "bg-white border-2 border-gray-300"
                                        }`}
                                    >
                                        {isSelected && (
                                            <Ionicons
                                                name="checkmark"
                                                size={16}
                                                color="#fff"
                                            />
                                        )}
                                    </View>
                                </View>
                            )}
                            <CartDiamondCard diamond={item.diamond} />
                        </View>
                    </Pressable>
                </Animated.View>
            </PanGestureHandler>
        </View>
    );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CartScreen() {
    const { isAuthenticated } = useAuth();
    const [cartItems, setCartItems] = useState<DiamondCartItem[]>([]);
    const [meleeCount, setMeleeCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [clearingCart, setClearingCart] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [holdingDiamonds, setHoldingDiamonds] = useState(false);

    const selectionMode = selectedIds.size > 0;

    const fetchCart = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await getCart();
            if (res.success) {
                const items = res.data.cart?.items ?? [];
                const diamondItems = items.filter(isDiamondCartItem);
                setCartItems(diamondItems);
                setMeleeCount(items.length - diamondItems.length);
            }
        } catch (err: any) {
            Alert.alert("Error", err?.toString() ?? "Failed to load cart");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchCart();
    }, [fetchCart]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setSelectedIds(new Set());
        fetchCart(true);
    }, [fetchCart]);

    const toggleSelect = (diamondId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(diamondId)) {
                next.delete(diamondId);
            } else {
                next.add(diamondId);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedIds.size === cartItems.length) {
            // Deselect all
            setSelectedIds(new Set());
        } else {
            // Select all
            setSelectedIds(new Set(cartItems.map((item) => item.diamond._id)));
        }
    };

    const handleHoldSelected = () => {
        if (selectedIds.size === 0) return;

        const selectedStockRefs = cartItems
            .filter((item) => selectedIds.has(item.diamond._id))
            .map((item) => item.diamond.stockRef);

        Alert.alert(
            "Hold Diamonds",
            `Put ${selectedIds.size} diamond${selectedIds.size > 1 ? "s" : ""} on hold?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Hold",
                    onPress: async () => {
                        setHoldingDiamonds(true);
                        try {
                            await holdDiamond(selectedStockRefs);
                            Alert.alert(
                                "Success",
                                `${selectedIds.size} diamond${selectedIds.size > 1 ? "s" : ""} placed on hold.`,
                            );
                            setSelectedIds(new Set());
                            await fetchCart(true);
                        } catch (err: any) {
                            Alert.alert(
                                "Error",
                                err?.toString() ??
                                    "Failed to hold diamonds. Please try again.",
                            );
                        } finally {
                            setHoldingDiamonds(false);
                        }
                    },
                },
            ],
        );
    };

    const handleRemoveOne = async (diamondId: string) => {
        try {
            setRemovingId(diamondId);
            await removeFromCart(diamondId);
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(diamondId);
                return next;
            });
            await fetchCart(true);
        } catch (err: any) {
            Alert.alert("Error", err?.toString() ?? "Failed to remove item");
        } finally {
            setRemovingId(null);
        }
    };

    const handleClearCart = () => {
        if (!cartItems.length) return;
        Alert.alert(
            "Clear Cart",
            "This will remove all items from your cart. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear Cart",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setClearingCart(true);
                            await clearCart();
                            setSelectedIds(new Set());
                            await fetchCart(true);
                        } catch (err: any) {
                            Alert.alert(
                                "Error",
                                err?.toString() ?? "Failed to clear cart",
                            );
                        } finally {
                            setClearingCart(false);
                        }
                    },
                },
            ],
        );
    };

    if (!isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <SafeAreaView className="flex-1">
            <AppHeader />
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View className="flex-1 bg-gray-50">
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-4 py-4 bg-white border-t border-gray-100">
                        <View className="flex-row items-center gap-2">
                            <TouchableOpacity
                                onPress={() => {
                                    if (selectionMode) {
                                        setSelectedIds(new Set());
                                    } else {
                                        router.back();
                                    }
                                }}
                                className="w-9 h-9 items-center justify-center"
                            >
                                <Ionicons
                                    name={
                                        selectionMode ? "close" : "arrow-back"
                                    }
                                    size={24}
                                    color="#49214c"
                                />
                            </TouchableOpacity>
                            <Text className="text-2xl font-loraBold text-primary-purple">
                                {selectionMode
                                    ? `${selectedIds.size} Selected`
                                    : "My Cart"}
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            {selectionMode && (
                                <TouchableOpacity
                                    onPress={handleSelectAll}
                                    className="px-3 py-1.5 rounded-full border border-gray-300"
                                >
                                    <Text className="text-xs font-latoBold text-gray-600">
                                        {selectedIds.size === cartItems.length
                                            ? "Deselect All"
                                            : "Select All"}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {selectionMode && (
                                <TouchableOpacity
                                    onPress={handleHoldSelected}
                                    disabled={holdingDiamonds}
                                    className="bg-[#c9a84c] px-3 py-1.5 rounded-full flex-row items-center gap-1"
                                    style={{
                                        opacity: holdingDiamonds ? 0.6 : 1,
                                    }}
                                >
                                    {holdingDiamonds ? (
                                        <ActivityIndicator
                                            size="small"
                                            color="#fff"
                                        />
                                    ) : (
                                        <>
                                            <Ionicons
                                                name="hand-left-outline"
                                                size={16}
                                                color="#fff"
                                            />
                                            <Text className="text-white text-xs font-latoBold">
                                                Hold
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={handleClearCart}
                                disabled={
                                    clearingCart || cartItems.length === 0
                                }
                                style={{
                                    opacity:
                                        clearingCart || cartItems.length === 0
                                            ? 0.4
                                            : 1,
                                }}
                            >
                                {clearingCart ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="#ef4444"
                                    />
                                ) : (
                                    <Ionicons
                                        name="trash-outline"
                                        size={22}
                                        color="#26062b"
                                    />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {loading ? (
                        <ScrollView className="flex-1 px-4 pt-4">
                            {[...Array(4)].map((_, i) => (
                                <DiamondCardSkeleton key={i} />
                            ))}
                        </ScrollView>
                    ) : cartItems.length === 0 ? (
                        <View className="flex-1 items-center justify-center gap-4 px-8">
                            <Ionicons
                                name="cart-outline"
                                size={72}
                                color="#d1d5db"
                            />
                            <Text className="text-lg font-latoBold text-gray-400">
                                {meleeCount > 0
                                    ? "No diamonds in your cart"
                                    : "Your cart is empty"}
                            </Text>
                            <Text className="text-sm font-lato text-gray-400 text-center">
                                {meleeCount > 0
                                    ? `${meleeCount} melee item${meleeCount > 1 ? "s" : ""} in your cart can be managed on the Uniglo website.`
                                    : "Browse our inventory and add diamonds to your cart."}
                            </Text>
                            <TouchableOpacity
                                onPress={() => router.push("/(tabs)/inventory")}
                                className="mt-2 bg-primary-purple px-6 py-3 rounded-lg"
                            >
                                <Text className="text-white font-latoBold text-sm">
                                    Browse Inventory
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {meleeCount > 0 && (
                                <View className="px-4 py-2 bg-amber-50 border-b border-amber-200">
                                    <Text className="text-xs font-lato text-amber-700 text-center">
                                        {meleeCount} melee item
                                        {meleeCount > 1 ? "s" : ""} in your cart
                                        can be managed on the Uniglo website.
                                    </Text>
                                </View>
                            )}
                            {!selectionMode && cartItems.length > 0 && (
                                <View className="px-4 py-2 bg-gray-100">
                                    <Text className="text-xs font-lato text-gray-500 text-center">
                                        Long press on a diamond to select & hold
                                    </Text>
                                </View>
                            )}
                            <FlatList
                                data={cartItems}
                                keyExtractor={(item) =>
                                    item.diamondId ?? item.diamond._id
                                }
                                contentContainerStyle={{ padding: 16 }}
                                refreshControl={
                                    <RefreshControl
                                        refreshing={refreshing}
                                        onRefresh={onRefresh}
                                        tintColor="#49214c"
                                    />
                                }
                                renderItem={({ item }) => (
                                    <SwipeableCartCard
                                        item={item}
                                        actionLoading={
                                            removingId === item.diamond._id
                                        }
                                        onRemove={() =>
                                            handleRemoveOne(item.diamond._id)
                                        }
                                        isSelected={selectedIds.has(
                                            item.diamond._id,
                                        )}
                                        onToggleSelect={() =>
                                            toggleSelect(item.diamond._id)
                                        }
                                        selectionMode={selectionMode}
                                    />
                                )}
                            />
                        </>
                    )}
                </View>
            </GestureHandlerRootView>
        </SafeAreaView>
    );
}
