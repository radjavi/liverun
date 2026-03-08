"use client";

import { createAuthClient } from "better-auth/react";
import {
  usernameClient,
  deviceAuthorizationClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [usernameClient(), deviceAuthorizationClient()],
});

export const { useSession, signIn, signOut, signUp } = authClient;
