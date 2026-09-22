import { Link } from "react-router-dom";

const CATEGORIES = [
  {
    title: "Account data",
    icon: "👤",
    items: ["Email address", "Username", "Password (stored as a one-way hash, never in plain text)", "Account creation date", "Role (player/admin)"],
    why: "To create and secure your account, let you log in, and communicate important account notices.",
  },
  {
    title: "Gameplay data",
    icon: "🎮",
    items: [
      "Character appearance and position",
      "Pixels/properties you own and their coordinates",
      "Decorations you've placed",
      "Credits balance and credit-earning history",
      "Attack/defense history (usernames only, never real-world identity)",
    ],
    why: "To run the game itself - showing you and other players the persistent world you've built.",
  },
  {
    title: "Transaction data",
    icon: "🧾",
    items: [
      "Purchase, sale, auction, and fee records (amounts, timestamps, involved usernames)",
      "Wallet balance",
      "In development mode: mock/test payment records only",
    ],
    why: "To run the real-money economy accurately, resolve disputes, and meet financial record-keeping obligations.",
  },
  {
    title: "Security logs",
    icon: "🔒",
    items: ["Login timestamps", "Admin action audit log (who did what administrative action, when, and why)", "Suspicious-activity flags on transactions"],
    why: "To protect the platform and all players from fraud, abuse, and unauthorized access, and to hold admins accountable for every action they take on the system.",
  },
  {
    title: "Analytics data",
    icon: "📊",
    items: ["Aggregate, non-identifying usage patterns (e.g. how much of an island is developed)"],
    why: "To understand how the game economy and world are evolving so we can tune it. We do not collect third-party ad-tracking analytics in this prototype.",
  },
];

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-light dark:bg-surface-dark p-4 md:p-10">
      <div className="max-w-3xl mx-auto panel p-6 md:p-10">
        <Link to="/world" className="text-brand-500 font-bold text-sm hover:underline">
          ← Back to the game
        </Link>
        <h1 className="text-3xl font-extrabold mt-4 mb-1">Privacy Policy</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          We collect only what's needed to run the game and keep it fair and secure. Here's exactly what that is.
        </p>

        <div className="flex flex-col gap-5 mb-8">
          {CATEGORIES.map((c) => (
            <div key={c.title} className="panel !shadow-none bg-slate-50 dark:bg-white/5 p-4">
              <h2 className="font-extrabold flex items-center gap-2 mb-2">
                <span className="text-xl">{c.icon}</span> {c.title}
              </h2>
              <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-0.5 mb-2">
                {c.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <strong>Why we collect it:</strong> {c.why}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2">What we don't collect</h2>
            <p>
              We don't ask for your real name, physical address, government ID, or precise location. We don't sell
              your data to third parties. Attack history and marketplace activity are shown to other players using
              your username only, never any other identifying information.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2">Payment information</h2>
            <p>
              In development mode, no real payment information is collected at all - deposits are simulated. In a
              production deployment, real payment details would be handled directly by a licensed, PCI-compliant
              payment processor; Pixel Estates itself would never store your full card number.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2">Your choices</h2>
            <p>
              You can review your transaction and attack history at any time from your account. Contact support to
              request deletion of your account and associated personal data, subject to records we're required to
              keep for financial/audit purposes.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2">Contact</h2>
            <p>
              Questions about this policy: <strong>privacy@pixelestates.example</strong> (placeholder contact for
              this prototype).
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
