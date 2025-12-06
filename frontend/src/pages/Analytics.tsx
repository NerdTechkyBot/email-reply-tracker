import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Mail, ThumbsUp, Heart, Frown } from 'lucide-react';
import axios from 'axios';

interface MailboxBreakdown {
  mailbox_id: string;
  email_address: string;
  positive: number;
  warm: number;
  negative: number;
  neutral: number;
}

interface AnalyticsData {
  totalReplies: number;
  positiveCount: number;
  warmCount: number;
  negativeCount: number;
  neutralCount: number;
  autoReplyCount: number;
  outOfOfficeCount: number;
  byMailbox: MailboxBreakdown[];
}

const Analytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  const pieData = [
    { name: 'Positive', value: analytics?.positiveCount || 0, color: '#10b981' },
    { name: 'Warm', value: analytics?.warmCount || 0, color: '#E66B2B' },
    { name: 'Negative', value: analytics?.negativeCount || 0, color: '#ef4444' },
    { name: 'Neutral', value: analytics?.neutralCount || 0, color: '#6b7280' },
    { name: 'Auto/OOO', value: (analytics?.autoReplyCount || 0) + (analytics?.outOfOfficeCount || 0), color: '#3b82f6' },
  ];

  const conversionRate = analytics?.totalReplies
    ? (((analytics.positiveCount + analytics.warmCount) / analytics.totalReplies) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Detailed insights into your email campaigns</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Total Replies</div>
          <div className="text-4xl font-bold text-gray-900">{analytics?.totalReplies || 0}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">Conversion Rate</div>
          <div className="text-4xl font-bold text-green-600">{conversionRate}%</div>
          <div className="text-xs text-gray-500 mt-1">Positive + Warm</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="text-sm text-gray-600 mb-2">High Interest</div>
          <div className="text-4xl font-bold text-accent">{analytics?.positiveCount || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Positive responses</div>
        </div>
      </div>

      {/* Sentiment Distribution */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Sentiment Distribution</h2>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Mailbox Breakdown */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Performance by Mailbox</h2>
        {!analytics?.byMailbox || analytics.byMailbox.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No mailbox data available
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analytics.byMailbox.map((mailbox) => {
              const total = mailbox.positive + mailbox.warm + mailbox.negative + mailbox.neutral;
              const positivePercent = total > 0 ? ((mailbox.positive / total) * 100).toFixed(0) : '0';
              const warmPercent = total > 0 ? ((mailbox.warm / total) * 100).toFixed(0) : '0';
              const negativePercent = total > 0 ? ((mailbox.negative / total) * 100).toFixed(0) : '0';

              return (
                <div
                  key={mailbox.mailbox_id}
                  className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                >
                  {/* Mailbox Header */}
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                    <div className="bg-white p-2 rounded-lg border border-gray-200">
                      <img 
                        src="/google-logo.webp" 
                        alt="Google" 
                        className="w-6 h-6"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate text-sm">
                        {mailbox.email_address}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {total} total replies
                      </p>
                    </div>
                  </div>

                  {/* Sentiment Breakdown */}
                  <div className="space-y-3">
                    {/* Positive */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="bg-green-100 p-1.5 rounded-lg">
                          <ThumbsUp className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="text-sm text-gray-700">Positive</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {mailbox.positive}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({positivePercent}%)
                        </span>
                      </div>
                    </div>

                    {/* Warm */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="bg-orange-100 p-1.5 rounded-lg">
                          <Heart className="w-4 h-4 text-orange-600" />
                        </div>
                        <span className="text-sm text-gray-700">Warm</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {mailbox.warm}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({warmPercent}%)
                        </span>
                      </div>
                    </div>

                    {/* Negative */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="bg-red-100 p-1.5 rounded-lg">
                          <Frown className="w-4 h-4 text-red-600" />
                        </div>
                        <span className="text-sm text-gray-700">Negative</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {mailbox.negative}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({negativePercent}%)
                        </span>
                      </div>
                    </div>

                    {/* Neutral */}
                    {mailbox.neutral > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-gray-100 p-1.5 rounded-lg">
                            <Mail className="w-4 h-4 text-gray-600" />
                          </div>
                          <span className="text-sm text-gray-700">Neutral</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {mailbox.neutral}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                      {mailbox.positive > 0 && (
                        <div
                          className="bg-green-500"
                          style={{ width: `${positivePercent}%` }}
                          title={`Positive: ${positivePercent}%`}
                        />
                      )}
                      {mailbox.warm > 0 && (
                        <div
                          className="bg-orange-500"
                          style={{ width: `${warmPercent}%` }}
                          title={`Warm: ${warmPercent}%`}
                        />
                      )}
                      {mailbox.negative > 0 && (
                        <div
                          className="bg-red-500"
                          style={{ width: `${negativePercent}%` }}
                          title={`Negative: ${negativePercent}%`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
