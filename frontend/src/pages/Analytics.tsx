import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import axios from 'axios';

interface AnalyticsData {
  totalReplies: number;
  positiveCount: number;
  warmCount: number;
  negativeCount: number;
  neutralCount: number;
  autoReplyCount: number;
  outOfOfficeCount: number;
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
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
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
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
    </div>
  );
};

export default Analytics;
