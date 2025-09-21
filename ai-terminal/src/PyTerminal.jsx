import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBackend } from './BackendContext';
import StatusIndicator from './StatusIndicator';
import FileExplorer from './FileExplorer';

const getHelpOutput = () => `
PyTerminal Help:
────────────────
A modern terminal with AI-powered natural language queries.

[Core Commands]
  ls [path]         List directory contents
  cd [path]         Change the current directory
  pwd               Print current working directory
  mkdir [name]      Create a new directory
  rm [-r] [path]    Remove a file or directory
  clear             Clear the terminal screen

[System Monitoring]
  cpu               Show current CPU usage
  mem               Show current memory usage
  ps                List running processes

[Features]
  ▶ AI Mode:        Type what you want to do in plain English.
  ▶ Conversational: AI remembers context from previous commands.
  ▶ History:        Use Up/Down arrows to navigate command history.
  ▶ Search History: Press Ctrl+R to search command history.
  ▶ Auto-Complete:  Press Tab to complete commands or file paths.
  ▶ Palette:        Press Ctrl+Shift+P to open the command palette.
  ▶ File Explorer:  Browse and interact with files in the sidebar (Ctrl+B).
  ▶ Themes:         Change visual appearance via Command Palette (Ctrl+Shift+P).
`;


const HeaderBar = ({ tabs, activeTabId, setActiveTabId, addTab, closeTab }) => (
    <div className="flex-shrink-0 h-11 border-b border-[var(--border-color)] flex items-center justify-between pl-4 bg-bg-primary rounded-t-xl">
        <div className="flex items-center">
            <div className="flex items-center space-x-2 mr-4">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <div className="flex items-end h-full" role="tablist">
                {tabs.map(tab => (
                    <div 
                        key={tab.id} 
                        onClick={() => setActiveTabId(tab.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setActiveTabId(tab.id);
                            }
                        }}
                        role="tab"
                        aria-selected={tab.id === activeTabId}
                        tabIndex={tab.id === activeTabId ? 0 : -1}
                        className={`flex items-center px-4 h-full border-r border-[var(--border-color)] cursor-pointer transition-colors duration-200 
                          ${tab.id === activeTabId ? 'tab-active' : 'tab-inactive'}
                          focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-blue`}
                    >
                        <span className="text-sm">{tab.title}</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    closeTab(tab.id);
                                }
                                e.stopPropagation();
                            }}
                            className="ml-3 text-text-muted hover:text-text-primary focus:outline-none focus:text-text-primary"
                            aria-label={`Close ${tab.title} tab`}
                        >×</button>
                    </div>
                ))}
                <button 
                    onClick={addTab} 
                    className="px-3 h-full text-2xl text-text-muted hover:bg-bg-secondary hover:text-text-primary transition-colors duration-200 focus:outline-none focus:text-text-primary focus:bg-bg-secondary"
                    aria-label="Add new tab"
                >+</button>
            </div>
        </div>
    </div>
);


