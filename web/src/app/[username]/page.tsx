import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/auth-schema";
import ProfileLoader from "./profile-loader";

export default async function UserProfile({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const [found] = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      displayUsername: user.displayUsername,
    })
    .from(user)
    .where(eq(user.username, username));

  if (!found) notFound();

  return (
    <ProfileLoader
      userId={found.id}
      name={found.name}
      image={found.image}
      displayUsername={found.displayUsername ?? username}
    />
  );
}
