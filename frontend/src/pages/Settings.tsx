import { useState, useEffect } from 'react';
import { Save, Bell } from 'lucide-react';
import axios from 'axios';

const Settings = () => {
  const [notifyEmail, setNotifyEmail] = useState('');
  const [enabledSentiments, setEnabledSentiments] = useState<string[]>(['positive', 'warm']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/settings/alerts`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setNotifyEmail(response.data.notify_email || '');
      setEnabledSentiments(response.data.enabled_sentiments || ['positive', 'warm']);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/settings/alerts`,
        {
          notifyEmail,
          enabledSentiments
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleSentiment = (sentiment: string) => {
    if (enabledSentiments.includes(sentiment)) {
      setEnabledSentiments(enabledSentiments.filter(s => s !== sentiment));
    } else {
      setEnabledSentiments([...enabledSentiments, sentiment]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Configure alerts and preferences</p>
      </div>

      <div className="max-w-3xl">
        {/* Alert Settings */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="text-primary" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Alert Settings</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notification Email
              </label>
              <input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="your-email@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                Receive email notifications for important replies
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Send alerts for these sentiments:
              </label>
              <div className="space-y-2">
                {['positive', 'warm', 'neutral', 'negative'].map((sentiment) => (
                  <label key={sentiment} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabledSentiments.includes(sentiment)}
                      onChange={() => toggleSentiment(sentiment)}
                      className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-gray-700 capitalize">{sentiment}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Gemini Settings */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">AI Configuration</h2>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-800">
                Gemini API is configured and active
              </span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
