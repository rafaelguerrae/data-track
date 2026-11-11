"use client";
import type { UserDto } from "@data-track/shared";
import { createContext, useContext } from "react";

export const UserContext = createContext<UserDto | null>(null);

export function useUser(): UserDto {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser fora do layout autenticado");
  return user;
}
