import React, { useState } from 'react';
import Header from '../Common/Header';
import Footer from '../Common/Footer';
import Card from '../UI/Card';
import Input from '../UI/Input';
import Button from '../UI/Button';
import { 
  HelpCircle, Mail, MessageCircle, PhoneCall, 
  Send, BookOpen, Globe 
} from 'lucide-react';

const Support = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!message.trim()) {
      setError('Please enter your message');
      return;
    }

    // TODO: Implement actual support ticket submission
    console.log('Support request submitted', { name, email, message });
    
    // Clear form and show success message
    setName('');
    setEmail('');
    setMessage('');
    setSubmitted(true);
    setError('');

    // Hide success message after 3 seconds
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-dark-300">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <HelpCircle className="mr-3 h-6 w-6 text-indigo-500" />
            Customer Support
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            We're here to help you with any questions or concerns
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Contact Form */}
          <Card className="md:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <MessageCircle className="mr-2 h-5 w-5 text-indigo-500" />
              Send Us a Message
            </h2>
            
            {submitted ? (
              <div className="bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-300 p-4 rounded text-center">
                Thank you for your message! We'll get back to you soon.
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-red-100 dark:bg-red-900 dark:bg-opacity-30 text-red-700 dark:text-red-300 p-3 rounded mb-4">
                    {error}
                  </div>
                )}
                
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    id="name"
                    name="name"
                    label="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    icon={<HelpCircle className="h-5 w-5" />}
                  />
                  
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    label="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<Mail className="h-5 w-5" />}
                  />
                </div>
                
                <div className="mt-4">
                  <label 
                    htmlFor="message" 
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Your Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows="4"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-dark-100 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="How can we help you today?"
                  ></textarea>
                </div>
                
                <div className="mt-4">
                  <Button 
                    type="submit" 
                    variant="primary" 
                    fullWidth 
                    icon={<Send className="h-4 w-4 mr-2" />}
                  >
                    Send Message
                  </Button>
                </div>
              </form>
            )}
          </Card>

          {/* Support Information */}
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <BookOpen className="mr-2 h-5 w-5 text-indigo-500" />
              Support Resources
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <Mail className="h-5 w-5 mr-3 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Email Support</p>
                  <a 
                    href="mailto:support@stockscreener.com" 
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    support@stockscreener.com
                  </a>
                </div>
              </div>
              
              <div className="flex items-center">
                <PhoneCall className="h-5 w-5 mr-3 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Phone Support</p>
                  <a 
                    href="tel:+18005551234" 
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    1-800-555-1234
                  </a>
                </div>
              </div>
              
              <div className="flex items-center">
                <Globe className="h-5 w-5 mr-3 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Help Center</p>
                  <a 
                    href="/help" 
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    StockScreener Help Center
                  </a>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-3 bg-gray-50 dark:bg-dark-200 rounded-md">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Support hours: Monday-Friday, 9 AM - 5 PM EST
              </p>
            </div>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Support;