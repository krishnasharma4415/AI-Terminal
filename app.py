import os
import shutil
import psutil
import subprocess
import glob
import shlex
import platform
import re
import json
import time
from datetime import datetime
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS

try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Environment variables loaded from .env file")
except ImportError:
    print("⚠️  python-dotenv not installed. Using system environment variables only.")

# Detect operating system
IS_WINDOWS = platform.system().lower() == 'windows'

GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
if not GOOGLE_API_KEY:
    print("WARNING: GOOGLE_API_KEY environment variable not found. AI features will be disabled.")
    AI_ENABLED = False
    model = None
else:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        AI_ENABLED = True
        print("✅ Google AI initialized successfully!")
    except Exception as e:
        print(f"Error initializing Google AI: {e}. AI features disabled.")
        AI_ENABLED = False
        model = None

app = Flask(__name__)
CORS(app)

session_contexts = {}

BUILTIN_COMMANDS = ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cpu', 'mem', 'ps', 'help', 'clear'] + (['dir'] if IS_WINDOWS else [])

# Enhanced command patterns for better NLP understanding
COMMAND_PATTERNS = {
    'list_files': {
        'patterns': [
            r'(?:show|list|display|see|view)\s+(?:all\s+)?files?',
            r'(?:what\'?s|whats)\s+(?:in\s+)?(?:this\s+)?(?:folder|directory)',
            r'ls\s*(?:-la?)?',
            r'dir(?:\s+/a)?',
            r'(?:show|list)\s+contents?',
            r'(?:show|list)\s+everything'
        ],
        'windows_cmd': 'dir',
        'unix_cmd': 'ls -la',
        'description': 'List all files and directories'
    },
    'list_hidden': {
        'patterns': [
            r'(?:show|list|display)\s+hidden\s+files?',
            r'(?:show|list)\s+(?:all\s+)?files?\s+including\s+hidden',
            r'ls\s+-a',
            r'dir\s+/a'
        ],
        'windows_cmd': 'dir /a',
        'unix_cmd': 'ls -la',
        'description': 'List all files including hidden ones'
    },
    'count_files': {
        'patterns': [
            r'(?:count|how many)\s+files?',
            r'number\s+of\s+files?',
            r'file\s+count'
        ],
        'windows_cmd': 'dir /b | find /c /v ""',
        'unix_cmd': 'ls -1 | wc -l',
        'description': 'Count files in directory'
    },
    'find_files': {
        'patterns': [
            r'find\s+(.+?)\s+files?',
            r'(?:search|look)\s+for\s+(.+?)\s+files?',
            r'files?\s+with\s+(.+?)',
            r'(.+?)\s+files?'
        ],
        'windows_cmd': 'dir *{ext} /s',
        'unix_cmd': 'find . -name "*{ext}*"',
        'description': 'Find files by extension or name'
    },
    'disk_usage': {
        'patterns': [
            r'(?:disk|storage|space)\s+usage',
            r'how\s+much\s+space',
            r'free\s+space',
            r'disk\s+space'
        ],
        'windows_cmd': 'dir',
        'unix_cmd': 'df -h',
        'description': 'Show disk usage'
    },
    'file_size': {
        'patterns': [
            r'size\s+of\s+(.+)',
            r'how\s+big\s+is\s+(.+)',
            r'(.+)\s+size'
        ],
        'windows_cmd': 'dir "{filename}"',
        'unix_cmd': 'ls -lh "{filename}"',
        'description': 'Show file size'
    },
    'create_file': {
        'patterns': [
            r'(?:create|make|new)\s+(?:file|document)\s+(.+)',
            r'touch\s+(.+)'
        ],
        'windows_cmd': 'type nul > "{filename}"',
        'unix_cmd': 'touch "{filename}"',
        'description': 'Create a new file'
    },
    'change_directory': {
        'patterns': [
            r'(?:go|change|switch|move|navigate)\s+(?:to|into|inside)\s+(.+)',
            r'(?:cd|chdir)\s+(.+)',
            r'(?:enter|open)\s+(?:folder|directory|dir)\s+(.+)',
            r'(?:go|move)\s+(?:into|inside|to)\s+(?:the\s+)?(.+?)(?:\s+(?:folder|directory|dir))?'
        ],
        'windows_cmd': 'cd /d "{dirname}"',
        'unix_cmd': 'cd "{dirname}"',
        'description': 'Change to directory',
        'builtin_override': True  # This tells us to handle it as built-in
    },
    'create_directory': {
        'patterns': [
            r'(?:create|make|new)\s+(?:folder|directory|dir)\s+(.+)',
            r'mkdir\s+(.+)'
        ],
        'windows_cmd': 'mkdir "{dirname}"',
        'unix_cmd': 'mkdir "{dirname}"',
        'description': 'Create a new directory'
    },
    'copy_file': {
        'patterns': [
            r'copy\s+(.+?)\s+to\s+(.+)',
            r'cp\s+(.+?)\s+(.+)'
        ],
        'windows_cmd': 'copy "{source}" "{dest}"',
        'unix_cmd': 'cp "{source}" "{dest}"',
        'description': 'Copy file or directory'
    },
    'move_file': {
        'patterns': [
            r'(?:move|rename)\s+(.+?)\s+to\s+(.+)',
            r'mv\s+(.+?)\s+(.+)'
        ],
        'windows_cmd': 'move "{source}" "{dest}"',
        'unix_cmd': 'mv "{source}" "{dest}"',
        'description': 'Move or rename file'
    },
    'delete_file': {
        'patterns': [
            r'(?:delete|remove)\s+(?:file\s+)?(.+)',
            r'rm\s+(.+)'
        ],
        'windows_cmd': 'del "{filename}"',
        'unix_cmd': 'rm "{filename}"',
        'description': 'Delete file'
    },
    'show_content': {
        'patterns': [
            r'(?:show|display|read|view|cat)\s+(?:contents?\s+of\s+)?(.+)',
            r'what\'?s\s+in\s+(.+)',
            r'cat\s+(.+)'
        ],
        'windows_cmd': 'type "{filename}"',
        'unix_cmd': 'cat "{filename}"',
        'description': 'Show file contents'
    },
    'system_info': {
        'patterns': [
            r'system\s+info(?:rmation)?',
            r'computer\s+info',
            r'hardware\s+info',
            r'specs?'
        ],
        'windows_cmd': 'systeminfo',
        'unix_cmd': 'uname -a && lscpu',
        'description': 'Show system information'
    },
    'processes': {
        'patterns': [
            r'(?:show|list)\s+processes?',
            r'running\s+programs?',
            r'what\'?s\s+running',
            r'ps(?:\s+aux)?',
            r'task\s+list'
        ],
        'windows_cmd': 'tasklist',
        'unix_cmd': 'ps aux',
        'description': 'List running processes'
    },
    'network_info': {
        'patterns': [
            r'(?:network|ip)\s+info',
            r'ip\s+address',
            r'network\s+config',
            r'ifconfig'
        ],
        'windows_cmd': 'ipconfig',
        'unix_cmd': 'ifconfig',
        'description': 'Show network information'
    }
}

