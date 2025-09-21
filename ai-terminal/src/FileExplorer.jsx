import React, { useState, useEffect } from 'react';
import { useBackend } from './BackendContext';

const FileIcon = ({ filename, isDirectory }) => {
  let iconClass = 'i-tabler-file';
  
  if (isDirectory) {
    iconClass = 'i-tabler-folder';
  } else {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        iconClass = 'i-tabler-brand-javascript';
        break;
      case 'py':
        iconClass = 'i-tabler-brand-python';
        break;
      case 'md':
        iconClass = 'i-tabler-markdown';
        break;
      case 'json':
        iconClass = 'i-tabler-brackets';
        break;
      case 'html':
      case 'htm':
        iconClass = 'i-tabler-brand-html5';
        break;
      case 'css':
        iconClass = 'i-tabler-brand-css3';
        break;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
        iconClass = 'i-tabler-photo';
        break;
      default:
        iconClass = 'i-tabler-file';
    }
  }

  return (
    <div className={`${iconClass} w-4 h-4 mr-2 shrink-0`}></div>
  );
};

// Individual file/folder item component
const FileItem = ({ file, depth, onSelect, onFileAction, isExpanded, onToggleExpand, currentPath }) => {
  const isActive = file.path === currentPath;
  const indentStyle = { paddingLeft: `${depth * 12}px` };

  return (
    <>
      <div 
        className={`flex items-center py-1 px-2 cursor-pointer hover:bg-bg-secondary text-sm group ${
          isActive ? 'bg-accent-blue/20 text-accent-blue' : ''
        }`}
        style={indentStyle}
        onClick={() => onSelect(file)}
        onContextMenu={(e) => {
          e.preventDefault();
          onFileAction(file, 'context-menu');
        }}
      >
        {file.is_dir && (
          <button 
            className="w-4 h-4 mr-1 flex items-center justify-center text-text-muted"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(file);
            }}
          >
            {isExpanded ? '▼' : '►'}
          </button>
        )}
        {!file.is_dir && <div className="w-4 mr-1" />}
        <FileIcon filename={file.name} isDirectory={file.is_dir} />
        <span className="truncate">{file.name}</span>
        <div className="ml-auto hidden group-hover:flex">
          <button 
            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onFileAction(file, 'copy-path');
            }}
            title="Copy Path"
          >
            <div className="i-tabler-clipboard w-4 h-4" />
          </button>
        </div>
      </div>
      
      {file.is_dir && isExpanded && file.children && file.children.map(child => (
        <FileItem 
          key={child.path}
          file={child}
          depth={depth + 1}
          onSelect={onSelect}
          onFileAction={onFileAction}
          isExpanded={false}
          onToggleExpand={onToggleExpand}
          currentPath={currentPath}
        />
      ))}
    </>
  );
};

