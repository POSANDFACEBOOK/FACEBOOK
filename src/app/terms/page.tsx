// ข้อกำหนดการให้บริการ — ใช้ในช่อง "URL ข้อกำหนดของบริการ" ของแอป Meta (App Review)
export default function TermsOfService() {
  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '20px 24px', fontFamily: 'sans-serif', lineHeight: 1.8, color: '#333' }}>
      <h1>Terms of Service</h1>
      <p><strong>Last updated:</strong> September 17, 2026</p>

      <h2>The Service</h2>
      <p>FACEBOOK CHAT NAIWANSOOK is a customer chat inbox. It lets a business read and reply to messages that customers send to the business&apos;s own Facebook Pages, in one place, together with the staff the business invites.</p>

      <h2>Who May Use It</h2>
      <ul>
        <li>Page owners who sign in with Facebook and connect Pages they manage.</li>
        <li>Staff members invited by a Page owner. Staff can only see and reply to conversations of the Pages the owner assigns to them.</li>
      </ul>

      <h2>Your Responsibilities</h2>
      <ul>
        <li>Use the service only for Pages you are authorized to manage.</li>
        <li>Follow the Meta Platform Terms, the Messenger Platform Policy and the Facebook Community Standards when messaging customers.</li>
        <li>Do not send spam or unsolicited messages, and do not use the service for unlawful purposes.</li>
        <li>Keep your login and the accounts of your staff secure, and remove staff who should no longer have access.</li>
      </ul>

      <h2>Your Data</h2>
      <p>How we collect and use data is described in our <a href="/privacy">Privacy Policy</a>. You can disconnect the app at any time from your Facebook settings, and you can request deletion of your data as described there.</p>

      <h2>Availability</h2>
      <p>The service depends on Facebook and other third-party platforms and is provided &quot;as is&quot;. We work to keep it available and accurate but cannot guarantee uninterrupted operation or that every message will be delivered.</p>

      <h2>Changes</h2>
      <p>We may update these terms. The date at the top of this page shows when they last changed. Continuing to use the service after a change means you accept the updated terms.</p>

      <h2>Contact</h2>
      <p>For questions about these terms, please contact the app administrator.</p>
    </div>
  )
}
