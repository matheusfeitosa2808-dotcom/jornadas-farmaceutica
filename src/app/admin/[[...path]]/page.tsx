import AdminApp from "@/components/admin";
import "@/components/admin.css";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  return <AdminApp section={path[0] || ""} id={path[1]} />;
}
