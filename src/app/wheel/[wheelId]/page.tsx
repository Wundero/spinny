import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import { redirect } from "next/navigation";

export default async function WheelPage({
  params,
}: {
  params: { wheelId: string };
}) {
  const { wheelId } = params;
  let wheel = await api.wheel.getWheel.query({ publicId: wheelId });
  if (!wheel) {
    redirect("/");
  }
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/");
  }
  if (!wheel.users.find((u) => u.userId === session.user.id)) {
    await api.wheel.joinWheel.mutate({ publicId: wheelId });
    wheel = await api.wheel.getWheel.query({ publicId: wheelId });
  }

  return <div>Hi {wheelId}</div>;
}