const ContextMenu = ({ file, position, onAction, onClose }) => {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  if (!file) return null;

  const menuItems = [
    { id: 'open', label: 'Open', icon: 'i-tabler-file' },
    ...(file.is_dir ? [
      { id: 'explore', label: 'Explore', icon: 'i-tabler-folder-open' },
      { id: 'create-file', label: 'New File', icon: 'i-tabler-file-plus' },
      { id: 'create-folder', label: 'New Folder', icon: 'i-tabler-folder-plus' },
    ] : [
      { id: 'edit', label: 'Edit', icon: 'i-tabler-edit' },
    ]),
    { id: 'rename', label: 'Rename', icon: 'i-tabler-pencil' },
    { id: 'delete', label: 'Delete', icon: 'i-tabler-trash' },
    { id: 'copy-path', label: 'Copy Path', icon: 'i-tabler-clipboard' },
  ];

  return (
    <div 
      className="absolute z-50 w-48 bg-bg-secondary border border-[var(--border-color)] rounded-md shadow-lg py-1"
      style={{ top: position.y, left: position.x }}
      onClick={e => e.stopPropagation()}
    >
      {menuItems.map(item => (
        <div 
          key={item.id}
          className="flex items-center px-4 py-2 hover:bg-bg-hover cursor-pointer text-sm"
          onClick={() => onAction(file, item.id)}
        >
          <div className={`${item.icon} w-4 h-4 mr-2`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

// Main file explorer component
const FileExplorer = ({ onFileSelect, currentPath, onFileAction, onActionComplete }) => {
  const { backendUrl } = useBackend();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
  const [path, setPath] = useState('~');
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    file: null,
    position: { x: 0, y: 0 }
  });

  const fetchDirectory = async (dirPath = path) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${backendUrl}/api/files/list?path=${encodeURIComponent(dirPath)}&depth=1`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setFiles(data.files);
      setPath(data.path);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching directory:', err);
      setError(err.message || 'Failed to load files');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory(currentPath || '~');
  }, [currentPath]);

  const handleSelect = (file) => {
    if (file.is_dir) {
      toggleExpand(file);
    } else {
      onFileSelect(file);
      // Return focus to terminal input after selecting a file
      if (onActionComplete) {
        setTimeout(() => onActionComplete(), 100);
      }
    }
  };

  const toggleExpand = async (file) => {
    if (!file.is_dir) return;
    
    const isCurrentlyExpanded = expandedFolders.has(file.path);
    const newExpandedFolders = new Set(expandedFolders);
    
    if (isCurrentlyExpanded) {
      newExpandedFolders.delete(file.path);
    } else {
      newExpandedFolders.add(file.path);
      
      if (!file.children) {
        try {
          const response = await fetch(`${backendUrl}/api/files/list?path=${encodeURIComponent(file.path)}`);
          
          if (response.ok) {
            const data = await response.json();
            
            const updatedFiles = updateFileWithChildren(files, file.path, data.files);
            setFiles(updatedFiles);
          }
        } catch (err) {
          console.error('Error fetching subfolder:', err);
        }
      }
    }
    
    setExpandedFolders(newExpandedFolders);
  };

  const updateFileWithChildren = (fileList, filePath, children) => {
    return fileList.map(file => {
      if (file.path === filePath) {
        return { ...file, children };
      }
      if (file.children) {
        return { ...file, children: updateFileWithChildren(file.children, filePath, children) };
      }
      return file;
    });
  };

  const handleContextMenu = (file, action) => {
    if (action === 'context-menu') {
      const eventHandler = (e) => {
        e.preventDefault();
        setContextMenu({
          visible: true,
          file,
          position: { x: e.clientX, y: e.clientY }
        });
        document.removeEventListener('contextmenu', eventHandler);
      };
      document.addEventListener('contextmenu', eventHandler);
    } else {
      // Handle other actions
      onFileAction(file, action);
    }
  };

  const handleContextMenuAction = (file, action) => {
    onFileAction(file, action);
    setContextMenu({ ...contextMenu, visible: false });
    // Call onActionComplete callback to return focus to terminal
    if (onActionComplete) {
      setTimeout(() => onActionComplete(), 100);
    }
  };

  if (isLoading && files.length === 0) {
    return (
      <div className="p-4 text-text-muted text-sm">
        <div className="animate-pulse">Loading files...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 text-sm">
        <div className="i-tabler-alert-circle w-4 h-4 inline-block mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto text-text-primary">
      {/* Path breadcrumb */}
      <div className="px-4 py-2 border-b border-[var(--border-color)] bg-bg-primary flex items-center text-sm">
        <div className="i-tabler-folder w-4 h-4 mr-2" />
        <div className="truncate">{path}</div>
        <button 
          className="ml-auto p-1 hover:bg-bg-secondary rounded"
          onClick={() => fetchDirectory(path)}
          title="Refresh"
        >
          <div className="i-tabler-refresh w-4 h-4" />
        </button>
      </div>
      
      {/* File list */}
      <div className="overflow-auto">
        {files.length === 0 ? (
          <div className="p-4 text-text-muted text-sm">
            <div className="i-tabler-folder-off w-4 h-4 inline-block mr-2" />
            Empty directory
          </div>
        ) : (
          files.map(file => (
            <FileItem 
              key={file.path}
              file={file}
              depth={0}
              onSelect={handleSelect}
              onFileAction={handleContextMenu}
              isExpanded={expandedFolders.has(file.path)}
              onToggleExpand={toggleExpand}
              currentPath={currentPath}
            />
          ))
        )}
      </div>
      
      {/* Context menu */}
      {contextMenu.visible && (
        <ContextMenu 
          file={contextMenu.file}
          position={contextMenu.position}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
        />
      )}
    </div>
  );
};

export default FileExplorer;
