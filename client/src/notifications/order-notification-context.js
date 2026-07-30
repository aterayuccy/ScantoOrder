import { createContext, useContext, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/auth-context";
import PaymentService from "../services/payment.service";

const OrderNotificationContext = createContext(null);
let sharedAudioContext = null;

const getPreferenceKey = (sellerId) =>
  sellerId ? `scanToOrder.orderNotifications:${sellerId}` : "";

const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    sharedAudioContext = sharedAudioContext || new AudioContext();
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume();
    }

    const oscillator = sharedAudioContext.createOscillator();
    const gain = sharedAudioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, sharedAudioContext.currentTime);
    gain.gain.setValueAtTime(0.0001, sharedAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.22,
      sharedAudioContext.currentTime + 0.02
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      sharedAudioContext.currentTime + 0.35
    );
    oscillator.connect(gain);
    gain.connect(sharedAudioContext.destination);
    oscillator.start();
    oscillator.stop(sharedAudioContext.currentTime + 0.36);
  } catch (error) {
    console.error("new order sound failed:", error);
  }
};

const showNewOrderNotification = (newPayments) => {
  if (!newPayments.length) return;

  playNotificationSound();
  if ("Notification" in window && Notification.permission === "granted") {
    const firstPayment = newPayments[0];
    const location = firstPayment.tableNumber
      ? `桌號 ${firstPayment.tableNumber}`
      : "新顧客";
    const extra =
      newPayments.length > 1 ? `，另有 ${newPayments.length - 1} 張訂單` : "";

    new Notification("Scan to Order 新訂單", {
      body: `${location} 已送出訂單${extra}`,
      tag: `new-order-${Date.now()}`,
    });
  }
};

export const OrderNotificationProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const sellerId =
    currentUser?.user?.role === "seller" ? currentUser.user._id : "";
  const preferenceKey = getPreferenceKey(sellerId);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () =>
      Boolean(preferenceKey) &&
      localStorage.getItem(preferenceKey) === "enabled"
  );
  const knownPaymentKeysRef = useRef(new Set());
  const hasLoadedPaymentsRef = useRef(false);

  useEffect(() => {
    const enabled =
      Boolean(preferenceKey) &&
      localStorage.getItem(preferenceKey) === "enabled";
    setNotificationsEnabled(enabled);
  }, [preferenceKey]);

  useEffect(() => {
    if (!notificationsEnabled || !sellerId) return undefined;

    const unlockSound = () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      sharedAudioContext = sharedAudioContext || new AudioContext();
      if (sharedAudioContext.state === "suspended") sharedAudioContext.resume();
    };

    document.addEventListener("pointerdown", unlockSound, {
      capture: true,
      once: true,
    });
    return () => {
      document.removeEventListener("pointerdown", unlockSound, true);
    };
  }, [notificationsEnabled, sellerId]);

  useEffect(() => {
    if (!notificationsEnabled || !sellerId) {
      knownPaymentKeysRef.current = new Set();
      hasLoadedPaymentsRef.current = false;
      return undefined;
    }

    let active = true;
    const loadNewOrders = () => {
      PaymentService.getSellerPayments()
        .then((response) => {
          if (!active) return;

          const payments = response.data || [];
          const newPayments = hasLoadedPaymentsRef.current
            ? payments.filter((payment) => {
                const key = payment.orderBatchId || payment.orderId;
                return key && !knownPaymentKeysRef.current.has(key);
              })
            : [];

          payments.forEach((payment) => {
            const key = payment.orderBatchId || payment.orderId;
            if (key) knownPaymentKeysRef.current.add(key);
          });
          hasLoadedPaymentsRef.current = true;
          showNewOrderNotification(newPayments);
        })
        .catch((error) => {
          console.error("new order notification polling failed:", error);
        });
    };

    knownPaymentKeysRef.current = new Set();
    hasLoadedPaymentsRef.current = false;
    loadNewOrders();
    const intervalId = window.setInterval(loadNewOrders, 3000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [notificationsEnabled, sellerId]);

  const toggleOrderNotifications = async () => {
    if (!preferenceKey) return "";

    if (notificationsEnabled) {
      localStorage.removeItem(preferenceKey);
      setNotificationsEnabled(false);
      return "新訂單提示音與瀏覽器通知已關閉。";
    }

    let permission = "unsupported";
    if ("Notification" in window) {
      permission = await Notification.requestPermission();
    }

    localStorage.setItem(preferenceKey, "enabled");
    setNotificationsEnabled(true);
    playNotificationSound();
    return permission === "granted"
      ? "新訂單提示已開啟；切換後台頁面也會繼續運作。"
      : "提示音已開啟，但瀏覽器通知未獲允許。";
  };

  const value = { notificationsEnabled, toggleOrderNotifications };

  return (
    <OrderNotificationContext.Provider value={value}>
      {children}
    </OrderNotificationContext.Provider>
  );
};

export const useOrderNotifications = () => {
  const context = useContext(OrderNotificationContext);
  if (!context) {
    throw new Error(
      "useOrderNotifications 必須在 OrderNotificationProvider 內使用"
    );
  }
  return context;
};
