# Conversational AI Implementation

## Overview

The AI-terminal now features **contextual, conversational AI** that maintains session history and provides intelligent follow-up commands. This transforms the AI from a stateless command translator into a true conversational assistant.

## Key Features

### 🧠 **Session-Based Context Management**
- Each tab maintains its own conversation context
- Tracks the last 5 commands and their outputs
- Context persists throughout the session
- Separate contexts for different tabs

### 💬 **Conversational Intelligence**
- AI remembers previous commands and outputs
- Understands references like "count them", "show me more", "do the same thing"
- Provides intelligent follow-up commands based on context
- Maintains conversation flow across multiple interactions

## Technical Implementation

### Backend Architecture

#### Session Context Storage
```python
session_contexts = {
    'session_id': {
        'command_history': ['ls', 'pwd', 'mkdir test'],
        'output_history': ['file1.txt\nfile2.txt', '/home/user', 'Created directory: test'],
        'max_history': 5
    }
}
```

#### Contextual Prompt Building
```python
def build_contextual_prompt(natural_language_query, session_id):
    context = get_session_context(session_id)
    
    context_string = ""
    if context['command_history']:
        context_string = "\n\nRecent command history for context:\n"
        for i, (cmd, output) in enumerate(zip(context['command_history'], context['output_history'])):
            context_string += f"{i+1}. Command: {cmd}\n"
            if output and len(output) < 200:
                context_string += f"   Output: {output[:100]}{'...' if len(output) > 100 else ''}\n"
    
    return f"""
    You are an expert system administrator inside a Python-based command terminal.
    Your task is to convert a natural language request into a single, executable bash command.
    
    IMPORTANT: You have access to recent command history. Use this context to understand what the user is referring to.
    For example, if they say "count them" after listing files, you should count the files from the previous command.
    
    User Request: "{natural_language_query}"{context_string}
    
    Command:
    """
```

#### Context Updates
Every command execution updates the session context:
```python
def update_session_context(session_id, command, output):
    context = get_session_context(session_id)
    context['command_history'].append(command)
    context['output_history'].append(output)
    
    # Keep only the last max_history items
    if len(context['command_history']) > context['max_history']:
        context['command_history'] = context['command_history'][-context['max_history']:]
        context['output_history'] = context['output_history'][-context['max_history']:]
```

### Frontend Integration

#### Session ID Management
```javascript
// Send tab ID as session ID for context
body: JSON.stringify({ 
    command, 
    path: activeTab.currentPath,
    sessionId: activeTabId.toString() // Each tab has its own context
})
```

## Usage Examples

### Example 1: File Operations
```
User: "list all the python files"
AI: ls *.py
Output: app.py, main.py, utils.py

User: "now, count them"
AI: ls *.py | wc -l  (Uses context from previous ls command)
Output: 3
```

### Example 2: Directory Navigation
```
User: "show me what's in the current directory"
AI: ls
Output: Documents, Downloads, Pictures, Videos

User: "go into Documents"
AI: cd Documents
Output: Changed directory to /home/user/Documents

User: "what's here now?"
AI: ls  (Uses context that we're now in Documents)
Output: project1, project2, notes.txt
```

### Example 3: System Monitoring
```
User: "check my CPU usage"
AI: cpu
Output: CPU Usage: 15.2%

User: "and memory?"
AI: mem  (Uses context from previous system command)
Output: Memory: 8.5GB used out of 16GB (53.1%)
```

## API Endpoints

### Command Execution with Context
```http
POST /command
Content-Type: application/json

{
    "command": "count the files",
    "path": "/home/user",
    "sessionId": "tab-123"
}
```

### Context Inspection (for debugging)
```http
GET /context/{session_id}
```

Response:
```json
{
    "session_id": "tab-123",
    "context": {
        "command_history": ["ls", "pwd"],
        "output_history": ["file1.txt\nfile2.txt", "/home/user"],
        "max_history": 5
    },
    "message": "This shows the conversational AI context for this session"
}
```

## Configuration

### Environment Variables
```bash
# Required for AI features
GOOGLE_API_KEY=your_google_api_key_here

# Optional: Flask configuration
FLASK_ENV=development
FLASK_DEBUG=True
```

### Context Settings
```python
# In app.py
'max_history': 5  # Number of commands to keep in context
```

## Benefits

### 🎯 **Improved User Experience**
- Natural conversation flow
- Reduced need to repeat context
- More intuitive command interactions
- Professional assistant-like behavior

### 🚀 **Enhanced Productivity**
- Faster command execution
- Less typing required
- Context-aware suggestions
- Seamless workflow continuation

### 🧠 **Intelligent Understanding**
- References to previous outputs
- Contextual command generation
- Multi-step operation support
- Conversation memory

## Security Considerations

- Context is stored in-memory (resets on server restart)
- No sensitive data persisted
- Command validation still applies
- Session isolation maintained

## Future Enhancements

1. **Persistent Context**: Store context in Redis/database
2. **Cross-Session Learning**: Learn from user patterns
3. **Advanced Context**: Include file system state
4. **Multi-Modal Context**: Support for file contents, etc.

## Testing

To test the conversational AI:

1. **Start the servers**:
   ```bash
   python app.py
   cd ai-terminal && npm run dev
   ```

2. **Test conversation flow**:
   - Open the terminal at `http://localhost:5174`
   - Run: `ls`
   - Then run: `count the files` (should use context from ls)

3. **Check context**:
   ```bash
   curl http://127.0.0.1:5000/context/your-tab-id
   ```

## Conclusion

The conversational AI implementation transforms the AI-terminal from a simple command translator into an intelligent, context-aware assistant that remembers and builds upon previous interactions. This creates a more natural and productive user experience that matches modern AI assistant expectations.