def get_session_context(session_id):
    """Get or create session context."""
    if session_id not in session_contexts:
        session_contexts[session_id] = {
            'command_history': [],
            'output_history': [],
            'current_files': [],  # Track files in current directory
            'last_operation': None,  # Track last operation for context
            'max_history': 10  # Increased history for better context
        }
    return session_contexts[session_id]

def update_session_context(session_id, command, output, operation_type=None):
    """Update session context with new command and output."""
    context = get_session_context(session_id)
    
    context['command_history'].append({
        'command': command,
        'timestamp': datetime.now().isoformat(),
        'operation_type': operation_type
    })
    context['output_history'].append(output)
    context['last_operation'] = operation_type
    
    # Update current files list if it's a directory listing
    if operation_type in ['list_files', 'list_hidden'] and output:
        try:
            # Extract filenames from output
            lines = output.strip().split('\n')
            files = []
            for line in lines:
                if line.strip() and not line.startswith('🤖'):
                    # Extract filename (handle different output formats)
                    if '<DIR>' in line:  # Windows format
                        parts = line.split()
                        if len(parts) > 1:
                            files.append(' '.join(parts[1:]))
                    elif line.strip():
                        files.append(line.strip())
            context['current_files'] = files[:20]  # Keep last 20 files
        except:
            pass
    
    # Trim history if too long
    if len(context['command_history']) > context['max_history']:
        context['command_history'] = context['command_history'][-context['max_history']:]
        context['output_history'] = context['output_history'][-context['max_history']:]

