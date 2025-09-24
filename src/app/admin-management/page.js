'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar, 
  MapPin, 
  MessageSquare,
  Filter,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  X,
  Users
} from 'lucide-react';
import { auth, database } from '../../../firebase-config';
import { ref, onValue, update, get, push } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import Navbar from '@/components/navbar';

export default function AdminManagement() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = ref(database, `users/${user.uid}`);
          const userSnapshot = await get(userRef);
          const userData = userSnapshot.val();
          
          if (userData && userData.role === 'admin') {
            setCurrentUser(userData);
            loadBookings();
          } else {
            router.push('/bookings');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          router.push('/login');
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (bookings.length > 0) {
      filterBookings();
    }
  }, [bookings, searchTerm, statusFilter]);

  const loadBookings = () => {
    const bookingsRef = ref(database, 'bookings');
    onValue(bookingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const bookingsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        
        bookingsArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setBookings(bookingsArray);
      } else {
        setBookings([]);
      }
    });
  };

  const filterBookings = () => {
    let filtered = bookings;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(booking => booking.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(booking =>
        booking.facilityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.venue?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredBookings(filtered);
  };

  const handleAction = (booking, action) => {
    setSelectedBooking(booking);
    setActionType(action);
    setShowReasonModal(true);
    setReason('');
  };

  const confirmAction = async () => {
    if (!selectedBooking || !actionType) return;

    setActionLoading(true);
    try {
      const bookingRef = ref(database, `bookings/${selectedBooking.id}`);
      const updateData = {
        status: actionType,
        [`${actionType}At`]: new Date().toISOString(),
        [`${actionType}By`]: currentUser.uid || auth.currentUser?.uid,
        [`${actionType}Reason`]: reason.trim() || null
      };

      await update(bookingRef, updateData);

      const notificationRef = ref(database, 'notifications');
      await push(notificationRef, {
        userId: selectedBooking.userId,
        type: actionType,
        bookingId: selectedBooking.id,
        facilityName: selectedBooking.facilityName || selectedBooking.venue,
        message: `Your booking for ${selectedBooking.facilityName || selectedBooking.venue} has been ${actionType}${reason ? ': ' + reason : ''}`,
        createdAt: new Date().toISOString(),
        read: false
      });

      setShowReasonModal(false);
      setSelectedBooking(null);
      setActionType('');
      setReason('');
    } catch (error) {
      console.error('Error updating booking:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'text-green-700 bg-green-100 border-green-200';
      case 'rejected':
        return 'text-red-700 bg-red-100 border-red-200';
      case 'pending':
        return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      default:
        return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={16} />;
      case 'rejected':
        return <XCircle size={16} />;
      case 'pending':
        return <Clock size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const formatDateTime = (dateTimeString) => {
    return new Date(dateTimeString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-[#8C1007] mx-auto mb-4" />
          <p className="text-[#8C1007] font-medium">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#8C1007] mb-2">Admin Management</h1>
          <p className="text-gray-600">Review and manage facility booking requests</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border-2 border-[#FFCC00]/20 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border-2 border-[#FFCC00] rounded-lg focus:ring-2 focus:ring-[#8C1007]/20 focus:border-[#8C1007] text-[#8C1007] font-medium"
                />
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border-2 border-[#FFCC00] rounded-lg focus:ring-2 focus:ring-[#8C1007]/20 focus:border-[#8C1007] text-[#8C1007] font-medium appearance-none bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="text-sm text-gray-600 font-medium">
              Total Bookings: {filteredBookings.length}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg border-2 border-[#FFCC00]/20 p-12 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-xl shadow-lg border-2 border-[#FFCC00]/20 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-[#8C1007] mb-1 capitalize">
                          {booking.facilityName || booking.venue}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <User size={16} />
                            <span>{booking.userName || booking.userEmail}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar size={16} />
                            <span>
                              {booking.startTime && booking.endTime ? (
                                `${formatDateTime(booking.startTime)} - ${formatDateTime(booking.endTime)}`
                              ) : (
                                `${formatDate(booking.date)} ${booking.startTime} - ${booking.endTime}`
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full border-2 flex items-center gap-2 text-sm font-medium ${getStatusColor(booking.status)}`}>
                        {getStatusIcon(booking.status)}
                        <span className="capitalize">{booking.status}</span>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Purpose:</span>
                        <p className="text-gray-600 mt-1">{booking.purpose}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Participants:</span>
                        <p className="text-gray-600 mt-1 flex items-center gap-1">
                          <Users size={16} />
                          {booking.participants} people
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Requested:</span>
                        <p className="text-gray-600 mt-1">{formatDateTime(booking.createdAt)}</p>
                      </div>
                      {booking.specialRequirements && (
                        <div>
                          <span className="font-medium text-gray-700">Special Requirements:</span>
                          <p className="text-gray-600 mt-1">{booking.specialRequirements}</p>
                        </div>
                      )}
                    </div>

                    {(booking.approvedReason || booking.rejectedReason) && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare size={16} className="text-gray-500" />
                          <span className="font-medium text-gray-700">Admin Note:</span>
                        </div>
                        <p className="text-gray-600 text-sm">{booking.approvedReason || booking.rejectedReason}</p>
                      </div>
                    )}
                  </div>

                  {booking.status === 'pending' && (
                    <div className="flex flex-col sm:flex-row gap-3 lg:flex-col lg:w-40">
                      <button
                        onClick={() => handleAction(booking, 'approved')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105"
                      >
                        <CheckCircle size={18} />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleAction(booking, 'rejected')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105"
                      >
                        <XCircle size={18} />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#FFCC00] max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#8C1007]">
                {actionType === 'approved' ? 'Approve Booking' : 'Reject Booking'}
              </h3>
              <button
                onClick={() => setShowReasonModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-2 capitalize">
                {selectedBooking?.facilityName || selectedBooking?.venue}
              </h4>
              <p className="text-sm text-gray-600">
                Requested by: {selectedBooking?.userName || selectedBooking?.userEmail}
              </p>
              <p className="text-sm text-gray-600">
                Date: {selectedBooking && (
                  selectedBooking.startTime ? 
                    formatDateTime(selectedBooking.startTime) : 
                    `${formatDate(selectedBooking.date)} ${selectedBooking.startTime}`
                )}
              </p>
              <p className="text-sm text-gray-600">
                Participants: {selectedBooking?.participants} people
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold mb-2 text-[#8C1007]">
                Reason (Optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Enter reason for ${actionType === 'approved' ? 'approval' : 'rejection'}...`}
                className="w-full px-3 py-2 border-2 border-[#FFCC00] rounded-lg focus:ring-2 focus:ring-[#8C1007]/20 focus:border-[#8C1007] text-[#8C1007] resize-none h-24"
                maxLength={500}
              />
              <div className="text-right text-xs text-gray-500 mt-1">
                {reason.length}/500 characters
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowReasonModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={actionLoading}
                className={`flex-1 px-4 py-3 rounded-lg font-medium text-white transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 ${
                  actionType === 'approved' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading ? (
                  <RefreshCw className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    {actionType === 'approved' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    <span>Confirm {actionType === 'approved' ? 'Approval' : 'Rejection'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}