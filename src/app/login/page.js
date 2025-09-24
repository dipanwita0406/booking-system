'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle, Loader2, Shield, User as UserIcon } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, database } from '../../../firebase-config';
import { ref, set, get, push } from 'firebase/database';
import Navbar from '@/components/navbar';

const googleProvider = new GoogleAuthProvider();

export default function Login() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  });
  
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    hasMinLength: false
  });

  const adminEmails = [
    'dipanwita957@gmail.com'
  ];

  useEffect(() => {
    setMounted(true);
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !loading) {
        handleExistingUser(user);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLogin && formData.password) {
      setPasswordStrength({
        hasUppercase: /[A-Z]/.test(formData.password),
        hasLowercase: /[a-z]/.test(formData.password),
        hasNumber: /\d/.test(formData.password),
        hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
        hasMinLength: formData.password.length >= 8
      });
    }
  }, [formData.password, isLogin]);

  const isAdminEmail = (email) => {
    return adminEmails.includes(email.toLowerCase());
  };

  const handleExistingUser = async (user) => {
    try {
      const userData = await storeUserInFirebase(user, false);
      
      setTimeout(() => {
        if (userData.role === 'admin') {
          router.push('/admin-management');
        } else {
          router.push('/bookings');
        }
      }, 1000);
    } catch (error) {
      console.error('Error handling existing user:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Validate user type for both login and signup
    if (userType === 'admin' && !isAdminEmail(formData.email)) {
      if (isLogin) {
        newErrors.email = 'This email is not authorized for admin access. Please use a valid admin email or switch to Student/Staff login.';
      } else {
        newErrors.email = 'Only authorized ISBR admin email addresses can create admin accounts. Please use Student/Staff signup or contact IT support.';
      }
    }
    
    if (userType === 'user' && isAdminEmail(formData.email)) {
      if (isLogin) {
        newErrors.email = 'This is an admin email. Please use the Admin login option.';
      } else {
        newErrors.email = 'This is an authorized admin email. Please select Admin account type to proceed.';
      }
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    if (!isLogin) {
      if (!formData.fullName.trim()) {
        newErrors.fullName = 'Full name is required';
      }
      
      const { hasUppercase, hasLowercase, hasNumber, hasSpecialChar, hasMinLength } = passwordStrength;
      
      if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar || !hasMinLength) {
        newErrors.password = 'Password must meet all requirements listed below';
      }
      
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const storeUserInFirebase = async (user, isNewUser = false, additionalData = {}) => {
    try {
      const isAdmin = isAdminEmail(user.email);
      const userRef = ref(database, `users/${user.uid}`);
      
      let userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || additionalData.fullName || user.email.split('@')[0],
        photoURL: user.photoURL || '',
        role: isAdmin ? 'admin' : 'user',
        lastLogin: new Date().toISOString(),
        ...additionalData
      };

      if (isNewUser) {
        userData.createdAt = new Date().toISOString();
      }

      const existingUser = await get(userRef);
      if (!existingUser.exists() || isNewUser) {
        await set(userRef, userData);
      } else {
        const existingData = existingUser.val();
        userData = { ...existingData, lastLogin: new Date().toISOString() };
        await set(userRef, userData);
      }

      console.log('User data stored successfully:', userData);
      return userData;
    } catch (error) {
      console.error('Error storing user data:', error);
      
      try {
        const fallbackRef = ref(database, `user_logs`);
        await push(fallbackRef, {
          uid: user.uid,
          email: user.email,
          timestamp: new Date().toISOString(),
          action: isNewUser ? 'signup' : 'login'
        });
      } catch (fallbackError) {
        console.error('Fallback storage also failed:', fallbackError);
      }

      throw error;
    }
  };

  const handleUserAfterAuth = async (user, isNewUser = false, additionalData = {}) => {
    try {
      const userData = await storeUserInFirebase(user, isNewUser, additionalData);
      
      // Verify user type matches email for both login and signup
      const expectedRole = isAdminEmail(user.email) ? 'admin' : 'user';
      const selectedRole = userType === 'admin' ? 'admin' : 'user';
      
      if (expectedRole !== selectedRole) {
        setLoading(false);
        if (isLogin) {
          if (expectedRole === 'admin') {
            setErrors({ general: 'This is an admin account. Please use the Admin login option.' });
          } else {
            setErrors({ general: 'This account is not authorized for admin access. Please use Student/Staff login.' });
          }
        } else {
          if (expectedRole === 'admin') {
            setErrors({ general: 'This email has admin privileges. Please select Admin account type to proceed.' });
          } else {
            setErrors({ general: 'This email is not authorized for admin access. Please select Student/Staff account type.' });
          }
        }
        return;
      }
      
      setTimeout(() => {
        setLoading(false);
        if (userData.role === 'admin') {
          router.push('/admin-management');
        } else {
          router.push('/bookings');
        }
      }, 1500);
    } catch (error) {
      console.error('Error handling user after auth:', error);
      setLoading(false);
      
      // Fallback navigation
      setTimeout(() => {
        const isAdmin = isAdminEmail(user.email);
        if (isAdmin) {
          router.push('/admin-management');
        } else {
          router.push('/bookings');
        }
      }, 1000);
    }
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  if (!validateForm()) return;
  
  setLoading(true);
  setErrors({});
  
  try {
    if (isLogin) {
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      await handleUserAfterAuth(userCredential.user, false, { selectedUserType: userType });
    } else {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      await handleUserAfterAuth(userCredential.user, true, { fullName: formData.fullName, selectedUserType: userType });
    }
    } catch (error) {
      console.error('Authentication error:', error);
      let errorMessage = 'Something went wrong. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account exists with this email address. Please check your email or sign up for a new account.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please check your password and try again.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'An account with this email address already exists. Please try signing in instead.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Please choose a stronger password with at least 6 characters.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed login attempts. Please wait a few minutes before trying again.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection and try again.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled. Please contact support for assistance.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email/password accounts are not enabled. Please contact support.';
          break;
        case 'auth/requires-recent-login':
          errorMessage = 'Please log out and log back in before retrying this operation.';
          break;
      }
      
      setErrors({ general: errorMessage });
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrors({});
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const isNewUser = result._tokenResponse?.isNewUser || false;
      
      // For Google sign-in, we need to check if the email matches the selected user type
      const isAdmin = isAdminEmail(result.user.email);
      const expectedRole = isAdmin ? 'admin' : 'user';
      const selectedRole = userType === 'admin' ? 'admin' : 'user';
      
      if (expectedRole !== selectedRole) {
        setLoading(false);
        if (isLogin) {
          if (expectedRole === 'admin') {
            setErrors({ general: 'This Google account has admin privileges. Please use the Admin login option.' });
          } else {
            setErrors({ general: 'This Google account is not authorized for admin access. Please use Student/Staff login.' });
          }
        } else {
          if (expectedRole === 'admin') {
            setErrors({ general: 'This Google account has admin privileges. Please select Admin account type to proceed.' });
          } else {
            setErrors({ general: 'This Google account is not authorized for admin access. Please select Student/Staff account type.' });
          }
        }
        return;
      }
      
      await handleUserAfterAuth(result.user, isNewUser);
    } catch (error) {
      console.error('Google sign-in error:', error);
      let errorMessage = 'Google sign-in failed. Please try again.';
      
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in was cancelled. Please try again.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection and try again.';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Popup was blocked by your browser. Please allow popups for this site and try again.';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'Sign-in was cancelled. Please try again.';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'An account already exists with this email using a different sign-in method. Please try signing in with email and password.';
          break;
      }
      
      setErrors({ general: errorMessage });
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setErrors({ email: 'Please enter your email address first' });
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setResetEmailSent(true);
      setErrors({});
    } catch (error) {
      console.error('Password reset error:', error);
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address. Please check your email or sign up for a new account.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many password reset requests. Please wait a few minutes before trying again.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection and try again.';
          break;
      }
      
      setErrors({ general: errorMessage });
    }
  };

  if (!mounted) return null;

  const PasswordStrengthIndicator = () => (
    <div className="space-y-2 mt-2">
      <div className="text-xs font-medium text-[#8C1007]">
        Password Requirements:
      </div>
      <div className="grid grid-cols-2 gap-1">
        {[
          { key: 'hasMinLength', label: '8+ characters' },
          { key: 'hasUppercase', label: 'Uppercase' },
          { key: 'hasLowercase', label: 'Lowercase' },
          { key: 'hasNumber', label: 'Number' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${
              passwordStrength[key] 
                ? 'bg-[#FFCC00]' 
                : 'bg-gray-300'
            }`} />
            <span className={`text-xs ${
              passwordStrength[key] 
                ? 'text-[#8C1007]'
                : 'text-gray-500'
            }`}>
              {label}
            </span>
          </div>
        ))}
        <div className="flex items-center space-x-1 col-span-2">
          <div className={`w-2 h-2 rounded-full ${
            passwordStrength.hasSpecialChar 
              ? 'bg-[#FFCC00]' 
              : 'bg-gray-300'
          }`} />
          <span className={`text-xs ${
            passwordStrength.hasSpecialChar 
              ? 'text-[#8C1007]'
              : 'text-gray-500'
          }`}>
            Special character (!@#$%^&*)
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <div className="pt-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl py-8 px-8 border-2 border-[#FFCC00] shadow-[#FFCC00]/20">
            
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-[#8C1007] flex items-center justify-center font-bold text-2xl text-white">
                  I
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-2 text-[#8C1007]">
                {isLogin ? 'Welcome Back' : 'Join ISBR'}
              </h2>
              <p className="text-sm text-[#8C1007]">
                {isLogin ? 'Sign in to your account' : 'Create your account'}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold mb-3 text-[#8C1007]">
                {isLogin ? 'Select Login Type' : 'Select Account Type'}
              </label>
              <div className="flex rounded-lg border-2 border-[#FFCC00] p-1 bg-[#FFCC00]/10">
                <button
                  type="button"
                  onClick={() => setUserType('user')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md font-medium transition-all duration-200 ${
                    userType === 'user'
                      ? 'bg-[#8C1007] text-white shadow-sm'
                      : 'text-[#8C1007] hover:bg-[#FFCC00]/20'
                  }`}
                >
                  <UserIcon size={18} />
                  <span>Student/Staff</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('admin')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md font-medium transition-all duration-200 ${
                    userType === 'admin'
                      ? 'bg-[#8C1007] text-white shadow-sm'
                      : 'text-[#8C1007] hover:bg-[#FFCC00]/20'
                  }`}
                >
                  <Shield size={18} />
                  <span>Admin</span>
                </button>
              </div>
              {!isLogin && userType === 'admin' && (
                <p className="mt-2 text-xs text-[#8C1007] bg-[#FFCC00]/10 p-2 rounded border border-[#FFCC00]">
                  <strong>Note:</strong> Admin accounts require an authorized ISBR admin email address (admin@isbr.edu, principal@isbr.edu, etc.)
                </p>
              )}
            </div>

            {resetEmailSent && (
              <div className="mb-6 p-4 rounded-lg border-2 bg-[#FFCC00]/20 border-[#FFCC00] text-[#8C1007]">
                <div className="flex items-center space-x-2">
                  <CheckCircle size={20} />
                  <span className="text-sm font-medium">
                    Password reset email sent successfully! Please check your inbox and follow the instructions.
                  </span>
                </div>
              </div>
            )}

            {errors.general && (
              <div className="mb-6 p-4 rounded-lg border-2 flex items-start space-x-2 bg-red-50 border-red-500 text-red-700">
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{errors.general}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-bold mb-2 text-[#8C1007]">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#8C1007]" />
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-medium bg-white border-[#FFCC00] text-[#8C1007] focus:border-[#8C1007] focus:ring-[#8C1007]/20 placeholder-gray-500 ${errors.fullName ? 'border-red-500' : ''}`}
                      placeholder="Enter your full name"
                    />
                  </div>
                  {errors.fullName && (
                    <p className="mt-1 text-sm text-red-500 font-medium">{errors.fullName}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold mb-2 text-[#8C1007]">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#8C1007]" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-medium bg-white border-[#FFCC00] text-[#8C1007] focus:border-[#8C1007] focus:ring-[#8C1007]/20 placeholder-gray-500 ${errors.email ? 'border-red-500' : ''}`}
                    placeholder="Enter your ISBR email"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-500 font-medium">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-[#8C1007]">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#8C1007]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-12 py-3 border-2 rounded-lg focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-medium bg-white border-[#FFCC00] text-[#8C1007] focus:border-[#8C1007] focus:ring-[#8C1007]/20 placeholder-gray-500 ${errors.password ? 'border-red-500' : ''}`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors text-[#8C1007] hover:text-[#8C1007]"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500 font-medium">{errors.password}</p>
                )}
                {!isLogin && formData.password && <PasswordStrengthIndicator />}
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-bold mb-2 text-[#8C1007]">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#8C1007]" />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-medium bg-white border-[#FFCC00] text-[#8C1007] focus:border-[#8C1007] focus:ring-[#8C1007]/20 placeholder-gray-500 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                      placeholder="Confirm your password"
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-500 font-medium">{errors.confirmPassword}</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-lg font-bold text-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border-2 bg-[#8C1007] hover:bg-[#8C1007]/90 text-white border-[#8C1007] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="animate-spin h-5 w-5" />
                    <span>{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
                  </div>
                ) : (
                  <span>
                    {isLogin 
                      ? (userType === 'admin' ? 'Admin Sign In' : 'Sign In to ISBR') 
                      : 'Create ISBR Account'
                    }
                  </span>
                )}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-[#FFCC00]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 font-bold bg-white text-[#8C1007]">
                    Or continue with
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="mt-4 w-full py-3 px-4 rounded-lg border-2 font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-3 border-[#FFCC00] bg-white text-[#8C1007] hover:bg-[#FFCC00]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Sign {isLogin ? 'in' : 'up'} with Google</span>
              </button>
            </div>

            <div className="mt-6 text-center space-y-4">
              {isLogin && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-bold transition-colors text-[#8C1007] hover:text-black"
                >
                  Forgot your password?
                </button>
              )}
              
              <p className="text-sm font-medium text-[#8C1007]">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setErrors({});
                    setFormData({ email: '', password: '', confirmPassword: '', fullName: '' });
                    setResetEmailSent(false);
                  }}
                  className="font-bold transition-colors text-[#8C1007] hover:text-black"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-xs font-medium text-[#8C1007]">
              ISBR School of Business, Bangalore - Facility Booking System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}