def extract_parameters_from_query(query, pattern):
    """Extract parameters from natural language query using regex pattern."""
    match = re.search(pattern, query, re.IGNORECASE)
    if match:
        return match.groups()
    return []

def match_command_pattern(query):
    """Match natural language query to command patterns."""
    query = query.lower().strip()
    
    for cmd_type, cmd_info in COMMAND_PATTERNS.items():
        for pattern in cmd_info['patterns']:
            if re.search(pattern, query, re.IGNORECASE):
                params = extract_parameters_from_query(query, pattern)
                return cmd_type, params, cmd_info
    
    return None, [], {}

def build_smart_command(cmd_type, params, cmd_info, session_context=None):
    """Build command based on pattern matching and parameters."""
    
    # Check if this should be handled as a built-in command
    if cmd_info.get('builtin_override'):
        return None  # Signal that this should be handled by built-in logic
    
    if IS_WINDOWS:
        base_cmd = cmd_info.get('windows_cmd', cmd_info.get('unix_cmd', ''))
    else:
        base_cmd = cmd_info.get('unix_cmd', cmd_info.get('windows_cmd', ''))
    
    # Handle parameter substitution
    if params:
        if cmd_type == 'find_files':
            ext = params[0] if params else ''
            # Handle common file type queries
            if 'python' in ext.lower():
                ext = '*.py'
            elif 'text' in ext.lower():
                ext = '*.txt'
            elif 'image' in ext.lower():
                ext = '*.jpg'
            elif 'document' in ext.lower():
                ext = '*.doc*'
            elif not ext.startswith('*'):
                ext = f'*{ext}*'
            base_cmd = base_cmd.format(ext=ext.replace('*', ''))
            
        elif cmd_type in ['create_file', 'show_content', 'file_size', 'delete_file']:
            filename = params[0] if params else 'newfile.txt'
            base_cmd = base_cmd.format(filename=filename)
            
        elif cmd_type in ['create_directory', 'change_directory']:
            dirname = params[0] if params else ('newfolder' if cmd_type == 'create_directory' else '.')
            base_cmd = base_cmd.format(dirname=dirname)
            
        elif cmd_type in ['copy_file', 'move_file']:
            source = params[0] if len(params) > 0 else 'source'
            dest = params[1] if len(params) > 1 else 'destination'
            base_cmd = base_cmd.format(source=source, dest=dest)
    
    return base_cmd

def get_contextual_suggestions(query, session_context):
    """Provide contextual suggestions based on recent operations."""
    suggestions = []
    
    if session_context.get('last_operation') == 'list_files':
        if 'count' in query.lower():
            suggestions.append("Count the files that were just listed")
        elif 'python' in query.lower() and session_context.get('current_files'):
            py_files = [f for f in session_context['current_files'] if f.endswith('.py')]
            if py_files:
                suggestions.append(f"Found {len(py_files)} Python files")
    
    return suggestions

