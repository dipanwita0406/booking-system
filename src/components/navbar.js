'use client';

import { useState, useEffect } from 'react';
import { Menu, X, FileText, Users, Info, Building2, LogIn, LogOut, User } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { auth } from '../../firebase-config';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function Navbar() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setIsMenuOpen(false);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleLoginClick = () => {
    router.push('/login');
    setIsMenuOpen(false);
  };

  const handleNavigation = (href) => {
    router.push(href);
    setIsMenuOpen(false);
  };

  const navItems = [
    { name: 'Bookings', icon: FileText, href: '/bookings' },
    { name: 'Facilities', icon: Building2, href: '/facilities' },
    { name: 'About', icon: Info, href: '/about' },
  ];

  return (
    <nav className={`sticky top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
        ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-[#FFCC00]/20'
        : 'bg-transparent'
      }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          <div className="flex-shrink-0 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg text-white">
              <Image
                src="/ISBR.png"
                alt="ISBR Logo"
                width={40}
                height={40}
                className="rounded-md"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#8C1007]">
              ISBR
            </h1>
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 text-[#8C1007] hover:text-[#8C1007] hover:bg-[#FFCC00]/20"
                  >
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:block">
              {loading ? (
                <div className="px-4 py-2 text-sm text-[#8C1007]">
                  Loading...
                </div>
              ) : user ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 text-[#8C1007]">
                    <User size={18} />
                    <span className="text-sm font-medium">
                      {user.displayName || user.email?.split('@')[0] || 'User'}
                    </span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 text-white bg-[#8C1007] hover:bg-[#8C1007]/80"
                  >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLoginClick}
                  className="flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 text-white bg-[#8C1007] hover:bg-[#8C1007]/80"
                >
                  <LogIn size={18} />
                  <span>Login</span>
                </button>
              )}
            </div>

            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-md transition-colors text-[#8C1007] hover:bg-[#FFCC00]/20"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-[#FFCC00]/20 bg-white/90">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-[#8C1007] hover:text-[#8C1007] hover:bg-[#FFCC00]/20"
                  >
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
              
              <div className="pt-2 border-t border-[#FFCC00]/20 mt-2">
                {loading ? (
                  <div className="px-3 py-2 text-sm text-[#8C1007]">
                    Loading...
                  </div>
                ) : user ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 px-3 py-2 text-[#8C1007]">
                      <User size={18} />
                      <span className="text-sm font-medium">
                        {user.displayName || user.email?.split('@')[0] || 'User'}
                      </span>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-white bg-[#8C1007] hover:bg-[#8C1007]/80"
                    >
                      <LogOut size={18} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLoginClick}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-white bg-[#8C1007] hover:bg-[#8C1007]/80"
                  >
                    <LogIn size={18} />
                    <span>Login</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}