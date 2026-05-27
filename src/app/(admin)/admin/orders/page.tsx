import { OrderTable } from "@/components/admin/OrderTable";

export default function AdminOrdersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <OrderTable />
    </div>
  );
}
