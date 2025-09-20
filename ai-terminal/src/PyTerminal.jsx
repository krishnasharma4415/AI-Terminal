import React, { useState, useEffect, useRef, useCallback } from 'react';
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
`;

// --- Child Component: HeaderBar ---
const HeaderBar = ({ tabs, activeTabId, setActiveTabId, addTab, closeTab }) => (
    <div className="flex-shrink-0 h-11 border-b border-[var(--border-color)] flex items-center justify-between pl-4 bg-bg-primary rounded-t-xl">
        <div className="flex items-center">
            <div className="flex items-center space-x-2 mr-4">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <div className="flex items-end h-full">
                {tabs.map(tab => (
                    <div key={tab.id} onClick={() => setActiveTabId(tab.id)}
                        className={`flex items-center px-4 h-full border-r border-[var(--border-color)] cursor-pointer transition-colors duration-200 ${tab.id === activeTabId ? 'tab-active' : 'tab-inactive'}`}>
                        <span className="text-sm">{tab.title}</span>
                        <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className="ml-3 text-text-muted hover:text-text-primary">×</button>
                    </div>
                ))}
                <button onClick={addTab} className="px-3 h-full text-2xl text-text-muted hover:bg-bg-secondary hover:text-text-primary transition-colors duration-200">+</button>
            </div>
        </div>
    </div>
);

// --- Child Component: TerminalOutput ---
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
        <div className="flex items-center space-x-1.5 pl-2">
            <div className="h-2 w-2 rounded-full bg-accent-blue animate-dot-fade" style={{ animationDelay: '0ms' }}></div>
            <div className="h-2 w-2 rounded-full bg-accent-blue animate-dot-fade" style={{ animationDelay: '200ms' }}></div>
            <div className="h-2 w-2 rounded-full bg-accent-blue animate-dot-fade" style={{ animationDelay: '400ms' }}></div>
        </div>
    );

    return (
        <div ref={ref} className="flex-grow p-4 overflow-y-auto space-y-3 text-sm md:text-base font-mono">
            {output.map(renderOutputLine)}
            {isLoading && <div className="pt-2"><LoadingIndicator /></div>}
        </div>
    );
});
const AutocompleteDropdown = ({ suggestions, selectedIndex, onSelect, onClose }) => {
    if (!suggestions || suggestions.length === 0) return null;

    return (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-bg-secondary border border-[var(--border-color)] rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
            {suggestions.map((suggestion, index) => (
                <div
                    key={index}
                    className={`px-3 py-2 cursor-pointer font-mono text-sm ${
                        index === selectedIndex 
                            ? 'bg-accent-blue/20 text-accent-blue' 
                            : 'text-text-primary hover:bg-white/5'
                    }`}
                    onClick={() => onSelect(suggestion)}
                >
                    {suggestion}
                </div>
            ))}
        </div>
    );
};
const SearchPrompt = ({ searchTerm, onSearchChange, onKeyDown, onClose }) => {
    return (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-bg-secondary border border-accent-blue rounded-lg shadow-lg p-2 z-10">
            <div className="flex items-center">
                <span className="text-accent-blue font-mono text-sm mr-2">(reverse-i-search)</span>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    className="flex-grow bg-transparent border-none outline-none font-mono text-text-primary"
                    placeholder="Search command history..."
                    autoFocus
                />
                <button
                    onClick={onClose}
                    className="ml-2 text-text-muted hover:text-text-primary"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

// --- Child Component: CommandLine ---
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
    return (
        <div className="flex-shrink-0 p-2 border-t border-[var(--border-color)] focus-within:border-accent-blue transition-colors duration-300 relative">
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
                    ref={ref} type="text"
                    className="flex-grow bg-transparent border-none outline-none pl-2 font-mono text-text-primary"
                    onKeyDown={onKeyDown}
                    disabled={isLoading}
                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
                />
                <span className={`w-2.5 h-5 bg-text-primary ${!isLoading ? 'cursor-blink' : ''}`}></span>
            </div>
        </div>
    );
});

// --- Child Component: CommandPalette ---
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

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-start pt-20" onClick={onClose}>
            <div className="w-full max-w-lg bg-bg-secondary rounded-lg shadow-2xl border border-[var(--border-color)]" onClick={e => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search commands..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent p-4 border-b border-[var(--border-color)] outline-none text-text-primary"
                />
                <ul>
                    {filteredCommands.length > 0 ? filteredCommands.map((cmd, index) => (
                        <li key={cmd.id} onMouseDown={() => { cmd.action(); onClose(); }}
                            className={`p-3 cursor-pointer ${index === activeIndex ? 'bg-accent-blue/20' : 'hover:bg-white/5'}`}>
                            {cmd.label}
                        </li>
                    )) : <li className="p-4 text-text-muted">No commands found.</li>}
                </ul>
            </div>
        </div>
    );
};

// --- Main App Component ---
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
    

    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchIndex, setSearchIndex] = useState(0);
    
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
    const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0);
    const [showAutocomplete, setShowAutocomplete] = useState(false);

    const inputRef = useRef(null);
    const terminalBodyRef = useRef(null);
    
    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
    

    useEffect(() => {
        try {
            localStorage.setItem('pyterminal-session', JSON.stringify(tabs));
        } catch (e) {
            console.error("Failed to save session to localStorage", e);
        }
    }, [tabs]);
    
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'p' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                e.preventDefault();
                setIsPaletteOpen(prev => !prev);
            }

            if (e.key === 'r' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                e.preventDefault();
                if (!isSearching) {
                    setIsSearching(true);
                    setSearchTerm('');
                    setSearchResults([]);
                    setSearchIndex(0);
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isSearching]);

    useEffect(() => {
        if (terminalBodyRef.current) {
            terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
        }
    }, [activeTab?.output]);

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

    const paletteCommands = [
        { id: 'new-tab', label: 'New Tab', action: addTab },
        { id: 'close-tab', label: 'Close Current Tab', action: () => closeTab(activeTabId) },
        { id: 'clear-terminal', label: 'Clear Terminal', action: clearActiveTab },
    ];

    const sendCommandToServer = async (command, currentOutput) => {
        setIsError(false);
        try {
            const response = await fetch('http://127.0.0.1:5000/command', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    command, 
                    path: activeTab.currentPath,
                    sessionId: activeTabId.toString()
                }),
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
            const errorMessage = "Connection Error: Is the Python server running?";
            const errorOutput = [...currentOutput, { type: 'error', content: errorMessage }];
            setTabState(activeTabId, { output: errorOutput });
            setIsError(true);
            setTimeout(() => setIsError(false), 500);
        }
    };

    const executeCommand = async (command, originalText) => {
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
            const response = await fetch('http://127.0.0.1:5000/autocomplete', {
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
    
    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
                :root { --bg-primary: #0f0f0f; --bg-secondary: #1a1a1a; --accent-blue: #00d4ff; --accent-green: #00ff88; --accent-amber: #ffab00; --accent-purple: #8b5cf6; --text-primary: #f8f9fa; --text-secondary: #a0a0a0; --text-muted: #666666; --border-color: rgba(255, 255, 255, 0.1); }
                .font-sans { font-family: 'Inter', sans-serif; } .font-mono { font-family: 'JetBrains Mono', monospace; } .text-accent-blue { color: var(--accent-blue); } .text-accent-green { color: var(--accent-green); } .text-text-primary { color: var(--text-primary); } .text-text-secondary { color: var(--text-secondary); } .text-text-muted { color: var(--text-muted); } .text-accent-purple { color: var(--accent-purple); } .bg-bg-primary { background-color: var(--bg-primary); } .bg-bg-secondary { background-color: var(--bg-secondary); } .tab-active { background-color: var(--bg-secondary); color: var(--text-primary); } .tab-inactive { background-color: var(--bg-primary); color: var(--text-secondary); }
                @keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-slide-up { animation: slide-up 0.3s ease-out; }
                @keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 0, 0); } 40%, 60% { transform: translate3d(4px, 0, 0); } } .shake-error { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
                @keyframes dot-fade { 0%, 80%, 100% { opacity: 0; } 40% { opacity: 1; } } .animate-dot-fade { animation: dot-fade 1.4s infinite ease-in-out both; }
                @keyframes cursor-blink { 50% { opacity: 0; } } .cursor-blink { animation: cursor-blink 1.2s step-end infinite; }
                ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; } ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
            `}</style>
            <div className="bg-bg-primary min-h-screen flex items-center justify-center p-4 font-sans text-text-primary">
                <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} commands={paletteCommands} />
                <div className={`w-full max-w-5xl h-[85vh] rounded-xl shadow-2xl flex flex-col transition-transform duration-500 ${isError ? 'shake-error' : ''}`}>
                    <HeaderBar tabs={tabs} activeTabId={activeTabId} setActiveTabId={setActiveTabId} addTab={addTab} closeTab={closeTab} />
                    <div className="flex-grow flex flex-col bg-bg-secondary rounded-b-xl overflow-hidden">
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
                    </div>
                </div>
            </div>
        </>
    );
}

