export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto pb-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mt-1">Last updated: May 2026</p>
      </div>

      {[
        {
          title: "1. Service Overview",
          body: "iKiWi is a B2B produce delivery platform that connects fresh produce suppliers with local shop owners. By using iKiWi, you agree to these terms.",
        },
        {
          title: "2. Orders",
          body: "Orders placed before the daily cutoff time are delivered the following morning. Quantities shown are estimates — final amounts are confirmed after weighing. You will be notified of the final cost before payment.",
        },
        {
          title: "3. Payment",
          body: "Payment is collected at the time of delivery in cash or by card, as selected in your payment preferences. Prices are shown in Uzbek Som (UZS) and may vary day to day based on market rates.",
        },
        {
          title: "4. Cancellations",
          body: "Orders can be cancelled before they are marked as 'Preparing'. Once preparation begins, cancellation may not be possible. Contact iKiWi support for assistance.",
        },
        {
          title: "5. Account Responsibility",
          body: "You are responsible for keeping your account credentials secure. Do not share your login details. iKiWi is not liable for unauthorized access resulting from credential sharing.",
        },
        {
          title: "6. Product Quality",
          body: "iKiWi strives to deliver fresh, high-quality produce. If you receive items that do not meet quality standards, contact support within 24 hours of delivery.",
        },
        {
          title: "7. Changes to Terms",
          body: "iKiWi may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.",
        },
        {
          title: "8. Contact",
          body: "For questions about these terms, contact us through the app's support section or reach out to your iKiWi account manager.",
        },
      ].map(({ title, body }) => (
        <div key={title} className="space-y-1.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>
      ))}
    </div>
  );
}
