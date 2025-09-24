'use client';
import React, { useState, useEffect } from 'react';
import { database } from '../../../firebase-config';
import { ref, push, onValue, query, orderByChild, equalTo } from 'firebase/database';
import Navbar from '@/components/navbar';
import { Calendar, Clock, MapPin, Users, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const BookingSystem = () => {
  const [selectedVenue, setSelectedVenue] = useState('canteen');
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [userBookings, setUserBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Mock user ID (in real app, get from authentication)
  const userId = 'user123';
  const userName = 'John Doe';

  // Load user's bookings and all bookings for conflict checking
  useEffect(() => {
    const userBookingsRef = query(
      ref(database, 'bookings'),
      orderByChild('userId'),
      equalTo(userId)
    );
    
    const allBookingsRef = ref(database, 'bookings');

    const unsubscribeUser = onValue(userBookingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const bookingsArray = Object.entries(data).map(([id, booking]) => ({
          id,
          ...booking
        }));
        setUserBookings(bookingsArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } else {
        setUserBookings([]);
      }
    });

    const unsubscribeAll = onValue(allBookingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const bookingsArray = Object.entries(data).map(([id, booking]) => ({
          id,
          ...booking
        }));
        setAllBookings(bookingsArray);
      } else {
        setAllBookings([]);
      }
    });

    return () => {
      unsubscribeUser();
      unsubscribeAll();
    };
  }, [userId]);

  // Check for booking conflicts
  const checkForConflicts = (venue, date, startTime, endTime) => {
    const newStart = new Date(`${date}T${startTime}`);
    const newEnd = new Date(`${date}T${endTime}`);

    return allBookings.some(booking => {
      if (booking.venue !== venue || booking.date !== date) {
        return false;
      }

      const existingStart = new Date(`${booking.date}T${booking.startTime}`);
      const existingEnd = new Date(`${booking.date}T${booking.endTime}`);

      // Check if times overlap
      return (newStart < existingEnd && newEnd > existingStart);
    });
  };

  const handleSubmit = async () => {
    
    if (!bookingDate || !startTime || !endTime || !purpose.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    if (startTime >= endTime) {
      setMessage({ type: 'error', text: 'End time must be after start time' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (bookingDate < today) {
      setMessage({ type: 'error', text: 'Cannot book for past dates' });
      return;
    }

    // Check for conflicts
    if (checkForConflicts(selectedVenue, bookingDate, startTime, endTime)) {
      setMessage({ type: 'error', text: `${selectedVenue === 'canteen' ? 'Canteen' : 'Auditorium'} is already booked for this time slot` });
      return;
    }

    setLoading(true);

    try {
      const bookingData = {
        userId,
        userName,
        venue: selectedVenue,
        date: bookingDate,
        startTime,
        endTime,
        purpose: purpose.trim(),
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };

      await push(ref(database, 'bookings'), bookingData);
      
      // Reset form
      setBookingDate('');
      setStartTime('');
      setEndTime('');
      setPurpose('');
      
      setMessage({ type: 'success', text: 'Booking created successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create booking. Please try again.' });
      console.error('Booking error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Booking Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center mb-6">
                <Calendar className="h-8 w-8 mr-3" style={{ color: '#FFCC00' }} />
                <h1 className="text-3xl font-bold text-black">Book a Venue</h1>
              </div>

              {message.text && (
                <div className={`mb-6 p-4 rounded-md flex items-center ${
                  message.type === 'success' 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {message.type === 'success' ? (
                    <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 mr-2 text-red-600" />
                  )}
                  <span className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                    {message.text}
                  </span>
                </div>
              )}

              <div className="space-y-6">
                {/* Venue Selection */}
                <div>
                  <label className="block text-sm font-medium text-black mb-3">
                    Select Venue
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedVenue('canteen')}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                        selectedVenue === 'canteen'
                          ? 'border-2 bg-white text-black shadow-md'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      style={selectedVenue === 'canteen' ? { borderColor: '#FFCC00' } : {}}
                    >
                      <div className="flex items-center justify-center mb-2">
                        <Users className={`h-6 w-6 ${selectedVenue === 'canteen' ? '' : 'text-gray-600'}`} 
                               style={selectedVenue === 'canteen' ? { color: '#8C1007' } : {}} />
                      </div>
                      <div className="text-center">
                        <h3 className="font-medium text-black">Canteen</h3>
                        <p className="text-sm text-gray-500">Dining & Events</p>
                      </div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setSelectedVenue('auditorium')}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                        selectedVenue === 'auditorium'
                          ? 'border-2 bg-white text-black shadow-md'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      style={selectedVenue === 'auditorium' ? { borderColor: '#FFCC00' } : {}}
                    >
                      <div className="flex items-center justify-center mb-2">
                        <MapPin className={`h-6 w-6 ${selectedVenue === 'auditorium' ? '' : 'text-gray-600'}`}
                               style={selectedVenue === 'auditorium' ? { color: '#8C1007' } : {}} />
                      </div>
                      <div className="text-center">
                        <h3 className="font-medium text-black">Auditorium</h3>
                        <p className="text-sm text-gray-500">Presentations & Shows</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Date Selection */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Booking Date
                  </label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-black"
                    style={{ focusRingColor: '#FFCC00' }}
                    required
                  />
                </div>

                {/* Time Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Start Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" 
                             style={{ color: '#FFCC00' }} />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-black"
                        style={{ focusRingColor: '#FFCC00' }}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      End Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" 
                             style={{ color: '#FFCC00' }} />
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-black"
                        style={{ focusRingColor: '#FFCC00' }}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Purpose */}
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Purpose of Booking
                  </label>
                  <textarea
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-transparent resize-none bg-white text-black"
                    style={{ focusRingColor: '#FFCC00' }}
                    placeholder="Describe the purpose of your booking..."
                    required
                  />
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-[#FFCC00] text-black py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {loading ? 'Creating Booking...' : 'Create Booking'}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar - Previous Bookings */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Your Bookings</h2>
              
              {userBookings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No bookings yet</p>
                  <p className="text-sm text-gray-400">Your bookings will appear here</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {userBookings.map((booking) => (
                    <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900 capitalize">
                          {booking.venue}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          booking.status === 'confirmed' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {formatDate(booking.date)}
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                        {booking.purpose}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Booking Guidelines */}
            <div className="bg-yellow-50 rounded-lg p-4 mt-6 border border-yellow-200">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                <h3 className="font-medium text-yellow-800">Booking Guidelines</h3>
              </div>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Bookings must be made at least 24 hours in advance</li>
                <li>• Maximum booking duration is 4 hours</li>
                <li>• Cancellations must be made 2 hours before start time</li>
                <li>• No double bookings are allowed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingSystem;