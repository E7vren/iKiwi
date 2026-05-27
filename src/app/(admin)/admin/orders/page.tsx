import { OrderTable } from "@/components/admin/OrderTable";

export default function AdminOrdersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-headline-lg">Orders</h1>
      <OrderTable />
    </div>
  );
}
