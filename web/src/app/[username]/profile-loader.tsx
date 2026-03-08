"use client";

import dynamic from "next/dynamic";

const ProfileClient = dynamic(() => import("./profile-client"), { ssr: false });

export default function ProfileLoader(props: {
  userId: string;
  name: string;
  image: string | null;
  displayUsername: string;
}) {
  return <ProfileClient {...props} />;
}
