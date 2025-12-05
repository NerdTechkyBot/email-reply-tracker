import { useEffect, useState } from 'react';
import { Search, Eye, X, Mail, Calendar, Tag, TrendingUp, FileText, Filter } from 'lucide-react';
import axios from 'axios';

interface Reply {
  id: string;
  sentiment: string;
  interest_level: string;
  summary: string;
  category: string;
  recommended_action: string;
  confidence_score: number;
  message: {
    id: string;
    from_address: string;
    subject: string;
    snippet: string;
    body_plain: string;
    body_html: string;
    received_at: string;
    is_read: boolean;
    thread: {
      mailbox: {
        email_address: string;
      };
    };
  };
}

const Replies = () => {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [selectedReply, setSelectedReply] = useState<Reply | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [hideAutoReplies, setHideAutoReplies] = useState(false);

  useEffect(() => {
    fetchReplies();
  }, [sentimentFilter]);

  const fetchReplies = async () => {
    try {
      const params: any = {};
      if (sentimentFilter !== 'all') {
        params.sentiment = sentimentFilter;
      }

      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/replies`, {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setReplies(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch replies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReplies = replies
    .filter(reply => {
      // Search filter
      const matchesSearch = reply.message.from_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reply.message.subject.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Hide auto-replies filter - only hide based on sentiment classification
      if (hideAutoReplies) {
        const isAutoReply = reply.sentiment === 'auto_reply' || 
                           reply.sentiment === 'out_of_office' || 
                           reply.sentiment === 'spam';
        
        if (isAutoReply) {
          return false;
        }
      }

      // Date filter
      if (dateFilter === 'all') return true;
      
      const receivedDate = new Date(reply.message.received_at);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dateFilter === 'today') return daysDiff === 0;
      if (dateFilter === 'week') return daysDiff <= 7;
      if (dateFilter === 'month') return daysDiff <= 30;
      
      return true;
    })
    .sort((a, b) => new Date(b.message.received_at).getTime() - new Date(a.message.received_at).getTime());

  const getSentimentColor = (sentiment: string) => {
    const colors: Record<string, string> = {
      positive: 'bg-green-100 text-green-700 border-green-200',
      warm: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      neutral: 'bg-gray-100 text-gray-700 border-gray-200',
      negative: 'bg-red-100 text-red-700 border-red-200',
      auto_reply: 'bg-blue-100 text-blue-700 border-blue-200',
      out_of_office: 'bg-purple-100 text-purple-700 border-purple-200',
      spam: 'bg-orange-100 text-orange-700 border-orange-200'
    };
    return colors[sentiment] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getInterestColor = (level: string) => {
    const colors: Record<string, string> = {
      high: 'bg-purple-100 text-purple-700 border-purple-200',
      medium: 'bg-blue-100 text-blue-700 border-blue-200',
      low: 'bg-gray-100 text-gray-700 border-gray-200',
      none: 'bg-gray-50 text-gray-500 border-gray-100'
    };
    return colors[level] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const extractName = (fromAddress: string) => {
    const match = fromAddress.match(/^(.+?)\s*<(.+?)>$/);
    return match ? match[1].trim() : fromAddress.split('@')[0];
  };

  const extractEmail = (fromAddress: string) => {
    const match = fromAddress.match(/<(.+?)>/);
    return match ? match[1] : fromAddress;
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredReplies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReplies.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} email(s)?`)) {
      return;
    }

    setDeleting(true);
    try {
      // Delete each selected classification
      for (const id of selectedIds) {
        await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/replies/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
      }
      
      alert(`Successfully deleted ${selectedIds.size} email(s)`);
      setSelectedIds(new Set());
      fetchReplies();
    } catch (error) {
      console.error('Failed to delete emails:', error);
      alert('Failed to delete some emails. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // Uncomment if you want to add a "Reclassify All" button
  // const handleReclassifyAll = async () => {
  //   if (!confirm('This will re-classify all existing messages. Continue?')) {
  //     return;
  //   }
  //
  //   setReclassifying(true);
  //   try {
  //     await axios.post(
  //       `${import.meta.env.VITE_API_BASE_URL}/sync/reclassify`,
  //       {},
  //       {
  //         headers: {
  //           Authorization: `Bearer ${localStorage.getItem('token')}`
  //         }
  //       }
  //     );
  //
  //     alert('Re-classification started! Refresh in a few seconds.');
  //     setTimeout(() => fetchReplies(), 3000);
  //   } catch (error) {
  //     console.error('Failed to re-classify:', error);
  //     alert('Failed to start re-classification. Please try again.');
  //   } finally {
  //     setReclassifying(false);
  //   }
  // };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Email Replies</h1>
        <p className="text-gray-600 mt-1">View and manage classified email responses</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <X size={16} />
              Delete {selectedIds.size} Selected
            </button>
          )}
          
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by subject or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-2">
              <button
                onClick={() => setSentimentFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  sentimentFilter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSentimentFilter('positive')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  sentimentFilter === 'positive' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Positive
              </button>
              <button
                onClick={() => setSentimentFilter('warm')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  sentimentFilter === 'warm' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Warm
              </button>
              <button
                onClick={() => setSentimentFilter('negative')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  sentimentFilter === 'negative' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Negative
              </button>
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              <Filter size={16} className="text-gray-500" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideAutoReplies}
                  onChange={(e) => setHideAutoReplies(e.target.checked)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                />
                <span className="text-sm text-gray-700">Hide Auto-Replies</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Replies Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading replies...</div>
        ) : replies.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No replies found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredReplies.length && filteredReplies.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    From
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Mailbox
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Sentiment
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider sticky right-0 bg-gray-50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReplies.map((reply) => (
                  <tr
                    key={reply.id}
                    className={`hover:bg-gray-50 ${
                      selectedIds.has(reply.id)
                        ? 'bg-blue-50'
                        : !reply.message?.is_read
                          ? 'bg-blue-50/40'
                          : ''
                    } ${!reply.message?.is_read ? 'font-semibold' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(reply.id)}
                        onChange={() => toggleSelect(reply.id)}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {extractName(reply.message?.from_address || 'N/A')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reply.message?.thread?.mailbox?.email_address || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {reply.message?.subject || 'No subject'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSentimentColor(reply.sentiment)}`}>
                        {reply.sentiment}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(reply.message?.received_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right sticky right-0 bg-white">
                      <button
                        onClick={() => setSelectedReply(reply)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                      >
                        <Eye size={16} />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {selectedReply && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Email Details</h2>
              <button
                onClick={() => setSelectedReply(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Sender Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="text-primary mt-1" size={20} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-600 mb-1">From</p>
                    <p className="text-lg font-bold text-gray-900">{extractName(selectedReply.message.from_address)}</p>
                    <p className="text-sm text-gray-600">{extractEmail(selectedReply.message.from_address)}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Mail className="text-accent mt-1" size={20} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-600 mb-1">Received On Mailbox</p>
                    <p className="text-base font-medium text-gray-900">{selectedReply.message.thread?.mailbox?.email_address || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="text-blue-500 mt-1" size={20} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-600 mb-1">Received At</p>
                    <p className="text-base text-gray-900">
                      {new Date(selectedReply.message.received_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Subject</h3>
                <p className="text-lg font-medium text-gray-900">{selectedReply.message.subject}</p>
              </div>

              {/* Classification */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                    <Tag size={16} />
                    Sentiment
                  </h3>
                  <span className={`inline-block px-4 py-2 rounded-lg text-sm font-medium border ${getSentimentColor(selectedReply.sentiment)}`}>
                    {selectedReply.sentiment}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                    <TrendingUp size={16} />
                    Interest Level
                  </h3>
                  <span className={`inline-block px-4 py-2 rounded-lg text-sm font-medium border ${getInterestColor(selectedReply.interest_level)}`}>
                    {selectedReply.interest_level}
                  </span>
                </div>
              </div>

              {/* AI Summary */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <FileText size={16} />
                  AI Summary
                </h3>
                <p className="text-gray-700 bg-blue-50 p-4 rounded-lg">{selectedReply.summary}</p>
              </div>

              {/* Category & Action */}
              {selectedReply.category && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Category</h3>
                  <p className="text-gray-700">{selectedReply.category}</p>
                </div>
              )}

              {selectedReply.recommended_action && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Recommended Action</h3>
                  <p className="text-gray-700 bg-green-50 p-4 rounded-lg">{selectedReply.recommended_action}</p>
                </div>
              )}

              {/* Email Body */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Email Content</h3>
                <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                    {selectedReply.message.body_plain || selectedReply.message.snippet || 'No content available'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedReply(null)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Replies;
