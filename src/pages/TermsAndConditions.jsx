import LegalDocument, { LegalSection } from "@/components/LegalDocument";

export default function TermsAndConditions() {
  return (
    <LegalDocument
      title="Terms and Conditions"
      updated="October 10, 2026"
      otherPath="/privacy-policy"
      otherLabel="Privacy Policy"
    >
      <p>
        These Terms and Conditions (the “Terms”) govern your access to and use of Revex, including its
        social feed, profiles, messaging, listings, offers, and related services (the “Service”). By
        creating an account or using the Service, you agree to these Terms. If you do not agree, do
        not create an account or use the Service.
      </p>
      <LegalSection title="1. The Service and these Terms">
        <p>
          Revex is a social and marketplace platform where people can share fashion-related content,
          discover creators and items, communicate, and arrange purchases. Features may change, be
          added, or be withdrawn. Additional terms shown when using a particular feature, including
          checkout terms, also apply to that feature.
        </p>
        <p>
          We may update these Terms when the Service or applicable requirements change. We will
          update the date above and, where required, give notice in the Service or by another
          reasonable method. Changes apply from their stated effective date. If you continue using
          Revex after that date, you accept the updated Terms.
        </p>
      </LegalSection>
      <LegalSection title="2. Eligibility and your account">
        <p>
          You may use Revex only if you can legally enter into a binding agreement where you live.
          If you are not old enough to do so, you may use the Service only with permission and
          supervision from a parent or legal guardian, where local law allows. The person responsible
          for you must review and agree to these Terms.
        </p>
        <p>
          You must provide accurate registration details, choose a username that you are allowed to
          use, keep your sign-in credentials secure, and promptly correct account information that
          becomes inaccurate. You are responsible for activity on your account. Do not impersonate
          another person, share or sell account access, or create accounts to evade a restriction.
          Contact the Service operator through its official support channel if you believe your
          account has been accessed without permission.
        </p>
      </LegalSection>
      <LegalSection title="3. Community rules">
        <p>You agree not to use Revex to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>break the law, violate another person’s rights, or encourage others to do so;</li>
          <li>harass, threaten, stalk, exploit, defraud, or discriminate against anyone;</li>
          <li>post content that is unlawful, deceptive, hateful, sexually exploitative, or harmful;</li>
          <li>sell counterfeit, stolen, prohibited, or misrepresented goods;</li>
          <li>spam, scrape, probe, disrupt, or attempt to gain unauthorized access to the Service;</li>
          <li>upload malware or use automated tools to access or manipulate the Service; or</li>
          <li>evade blocks, moderation actions, rate limits, or other safeguards.</li>
        </ul>
        <p>
          You may report content or accounts that appear to violate these rules. You can block other
          accounts using the available controls. Blocking may affect messaging and follow relationships.
        </p>
      </LegalSection>
      <LegalSection title="4. Your content">
        <p>
          You keep ownership of content you create and submit, such as profile information, photos,
          videos, posts, listings, and messages (“Your Content”). You are responsible for Your Content
          and must have the rights and permissions needed to submit it and to grant the licence below.
        </p>
        <p>
          You grant the Service operator a worldwide, non-exclusive, royalty-free licence to host,
          store, reproduce, adapt for technical display, distribute, and display Your Content as
          needed to provide, secure, maintain, and promote the Service. This licence covers showing
          public posts and profiles to other users and making media available through the Service.
          It ends for content when it is removed from the Service, except for copies retained in
          backups, records needed for legal or safety purposes, or content that other users have
          lawfully shared and cannot reasonably retrieve.
        </p>
        <p>
          Do not submit content that infringes copyright, trademark, privacy, publicity, or other
          rights. If you believe content on Revex infringes your rights, report it through the
          Service’s reporting controls or the official support channel.
        </p>
      </LegalSection>
      <LegalSection title="5. Profiles, posts, and messages">
        <p>
          Public profiles, posts, listings, and other public activity may be visible to other users
        and may be copied or shared by them. Account privacy settings can limit some visibility, but
        cannot guarantee that information will remain private once shared. Messages are intended for
        the conversation participants, but you should not send information that you would not want
        the recipient to retain or disclose.
        </p>
        <p>
          You may delete certain messages using the available controls, subject to the Service’s
          rules and technical limits. Deleting a message from the conversation does not guarantee
          deletion from backups or from notifications or copies already received by another user.
        </p>
      </LegalSection>
      <LegalSection title="6. Listings, offers, and purchases">
        <p>
          Sellers are responsible for the accuracy, legality, condition, pricing, availability, and
          fulfilment of their listings. Buyers should review the listing and all costs shown before
          placing an order. Offers, orders, shipping, cancellations, refunds, and returns are subject
          to the terms displayed during the transaction and any applicable law.
        </p>
        <p>
          Revex may facilitate discovery and communication between users. Unless a checkout screen
          expressly says otherwise, Revex is not the seller of items listed by users and does not
          guarantee a listing, seller, buyer, delivery, or transaction outcome. Payment processing
          may be provided by Stripe or another third-party provider; its terms and privacy notice
          apply to payment information it handles. You authorize the payment method you select for
          the amount shown at checkout.
        </p>
      </LegalSection>
      <LegalSection title="7. Revex intellectual property">
        <p>
          The Service, including its software, branding, design, and materials provided by Revex,
          is protected by intellectual property laws. These Terms give you a limited, personal,
          revocable, non-transferable right to use the Service for its intended purposes. They do not
          transfer ownership of Revex intellectual property to you.
        </p>
      </LegalSection>
      <LegalSection title="8. Moderation and account restrictions">
        <p>
          We may review reported or otherwise identified activity and may remove content, restrict
          features, suspend, or close accounts when reasonably necessary to enforce these Terms,
          protect users or the Service, or comply with law. Where appropriate and legally permitted,
          we will provide notice and an opportunity to appeal through the available support channel.
          We may preserve information when required for safety, dispute resolution, or legal compliance.
        </p>
      </LegalSection>
      <LegalSection title="9. Third-party services">
        <p>
          The Service may link to or rely on third-party websites and services, including sign-in,
          hosting, storage, and payment providers. Those services are governed by their own terms
          and privacy notices. Revex is not responsible for third-party services that it does not
          control.
        </p>
      </LegalSection>
      <LegalSection title="10. Suspension and termination">
        <p>
          You may stop using Revex at any time and may request account deletion through the account
          settings where available. We may suspend or terminate access as described in these Terms.
          Provisions that by their nature should continue after account closure, including ownership,
          licences already needed for shared content, disclaimers, and liability limits, will continue
          to apply as permitted by law.
        </p>
      </LegalSection>
      <LegalSection title="11. Disclaimers">
        <p>
          To the extent permitted by law, the Service is provided “as is” and “as available.”
          We do not promise that it will always be uninterrupted, error-free, secure, or suitable
          for every purpose. Nothing in these Terms excludes a consumer guarantee or other right
          that cannot legally be excluded.
        </p>
      </LegalSection>
      <LegalSection title="12. Liability">
        <p>
          To the extent permitted by law, the Service operator is not liable for indirect or
          consequential losses, loss of profits, or loss of data arising from use of the Service.
          Nothing in these Terms limits liability where doing so is unlawful, including liability
          that cannot be excluded under applicable consumer protection law.
        </p>
      </LegalSection>
      <LegalSection title="13. Governing law and contact">
        <p>
          These Terms are subject to the mandatory laws and consumer protections that apply where
          you live. Any governing-law or venue rule cannot remove rights that local law makes
          non-waivable.
        </p>
        <p>
          For questions, complaints, or appeals, use the official support or contact channel
          provided by the Revex service operator.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