def build_enhanced_prompt(natural_language_query, session_id):
    """Build an enhanced contextual prompt with pattern matching and smart suggestions."""
    context = get_session_context(session_id)
    
    # Try pattern matching first
    cmd_type, params, cmd_info = match_command_pattern(natural_language_query)
    if cmd_type:
        smart_command = build_smart_command(cmd_type, params, cmd_info, context)
        return smart_command, f"🎯 Pattern matched: {cmd_info['description']}"
    
    # Contextual information
    context_info = ""
    if context['command_history']:
        recent_commands = context['command_history'][-3:]  # Last 3 commands
        context_info = "\n\nRecent context:\n"
        for i, cmd_info in enumerate(recent_commands, 1):
            context_info += f"{i}. {cmd_info['command']} ({cmd_info.get('operation_type', 'unknown')})\n"
    
    if context['current_files']:
        context_info += f"\nCurrent directory contains: {', '.join(context['current_files'][:5])}"
        if len(context['current_files']) > 5:
            context_info += f" and {len(context['current_files']) - 5} more..."
    
    # Get contextual suggestions
    suggestions = get_contextual_suggestions(natural_language_query, context)
    if suggestions:
        context_info += f"\n\nSmart suggestions: {'; '.join(suggestions)}"
    
    # Enhanced command examples based on OS
    if IS_WINDOWS:
        command_examples = """
    WINDOWS COMMANDS:
    - List files: "dir" or "dir /a" (with hidden)
    - Find files: "dir *.py /s" (Python files)
    - File content: "type filename.txt"
    - Create file: "type nul > newfile.txt"
    - Copy: "copy source.txt dest.txt"
    - System info: "systeminfo"
    - Processes: "tasklist"
    - Network: "ipconfig"
        """
    else:
        command_examples = """
    UNIX/LINUX COMMANDS:
    - List files: "ls -la"
    - Find files: "find . -name '*.py'"
    - File content: "cat filename.txt"
    - Create file: "touch newfile.txt"
    - Copy: "cp source.txt dest.txt"
    - System info: "uname -a"
    - Processes: "ps aux"
    - Network: "ifconfig"
        """
    
    return f"""
    You are an expert system administrator with advanced natural language understanding.
    Convert the user's request into a single, executable command for {"Windows" if IS_WINDOWS else "Unix/Linux"}.
    
    ENHANCED GUIDELINES:
    - Return ONLY the command, no explanations
    - Consider the context from recent operations
    - Use the most appropriate command for the user's intent
    - If referencing files from context, use those specific filenames
    - Handle ambiguous requests intelligently
    {command_examples}
    
    CONTEXT-AWARE PROCESSING:
    - If user says "count them" after listing files, use file count command
    - If user asks about specific file types, use appropriate search
    - If user refers to "that file" or "it", use context to determine what file
    - For follow-up questions, consider the previous operation
    
    User Request: "{natural_language_query}"{context_info}
    
    Command:
    """, "🧠 AI processing with enhanced context"

def get_ai_command(natural_language_query, session_id=None):
    """Enhanced AI command generation with pattern matching and context."""
    if not AI_ENABLED:
        return None, "AI features are not configured. Please set the GOOGLE_API_KEY."
    
    try:
        # Try pattern matching first for common commands
        if session_id:
            context = get_session_context(session_id)
            cmd_type, params, cmd_info = match_command_pattern(natural_language_query)
            
            if cmd_type:
                # Check if this should be handled as built-in
                if cmd_info.get('builtin_override'):
                    return 'BUILTIN_OVERRIDE', f"🎯 Built-in handler: {cmd_info['description']}"
                
                smart_command = build_smart_command(cmd_type, params, cmd_info, context)
                if smart_command:
                    return smart_command, f"🎯 Smart match: {cmd_info['description']}"
        
        # Fall back to AI for complex queries
        if session_id:
            prompt, feedback = build_enhanced_prompt(natural_language_query, session_id)
        else:
            prompt = f"""
            Convert this request to a {"Windows" if IS_WINDOWS else "Unix/Linux"} command.
            Return only the command: "{natural_language_query}"
            """
            feedback = "🤖 AI processing"
        
        response = model.generate_content(prompt)
        command = response.text.strip()
        
        # Clean up the response
        command = re.sub(r'```[\w]*\n?', '', command)  # Remove code blocks
        command = command.replace('`', '').strip()
        
        if command.startswith("Error:"):
            return None, command
        
        is_safe, error_msg = validate_command_security(command)
        if not is_safe:
            return None, f"Security validation failed: {error_msg}"
        
        return command, feedback
        
    except Exception as e:
        return None, f"Error processing request: {str(e)}"

def validate_command_security(command):
    """Enhanced security validation."""
    if not command:
        return False, "Empty command"
    
    command_lower = command.lower()
    
    # Dangerous patterns
    dangerous_patterns = [
        'rm -rf /', 'del /f /s /q c:', 'format c:', 'fdisk', 'mkfs',
        'shutdown', 'reboot', 'halt', 'poweroff', 'init 0', 'init 6',
        'chmod 777 /', '> /dev/sda', 'dd if=/dev/zero', 'killall',
        'pkill -9', 'kill -9 -1', 'forkbomb', ':(){ :|:& };:',
        'sudo rm', 'sudo chmod', 'sudo chown'
    ]
    
    for pattern in dangerous_patterns:
        if pattern in command_lower:
            return False, f"Blocked dangerous command: {pattern}"
    
    # Length check
    if len(command) > 500:
        return False, "Command too long"
    
    return True, None

