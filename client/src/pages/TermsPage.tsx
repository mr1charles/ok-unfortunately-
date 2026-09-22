import { Link } from "react-router-dom";

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. What the game is",
    body: (
      <p>
        Pixel Estates is a game. You create a character, explore virtual islands made of purchasable "pixels" of
        land, decorate and build on land you own, trade with other players, and take part in gameplay features like
        auctions, credits, and attacks/defenses. Everything in the game - pixels, buildings, decorations, credits -
        is a digital game asset that exists only inside Pixel Estates. It is not physical property, not a financial
        security, and not a real-world currency.
      </p>
    ),
  },
  {
    title: "2. Accounts",
    body: (
      <>
        <p>You need an account to play. You agree to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Give accurate information when you register.</li>
          <li>Keep your password secure and not share your account.</li>
          <li>Meet the minimum age requirement for your location (see Section 16, "Age requirements", below).</li>
          <li>Not create accounts to evade a ban or manipulate the marketplace (e.g. fake buyers/sellers).</li>
        </ul>
        <p className="mt-2">You're responsible for activity that happens on your account.</p>
      </>
    ),
  },
  {
    title: "3. Virtual pixels and land",
    body: (
      <>
        <p>
          Buying a pixel or property in Pixel Estates gives you a license to use and display that digital asset
          within the game, for as long as the game and your account remain active. It does <strong>not</strong>{" "}
          give you ownership of any physical land, real property, or intellectual property outside the game.
        </p>
        <p className="mt-2">
          Pixel prices are set by the platform and can change at any time (for example, an admin may adjust the
          price for new/unowned pixels going forward). Changing the price of unowned pixels does not change what you
          already paid for pixels you already own.
        </p>
      </>
    ),
  },
  {
    title: "4. Purchases",
    body: (
      <>
        <p>
          Purchases in the live game use real money processed through a licensed payment provider. In development/
          test mode, purchases use fake "test funds" with no monetary value - these are clearly labeled and never
          convert to real money.
        </p>
        <p className="mt-2">
          You should only spend money in Pixel Estates that you're comfortable spending on a game. We do not
          guarantee that virtual land will increase in value, generate income, or be worth what you paid for it.
        </p>
      </>
    ),
  },
  {
    title: "5. Marketplace",
    body: (
      <p>
        Players can list land for sale to other players. Sale prices are set by the players involved - Pixel
        Estates does not set, guarantee, or endorse marketplace prices. When a player-to-player sale completes, the
        platform deducts a marketplace fee (the current rate is always shown before you list or buy) from the sale
        price; the seller receives the remainder. This fee percentage is configurable and may change; any change
        applies to sales completed after the change, not retroactively.
      </p>
    ),
  },
  {
    title: "6. Auctions",
    body: (
      <>
        <p>
          Sellers can auction land with a starting price, an optional reserve price, and a fixed duration. Bids are
          binding: if you win an auction, the winning amount is charged to your account balance and ownership
          transfers to you automatically. If the highest bid doesn't meet the reserve price, the auction ends with
          no sale.
        </p>
        <p className="mt-2">
          We take reasonable technical measures to prevent fake bids, duplicate wins, and bids that exceed a
          player's available balance, but auction outcomes are final once settled.
        </p>
      </>
    ),
  },
  {
    title: "7. Credits",
    body: (
      <p>
        Credits are a separate, in-game currency earned through gameplay (like mining or successful attacks) and
        spent on gameplay features (like shields and cosmetics). Credits are <strong>not</strong> real money, are
        not purchasable with real money in this version of the game, and cannot be redeemed, exchanged, or cashed
        out for real money. Credit balances have no cash value.
      </p>
    ),
  },
  {
    title: "8. Attacks and defenses",
    body: (
      <p>
        Attacks, shields, and defenses are gameplay mechanics that affect credits and temporary in-game effects
        only. They can never remove, destroy, or transfer ownership of land or decorations you purchased with real
        money. Attack outcomes are randomized within probabilities we publish and may adjust from time to time to
        keep the game balanced.
      </p>
    ),
  },
  {
    title: "9. User-generated content",
    body: (
      <>
        <p>
          You're responsible for the decorations, property names, and other content you place or submit. Don't
          upload or create content that is illegal, infringes someone else's rights, or is hateful, harassing, or
          sexually explicit.
        </p>
        <p className="mt-2">
          We can remove content or decorations that violate these Terms, and repeated violations can lead to account
          suspension (see Section 11).
        </p>
      </>
    ),
  },
  {
    title: "10. Events",
    body: (
      <p>
        We run limited-time events (e.g. seasonal events) with their own cosmetic items. Event items may only be
        available to claim while the event is running; once claimed, they remain in your inventory permanently even
        after the event ends. We may end an event early or extend it, and event item availability is not
        guaranteed in advance.
      </p>
    ),
  },
  {
    title: "11. Account suspension",
    body: (
      <p>
        We can suspend or ban accounts that violate these Terms, engage in fraud, abuse the marketplace, exploit
        bugs for unfair advantage, or attempt to attack the platform's systems. Where reasonably possible we'll tell
        you why. Suspension does not automatically forfeit real-money balances that are legitimately yours, subject
        to our right to withhold funds connected to fraud or chargebacks while we investigate.
      </p>
    ),
  },
  {
    title: "12. Refund policy",
    body: (
      <>
        <p>
          Our general policy is that completed purchases are non-refundable once the underlying digital item
          (pixels, land, credits, decorations) has been delivered to your account, except as described below. We
          may apply a standard non-refundable window (currently framed as up to one year from purchase) as a
          default operating policy, but this is always subject to and overridden by:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Any refund rights required by the law of your country or state (for example, statutory cooling-off periods or consumer guarantees).</li>
          <li>The refund/chargeback rules of the payment provider or platform (e.g. app store) you paid through.</li>
          <li>Unauthorized transactions - if someone used your payment method without your permission.</li>
          <li>Duplicate charges - if you were accidentally charged twice for the same purchase.</li>
          <li>Verified technical failures - if a bug caused you to be charged without receiving the item.</li>
        </ul>
        <p className="mt-2">
          To request a refund or report a billing problem, contact us using the information in Section 16. This
          policy does not limit any right you have under mandatory consumer-protection law that cannot be waived by
          contract.
        </p>
      </>
    ),
  },
  {
    title: "13. Privacy",
    body: (
      <p>
        Our <Link to="/privacy" className="text-brand-500 font-bold hover:underline">Privacy Policy</Link> explains
        what information we collect, why, and how it's separated between account, gameplay, transaction, security,
        and analytics data. It's part of these Terms.
      </p>
    ),
  },
  {
    title: "14. Disclaimers",
    body: (
      <>
        <p>
          Pixel Estates is provided "as is." We don't guarantee the game will always be available, error-free, or
          uninterrupted. Virtual land and other digital assets are not guaranteed investments and may lose all
          value if the game is discontinued. Marketplace and auction prices reflect what other players are willing
          to pay, not a value we set or promise.
        </p>
        <p className="mt-2">
          To the extent permitted by law, we aren't liable for indirect or consequential losses arising from your
          use of the game. Nothing here removes liability that can't legally be excluded, such as liability for
          fraud or, where applicable, gross negligence. This section is intentionally general - the final
          dispute-resolution and liability language for each jurisdiction we operate in should be reviewed by a
          qualified lawyer before commercial launch, and nothing here should be read as "you can never bring a
          claim against us."
        </p>
      </>
    ),
  },
  {
    title: "15. Changes to the service",
    body: (
      <p>
        We may update these Terms, game features, prices for new/unowned content, and the fee percentages described
        above. We'll post the updated Terms here with a new effective date. Continuing to play after a change means
        you accept the update; if you disagree with a material change, you can stop using the service and, where
        applicable law entitles you to one, request any refund you're owed under Section 12.
      </p>
    ),
  },
  {
    title: "16. Age requirements",
    body: (
      <>
        <p>
          Because Pixel Estates involves real-money purchases, you must meet the minimum age to form a binding
          contract and consent to online purchases in your country or state, and where you are under that age but
          old enough to use the service with a parent or guardian's consent, that consent is required before making
          any purchase. We do not knowingly allow minors to bypass these requirements or to make purchases without
          the required consent. The exact minimum age and parental-consent process are configurable per
          jurisdiction and enforced at checkout and account creation.
        </p>
      </>
    ),
  },
  {
    title: "17. Contact information",
    body: (
      <p>
        Questions about these Terms, billing, or your account: <strong>support@pixelestates.example</strong> (
        placeholder contact for this prototype - replace with a real support address before launch).
      </p>
    ),
  },
];

export function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-light dark:bg-surface-dark p-4 md:p-10">
      <div className="max-w-3xl mx-auto panel p-6 md:p-10">
        <Link to="/world" className="text-brand-500 font-bold text-sm hover:underline">
          ← Back to the game
        </Link>
        <h1 className="text-3xl font-extrabold mt-4 mb-1">Terms &amp; Conditions</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          Plain-English summary. Effective for this prototype build. Last updated: development build.
        </p>
        <div className="flex flex-col gap-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2">{s.title}</h2>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
