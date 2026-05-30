export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto pb-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mt-1">Last updated: May 2026</p>
      </div>

      {[
        {
          title: "1. Information We Collect",
          body: "We collect information you provide when registering: your name, email address, phone number, and shop address. We also collect order history, product preferences, and location data used for delivery routing.",
        },
        {
          title: "2. How We Use Your Information",
          body: "Your information is used to process and deliver orders, send order updates and price notifications, improve our service, and communicate with you about your account. We do not sell your personal data to third parties.",
        },
        {
          title: "3. Data Sharing",
          body: "We share your shop name and delivery address with our delivery drivers solely for the purpose of completing your order. We do not share your personal information with any other third parties without your consent, except as required by law.",
        },
        {
          title: "4. Notifications",
          body: "We send push notifications and emails about order status, price changes, and account activity. You can manage notification preferences in the app settings.",
        },
        {
          title: "5. Data Security",
          body: "We use industry-standard security measures to protect your data, including encrypted connections (HTTPS) and secure password storage. However, no system is 100% secure — please keep your credentials safe.",
        },
        {
          title: "6. Data Retention",
          body: "We retain your account data for as long as your account is active. Order history is retained for accounting and legal purposes. You may request deletion of your account at any time from the profile settings.",
        },
        {
          title: "7. Your Rights",
          body: "You have the right to access, correct, or delete your personal data. To exercise these rights, contact iKiWi support through the app.",
        },
        {
          title: "8. Contact",
          body: "If you have questions about this Privacy Policy or how your data is handled, please contact us through the app's support section.",
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
