import { useEffect, useState, useRef } from 'react';
import { CheckCircle, Loader2, Inbox, Sparkles } from 'lucide-react';

interface SyncProgress {
  mailbox: string;
  status: 'pending' | 'syncing' | 'completed' | 'error';
  emailsProcessed: number;
  totalEmails: number;
  message?: string;
}

interface SyncProgressModalProps {
  isOpen: boolean;
  mailboxes: string[];
  onComplete: () => void;
}

const SyncProgressModal = ({ isOpen, mailboxes, onComplete }: SyncProgressModalProps) => {
  const [progress, setProgress] = useState<SyncProgress[]>([]);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && mailboxes.length > 0) {
      // Initialize progress for all mailboxes
      const initialProgress = mailboxes.map(mailbox => ({
        mailbox,
        status: 'pending' as const,
        emailsProcessed: 0,
        totalEmails: 0
      }));
      setProgress(initialProgress);
      setTotalProcessed(0);
      setIsComplete(false);
      setIsCancelled(false);
      
      // Start syncing
      startSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mailboxes]);

  const startSync = async () => {
    for (let i = 0; i < mailboxes.length; i++) {
      // Check if cancelled
      if (isCancelled) {
        break;
      }

      // Auto-scroll to current mailbox - scroll to start of item
      setTimeout(() => {
        const element = document.getElementById(`mailbox-${i}`);
        if (element && scrollContainerRef.current) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      
      // Update status to syncing
      setProgress(prev => prev.map((p, idx) => 
        idx === i ? { ...p, status: 'syncing' } : p
      ));

      // Simulate email processing with realistic progress
      const emailCount = Math.floor(Math.random() * 20) + 5; // 5-25 emails
      
      for (let j = 0; j <= emailCount; j++) {
        if (isCancelled) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        setProgress(prev => prev.map((p, idx) => 
          idx === i ? { 
            ...p, 
            emailsProcessed: j,
            totalEmails: emailCount,
            message: j === emailCount ? 'Analyzing sentiments...' : 'Fetching emails...'
          } : p
        ));
        
        setTotalProcessed(prev => prev + 1);
      }

      // Mark as completed
      setProgress(prev => prev.map((p, idx) => 
        idx === i ? { 
          ...p, 
          status: 'completed',
          message: `✓ ${emailCount} emails synced`
        } : p
      ));
    }

    // All done or cancelled
    if (!isCancelled) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsComplete(true);
      
      // Auto close after 2 seconds
      setTimeout(() => {
        onComplete();
      }, 2000);
    } else {
      // If cancelled, close immediately
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  };

  const handleCancel = () => {
    setIsCancelled(true);
  };

  if (!isOpen) return null;

  const completedCount = progress.filter(p => p.status === 'completed').length;
  const overallProgress = mailboxes.length > 0 ? (completedCount / mailboxes.length) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4a7c7e] to-[#5a9c9e] p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              {isComplete ? (
                <CheckCircle className="w-7 h-7" />
              ) : (
                <Loader2 className="w-7 h-7 animate-spin" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {isComplete ? 'Sync Complete!' : 'Syncing Emails'}
              </h2>
              <p className="text-white/80 text-sm">
                {isComplete 
                  ? `Successfully synced ${totalProcessed} emails`
                  : `Processing ${completedCount} of ${mailboxes.length} mailboxes`
                }
              </p>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="relative h-3 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-500 ease-out"
              style={{ width: `${overallProgress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
            </div>
          </div>
          <div className="mt-2 text-right text-sm text-white/90 font-medium">
            {Math.round(overallProgress)}%
          </div>
        </div>

        {/* Progress List - Show only 2 items at a time */}
        <div 
          ref={scrollContainerRef}
          className="p-6 overflow-y-auto"
          style={{ height: '320px' }} // Height for 2.5 items for better visibility
        >
          <div className="space-y-3">
            {progress.map((item, index) => (
              <div 
                key={item.mailbox}
                id={`mailbox-${index}`}
                className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                  item.status === 'completed' 
                    ? 'bg-green-50 border-green-200' 
                    : item.status === 'syncing'
                    ? 'bg-blue-50 border-blue-200 shadow-md'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    item.status === 'completed'
                      ? 'bg-green-500 text-white'
                      : item.status === 'syncing'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {item.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : item.status === 'syncing' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Inbox className="w-5 h-5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-gray-900 truncate">
                        {item.mailbox}
                      </p>
                      {item.status === 'syncing' && (
                        <span className="text-sm text-blue-600 font-medium">
                          {item.emailsProcessed}/{item.totalEmails}
                        </span>
                      )}
                    </div>
                    
                    {item.message && (
                      <p className={`text-sm ${
                        item.status === 'completed' ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {item.message}
                      </p>
                    )}

                    {/* Progress bar for current mailbox */}
                    {item.status === 'syncing' && item.totalEmails > 0 && (
                      <div className="mt-2 h-1.5 bg-blue-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${(item.emailsProcessed / item.totalEmails) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          {isComplete ? (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">All emails synced and analyzed!</span>
            </div>
          ) : isCancelled ? (
            <div className="flex items-center justify-center gap-2 text-orange-600">
              <span className="font-medium">Sync cancelled</span>
            </div>
          ) : (
            <button
              onClick={handleCancel}
              className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
            >
              Cancel Sync
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default SyncProgressModal;
