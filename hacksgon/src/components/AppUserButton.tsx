"use client";

import { UserButton, useUser } from "@clerk/nextjs";

export function AppUserButton() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;

  if (role === "patient") {
    return <UserButton userProfileMode="navigation" userProfileUrl="/profile" />;
  }

  return <UserButton userProfileMode="modal" />;
}