const TerminalOutput = React.forwardRef(({ output, isLoading }, ref) => {
    const renderOutputLine = (line, index) => {
        if (line.type === 'prompt') {
            const promptSymbol = (
                <div className="flex-shrink-0">
                    <span className="text-accent-green">user@pyterminal</span><span className="text-text-secondary">:</span>
                    <span className="text-accent-purple">{line.path === '~' ? '~' : (line.path.split(/[\\/]/).pop() || '/')}</span>
                    <span className="text-accent-blue font-semibold"> ❯ </span>
                </div>
            );
            return (
                <div key={index} className="animate-slide-up"><div className="flex">{promptSymbol}<span className="pl-2">{line.content}</span></div></div>
            );
        }
        if (line.type === 'response' && line.content.includes("🤖 AI translated to:")) {
            const parts = line.content.split('`');
            return (
                <div key={index} className="animate-slide-up text-text-muted italic">
                    {parts[0]}<code className="text-accent-amber not-italic bg-black/50 px-1.5 py-0.5 rounded-md">{parts[1]}</code>
                    <div className="whitespace-pre-wrap text-text-primary not-italic">{parts[2] || ''}</div>
                </div>
            )
        }
        return (
            <div key={index} className="animate-slide-up">
                {line.type === 'response' && <div className="whitespace-pre-wrap text-text-primary">{line.content}</div>}
                {line.type === 'error' && <div className="text-red-500">Error: {line.content}</div>}
                {line.type === 'system' && <div className="text-accent-blue">{line.content}</div>}
            </div>
        );
    };

    const LoadingIndicator = () => (
        <div className="flex items-center space-x-1.5 pl-2" aria-label="Processing command" role="status">
            <div className="h-2 w-2 rounded-full bg-accent-blue animate-dot-fade" style={{ animationDelay: '0ms' }}></div>
            <div className="h-2 w-2 rounded-full bg-accent-blue animate-dot-fade" style={{ animationDelay: '200ms' }}></div>
            <div className="h-2 w-2 rounded-full bg-accent-blue animate-dot-fade" style={{ animationDelay: '400ms' }}></div>
            <span className="sr-only">Command processing...</span>
        </div>
    );

    return (
        <div 
            ref={ref} 
            className="flex-grow p-4 overflow-y-auto space-y-3 text-sm md:text-base font-mono"
            aria-live="polite"
            role="log"
        >
            {output.map(renderOutputLine)}
            {isLoading && <div className="pt-2"><LoadingIndicator /></div>}
        </div>
    );
});
const AutocompleteDropdown = ({ suggestions, selectedIndex, onSelect, onClose }) => {
    if (!suggestions || suggestions.length === 0) return null;

    return (
        <div 
            className="absolute bottom-full left-0 right-0 mb-1 bg-bg-secondary border border-[var(--border-color)] rounded-lg shadow-lg max-h-48 overflow-y-auto z-10"
            role="listbox"
            aria-label="Command suggestions"
        >
            {suggestions.map((suggestion, index) => (
                <div
                    key={index}
                    className={`px-3 py-2 cursor-pointer font-mono text-sm ${
                        index === selectedIndex 
                            ? 'bg-accent-blue/20 text-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue' 
                            : 'text-text-primary hover:bg-white/5'
                    }`}
                    onClick={() => onSelect(suggestion)}
                    role="option"
                    aria-selected={index === selectedIndex}
                    tabIndex={index === selectedIndex ? 0 : -1}
                >
                    {suggestion}
                </div>
            ))}
        </div>
    );
};
const SearchPrompt = ({ searchTerm, onSearchChange, onKeyDown, onClose }) => {
    return (
        <div 
            className="absolute bottom-full left-0 right-0 mb-1 bg-bg-secondary border border-accent-blue rounded-lg shadow-lg p-2 z-10"
            role="search"
        >
            <div className="flex items-center">
                <span className="text-accent-blue font-mono text-sm mr-2">(reverse-i-search)</span>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    className="flex-grow bg-transparent border-none outline-none font-mono text-text-primary focus:ring-1 focus:ring-accent-blue focus:ring-opacity-50"
                    placeholder="Search command history..."
                    aria-label="Search command history"
                    autoFocus
                />
                <button
                    onClick={onClose}
                    className="ml-2 text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-hover"
                    aria-label="Close search"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};


const CommandLine = React.forwardRef(({ 
    isLoading, 
    currentPath, 
    onKeyDown, 
    autocompleteSuggestions, 
    selectedAutocompleteIndex,
    onAutocompleteSelect,
    onAutocompleteClose,
    isSearching,
    searchTerm,
    onSearchChange,
    onSearchKeyDown,
    onSearchClose
}, ref) => {
    // Handle click on command line to ensure focus goes to input
    const handleContainerClick = () => {
        ref.current?.focus();
    };

    return (
        <div 
            className="flex-shrink-0 p-2 border-t border-[var(--border-color)] focus-within:border-accent-blue transition-colors duration-300 relative"
            onClick={handleContainerClick}
            role="textbox"
            aria-label="Terminal input"
        >
            {/* Autocomplete Dropdown */}
            <AutocompleteDropdown
                suggestions={autocompleteSuggestions}
                selectedIndex={selectedAutocompleteIndex}
                onSelect={onAutocompleteSelect}
                onClose={onAutocompleteClose}
            />
            
            {/* Search Prompt */}
            {isSearching && (
                <SearchPrompt
                    searchTerm={searchTerm}
                    onSearchChange={onSearchChange}
                    onKeyDown={onSearchKeyDown}
                    onClose={onSearchClose}
                />
            )}
            
           <div className="flex items-center">
                <div className="flex-shrink-0 font-mono">
                    <span className="text-accent-green">user@pyterminal</span><span className="text-text-secondary">:</span>
                    <span className="text-accent-purple">{currentPath === '~' ? '~' : (currentPath.split(/[\\/]/).pop() || '/')}</span>
                    <span className="text-accent-blue font-semibold"> ❯ </span>
                </div>
                <input
                    ref={ref}
                    type="text"
                    className="flex-grow bg-transparent border-none outline-none pl-2 font-mono text-text-primary focus:ring-1 focus:ring-accent-blue focus:ring-opacity-50"
                    onKeyDown={onKeyDown}
                    disabled={isLoading}
                    autoComplete="off"
                    autoCorrect="off" 
                    autoCapitalize="off"
                    spellCheck="false"
                    aria-label="Command input"
                    aria-disabled={isLoading}
                    autoFocus
                />
                <span className={`w-2.5 h-5 bg-text-primary ${!isLoading ? 'cursor-blink' : ''}`}></span>
            </div>
        </div>
    );
});


const CommandPalette = ({ isOpen, onClose, commands }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef(null);

    const filteredCommands = commands.filter(cmd => cmd.label.toLowerCase().includes(searchTerm.toLowerCase()));

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setActiveIndex(0);
            setSearchTerm('');
        }
    }, [isOpen]);

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter') {
            if (filteredCommands[activeIndex]) {
                filteredCommands[activeIndex].action();
                onClose();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };
    
    if (!isOpen) return null;

    // Check if an item is a theme
    const isThemeItem = (cmd) => cmd.id.startsWith('theme-');
    const isThemeDivider = (cmd) => cmd.id === 'theme-divider';

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-start pt-20" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
        >
            <div className="w-full max-w-lg bg-bg-secondary rounded-lg shadow-2xl border border-[var(--border-color)]" onClick={e => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search commands..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent p-4 border-b border-[var(--border-color)] outline-none text-text-primary focus:ring-2 focus:ring-accent-blue focus:ring-opacity-50"
                    aria-label="Search commands"
                    autoFocus
                />
                <ul role="listbox" aria-label="Available commands">
                    {filteredCommands.length > 0 ? filteredCommands.map((cmd, index) => {
                        if (isThemeDivider(cmd)) {
                            return (
                                <li key={cmd.id} className="text-text-muted text-xs uppercase px-3 py-2 border-t border-[var(--border-color)]" role="presentation">
                                    Theme Selection
                                </li>
                            );
                        }
                        
                        return (
                            <li key={cmd.id} 
                                onMouseDown={() => { cmd.action(); onClose(); }}
                                className={`p-3 cursor-pointer ${
                                    index === activeIndex 
                                        ? 'bg-accent-blue/20' 
                                        : 'hover:bg-white/5'
                                } ${
                                    isThemeItem(cmd) ? 'flex items-center' : ''
                                }`}
                                role="option"
                                aria-selected={index === activeIndex}
                                tabIndex={index === activeIndex ? 0 : -1}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        cmd.action();
                                        onClose();
                                    }
                                }}
                            >
                                {isThemeItem(cmd) && (
                                    <div 
                                        className="w-4 h-4 rounded-full mr-2 border border-[var(--border-color)] overflow-hidden"
                                        style={{
                                            background: cmd.id === 'theme-premium-dark' ? '#0f0f0f' : 
                                                      cmd.id === 'theme-solarized-light' ? '#fdf6e3' :
                                                      cmd.id === 'theme-matrix' ? '#000000' :
                                                      cmd.id === 'theme-cyberpunk' ? '#0d0221' : 
                                                      cmd.id === 'theme-nord' ? '#2e3440' : '#0f0f0f'
                                        }}
                                    >
                                        <div className="h-2 w-4" style={{
                                            background: cmd.id === 'theme-premium-dark' ? '#00d4ff' : 
                                                      cmd.id === 'theme-solarized-light' ? '#268bd2' :
                                                      cmd.id === 'theme-matrix' ? '#00ff00' :
                                                      cmd.id === 'theme-cyberpunk' ? '#f6019d' : 
                                                      cmd.id === 'theme-nord' ? '#88c0d0' : '#00d4ff'
                                        }}></div>
                                    </div>
                                )}
                                {cmd.label}
                            </li>
                        );
                    }) : <li className="p-4 text-text-muted">No commands found.</li>}
                </ul>
            </div>
        </div>
    );
};