def execute_system_command(command, current_path):
    """Enhanced command execution with better error handling."""
    try:
        if IS_WINDOWS:
            print(f"🔧 Executing on Windows: {command}")
            result = subprocess.run(
                command, 
                capture_output=True, 
                text=True, 
                cwd=current_path,
                shell=True,
                timeout=30,
                encoding='utf-8',
                errors='replace'  # Handle encoding issues
            )
        else:
            command_parts = shlex.split(command)
            if command_parts:
                base_command = command_parts[0]
                if shutil.which(base_command) is None:
                    common_paths = ['/bin/', '/usr/bin/', '/usr/local/bin/']
                    for path in common_paths:
                        full_command_path = path + base_command
                        if os.path.exists(full_command_path):
                            command_parts[0] = full_command_path
                            break
                    else:
                        return f"❌ Command not found: {base_command}"
            
            print(f"🔧 Executing on Unix/Linux: {' '.join(command_parts)}")
            result = subprocess.run(
                command_parts, 
                capture_output=True, 
                text=True, 
                cwd=current_path,
                timeout=30
            )
        
        if result.returncode == 0:
            output = result.stdout if result.stdout else "✅ Command executed successfully"
            return output.strip()
        else:
            error = result.stderr if result.stderr else f"❌ Command failed (exit code: {result.returncode})"
            return error.strip()
            
    except subprocess.TimeoutExpired:
        return "⏱️ Command timed out after 30 seconds"
    except FileNotFoundError as e:
        return f"❌ Command not found: {e.filename if hasattr(e, 'filename') else command}"
    except Exception as e:
        return f"❌ Error executing command: {str(e)}"

