import LegalDocument, { LegalSection } from "@/components/LegalDocument";

export default function PrivacyPolicy() {
  return (
    <LegalDocument
      title="Privacy Policy"
      updated="October 10, 2026"
      otherPath="/terms-and-conditions"
      otherLabel="Terms and Conditions"
    >
      <p>
        This Privacy Policy explains how Revex handles information when you create an account,
        browse or post content, message other users, or buy and sell through the Service. The
        specific legal rights available to you depend on where you live.
      </p>
      <LegalSection title="1. Information we collect">
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Account information:</strong> email address, username, account identifier, and the profile details you choose to add, such as display name, avatar, bio, preferences, and account settings.</li>
          <li><strong>Content and activity:</strong> posts, photos, videos, listings, likes, bookmarks, follows, reports, and information about how you use platform features.</li>
          <li><strong>Communications:</strong> messages and related delivery or read information needed to operate chats and notifications.</li>
          <li><strong>Transactions:</strong> order, offer, item, shipping, payout, and payment-status information. Payment providers may collect and process card or bank details directly.</li>
          <li><strong>Technical information:</strong> information needed to maintain account sessions, prevent abuse, secure the Service, and diagnose failures. Your browser or device may also store session and temporary app data.</li>
        </ul>
      </LegalSection>
      <LegalSection title="2. How we use information">
        <p>We use information to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>create and secure accounts, verify email addresses, and provide sign-in;</li>
          <li>show profiles, feeds, posts, listings, follower lists, and messages according to your settings;</li>
          <li>enable offers, orders, payments, shipping, payouts, and transaction support;</li>
          <li>send service notifications, account notices, and requested updates;</li>
          <li>respond to reports, enforce our rules, prevent fraud and abuse, and protect users;</li>
          <li>maintain, troubleshoot, and improve the Service; and</li>
          <li>meet legal obligations and resolve disputes.</li>
        </ul>
        <p>
          Depending on the law that applies, we process information to provide the Service you
          request, meet legal obligations, protect legitimate interests such as safety and fraud
          prevention, or based on your consent where consent is required.
        </p>
      </LegalSection>
      <LegalSection title="3. What other users can see">
        <p>
          Your username and information you place on a public profile, post, or listing can be seen
          by other users. Public media may be delivered through publicly accessible media links.
          Follower and following relationships may appear in profile lists. Messages are available
          to the participants in that conversation. Do not include sensitive information in public
          content or messages unless you are comfortable sharing it with the recipient.
        </p>
        <p>
          Other users may save, screenshot, or share information they can see. Removing content from
          Revex cannot remove copies already made by others or necessarily remove retained backups.
        </p>
      </LegalSection>
      <LegalSection title="4. When information is shared">
        <p>We may share information:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>with other users as needed to show your profile, content, listings, follows, and conversation;</li>
          <li>with providers that help run the Service, including authentication, database, hosting, media storage, email, and payment providers;</li>
          <li>with payment, shipping, or payout partners to complete transactions you request;</li>
          <li>when required by law, a valid legal process, or to protect people, rights, and the Service; and</li>
          <li>as part of a business reorganization or transfer, subject to applicable privacy law.</li>
        </ul>
        <p>
          Providers may process information under their own privacy terms and as needed to provide
          their services. For example, Revex uses Cloudflare for hosting, domain registration, and network security
          functionality and Stripe for some payment and payout functions.
        </p>
      </LegalSection>
      <LegalSection title="5. Retention">
        <p>
          We keep information for as long as needed to provide the Service, maintain account and
          transaction records, enforce our rules, resolve disputes, and meet legal obligations.
          Retention periods vary by information type and purpose. When information is no longer
          needed, it may be deleted or de-identified, subject to backup cycles and lawful retention
          requirements.
        </p>
      </LegalSection>
      <LegalSection title="6. Security">
        <p>
          We use technical and organizational measures intended to protect information. No online
          service can guarantee absolute security. Keep your credentials private and contact the
          Service operator through its official support channel if you suspect unauthorized access.
        </p>
      </LegalSection>
      <LegalSection title="7. Your choices and rights">
        <p>
          You can manage profile information and certain privacy settings in the Service, block
          users, and request account deletion where the controls are available. Depending on your
          location, you may also have rights to access, correct, delete, restrict, object to, or
          receive a copy of personal information, and to withdraw consent where processing relies on
          consent. You may have the right to complain to your local privacy regulator.
        </p>
        <p>
          To make a privacy request, use the official support or contact channel provided by the
          Revex service operator. We may need to verify your identity and may retain information
          where the law allows or requires it.
        </p>
      </LegalSection>
      <LegalSection title="8. Children">
        <p>
          Revex is not intended for anyone who is prohibited from using it under the laws that apply
          to them. We do not knowingly seek to collect personal information from children in
          violation of applicable law. If you believe a child has provided information unlawfully,
          contact the Service operator through its official support channel.
        </p>
      </LegalSection>
      <LegalSection title="9. International processing">
        <p>
          Revex and its providers may process or store information in countries other than the one
          where you live. Where required, appropriate safeguards are used for international
          transfers in accordance with applicable privacy law.
        </p>
      </LegalSection>
      <LegalSection title="10. Third-party services">
        <p>
          Signing in with Google, making a payment, or opening an external link may involve a third
          party that has its own privacy policy. Review those policies to understand how that provider
          handles information it collects directly.
        </p>
      </LegalSection>
      <LegalSection title="11. Changes and contact">
        <p>
          We may update this Policy as the Service or applicable requirements change. The updated
          date at the top shows when the current version was last revised. Where required, we will
          notify you of material changes through the Service or another appropriate method.
        </p>
        <p>
          For privacy questions or requests, use the official support or contact channel provided
          by the Revex service operator.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
