import ParticipantApp from "@/components/participant";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  return <ParticipantApp section={path[0] || ""} id={path[1]} />;
}
