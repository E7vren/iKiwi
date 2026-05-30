import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-sm space-y-4">
        <div className="text-6xl">🥬</div>
        <h1 className="text-4xl font-extrabold text-foreground">404</h1>
        <p className="text-lg font-semibold text-foreground">Page not found</p>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors">
          Go home
        </Link>
      </div>
    </div>
  );
}
