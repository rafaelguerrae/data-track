"use client";
import { useSyncExternalStore } from "react";

const KEY = "dt_alerts_unread";
const EVENT = "dt:alerts-unread";

const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

const write = (unread: boolean) => {
  try {
    if (unread) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // sem localStorage (modo privado, etc.): o aviso só vale até recarregar
  }
  window.dispatchEvent(new Event(EVENT));
};

export const markAlertsUnread = () => write(true);
export const markAlertsRead = () => write(false);

const subscribe = (cb: () => void) => {
  // `storage` cobre outras abas; o evento próprio cobre a aba atual.
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/** Há algum alerta novo que o usuário ainda não abriu na tela de Alertas? */
export const useAlertsUnread = () => useSyncExternalStore(subscribe, read, () => false);
