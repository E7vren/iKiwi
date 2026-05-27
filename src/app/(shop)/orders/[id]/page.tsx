import { notFound } from "next/navigation";
import { getOrderById } from "@/server/actions/orders";
import { OrderDetailClient } from "./OrderDetailClient";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  return <OrderDetailClient order={order} />;
}
