export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '20px 24px', fontFamily: 'sans-serif', lineHeight: 1.8, color: '#333' }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> April 14, 2026</p>

      <h2>Information We Collect</h2>
      <p>We collect information you provide when using our Facebook Ads management service, including your Facebook profile information (name, email) and Facebook Page data necessary to manage your advertising campaigns.</p>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>To create and manage Facebook advertising campaigns on your behalf</li>
        <li>To analyze ad performance and provide recommendations</li>
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