@app.route('/command', methods=['POST'])
def handle_command():
    if not request.json:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    data = request.json
    command_full = data.get('command', '').strip()
    
    if len(command_full) > 1000:
        return jsonify({'error': 'Command too long (max 1000 characters)'}), 400
    
    session_id = data.get('sessionId', 'default')
    current_path = data.get('path', '~')
    if current_path == '~' or not os.path.isdir(current_path):
        current_path = os.path.expanduser('~')
    
    new_path = current_path
    parts = command_full.split()
    command_key = parts[0] if parts else ''
    
    try:
        # Handle built-in commands (same as before)
        if command_key == 'ls':
            # Built-in ls implementation
            path_arg = parts[1] if len(parts) > 1 else '.'
            target_path = os.path.join(current_path, path_arg)
            show_hidden = '-a' in parts or '-la' in parts or '-al' in parts
            show_long = '-l' in parts or '-la' in parts or '-al' in parts
            
            try:
                files = os.listdir(target_path)
                if not show_hidden:
                    files = [f for f in files if not f.startswith('.')]
                
                if show_long:
                    output_lines = []
                    for file in sorted(files):
                        file_path = os.path.join(target_path, file)
                        try:
                            stat_info = os.stat(file_path)
                            size = stat_info.st_size
                            is_dir = os.path.isdir(file_path)
                            permissions = 'drwxr-xr-x' if is_dir else '-rw-r--r--'
                            output_lines.append(f"{permissions} {size:>8} {file}")
                        except OSError:
                            output_lines.append(f"????????? {file}")
                    output = '\n'.join(output_lines)
                else:
                    output = '\n'.join(sorted(files))
                
                update_session_context(session_id, command_full, output, 'list_files')
                return jsonify({'output': output, 'new_path': new_path})
            except OSError as e:
                return jsonify({'error': f'ls: {str(e)}', 'new_path': new_path})
        
        elif command_key == 'dir' and IS_WINDOWS:
            # Windows dir command
            path_arg = parts[1] if len(parts) > 1 and not parts[1].startswith('/') else '.'
            show_hidden = '/a' in parts or '/A' in parts
            
            try:
                files = os.listdir(os.path.join(current_path, path_arg))
                if not show_hidden:
                    files = [f for f in files if not f.startswith('.')]
                
                output_lines = []
                for file in sorted(files):
                    file_path = os.path.join(current_path, path_arg, file)
                    try:
                        stat_info = os.stat(file_path)
                        size = stat_info.st_size if not os.path.isdir(file_path) else 0
                        is_dir = os.path.isdir(file_path)
                        dir_marker = '<DIR>' if is_dir else f'{size:>10}'
                        output_lines.append(f"{dir_marker} {file}")
                    except OSError:
                        output_lines.append(f"       ??? {file}")
                
                output = '\n'.join(output_lines)
                update_session_context(session_id, command_full, output, 'list_files')
                return jsonify({'output': output, 'new_path': new_path})
            except OSError as e:
                return jsonify({'error': f'dir: {str(e)}', 'new_path': new_path})
        
        # Other built-in commands (cd, pwd, mkdir, etc.) remain the same as before
        elif command_key == 'cd':
            if len(parts) < 2:
                new_path = os.path.expanduser('~')
                return jsonify({'output': f'Changed directory to {new_path}', 'new_path': new_path})
            
            path_arg = parts[1]
            potential_path = os.path.join(current_path, path_arg)
            
            if os.path.isdir(potential_path):
                new_path = os.path.abspath(potential_path)
                return jsonify({'output': f'Changed directory to {new_path}', 'new_path': new_path})
            else:
                return jsonify({'error': f'cd: no such file or directory: {path_arg}', 'new_path': current_path})
        
        elif command_key == 'pwd':
            output = current_path
            update_session_context(session_id, command_full, output, 'show_path')
            return jsonify({'output': output, 'new_path': new_path})
        
        elif command_key == 'help':
            help_text = f"""
🚀 PyTerminal - Enhanced AI Terminal
{'=' * 40}

[Built-in Commands]
  ls, dir           List files and directories
  cd [path]         Change directory
  pwd               Show current directory
  mkdir [name]      Create directory
  rm [file]         Remove file
  help              Show this help
  clear             Clear terminal

[Smart NLP Commands - Just type naturally!]
  📁 File Operations:
     • "show all files" / "list everything"
     • "find Python files" / "search for .txt files"
     • "count files" / "how many files"
     • "show hidden files"
     
  📄 File Content:
     • "show content of file.txt"
     • "what's in readme.md"
     • "read config.json"
     
  🔧 File Management:
     • "create file test.py"
     • "copy file.txt to backup.txt"
     • "delete old.log"
     • "make folder documents"
     
  💻 System Info:
     • "system information"
     • "running processes" / "what's running"
     • "network info" / "ip address"
     • "disk usage" / "free space"

[Smart Context Features]
  🧠 Contextual Understanding:
     • Remembers recent commands and files
     • "count them" after listing files
     • "show that file" referring to previous results
     
  🎯 Pattern Matching:
     • Fast recognition of common requests
     • Smart parameter extraction
     • Cross-platform compatibility

[Examples]
  Instead of: ls -la | grep py
  Just say:   "find Python files"
  
  Instead of: cat readme.txt
  Just say:   "show readme content"
  
  Instead of: mkdir -p project/src
  Just say:   "create folder project/src"

💡 Tip: The AI learns from context - your previous commands help it understand follow-up requests better!
"""
            update_session_context(session_id, command_full, help_text, 'help')
            return jsonify({'output': help_text, 'new_path': new_path})
        
        elif command_key == 'clear':
            return jsonify({'output': '', 'new_path': new_path})
        
        # Enhanced AI processing for natural language
        else:
            ai_command, feedback = get_ai_command(command_full, session_id)
            if not ai_command:
                return jsonify({'error': feedback or 'Could not process command', 'new_path': new_path})
            
            # Check if this should be handled by built-in logic
            if ai_command == 'BUILTIN_OVERRIDE':
                # Handle directory change commands specially
                cmd_type, params, cmd_info = match_command_pattern(command_full)
                if cmd_type == 'change_directory' and params:
                    # Use built-in cd logic
                    path_arg = params[0]
                    potential_path = os.path.join(current_path, path_arg)
                    
                    if os.path.isdir(potential_path):
                        new_path = os.path.abspath(potential_path)
                        update_session_context(session_id, f'cd "{path_arg}"', f'Changed to {new_path}', 'change_directory')
                        return jsonify({
                            'output': f'{feedback}\nChanged directory to {new_path}', 
                            'new_path': new_path
                        })
                    else:
                        return jsonify({
                            'error': f'{feedback}\nDirectory not found: {path_arg}', 
                            'new_path': current_path
                        })
                
                # Handle other built-in overrides here if needed
                return jsonify({'error': 'Built-in command not implemented', 'new_path': new_path})
            
            # Determine operation type for context
            cmd_type, _, _ = match_command_pattern(command_full)
            operation_type = cmd_type or 'unknown'
            
            print(f"🤖 Generated command: {ai_command}")
            output = execute_system_command(ai_command, current_path)
            
            final_output = f"{feedback}\n{output}"
            update_session_context(session_id, ai_command, output, operation_type)
            
            return jsonify({'output': final_output, 'new_path': new_path})

    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}', 'new_path': new_path})

