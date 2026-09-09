import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPost, apiGet, apiPut, fetchWithInterceptors } from '@/utils/fetchInterceptor';
import { getApiUrl } from '@/utils/runtime';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import YluneDialog from '@/components/ui/YluneDialog';

interface McpbUploadFormProps {
  onSuccess: (serverConfig: any) => void;
  onCancel: () => void;
}

interface McpbUploadResponse {
  success: boolean;
  data?: {
    manifest: any;
    extractDir: string;
  };
  message?: string;
}

const McpbUploadForm: React.FC<McpbUploadFormProps> = ({ onSuccess, onCancel }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showServerForm, setShowServerForm] = useState(false);
  const [manifestData, setManifestData] = useState<any>(null);
  const [extractDir, setExtractDir] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingServerName, setPendingServerName] = useState<string>('');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.mcpb')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError(t('mcpb.invalidFileType'));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.mcpb')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError(t('mcpb.invalidFileType'));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError(t('mcpb.noFileSelected'));
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('mcpbFile', selectedFile);

      const response = await fetchWithInterceptors(getApiUrl('/mcpb/upload'), {
        method: 'POST',
        body: formData,
      });

      const result: McpbUploadResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! Status: ${response.status}`);
      }

      if (result.success && result.data) {
        setManifestData(result.data.manifest);
        setExtractDir(result.data.extractDir);
        setShowServerForm(true);
      } else {
        throw new Error(result.message || t('mcpb.uploadFailed'));
      }
    } catch (err) {
      console.error('MCPB upload error:', err);
      setError(err instanceof Error ? err.message : t('mcpb.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleInstallServer = async (serverName: string, forceOverride: boolean = false) => {
    setIsUploading(true);
    setError(null);

    try {
      // Convert MCPB manifest to MCPHub stdio server configuration
      const serverConfig = convertMcpbToMcpConfig(manifestData, extractDir, serverName);

      // First, check if server exists
      if (!forceOverride) {
        const checkResult = await apiGet('/servers');

        if (checkResult.success) {
          const existingServer = checkResult.data?.find(
            (server: any) => server.name === serverName,
          );

          if (existingServer) {
            // Server exists, show confirmation dialog
            setPendingServerName(serverName);
            setShowConfirmDialog(true);
            setIsUploading(false);
            return;
          }
        }
      }

      // Install or override the server
      let result;
      if (forceOverride) {
        result = await apiPut(`/servers/${encodeURIComponent(serverName)}`, {
          name: serverName,
          config: serverConfig,
        });
      } else {
        result = await apiPost('/servers', {
          name: serverName,
          config: serverConfig,
        });
      }

      if (result.success) {
        onSuccess(serverConfig);
      } else {
        throw new Error(result.message || t('mcpb.installFailed'));
      }
    } catch (err) {
      console.error('MCPB install error:', err);
      setError(err instanceof Error ? err.message : t('mcpb.installFailed'));
      setIsUploading(false);
    }
  };

  const handleConfirmOverride = () => {
    setShowConfirmDialog(false);
    if (pendingServerName) {
      handleInstallServer(pendingServerName, true);
    }
  };

  const handleCancelOverride = () => {
    setShowConfirmDialog(false);
    setPendingServerName('');
    setIsUploading(false);
  };

  const convertMcpbToMcpConfig = (manifest: any, extractPath: string, _serverName: string) => {
    const mcpConfig = manifest.server?.mcp_config || {};

    // Convert MCPB manifest to MCPHub stdio configuration
    const config: any = {
      type: 'stdio',
      command: mcpConfig.command || 'node',
      args: (mcpConfig.args || []).map((arg: string) => arg.replace('${__dirname}', extractPath)),
    };

    // Add environment variables if they exist
    if (mcpConfig.env && Object.keys(mcpConfig.env).length > 0) {
      config.env = { ...mcpConfig.env };

      // Replace ${__dirname} in environment variables
      Object.keys(config.env).forEach((key) => {
        if (typeof config.env[key] === 'string') {
          config.env[key] = config.env[key].replace('${__dirname}', extractPath);
        }
      });
    }

    return config;
  };

  if (showServerForm && manifestData) {
    return (
      <>
        <ConfirmDialog
          isOpen={showConfirmDialog}
          onClose={handleCancelOverride}
          onConfirm={handleConfirmOverride}
          title={t('mcpb.serverExistsTitle')}
          message={t('mcpb.serverExistsConfirm', { serverName: pendingServerName })}
          confirmText={t('mcpb.override')}
          cancelText={t('common.cancel')}
          variant="warning"
        />

        <YluneDialog
          size="lg"
          title={t('mcpb.installServer')}
          onClose={onCancel}
          footer={
            <>
              <button type="button" onClick={onCancel} disabled={isUploading} className="hub-btn">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const nameInput = document.getElementById('serverName') as HTMLInputElement;
                  const serverName = nameInput?.value.trim() || manifestData.name;
                  handleInstallServer(serverName);
                }}
                disabled={isUploading}
                className="hub-btn primary"
              >
                {isUploading ? t('mcpb.installing') : t('mcpb.install')}
              </button>
            </>
          }
        >
          {error && <div className="ylune-error">{error}</div>}
          <div className="ylune-preview">
            <h3>{t('mcpb.extensionInfo')}</h3>
            <p className="ylune-help" style={{ margin: 0 }}>
              {t('mcpb.name')}: {manifestData.display_name || manifestData.name}
              <br />
              {t('mcpb.version')}: {manifestData.version}
              <br />
              {t('mcpb.description')}: {manifestData.description}
            </p>
          </div>
          <div>
            <label className="ylune-label">{t('mcpb.serverName')}</label>
            <input
              type="text"
              id="serverName"
              defaultValue={manifestData.name}
              className="hub-input"
              placeholder={t('mcpb.serverNamePlaceholder')}
            />
          </div>
        </YluneDialog>
      </>
    );
  }

  return (
    <YluneDialog
      title={t('mcpb.uploadTitle')}
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={isUploading} className="hub-btn">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="hub-btn primary"
          >
            {isUploading ? t('mcpb.uploading') : t('mcpb.upload')}
          </button>
        </>
      }
    >
      {error && <div className="ylune-error">{error}</div>}
      <div
        className={`ylune-dropzone${isDragging ? ' is-active' : ''}${selectedFile ? ' is-ready' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {selectedFile ? (
          <div>
            <p className="ylune-dropzone-title">{selectedFile.name}</p>
            <p className="ylune-dropzone-sub">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        ) : (
          <div>
            <p className="ylune-dropzone-title">{t('mcpb.dropFileHere')}</p>
            <p className="ylune-dropzone-sub">{t('mcpb.orClickToSelect')}</p>
          </div>
        )}
        <input
          type="file"
          accept=".mcpb"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </YluneDialog>
  );
};

export default McpbUploadForm;
