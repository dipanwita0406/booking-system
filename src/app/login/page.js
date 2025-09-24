'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth } from '../../../firebase-config';
import Navbar from '@/components/navbar';

const googleProvider = new GoogleAuthProvider();

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    hasMinLength: false
  });

  useEffect(() => {
    setMounted(true);
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
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    if (!isLogin) {
      const { hasUppercase, hasLowercase, hasNumber, hasSpecialChar, hasMinLength } = passwordStrength;
      
      if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecialChar || !hasMinLength) {
        newErrors.password = 'Password does not meet requirements';
      }
      
      if (formData.password !== formData.confirmPassword) {
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
    
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        console.log('User logged in:', userCredential.user);
        window.location.href = '/dashboard';
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        console.log('User created:', userCredential.user);
        await storeUserInMongoDB(userCredential.user);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Google sign-in successful:', result.user);
      
      if (result._tokenResponse?.isNewUser) {
        await storeUserInMongoDB(result.user);
      }
      
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Google sign-in error:', error);
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setErrors({ email: 'Please enter your email first' });
      return;
    }
    
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setResetEmailSent(true);
    } catch (error) {
      console.error('Password reset error:', error);
      setErrors({ general: error.message });
    }
  };

  const storeUserInMongoDB = async (user) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to store user data');
      }
    } catch (error) {
      console.error('Error storing user in MongoDB:', error);
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
                {isLogin ? 'Sign in to your booking account' : 'Create your booking account'}
              </p>
            </div>

            {resetEmailSent && (
              <div className="mb-6 p-4 rounded-lg border-2 bg-[#FFCC00]/20 border-[#FFCC00] text-[#8C1007]">
                <div className="flex items-center space-x-2">
                  <CheckCircle size={20} />
                  <span className="text-sm font-medium">
                    Password reset email sent! Check your inbox.
                  </span>
                </div>
              </div>
            )}

            {errors.general && (
              <div className="mb-6 p-4 rounded-lg border-2 flex items-center space-x-2 bg-red-50 border-red-500 text-red-700">
                <AlertCircle size={20} />
                <span className="text-sm font-medium">{errors.general}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
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
                  <span>{isLogin ? 'Sign In to ISBR' : 'Create ISBR Account'}</span>
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
                    setFormData({ email: '', password: '', confirmPassword: '' });
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