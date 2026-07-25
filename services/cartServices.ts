import apiClient from "@/services/api";
import { Diamond } from "@/services/diamondService";
import { AxiosError } from "axios";

export interface ApiSuccessResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

export interface ApiErrorResponse {
    message: string;
}

// The cart API mixes two item shapes in `items`: diamond items carry
// diamondId/diamond, melee items carry melleId/melle (added from the web app).
export interface CartItem {
    diamondId?: string;
    diamond?: Diamond;
    melleId?: string;
    melle?: Record<string, unknown>;
    addedAt: string;
    status?: string;
}

export type DiamondCartItem = CartItem & { diamondId: string; diamond: Diamond };

export const isDiamondCartItem = (item: CartItem): item is DiamondCartItem =>
    Boolean(item?.diamond?._id);

export interface Cart {
    _id: string;
    userId: string;
    items: CartItem[];
    createdAt: string;
    updatedAt: string;
}

export interface CartResponseData {
    cart: Cart | null;
    totalItems: number;
}

export interface AddToCartResponseData {
    cartItem: CartItem;
}

export interface HoldDiamondResponseData {
    message: string;
    stockRef: string;
}

export interface RemoveFromCartResponseData {
    message: string;
    cart: Cart | null;
}

export interface HoldItemsResponseData {
    holdItems: CartItem[];
    totalItems: number;
}

export const getCart = async (): Promise<
    ApiSuccessResponse<CartResponseData>
> => {
    try {
        const response =
            await apiClient.get<ApiSuccessResponse<CartResponseData>>(
                "/diamonds/cart",
            );
        return response.data;
    } catch (error) {
        const axiosError = error as AxiosError<ApiErrorResponse>;
        throw (
            axiosError.response?.data?.message ||
            "Failed to retrieve cart. Please try again."
        );
    }
};

export const addToCart = async (
    diamondId: string[],
): Promise<ApiSuccessResponse<AddToCartResponseData>> => {
    try {
        const response = await apiClient.post<
            ApiSuccessResponse<AddToCartResponseData>
        >("/diamonds/cart/add", { diamondId });
        return response.data;
    } catch (error) {
        const axiosError = error as AxiosError<ApiErrorResponse>;
        throw (
            axiosError.response?.data?.message ||
            "Failed to add to cart. Please try again."
        );
    }
};

export const removeFromCart = async (
    diamondId: string,
): Promise<ApiSuccessResponse<RemoveFromCartResponseData>> => {
    try {
        const response = await apiClient.delete<
            ApiSuccessResponse<RemoveFromCartResponseData>
        >(`/diamonds/cart/${diamondId}`);
        return response.data;
    } catch (error) {
        const axiosError = error as AxiosError<ApiErrorResponse>;
        throw (
            axiosError.response?.data?.message ||
            "Failed to remove item from cart. Please try again."
        );
    }
};

export const clearCart = async (): Promise<
    ApiSuccessResponse<RemoveFromCartResponseData>
> => {
    try {
        const response =
            await apiClient.delete<
                ApiSuccessResponse<RemoveFromCartResponseData>
            >("/diamonds/cart");
        return response.data;
    } catch (error) {
        const axiosError = error as AxiosError<ApiErrorResponse>;
        throw (
            axiosError.response?.data?.message ||
            "Failed to clear cart. Please try again."
        );
    }
};

export const holdDiamond = async (
    stockRef: string | string[],
): Promise<ApiSuccessResponse<HoldDiamondResponseData>> => {
    try {
        const response = await apiClient.post<
            ApiSuccessResponse<HoldDiamondResponseData>
        >("/diamonds/hold", { stockRef });
        return response.data;
    } catch (error) {
        const axiosError = error as AxiosError<ApiErrorResponse>;
        throw (
            axiosError.response?.data?.message ||
            "Failed to hold diamond. Please try again."
        );
    }
};

export const getHoldItems = async (): Promise<
    ApiSuccessResponse<HoldItemsResponseData>
> => {
    try {
        const response = await apiClient.get<
            ApiSuccessResponse<HoldItemsResponseData>
        >("/diamonds/cart/hold");
        return response.data;
    } catch (error) {
        const axiosError = error as AxiosError<ApiErrorResponse>;
        throw (
            axiosError.response?.data?.message ||
            "Failed to retrieve hold items. Please try again."
        );
    }
};