@app.route('/autocomplete', methods=['POST'])
def autocomplete():
    if not request.json:
        return jsonify({'suggestions': [], 'error': 'No JSON data provided'}), 400
    
    data = request.json
    text = data.get('text', '')
    
    if len(text) > 500:
        return jsonify({'suggestions': [], 'error': 'Input too long'}), 400
    
    current_path = data.get('path', '~')
    if current_path == '~' or not os.path.isdir(current_path):
        current_path = os.path.expanduser('~')
        
    parts = text.split()
    suggestions = []
    
    try:
        # --- Command suggestions ---
        if len(parts) <= 1 and not text.endswith(' '):
            command_suggestions = [cmd for cmd in BUILTIN_COMMANDS if cmd.startswith(text)]
            
            # NLP suggestions
            nlp_suggestions = []
            text_lower = text.lower()
            
            if 'show' in text_lower or 'list' in text_lower:
                nlp_suggestions.extend(['show all files', 'show hidden files', 'show content of'])
            elif 'find' in text_lower or 'search' in text_lower:
                nlp_suggestions.extend(['find Python files', 'find text files', 'search for'])
            elif 'create' in text_lower or 'make' in text_lower:
                nlp_suggestions.extend(['create file', 'create folder', 'make directory'])
            elif 'count' in text_lower:
                nlp_suggestions.extend(['count files', 'how many files'])
            elif 'system' in text_lower:
                nlp_suggestions.extend(['system information', 'system processes'])
            elif 'network' in text_lower or 'ip' in text_lower:
                nlp_suggestions.extend(['network info', 'ip address'])
            
            # Match partial input
            matching_nlp = [s for s in nlp_suggestions if s.startswith(text_lower)]
            suggestions.extend(command_suggestions)
            suggestions.extend(matching_nlp[:5])  # max 5
            
        else:
            # --- File & directory suggestions ---
            partial_path = parts[-1]
            if not partial_path:
                partial_path = '.'
            
            # Resolve relative to current path
            full_path = os.path.join(current_path, partial_path)
            dirname = os.path.dirname(full_path) or current_path
            prefix = os.path.basename(partial_path)
            
            if os.path.isdir(dirname):
                for entry in os.listdir(dirname):
                    if entry.startswith(prefix):
                        entry_path = os.path.join(dirname, entry)
                        if os.path.isdir(entry_path):
                            suggestions.append(entry + os.sep)
                        else:
                            suggestions.append(entry)
            
            suggestions = sorted(suggestions)[:20]  # limit
        
        return jsonify({'suggestions': suggestions, 'error': None})
    
    except Exception as e:
        return jsonify({'suggestions': [], 'error': str(e)})

@app.route('/context/<session_id>', methods=['GET'])
def get_session_context_endpoint(session_id):
    """Get session context for debugging and testing purposes."""
    context = get_session_context(session_id)
    return jsonify({
        'session_id': session_id,
        'context': {
            'command_history': context['command_history'][-5:],  # Last 5 commands
            'current_files': context['current_files'][:10],  # First 10 files
            'last_operation': context['last_operation']
        },
        'stats': {
            'total_commands': len(context['command_history']),
            'files_tracked': len(context['current_files'])
        },
        'message': 'Enhanced conversational AI context with pattern matching and smart suggestions'
    })

