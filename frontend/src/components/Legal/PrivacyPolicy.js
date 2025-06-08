import React from 'react';
import Header from '../Common/Header';
import Footer from '../Common/Footer';
import Card from '../UI/Card';
import { Shield } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-dark-300">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Shield className="mr-3 h-6 w-6 text-indigo-500" />
            Privacy Policy
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Last Updated: March 31, 2025
          </p>
        </div>

        <Card>
          <div className="prose dark:prose-invert max-w-none">
            <h2>1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, including:
            </p>
            <ul>
              <li>Name and email address</li>
              <li>Account login credentials</li>
              <li>Stock preferences and alert settings</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>
              We use the information we collect to:
            </p>
            <ul>
              <li>Provide and improve our stock monitoring services</li>
              <li>Send you important account and service notifications</li>
              <li>Respond to your customer support requests</li>
              <li>Detect and prevent fraudulent activities</li>
            </ul>

            <h2>3. Data Protection</h2>
            <p>
              We implement industry-standard security measures to protect your personal information:
            </p>
            <ul>
              <li>Encrypted data transmission</li>
              <li>Secure password hashing</li>
              <li>Regular security audits</li>
              <li>Access controls and authentication</li>
            </ul>

            <h2>4. Third-Party Sharing</h2>
            <p>
              We do not sell your personal information. We may share data with:
            </p>
            <ul>
              <li>Service providers necessary for platform operation</li>
              <li>Legal authorities when required by law</li>
            </ul>

            <h2>5. Your Rights</h2>
            <p>
              You have the right to:
            </p>
            <ul>
              <li>Access your personal information</li>
              <li>Request correction of your data</li>
              <li>Request deletion of your account</li>
              <li>Opt-out of non-essential communications</li>
            </ul>

            <h2>6. Cookies and Tracking</h2>
            <p>
              We use cookies to improve user experience and platform functionality. You can manage cookie preferences in your browser settings.
            </p>

            <h2>7. Changes to Privacy Policy</h2>
            <p>
              We may update this policy periodically. Continued use of the service implies acceptance of any changes.
            </p>
          </div>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;