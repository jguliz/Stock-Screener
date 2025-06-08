import React from 'react';
import Header from '../Common/Header';
import Footer from '../Common/Footer';
import Card from '../UI/Card';
import { FileText } from 'lucide-react';

const TermsOfService = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-dark-300">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <FileText className="mr-3 h-6 w-6 text-indigo-500" />
            Terms of Service
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Last Updated: March 31, 2025
          </p>
        </div>

        <Card>
          <div className="prose dark:prose-invert max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using StockScreener, you accept and agree to be bound by the terms and provisions of this agreement.
            </p>

            <h2>2. Use of Service</h2>
            <p>
              StockScreener provides a stock monitoring and alert platform. Users agree to use the service for lawful purposes only.
            </p>

            <h2>3. User Account</h2>
            <ul>
              <li>You must provide accurate and complete registration information</li>
              <li>You are responsible for maintaining the confidentiality of your account</li>
              <li>You agree to accept responsibility for all activities that occur under your account</li>
            </ul>

            <h2>4. Data and Privacy</h2>
            <p>
              We collect and use your data as described in our Privacy Policy. By using StockScreener, you consent to our data practices.
            </p>

            <h2>5. Disclaimer of Warranties</h2>
            <p>
              StockScreener provides stock information "as is" without any warranties. We do not guarantee the accuracy or completeness of market data.
            </p>

            <h2>6. Limitation of Liability</h2>
            <p>
              In no event shall StockScreener be liable for any direct, indirect, incidental, special, or consequential damages arising from your use of the service.
            </p>

            <h2>7. Modifications to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of the updated terms.
            </p>
          </div>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default TermsOfService;