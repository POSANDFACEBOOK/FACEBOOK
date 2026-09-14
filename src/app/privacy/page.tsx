export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '20px 24px', fontFamily: 'sans-serif', lineHeight: 1.8, color: '#333' }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> September 14, 2026</p>

      <h2>Information We Collect</h2>
      <p>We collect information you provide when using our customer chat inbox service, including your Facebook profile information (name, email), the list of Facebook Pages you manage, and the messages exchanged between your Pages (or LINE Official Accounts) and your customers so that your team can read and reply to them.</p>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>To display customer conversations from your connected Pages and LINE Official Accounts</li>
        <li>To send the replies you or your team write back to your customers</li>
        <li>To authenticate your identity via Facebook Login</li>
      </ul>

      <h2>Data Storage</h2>
      <p>Your data is stored securely using Supabase cloud infrastructure. We do not sell or share your personal information with third parties.</p>

      <h2>Facebook Data</h2>
      <p>We access your Facebook data only with your explicit permission through Facebook Login. You can revoke access at any time through your Facebook settings.</p>

      <h2>Data Deletion</h2>
      <p>You can request deletion of your data by contacting us or through the data deletion callback provided to Facebook.</p>

      <h2>Contact</h2>
      <p>For questions about this privacy policy, please contact the app administrator.</p>
    </div>
  )
}