export default function App() {

    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [tabs, setTabs] = useState(() => {
        try {
            const savedSession = localStorage.getItem('pyterminal-session');
            return savedSession ? JSON.parse(savedSession) : [{ id: Date.now(), title: 'bash', output: [], history: [], historyIndex: 0, currentPath: '~' }];
        } catch (e) {
            console.error("Failed to parse session from localStorage", e);
            return [{ id: Date.now(), title: 'bash', output: [], history: [], historyIndex: 0, currentPath: '~' }];
        }
    });

    const [activeTabId, setActiveTabId] = useState(tabs[0].id);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [activeProcess, setActiveProcess] = useState(null);

    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchIndex, setSearchIndex] = useState(0);
    
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
    const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    
    // File explorer state
    const [showSidebar, setShowSidebar] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    
    // Theme state
    const [currentTheme, setCurrentTheme] = useState(() => {
        try {
            const savedTheme = localStorage.getItem('pyterminal-theme');
            return savedTheme || 'premium-dark';
        } catch (e) {
            console.error("Failed to load theme from localStorage", e);
            return 'premium-dark';
        }
    });

    const inputRef = useRef(null);
    const terminalBodyRef = useRef(null);
    
    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
    
    // Import socket from BackendContext
    const { socket, socketConnected } = useBackend();
    
    // Socket event listeners
    useEffect(() => {
        if (!socket) return;
        
        // Listen for command output
        socket.on('command_output', (data) => {
            console.log('Command output received:', data);
            if (!data) return;
            
            setTabState(activeTabId, prev => {
                const updatedOutput = [...prev.output];
                
                // Find if we already have a response line we can append to
                const lastIndex = updatedOutput.length - 1;
                const lastLine = lastIndex >= 0 ? updatedOutput[lastIndex] : null;
                
                if (lastLine && lastLine.type === 'response' && lastLine.processId === data.process_id) {
                    // Append to existing output
                    updatedOutput[lastIndex] = {
                        ...lastLine,
                        content: lastLine.content + '\n' + data.output
                    };
                } else if (data.output) {
                    // Add new line
                    updatedOutput.push({
                        type: data.is_error ? 'error' : 'response',
                        content: data.output,
                        processId: data.process_id
                    });
                }
                
                if (data.finished) {
                    setIsLoading(false);
                    setActiveProcess(null);
                    
                    // Update path if provided
                    if (data.new_path) {
                        return { 
                            ...prev, 
                            output: updatedOutput,
                            currentPath: data.new_path 
                        };
                    }
                }
                
                return { ...prev, output: updatedOutput };
            });
        });
        
        // Listen for command started
        socket.on('command_started', (data) => {
            console.log('Command started:', data);
            setActiveProcess(data.process_id);
        });
        
        // Clean up listeners
        return () => {
            socket.off('command_output');
            socket.off('command_started');
        };
    }, [socket, activeTabId]);

    useEffect(() => {
        try {
            localStorage.setItem('pyterminal-session', JSON.stringify(tabs));
        } catch (e) {
            console.error("Failed to save session to localStorage", e);
        }
    }, [tabs]);
    
    // Global keyboard shortcuts
    useEffect(() => {
        const handler = (e) => {
            // Only handle global shortcuts if not in a focused input field (except for ESC)
            const isInInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            
            // Command palette with Ctrl+Shift+P
            if (e.key === 'p' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                e.preventDefault();
                setIsPaletteOpen(prev => !prev);
                
                // Focus input field when palette closes
                if (isPaletteOpen) {
                    setTimeout(() => inputRef.current?.focus(), 50);
                }
            }

            // Search history with Ctrl+R
            if (e.key === 'r' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                e.preventDefault();
                if (!isSearching) {
                    setIsSearching(true);
                    setSearchTerm('');
                    setSearchResults([]);
                    setSearchIndex(0);
                }
            }
            
            // Toggle sidebar with Ctrl+B
            if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setShowSidebar(prev => !prev);
                
                // Return focus to input when toggling sidebar
                setTimeout(() => inputRef.current?.focus(), 50);
            }
            
            // Make Escape always return focus to main input
            if (e.key === 'Escape' && !isPaletteOpen && !isSearching) {
                inputRef.current?.focus();
            }
        };
        
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isSearching, isPaletteOpen]);

    // Keep terminal scrolled to bottom and focus input field when output changes
    useEffect(() => {
        if (terminalBodyRef.current) {
            terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
        }
        // Refocus input after command completes
        if (!isLoading) {
            inputRef.current?.focus();
        }
    }, [activeTab?.output, isLoading]);

    // Focus input when tab changes
    useEffect(() => {
        inputRef.current?.focus();
    }, [activeTabId]);


    const setTabState = useCallback((id, updates) => {
        setTabs(prevTabs =>
            prevTabs.map(tab => (tab.id === id ? { ...tab, ...updates } : tab))
        );
    }, []);

    const addTab = useCallback(() => {
        const newTab = { id: Date.now(), title: 'bash', output: [{ type: 'system', content: 'New session started.' }], history: [], historyIndex: 0, currentPath: '~' };
        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(newTab.id);
    }, []);

    const closeTab = useCallback((idToClose) => {
        setTabs(prevTabs => {
            if (prevTabs.length <= 1) return prevTabs;
            const tabIndex = prevTabs.findIndex(t => t.id === idToClose);
            let newActiveId = activeTabId;
            if (idToClose === activeTabId) {
                newActiveId = tabIndex > 0 ? prevTabs[tabIndex - 1].id : prevTabs[tabIndex + 1].id;
            }
            setActiveTabId(newActiveId);
            return prevTabs.filter(t => t.id !== idToClose);
        });
    }, [activeTabId]);
    
    const clearActiveTab = useCallback(() => {
        setTabState(activeTabId, { output: [] });
    }, [activeTabId, setTabState]);

    // Theme definitions with descriptions
    const themes = {
        'premium-dark': { label: 'Premium Dark', description: 'Default dark theme with blue accents' },
        'solarized-light': { label: 'Solarized Light', description: 'High contrast light theme with blue and amber accents' },
        'matrix': { label: 'Matrix', description: 'Classic green-on-black hacker theme' },
        'cyberpunk': { label: 'Cyberpunk', description: 'Neon lights with vibrant pinks and blues' },
        'nord': { label: 'Nord', description: 'Arctic, bluish color palette' }
    };

    // Handle theme changes
    const changeTheme = (themeKey) => {
        setCurrentTheme(themeKey);
        try {
            localStorage.setItem('pyterminal-theme', themeKey);
        } catch (e) {
            console.error("Failed to save theme to localStorage", e);
        }
    };

    // Generate theme command entries
    const themeCommands = Object.entries(themes).map(([key, theme]) => ({
        id: `theme-${key}`,
        label: `Theme: ${theme.label}`,
        action: () => changeTheme(key)
    }));
    
    const paletteCommands = [
        { id: 'new-tab', label: 'New Tab', action: addTab },
        { id: 'close-tab', label: 'Close Current Tab', action: () => closeTab(activeTabId) },
        { id: 'clear-terminal', label: 'Clear Terminal', action: clearActiveTab },
        { id: 'toggle-sidebar', label: `${showSidebar ? 'Hide' : 'Show'} File Explorer`, action: () => setShowSidebar(prev => !prev) },
        { id: 'theme-divider', label: '--- Themes ---', action: () => {} },
        ...themeCommands
    ];

    // Get the backend URL from context
    const { backendUrl, isConnected, aiEnabled } = useBackend();
    
    const sendCommandToServer = async (command, currentOutput) => {
        setIsError(false);
        
        // Check if backend is connected
        if (!isConnected) {
            const errorOutput = [...currentOutput, { 
                type: 'error', 
                content: "⚠️ Backend server is not connected. Please check your network connection and server status."
            }];
            setTabState(activeTabId, { output: errorOutput });
            setIsError(true);
            setTimeout(() => setIsError(false), 500);
            return;
        }
        
        // Use WebSockets if available, otherwise fall back to REST API
        if (socket && socketConnected) {
            console.log('Using socket for command execution');
            socket.emit('execute_command', {
                command,
                path: activeTab.currentPath,
                sessionId: activeTabId.toString()
            });
            
            // Note: The socket listeners will update the UI with output
            return;
        }
        
        // Fallback to REST API
        try {
            console.log(`Sending command to backend via REST API at ${backendUrl}`);
            const response = await fetch(`${backendUrl}/command`, {
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' },
              credentials: 'omit', // Avoid CORS issues with credentials
              body: JSON.stringify({ 
                command, 
                path: activeTab.currentPath,
                sessionId: activeTabId.toString()
              }),
            });
            if (!response.ok) {
                let errorText = `Server error: ${response.status}`;
                try {
                    // Try to get more details from the error response
                    const errorData = await response.json();
                    if (errorData && errorData.error) {
                        errorText = errorData.error;
                    }
                } catch (e) {
                    // If we can't parse JSON, use the status text
                    errorText = `Server error: ${response.statusText || response.status}`;
                }
                throw new Error(errorText);
            }
            
            const data = await response.json();

            const newPath = data.new_path || activeTab.currentPath;
            let finalOutput = currentOutput;
            if (data.error) {
                finalOutput = [...currentOutput, { type: 'error', content: data.error }];
                setIsError(true);
                setTimeout(() => setIsError(false), 500);
            } else if (data.output !== null && data.output !== undefined) {
                finalOutput = [...currentOutput, { type: 'response', content: data.output }];
            }
            setTabState(activeTabId, { output: finalOutput, currentPath: newPath });
        } catch (error) {
            const errorMessage = error.message || "Connection Error: Is the Python server running?";
            console.error("API request failed:", error);
            const errorOutput = [...currentOutput, { type: 'error', content: errorMessage }];
            setTabState(activeTabId, { output: errorOutput });
            setIsError(true);
            setTimeout(() => setIsError(false), 500);
        }
    };

    // Function to cancel the current command
    const cancelCommand = () => {
        if (!activeProcess || !socket || !socketConnected) return;
        
        console.log('Cancelling command:', activeProcess);
        socket.emit('cancel_command', { process_id: activeProcess });
    };
    
    const executeCommand = async (command, originalText) => {
        // Always ensure focus returns to input after command execution
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
        
        // Cancel existing command if Ctrl+C is pressed
        if (originalText === '^C' && activeProcess) {
            cancelCommand();
            return;
        }
        
        let commandToRun = command;
         if (originalText === '!!') {
            if (activeTab.history.length > 0) {
                commandToRun = activeTab.history[activeTab.history.length - 1];
            } else {
                const errorOutput = [...activeTab.output, { type: 'prompt', content: '!!', path: activeTab.currentPath }, { type: 'error', content: 'No commands in history.' }];
                setTabState(activeTabId, { output: errorOutput });
                return;
            }
        }

        const newOutput = [...activeTab.output, { type: 'prompt', content: originalText, path: activeTab.currentPath }];
        
        if (commandToRun) {
            if (originalText === '!!') newOutput.push({ type: 'system', content: `Executing: ${commandToRun}` });

            const newHistory = [...activeTab.history, commandToRun];
            const newHistoryIndex = newHistory.length;

            if (commandToRun.toLowerCase() === 'clear') {
                setTabState(activeTabId, { output: [], history: newHistory, historyIndex: newHistoryIndex });
            } else if (commandToRun.toLowerCase() === 'help') {
                const helpOutput = [...newOutput, { type: 'response', content: getHelpOutput() }];
                setTabState(activeTabId, { output: helpOutput, history: newHistory, historyIndex: newHistoryIndex });
            } else {
                setTabState(activeTabId, { output: newOutput, history: newHistory, historyIndex: newHistoryIndex });
                setIsLoading(true);
                await sendCommandToServer(commandToRun, newOutput);
                setIsLoading(false);
            }
        } else {
            setTabState(activeTabId, { output: newOutput });
        }
    }
    

    const handleAutocomplete = async (text) => {
        if (!text) {
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/autocomplete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                text, 
                path: activeTab.currentPath,
                sessionId: activeTabId.toString()
              }),
            });
            const data = await response.json();
            if (data.suggestions && data.suggestions.length > 0) {
                setAutocompleteSuggestions(data.suggestions);
                setSelectedAutocompleteIndex(0);
                setShowAutocomplete(true);
            } else {
                setAutocompleteSuggestions([]);
                setShowAutocomplete(false);
            }
        } catch (error) {
            console.error("Autocomplete error:", error);
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
        }
    };


    const searchCommandHistory = (searchText) => {
        if (!searchText) {
            setSearchResults([]);
            return;
        }
        
        const results = activeTab.history
            .slice()
            .reverse()
            .filter(cmd => cmd.toLowerCase().includes(searchText.toLowerCase()));
        
        setSearchResults(results);
        setSearchIndex(0);
    };


    const handleSearchKeyDown = (e) => {
        if (e.key === 'Escape') {
            setIsSearching(false);
            setSearchTerm('');
            setSearchResults([]);
            inputRef.current?.focus();
        } else if (e.key === 'Enter') {
            if (searchResults.length > 0) {
                const selectedCommand = searchResults[searchIndex];
                inputRef.current.value = selectedCommand;
                setIsSearching(false);
                setSearchTerm('');
                setSearchResults([]);
                inputRef.current?.focus();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSearchIndex(prev => Math.max(0, prev - 1));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSearchIndex(prev => Math.min(searchResults.length - 1, prev + 1));
        }
    };


    const handleAutocompleteSelect = (suggestion) => {
        if (!inputRef.current) return;
        const text = inputRef.current.value;
        const parts = text.split(' ');
        parts[parts.length - 1] = suggestion;
        inputRef.current.value = parts.join(' ');
        setShowAutocomplete(false);
        setAutocompleteSuggestions([]);
        inputRef.current?.focus();
    };

    // NEW: Handle autocomplete navigation
    const handleAutocompleteNavigation = (direction) => {
        if (autocompleteSuggestions.length === 0) return;
        
        if (direction === 'up') {
            setSelectedAutocompleteIndex(prev => 
                prev > 0 ? prev - 1 : autocompleteSuggestions.length - 1
            );
        } else if (direction === 'down') {
            setSelectedAutocompleteIndex(prev => 
                prev < autocompleteSuggestions.length - 1 ? prev + 1 : 0
            );
        }
    };

    const handleKeyDown = async (event) => {
        // Don't handle keys when searching
        if (isSearching) return;
        
        // Handle Ctrl+C to cancel commands
        if (event.key === 'c' && event.ctrlKey && isLoading && activeProcess) {
            event.preventDefault();
            const output = [...activeTab.output, { type: 'prompt', content: '^C', path: activeTab.currentPath }];
            setTabState(activeTabId, { output });
            await executeCommand('^C', '^C');
            return;
        }
        
        if (event.key === 'Enter' && !isLoading) {
            event.preventDefault();
            const commandToExecute = inputRef.current.value.trim();
            inputRef.current.value = '';
            setShowAutocomplete(false);
            setAutocompleteSuggestions([]);
            await executeCommand(commandToExecute, commandToExecute);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (showAutocomplete && autocompleteSuggestions.length > 0) {
                handleAutocompleteNavigation('up');
            } else if (activeTab.history.length === 0) {
                return;
            } else {
                const newIndex = Math.max(0, activeTab.historyIndex - 1);
                inputRef.current.value = activeTab.history[newIndex];
                setTabState(activeTabId, { historyIndex: newIndex });
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (showAutocomplete && autocompleteSuggestions.length > 0) {
                handleAutocompleteNavigation('down');
            } else if (activeTab.historyIndex < activeTab.history.length - 1) {
                const newIndex = activeTab.historyIndex + 1;
                inputRef.current.value = activeTab.history[newIndex];
                setTabState(activeTabId, { historyIndex: newIndex });
            } else {
                inputRef.current.value = '';
                setTabState(activeTabId, { historyIndex: activeTab.history.length });
            }
        } else if (event.key === 'Tab') {
            event.preventDefault();
            if (showAutocomplete && autocompleteSuggestions.length > 0) {
                // Select the currently highlighted suggestion
                handleAutocompleteSelect(autocompleteSuggestions[selectedAutocompleteIndex]);
            } else {
                // Trigger autocomplete
                const text = inputRef.current.value;
                await handleAutocomplete(text);
            }
        } else if (event.key === 'Escape') {
            // Close autocomplete dropdown
            setShowAutocomplete(false);
            setAutocompleteSuggestions([]);
        } else {
            // Handle regular typing - trigger autocomplete after a delay
            const text = inputRef.current.value;
            if (text.length > 0) {
                // Debounce autocomplete requests
                clearTimeout(window.autocompleteTimeout);
                window.autocompleteTimeout = setTimeout(() => {
                    handleAutocomplete(text);
                }, 300);
            } else {
                setShowAutocomplete(false);
                setAutocompleteSuggestions([]);
            }
        }
    };

    // NEW: Handle search term changes
    const handleSearchChange = (newSearchTerm) => {
        setSearchTerm(newSearchTerm);
        searchCommandHistory(newSearchTerm);
    };

    // NEW: Close search mode
    const handleSearchClose = () => {
        setIsSearching(false);
        setSearchTerm('');
        setSearchResults([]);
        inputRef.current?.focus();
    };
    
    // File explorer handlers
    const handleFileSelect = (file) => {
        setSelectedFile(file);
        if (!file.is_dir) {
            // If file is selected, perform action (e.g., view file content)
            executeCommand(`cat "${file.path}"`, `cat "${file.path}"`);
        } else {
            // If directory is selected, change directory
            executeCommand(`cd "${file.path}"`, `cd "${file.path}"`);
        }
        
        // Ensure focus returns to the terminal input after file interaction
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleFileAction = (file, action) => {
        switch (action) {
            case 'open':
                if (!file.is_dir) {
                    executeCommand(`cat "${file.path}"`, `cat "${file.path}"`);
                } else {
                    executeCommand(`cd "${file.path}"`, `cd "${file.path}"`);
                }
                break;
            case 'explore':
                if (file.is_dir) {
                    executeCommand(`cd "${file.path}"`, `cd "${file.path}"`);
                }
                break;
            case 'copy-path':
                navigator.clipboard.writeText(file.path);
                break;
            case 'create-file':
                if (file.is_dir) {
                    const filename = prompt('Enter filename:');
                    if (filename) {
                        executeCommand(`touch "${file.path}/${filename}"`, `touch "${file.path}/${filename}"`);
                    }
                }
                break;
            case 'create-folder':
                if (file.is_dir) {
                    const dirname = prompt('Enter folder name:');
                    if (dirname) {
                        executeCommand(`mkdir "${file.path}/${dirname}"`, `mkdir "${file.path}/${dirname}"`);
                    }
                }
                break;
            case 'delete':
                if (confirm(`Are you sure you want to delete ${file.name}?`)) {
                    if (file.is_dir) {
                        executeCommand(`rm -r "${file.path}"`, `rm -r "${file.path}"`);
                    } else {
                        executeCommand(`rm "${file.path}"`, `rm "${file.path}"`);
                    }
                }
                break;
            case 'rename':
                const newName = prompt('Enter new name:', file.name);
                if (newName && newName !== file.name) {
                    const parentDir = file.path.substring(0, file.path.lastIndexOf('/'));
                    executeCommand(`mv "${file.path}" "${parentDir}/${newName}"`, `mv "${file.path}" "${parentDir}/${newName}"`);
                }
                break;
            default:
                break;
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
                /* Theme variables are defined in index.css */
                .font-sans { font-family: 'Inter', sans-serif; } .font-mono { font-family: 'JetBrains Mono', monospace; } .text-accent-blue { color: var(--accent-blue); } .text-accent-green { color: var(--accent-green); } .text-text-primary { color: var(--text-primary); } .text-text-secondary { color: var(--text-secondary); } .text-text-muted { color: var(--text-muted); } .text-accent-purple { color: var(--accent-purple); } .bg-bg-primary { background-color: var(--bg-primary); } .bg-bg-secondary { background-color: var(--bg-secondary); } .tab-active { background-color: var(--bg-secondary); color: var(--text-primary); } .tab-inactive { background-color: var(--bg-primary); color: var(--text-secondary); }
                @keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-slide-up { animation: slide-up 0.3s ease-out; }
                @keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 0, 0); } 40%, 60% { transform: translate3d(4px, 0, 0); } } .shake-error { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
                @keyframes dot-fade { 0%, 80%, 100% { opacity: 0; } 40% { opacity: 1; } } .animate-dot-fade { animation: dot-fade 1.4s infinite ease-in-out both; }
                @keyframes cursor-blink { 50% { opacity: 0; } } .cursor-blink { animation: cursor-blink 1.2s step-end infinite; }
                ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; } ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
                .i-tabler-folder, .i-tabler-file, .i-tabler-brand-javascript, .i-tabler-brand-python, .i-tabler-markdown, .i-tabler-brackets, .i-tabler-brand-html5, .i-tabler-brand-css3, .i-tabler-photo, .i-tabler-folder-open, .i-tabler-file-plus, .i-tabler-folder-plus, .i-tabler-edit, .i-tabler-pencil, .i-tabler-trash, .i-tabler-clipboard, .i-tabler-refresh, .i-tabler-folder-off, .i-tabler-x, .i-tabler-alert-circle {
                    display: inline-block;
                    width: 1em;
                    height: 1em;
                    background-size: contain;
                    background-repeat: no-repeat;
                    background-position: center;
                }
                .i-tabler-folder { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2'%3E%3C/path%3E%3C/svg%3E"); }
                .i-tabler-file { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 3v4a1 1 0 0 0 1 1h4'%3E%3C/path%3E%3Cpath d='M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z'%3E%3C/path%3E%3C/svg%3E"); }
                .i-tabler-x { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='18' y1='6' x2='6' y2='18'%3E%3C/line%3E%3Cline x1='6' y1='6' x2='18' y2='18'%3E%3C/line%3E%3C/svg%3E"); }
                .i-tabler-refresh { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4'%3E%3C/path%3E%3Cpath d='M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'%3E%3C/path%3E%3C/svg%3E"); }
                .i-tabler-clipboard { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2'%3E%3C/path%3E%3Crect x='9' y='3' width='6' height='4' rx='2'%3E%3C/rect%3E%3C/svg%3E"); }
            `}</style>
            <div 
                className="bg-bg-primary min-h-screen flex items-center justify-center p-4 font-sans text-text-primary"
                data-theme={currentTheme !== 'premium-dark' ? currentTheme : null}
            >
                <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} commands={paletteCommands} />
                <div className={`w-full max-w-5xl h-[85vh] rounded-xl shadow-2xl flex flex-col transition-transform duration-500 ${isError ? 'shake-error' : ''} relative`}>
                    <StatusIndicator />
                    <HeaderBar tabs={tabs} activeTabId={activeTabId} setActiveTabId={setActiveTabId} addTab={addTab} closeTab={closeTab} />
                    <div className="flex-grow flex bg-bg-secondary rounded-b-xl overflow-hidden">
                        {/* File Explorer Sidebar */}
                        {showSidebar && (
                            <div className="w-64 h-full flex flex-col border-r border-[var(--border-color)]">
                                <div className="p-2 border-b border-[var(--border-color)] flex justify-between items-center">
                                    <span className="font-medium text-sm">FILES</span>
                                    <button 
                                        className="p-1 hover:bg-bg-hover rounded"
                                        onClick={() => setShowSidebar(false)}
                                        title="Close Sidebar"
                                    >
                                        <div className="i-tabler-x w-4 h-4" />
                                    </button>
                                </div>
                                <FileExplorer 
                                    onFileSelect={handleFileSelect}
                                    currentPath={activeTab?.currentPath || '~'}
                                    onFileAction={handleFileAction}
                                    onActionComplete={() => inputRef.current?.focus()} // Return focus to terminal input
                                />
                            </div>
                        )}
                        
                        {/* Terminal Area */}
                        // Terminal Area
                        <div 
                            className="flex-grow flex flex-col overflow-hidden"
                            onClick={() => inputRef.current?.focus()} // Focus input when clicking anywhere in terminal
                            onKeyDown={(e) => {
                                if (!isSearching && !isPaletteOpen && !e.target.closest('input')) {
                                    inputRef.current?.focus();
                                }
                            }}
                            role="application"
                            aria-label="Terminal"
                            tabIndex={-1} // Make container focusable but not in the tab order
                        >
                           <TerminalOutput ref={terminalBodyRef} output={activeTab?.output || []} isLoading={isLoading} />
                           <CommandLine 
                               ref={inputRef} 
                               isLoading={isLoading} 
                               currentPath={activeTab?.currentPath || '~'} 
                               onKeyDown={handleKeyDown}
                               autocompleteSuggestions={showAutocomplete ? autocompleteSuggestions : []}
                               selectedAutocompleteIndex={selectedAutocompleteIndex}
                               onAutocompleteSelect={handleAutocompleteSelect}
                               onAutocompleteClose={() => setShowAutocomplete(false)}
                               isSearching={isSearching}
                               searchTerm={searchTerm}
                               onSearchChange={handleSearchChange}
                               onSearchKeyDown={handleSearchKeyDown}
                               onSearchClose={handleSearchClose}
                           />
                           
                           {/* Status Bar */}
                           <div className="h-6 flex items-center px-4 py-1 bg-bg-secondary border-t border-[var(--border-color)]">
                               <div className="flex items-center text-xs">
                                   {socketConnected ? (
                                       <div className="flex items-center text-accent-green">
                                           <div className="w-1.5 h-1.5 bg-accent-green rounded-full mr-1"></div>
                                           WebSocket
                                       </div>
                                   ) : (
                                       <div className="flex items-center text-text-muted">
                                           <div className="w-1.5 h-1.5 bg-text-muted rounded-full mr-1"></div>
                                           HTTP
                                       </div>
                                   )}
                                   
                                   {aiEnabled && (
                                       <div className="flex items-center text-accent-purple ml-3">
                                           <div className="w-1.5 h-1.5 bg-accent-purple rounded-full mr-1"></div>
                                           AI
                                       </div>
                                   )}
                                   
                                   {/* Theme indicator */}
                                   <div className="flex items-center text-accent-blue ml-3">
                                       <div className="w-1.5 h-1.5 bg-accent-blue rounded-full mr-1"></div>
                                       {themes[currentTheme]?.label || 'Theme'}
                                   </div>
                               </div>
                               <div className="ml-auto text-xs text-text-muted">
                                   {showSidebar ? 'Ctrl+B to hide sidebar' : 'Ctrl+B to show sidebar'} | Ctrl+R to search history | Ctrl+Shift+P for command palette & themes
                               </div>
                           </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

