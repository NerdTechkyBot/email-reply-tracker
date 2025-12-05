import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Mail, CheckCircle, XCircle, RefreshCw, Download, Trash2 } from 'lucide-react';
import axios from 'axios';

interface Mailbox {
  id: string;
  email_address: string;
  status: string;
  last_synced_at: string;
  created_at: string;
}

const Mailboxes = () => {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    // Check if we have a token in the URL (from OAuth callback)
    const token = searchParams.get('token');
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (token) {
      localStorage.setItem('token', token);
      // Clean up URL
      setSearchParams({});
    }

    if (success) {
      alert('Mailbox connected successfully!');
    }

    if (error) {
      alert(`Failed to connect mailbox: ${error}`);
    }

    fetchMailboxes();
  }, [searchParams, setSearchParams]);

  const fetchMailboxes = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/mailboxes`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setMailboxes(response.data || []);
    } catch (error) {
      console.error('Failed to fetch mailboxes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectMailbox = () => {
    // Pass existing token as state so backend can add mailbox to current user
    const existingToken = localStorage.getItem('token');
    const authUrl = `${import.meta.env.VITE_API_BASE_URL}/auth/google${existingToken ? `?state=${existingToken}` : ''}`;
    window.location.href = authUrl;
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/sync/all`,
        { maxResults: 10 },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        alert(`Sync complete! Processed emails from ${response.data.results.length} mailbox(es)`);
        fetchMailboxes(); // Refresh the list
      }
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Failed to sync emails. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteMailbox = async (mailboxId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}? This will remove all associated emails and data.`)) {
      return;
    }

    setDeleting(mailboxId);
    try {
      await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/mailboxes/${mailboxId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      alert('Mailbox deleted successfully!');
      fetchMailboxes();
    } catch (error) {
      console.error('Failed to delete mailbox:', error);
      alert('Failed to delete mailbox. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'error':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <RefreshCw className="text-gray-400" size={20} />;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mailboxes</h1>
          <p className="text-gray-600 mt-1">Manage connected Gmail accounts</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSyncAll}
            disabled={syncing || mailboxes.length === 0}
            className="flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Download size={20} />
                Sync All Emails
              </>
            )}
          </button>
          <button
            onClick={handleConnectMailbox}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Plus size={20} />
            Connect Mailbox
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 text-center text-gray-500">
          Loading mailboxes...
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 border border-gray-100 text-center">
          <Mail className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No mailboxes connected</h3>
          <p className="text-gray-600 mb-6">Connect your first Gmail account to start analyzing replies</p>
          <button
            onClick={handleConnectMailbox}
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Plus size={20} />
            Connect Your First Mailbox
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mailboxes.map((mailbox) => (
            <div
              key={mailbox.id}
              className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-primary/10 p-3 rounded-xl">
                  <Mail className="text-primary" size={24} />
                </div>
                {getStatusIcon(mailbox.status)}
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                {mailbox.email_address}
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${
                    mailbox.status === 'connected' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {mailbox.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last synced:</span>
                  <span className="text-gray-900">
                    {mailbox.last_synced_at
                      ? new Date(mailbox.last_synced_at).toLocaleDateString()
                      : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Connected:</span>
                  <span className="text-gray-900">
                    {new Date(mailbox.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleDeleteMailbox(mailbox.id, mailbox.email_address)}
                  disabled={deleting === mailbox.id}
                  className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting === mailbox.id ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete Mailbox
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Mailboxes;
