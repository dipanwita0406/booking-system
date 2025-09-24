'use client';
import React, { useState, useEffect } from 'react';
import { database, auth } from '../../../firebase-config';
import { ref, push, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import Navbar from '@/components/navbar';
import { Calendar, Clock, MapPin, Users, CheckCircle, XCircle, AlertTriangle, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

const BookingSystem = () => {
  const [selectedVenue, setSelectedVenue] = useState('canteen');
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [participants, setParticipants] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [userBookings, setUserBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        loadUserBookings(user.uid);
        loadAllBookings();
      } else {
       
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    filterBookings();
  }, [userBookings, searchTerm]);

  const loadUserBookings = (userId) => {
    const userBookingsRef = query(
      ref(database, 'bookings'),
      orderByChild('userId'),
      equalTo(userId)
    );

    onValue(userBookingsRef, (snapshot) => {
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
  };

  const loadAllBookings = () => {
    const allBookingsRef = ref(database, 'bookings');

    onValue(allBookingsRef, (snapshot) => {
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
  };

  const filterBookings = () => {
    if (!searchTerm.trim()) {
      setFilteredBookings(userBookings);
      return;
    }

    const filtered = userBookings.filter(booking =>
      booking.venue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatDate(booking.date).toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredBookings(filtered);
  };

  const checkForConflicts = (venue, date, startTime, endTime) => {
    const newStart = new Date(`${date}T${startTime}`);
    const newEnd = new Date(`${date}T${endTime}`);

    return allBookings.some(booking => {
      if (booking.venue !== venue || booking.date !== date || booking.status === 'rejected') {
        return false;
      }

      const existingStart = new Date(`${booking.date}T${booking.startTime}`);
      const existingEnd = new Date(`${booking.date}T${booking.endTime}`);

      return (newStart < existingEnd && newEnd > existingStart);
    });
  };

  const handleSubmit = async () => {
    if (!currentUser) {
      setMessage({ type: 'error', text: 'Please log in to make a booking' });
      return;
    }

    if (!bookingDate || !startTime || !endTime || !purpose.trim() || !participants.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
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

    const participantCount = parseInt(participants);
    if (isNaN(participantCount) || participantCount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid number of participants' });
      return;
    }

    if (checkForConflicts(selectedVenue, bookingDate, startTime, endTime)) {
      setMessage({ type: 'error', text: `${selectedVenue === 'canteen' ? 'Canteen' : 'Auditorium'} is already booked for this time slot` });
      return;
    }

    setLoading(true);

    try {
      const bookingData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || currentUser.email,
        venue: selectedVenue,
        facilityName: selectedVenue === 'canteen' ? 'Canteen' : 'Auditorium',
        date: bookingDate,
        startTime: `${bookingDate}T${startTime}:00`,
        endTime: `${bookingDate}T${endTime}:00`,
        purpose: purpose.trim(),
        participants: participantCount,
        specialRequirements: specialRequirements.trim() || null,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await push(ref(database, 'bookings'), bookingData);

      setBookingDate('');
      setStartTime('');
      setEndTime('');
      setPurpose('');
      setParticipants('');
      setSpecialRequirements('');

      setMessage({ type: 'success', text: 'Booking request submitted successfully! Awaiting admin approval.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to submit booking request. Please try again.' });
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

  const formatDateTime = (dateTimeString) => {
    return new Date(dateTimeString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center mb-6">
                <Calendar className="h-8 w-8 mr-3" style={{ color: '#FFCC00' }} />
                <h1 className="text-3xl font-bold text-black">Book a Venue</h1>
              </div>

              {message.text && (
                <div className={`mb-6 p-4 rounded-md flex items-center ${message.type === 'success'
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
                <div>
                  <label className="block text-sm font-medium text-black mb-3">
                    Select Venue
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedVenue('canteen')}
                      className={`p-4 rounded-lg border-2 transition-all duration-200 ${selectedVenue === 'canteen'
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
                      className={`p-4 rounded-lg border-2 transition-all duration-200 ${selectedVenue === 'auditorium'
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

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Number of Participants
                  </label>
                  <input
                    type="number"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-black"
                    style={{ focusRingColor: '#FFCC00' }}
                    placeholder="Enter number of participants"
                    required
                  />
                </div>

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

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Special Requirements (Optional)
                  </label>
                  <textarea
                    value={specialRequirements}
                    onChange={(e) => setSpecialRequirements(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-transparent resize-none bg-white text-black"
                    style={{ focusRingColor: '#FFCC00' }}
                    placeholder="Any special arrangements needed..."
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-[#FFCC00] text-black py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {loading ? 'Submitting Request...' : 'Submit Booking Request'}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Your Bookings</h2>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search bookings..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-white text-black text-sm"
                    style={{ focusRingColor: '#FFCC00' }}
                  />
                </div>
              </div>

              {filteredBookings.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchTerm ? 'No matching bookings found' : 'No bookings yet'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {searchTerm ? 'Try different search terms' : 'Your bookings will appear here'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filteredBookings.map((booking) => (
                    <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900 capitalize">
                          {booking.venue}
                        </h3>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(booking.status)}`}>
                          {getStatusIcon(booking.status)}
                          <span className="capitalize">{booking.status}</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span>{formatDate(booking.date)}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          <span>{formatDateTime(booking.startTime)} - {formatDateTime(booking.endTime)}</span>
                        </div>
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          <span>{booking.participants} participants</span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                        {booking.purpose}
                      </p>

                      {booking.specialRequirements && (
                        <p className="text-xs text-gray-600 mt-1 italic">
                          Special: {booking.specialRequirements}
                        </p>
                      )}

                      {(booking.approvedReason || booking.rejectedReason) && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                          <span className="font-medium">Admin Note:</span>
                          <p className="text-gray-600">{booking.approvedReason || booking.rejectedReason}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-yellow-50 rounded-lg p-4 mt-6 border border-yellow-200">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                <h3 className="font-medium text-yellow-800">Booking Guidelines</h3>
              </div>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• All bookings require admin approval</li>
                <li>• Submit requests at least 24 hours in advance</li>
                <li>• Maximum booking duration is 4 hours</li>
                <li>• Provide accurate participant count</li>
                <li>• Check your booking status regularly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingSystem;