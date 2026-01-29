import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface InstallationSetupProps {
  onComplete: (folderPath: string) => void;
  onSkip?: () => void;
}

export const InstallationSetup: React.FC<InstallationSetupProps> = ({ 
  onComplete, 
  onSkip 
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'intro' | 'selection' | 'confirm'>('intro');

  const handleSelectFolder = async () => {
    setLoading(true);
    try {
      const result = await (window.fileAPI as any).selectInstallationFolder();
      
      if (result.canceled) {
        toast.info('Folder selection cancelled');
        setLoading(false);
        return;
      }

      if (!result.success) {
        toast.error('Failed to select folder', {
          description: result.error || 'Unknown error'
        });
        setLoading(false);
        return;
      }

      setSelectedFolder(result.path);
      setStep('confirm');
    } catch (err) {
      toast.error('Error selecting folder', {
        description: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedFolder) {
      onComplete(selectedFolder);
    }
  };

  const handleUseDefault = () => {
    onSkip?.();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '32px',
        maxWidth: '500px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
      }}>
        {step === 'intro' && (
          <>
            <h1 style={{ marginTop: 0, marginBottom: '16px' }}>Welcome to APLSys</h1>
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px' }}>
              Let's set up your documents folder. This is where scanned files and OCR results will be saved.
            </p>

            <div style={{
              background: '#f0f4f8',
              padding: '16px',
              borderRadius: '6px',
              marginBottom: '24px',
              fontSize: '14px',
              color: '#555',
            }}>
              <p style={{ marginTop: 0 }}>
                📁 <strong>You can:</strong>
              </p>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Choose an existing folder</li>
                <li>Create a new folder</li>
                <li>Change this later in settings</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleUseDefault}
                style={{
                  padding: '8px 16px',
                  background: '#f0f0f0',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Use Default
              </button>
              <button
                onClick={() => setStep('selection')}
                style={{
                  padding: '8px 16px',
                  background: '#0b5ed7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Choose Folder
              </button>
            </div>
          </>
        )}

        {step === 'selection' && (
          <>
            <h2 style={{ marginTop: 0 }}>Select Documents Folder</h2>
            <p style={{ color: '#666', marginBottom: '24px' }}>
              Click the button below to browse and select a folder where your documents will be stored.
            </p>

            <button
              onClick={handleSelectFolder}
              disabled={loading}
              style={{
                width: '100%',
                padding: '48px 16px',
                background: loading ? '#e0e0e0' : '#f8f9fa',
                border: '2px dashed #0b5ed7',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                color: '#0b5ed7',
                fontWeight: 'bold',
                marginBottom: '16px',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Opening folder browser...' : '📁 Browse and Select Folder'}
            </button>

            <button
              onClick={() => setStep('intro')}
              style={{
                width: '100%',
                padding: '8px 16px',
                background: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          </>
        )}

        {step === 'confirm' && selectedFolder && (
          <>
            <h2 style={{ marginTop: 0 }}>Confirm Folder Selection</h2>
            <p style={{ color: '#666', marginBottom: '12px' }}>
              Selected folder:
            </p>
            <div style={{
              background: '#f0f4f8',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '24px',
              fontFamily: 'monospace',
              fontSize: '12px',
              wordBreak: 'break-all',
              color: '#333',
            }}>
              {selectedFolder}
            </div>

            <div style={{
              background: '#e8f5e9',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '24px',
              fontSize: '14px',
              color: '#2e7d32',
            }}>
              ✓ This folder will be used for all scanned documents and OCR results.
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep('selection')}
                style={{
                  padding: '8px 16px',
                  background: '#f0f0f0',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Change
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '8px 16px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Confirm & Continue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};