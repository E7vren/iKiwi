import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="mt-10 pb-4 text-center text-[11px] text-muted-foreground/60 space-y-0.5">
      <p className="font-medium text-muted-foreground/80">iKiwi v1.0.0</p>
      <p>© 2026 iKiwi · Tashkent, Uzbekistan</p>
      <p>
        <Link href="mailto:support@ikiwi.uz" className="hover:text-primary transition-colors">
          support@ikiwi.uz
        </Link>
        {" · "}
        <Link href="tel:+998901234567" className="hover:text-primary transition-colors">
          +998 90 123 45 67
        </Link>
      </p>
    </footer>
  );
}