@app.route('/patterns', methods=['GET'])
def get_command_patterns():
    """Get available command patterns for frontend reference."""
    pattern_info = {}
    for cmd_type, info in COMMAND_PATTERNS.items():
        pattern_info[cmd_type] = {
            'description': info['description'],
            'examples': info['patterns'][:3],  # First 3 patterns as examples
            'windows_cmd': info.get('windows_cmd', ''),
            'unix_cmd': info.get('unix_cmd', '')
        }
    
    return jsonify({
        'patterns': pattern_info,
        'system': 'Windows' if IS_WINDOWS else 'Unix/Linux',
        'total_patterns': len(COMMAND_PATTERNS)
    })

@app.route('/smart-suggest', methods=['POST'])
def smart_suggest():
    """Provide smart suggestions based on partial input and context."""
    if not request.json:
        return jsonify({'suggestions': [], 'error': 'No JSON data provided'}), 400
    
    data = request.json
    partial_query = data.get('query', '').lower()
    session_id = data.get('sessionId', 'default')
    
    if len(partial_query) > 200:
        return jsonify({'suggestions': [], 'error': 'Query too long'}), 400
    
    try:
        context = get_session_context(session_id)
        suggestions = []
        
        # Pattern-based suggestions
        for cmd_type, cmd_info in COMMAND_PATTERNS.items():
            for pattern in cmd_info['patterns'][:2]:  # Check first 2 patterns
                # Simple fuzzy matching
                pattern_words = re.findall(r'\w+', pattern.lower())
                query_words = partial_query.split()
                
                if any(word in pattern_words for word in query_words):
                    suggestions.append({
                        'text': cmd_info['description'],
                        'type': 'pattern',
                        'category': cmd_type,
                        'confidence': 0.8
                    })
                    break
        
        # Context-based suggestions
        if context['last_operation'] == 'list_files':
            if 'count' in partial_query:
                suggestions.append({
                    'text': 'count files in current directory',
                    'type': 'contextual',
                    'category': 'follow_up',
                    'confidence': 0.9
                })
            elif any(ext in partial_query for ext in ['py', 'python', 'txt', 'js']):
                suggestions.append({
                    'text': f'find {partial_query} files in current directory',
                    'type': 'contextual',
                    'category': 'filter',
                    'confidence': 0.85
                })
        
        # File-based suggestions if files are in context
        if context['current_files'] and len(partial_query) > 2:
            matching_files = [f for f in context['current_files'] if partial_query in f.lower()]
            for file in matching_files[:3]:  # Top 3 matching files
                suggestions.append({
                    'text': f'show content of {file}',
                    'type': 'file',
                    'category': 'file_operation',
                    'confidence': 0.7
                })
        
        # Sort by confidence and remove duplicates
        suggestions = sorted(suggestions, key=lambda x: x['confidence'], reverse=True)
        unique_suggestions = []
        seen_texts = set()
        
        for suggestion in suggestions:
            if suggestion['text'] not in seen_texts:
                unique_suggestions.append(suggestion)
                seen_texts.add(suggestion['text'])
        
        return jsonify({
            'suggestions': unique_suggestions[:8],  # Top 8 suggestions
            'query': partial_query,
            'context_used': bool(context['last_operation'])
        })
        
    except Exception as e:
        return jsonify({'suggestions': [], 'error': str(e)})

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint with system info."""
    return jsonify({
        'status': 'healthy',
        'ai_enabled': AI_ENABLED,
        'system': 'Windows' if IS_WINDOWS else 'Unix/Linux',
        'patterns_loaded': len(COMMAND_PATTERNS),
        'active_sessions': len(session_contexts),
        'version': '2.0.0-enhanced'
    })

if __name__ == '__main__':
    print(f"""
🚀 Enhanced PyTerminal Starting...
{'=' * 40}
System: {'Windows' if IS_WINDOWS else 'Unix/Linux'}
AI Enabled: {'✅' if AI_ENABLED else '❌'}
Smart Patterns: {len(COMMAND_PATTERNS)}
Enhanced Features:
  🎯 Pattern Matching
  🧠 Contextual Understanding  
  💡 Smart Suggestions
  🔄 Cross-platform Support
  📊 Session Tracking
{'=' * 40}
    """)
    app.run(debug=True, port=5000)