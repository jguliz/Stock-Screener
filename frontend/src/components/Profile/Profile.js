import React, { useState } from 'react';
import Header from '../Common/Header';
import Footer from '../Common/Footer';
import Card from '../UI/Card';
import Input from '../UI/Input';
import Button from '../UI/Button';
import { User, Mail, Lock, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { validators } from '../../utils/validators';

const Profile = () => {
  const { currentUser, getProfile } = useAuth();
  
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const validateForm = () => {
    const newErrors = {};

    // Email validation
    if (!validators.isValidEmail(email)) {
      newErrors.email = 'Invalid email address';
    }

    // Password validation (if changing password)
    if (newPassword) {
      if (!validators.isStrongPassword(newPassword)) {
        newErrors.newPassword = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
      }
      
      if (newPassword !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setSuccessMessage('');
    
    try {
      // TODO: Implement update profile logic in AuthContext
      // For now, this is a placeholder
      const updatedUser = await getProfile();
      
      setSuccessMessage('Profile updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-dark-300">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Settings className="mr-3 h-6 w-6 text-indigo-500" />
            Profile Settings
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Profile Information Card */}
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <User className="mr-2 h-5 w-5 text-indigo-500" />
              Personal Information
            </h2>
            
            <form onSubmit={handleSubmit}>
              <Input
                id="name"
                name="name"
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                icon={<User className="h-5 w-5" />}
                error={errors.name}
              />
              
              <Input
                id="email"
                name="email"
                type="email"
                label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="h-5 w-5" />}
                error={errors.email}
              />
              
              {successMessage && (
                <div className="bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-300 p-3 rounded mb-4">
                  {successMessage}
                </div>
              )}
              
              <Button 
                type="submit" 
                fullWidth 
                variant="primary"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </Button>
            </form>
          </Card>

          {/* Change Password Card */}
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Lock className="mr-2 h-5 w-5 text-indigo-500" />
              Change Password
            </h2>
            
            <form onSubmit={handleSubmit}>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                label="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                icon={<Lock className="h-5 w-5" />}
                error={errors.currentPassword}
              />
              
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                icon={<Lock className="h-5 w-5" />}
                error={errors.newPassword}
              />
              
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                icon={<Lock className="h-5 w-5" />}
                error={errors.confirmPassword}
              />
              
              <Button 
                type="submit" 
                fullWidth 
                variant="primary"
                disabled={loading}
                className="mt-4"
              >
                {loading ? 'Changing Password...' : 'Change Password'}
              </Button>
            </form>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Profile;