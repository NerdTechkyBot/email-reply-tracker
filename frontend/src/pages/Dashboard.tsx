import { useEffect, useState } from 'react';
import { TrendingUp, Mail, ThumbsUp, Heart, Frown, Bot } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import axios from 'axios';

interface AnalyticsData {
  totalReplies: number;
  positiveCount: number;
  warmCount: number;
  negativeCount: number;
  neutralCount: number;
  autoReplyCount: number;
  outOfOfficeCount: number;
  byMailbox: Array<{
    mailbox_id: string;
    email_address: string;
    positive: number;
    warm: number;
    negative: number;
  }>;
  trendByDay: Array<{
    date: string;
    positive: number;
    warm: number;
    negative: number;
  }>;
}

interface PositiveReply {
  id: string;
  sentiment: string;
  summary: string;
  created_at: string;
  message: {
    subject: string;
    from_address: string;
    received_at: string;
  };
}

const Dashboard = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentPositive, setRecentPositive] = useState<PositiveReply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    fetchRecentPositive();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/analytics/overview`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentPositive = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/replies`, {
        params: {
          sentiment: 'positive',
          pageSize: 5,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const replies: PositiveReply[] = response.data.data || [];
      const sortedReplies = [...replies].sort((a, b) => {
        const dateA = new Date(a.message.received_at || a.created_at).getTime();
        const dateB = new Date(b.message.received_at || b.created_at).getTime();
        return dateB - dateA;
      });
      setRecentPositive(sortedReplies);
    } catch (error) {
      console.error('Failed to fetch recent positive replies:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Total Replies',
      value: analytics?.totalReplies || 0,
      icon: Mail,
      color: 'bg-blue-500',
    },
    {
      label: 'Positive',
      value: analytics?.positiveCount || 0,
      icon: ThumbsUp,
      color: 'bg-green-500',
    },
    {
      label: 'Warm',
      value: analytics?.warmCount || 0,
      icon: Heart,
      color: 'bg-accent',
    },
    {
      label: 'Negative',
      value: analytics?.negativeCount || 0,
      icon: Frown,
      color: 'bg-red-500',
    },
    {
      label: 'Auto/OOO',
      value: (analytics?.autoReplyCount || 0) + (analytics?.outOfOfficeCount || 0),
      icon: Bot,
      color: 'bg-gray-500',
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">AI-powered email reply analytics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${card.color} p-3 rounded-xl text-white`}>
                  <Icon size={24} />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {card.value}
              </div>
              <div className="text-sm text-gray-600">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Trend Chart */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" />
            Reply Trends (Last 30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics?.trendByDay || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="positive" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="warm" stroke="#E66B2B" strokeWidth={2} />
              <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Mailbox Performance */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Performance by Mailbox
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={analytics?.byMailbox?.map(item => ({
                ...item,
                short_email: item.email_address?.split('@')[0] || item.email_address
              })) || []}
              margin={{ bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="short_email" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [value, name]}
                labelFormatter={(label) => {
                  const item = analytics?.byMailbox?.find(m => m.email_address?.split('@')[0] === label);
                  return item?.email_address || label;
                }}
              />
              <Legend />
              <Bar dataKey="positive" fill="#10b981" name="Positive" />
              <Bar dataKey="warm" fill="#E66B2B" name="Warm" />
              <Bar dataKey="negative" fill="#ef4444" name="Negative" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Positive Replies */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Recent Positive Replies
        </h2>
        {recentPositive.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No recent positive replies to display
          </div>
        ) : (
          <div className="space-y-4">
            {recentPositive.map((reply) => (
              <div
                key={reply.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-4 rounded-xl border border-gray-100 bg-gray-50"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {reply.message.subject || 'No subject'}
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    {reply.message.from_address}
                  </div>
                  <div className="text-sm text-gray-600 line-clamp-2">
                    {reply.summary}
                  </div>
                </div>
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(reply.message.received_at || reply.created_at).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
