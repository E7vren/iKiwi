import { notFound } from "next/navigation";
import { getOrderById } from "@/server/actions/orders";
import { ConfirmationClient } from "./ConfirmationClient";

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  return <ConfirmationClient order={order} />;
}
