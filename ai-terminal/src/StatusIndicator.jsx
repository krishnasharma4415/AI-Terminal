import React from 'react';
import { useBackend } from './BackendContext';

const StatusIndicator = () => {
  const { isConnected, aiEnabled, isChecking, error, system, version, socketConnected } = useBackend();
  
  return (
    <div className="absolute top-2 right-4 flex items-center gap-2 text-sm">
      {isChecking ? (
        <span className="text-text-muted animate-pulse">Checking connection...</span>
      ) : isConnected ? (
        <div className="flex items-center">
          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${aiEnabled ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
          <span className="text-text-muted">
            {aiEnabled ? 'AI: Connected' : 'Backend: Connected (AI disabled)'}
            {socketConnected && ' | WebSockets: Connected'}
          </span>
          <span className="ml-2 text-text-muted text-xs opacity-50">
            {system && `${system} | ${version || ''}`}
          </span>
        </div>
      ) : (
        <div className="flex items-center">
          <span className="inline-block w-2 h-2 rounded-full mr-1 bg-red-500"></span>
          <span className="text-red-400">Disconnected</span>
          {error && <span className="ml-2 text-red-300 text-xs">{error}</span>}
        </div>
      )}
    </div>
  );
};

export default StatusIndicator;
