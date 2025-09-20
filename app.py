import os
import shutil
import psutil
import subprocess
import glob
import shlex
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS

try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Environment variables loaded from .env file")
except ImportError:
    print("⚠️  python-dotenv not installed. Using system environment variables only.")

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

BUILTIN_COMMANDS = ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cpu', 'mem', 'ps', 'help', 'clear']

ALLOWED_COMMANDS = [
    'ls', 'cd', 'pwd', 'mkdir', 'rm', 'cat', 'grep', 'find', 'ps', 'top', 'htop',
    'tree', 'du', 'df', 'free', 'uptime', 'whoami', 'date', 'echo', 'touch',
    'cp', 'mv', 'chmod', 'chown', 'head', 'tail', 'sort', 'uniq', 'wc',
    'curl', 'wget', 'ping', 'nslookup', 'netstat', 'ss', 'lsof'
]

BLOCKED_COMMANDS = [
    'rm -rf /', 'rm -rf /*', 'sudo rm -rf', 'format', 'fdisk', 'mkfs',
    'dd if=/dev/zero', 'shutdown', 'reboot', 'halt', 'poweroff',
    'chmod 777 /', 'chown -R', 'passwd', 'su -', 'sudo su'
]

def get_session_context(session_id):
    """Get or create session context."""
    if session_id not in session_contexts:
        session_contexts[session_id] = {
            'command_history': [],
            'output_history': [],
            'max_history': 5
        }
    return session_contexts[session_id]

def update_session_context(session_id, command, output):
    """Update session context with new command and output."""
    context = get_session_context(session_id)
    
    context['command_history'].append(command)
    context['output_history'].append(output)
    
    if len(context['command_history']) > context['max_history']:
        context['command_history'] = context['command_history'][-context['max_history']:]
        context['output_history'] = context['output_history'][-context['max_history']:]

def build_contextual_prompt(natural_language_query, session_id):
    """Build a contextual prompt with recent command history."""
    context = get_session_context(session_id)
    
    context_string = ""
    if context['command_history']:
        context_string = "\n\nRecent command history for context:\n"
        for i, (cmd, output) in enumerate(zip(context['command_history'], context['output_history'])):
            context_string += f"{i+1}. Command: {cmd}\n"
            if output and len(output) < 200:
                context_string += f"   Output: {output[:100]}{'...' if len(output) > 100 else ''}\n"
            context_string += "\n"
    
    return f"""
    You are an expert system administrator inside a Python-based command terminal.
    Your task is to convert a natural language request into a single, executable bash command.
    
    IMPORTANT: You have access to recent command history. Use this context to understand what the user is referring to.
    For example, if they say "count them" after listing files, you should count the files from the previous command.
    
    - Only return the bash command.
    - Do not include any explanation, preamble, or markdown formatting.
    - The command must be directly runnable.
    - Only use these allowed commands: {', '.join(ALLOWED_COMMANDS)}
    - If the request is ambiguous or seems dangerous (like 'delete everything'), return "Error: Ambiguous or unsafe request."
    - Do not use sudo, rm -rf, or any system administration commands.
    - Use context from recent commands to provide intelligent follow-up commands.

    User Request: "{natural_language_query}"{context_string}
    
    Command:
    """

def validate_command_security(command):
    """Validate that a command is safe to execute."""
    if not command:
        return False, "Empty command"
    
    command_lower = command.lower()
    for blocked in BLOCKED_COMMANDS:
        if blocked in command_lower:
            return False, f"Blocked dangerous command: {blocked}"
    
    parts = command.split()
    if parts:
        first_command = parts[0]
        if first_command not in ALLOWED_COMMANDS:
            return False, f"Command '{first_command}' not in allowed list"
    
    return True, None

def get_ai_command(natural_language_query, session_id=None):
    """Translates natural language into a shell command using the Gemini API with context."""
    if not AI_ENABLED:
        return None, "AI features are not configured. Please set the GOOGLE_API_KEY."
    
    if session_id:
        prompt = build_contextual_prompt(natural_language_query, session_id)
    else:
        prompt = f"""
        You are an expert system administrator inside a Python-based command terminal.
        Your task is to convert a natural language request into a single, executable bash command.
        - Only return the bash command.
        - Do not include any explanation, preamble, or markdown formatting.
        - The command must be directly runnable.
        - Only use these allowed commands: {', '.join(ALLOWED_COMMANDS)}
        - If the request is ambiguous or seems dangerous (like 'delete everything'), return "Error: Ambiguous or unsafe request."
        - Do not use sudo, rm -rf, or any system administration commands.

        User Request: "{natural_language_query}"
        
        Command:
        """
    
    try:
        response = model.generate_content(prompt)
        command = response.text.strip()
        
        if '```' in command:
            lines = command.split('\n')
            command = ''
            in_code_block = False
            for line in lines:
                if line.strip().startswith('```'):
                    in_code_block = not in_code_block
                elif in_code_block and line.strip():
                    command = line.strip()
                    break
        
        command = command.replace('`', '').strip()
        
        if command.startswith("Error:"):
            return None, command
        
        is_safe, error_msg = validate_command_security(command)
        if not is_safe:
            return None, f"Security validation failed: {error_msg}"
        
        return command, None
    except Exception as e:
        return None, f"Error contacting AI model: {str(e)}"

@app.route('/command', methods=['POST'])
def handle_command():
    if not request.json:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    data = request.json
    command_full = data.get('command', '').strip()
    
    # Validate command length
    if len(command_full) > 1000:
        return jsonify({'error': 'Command too long (max 1000 characters)'}), 400
    
    # Get session ID for context (use tab ID from frontend)
    session_id = data.get('sessionId', 'default')
    
    # STATELESS: Get path from client, default to user's home directory.
    current_path = data.get('path', '~')
    if current_path == '~' or not os.path.isdir(current_path):
        current_path = os.path.expanduser('~')
    
    # This will be sent back to the client to keep it in sync.
    new_path = current_path
    
    parts = command_full.split()
    command_key = parts[0] if parts else ''
    
    try:
        # --- Handle Built-in Commands ---
        if command_key == 'ls':
            path_arg = parts[1] if len(parts) > 1 else '.'
            target_path = os.path.join(current_path, path_arg)
            files = os.listdir(target_path)
            output = '\n'.join(files)
            # Update session context for built-in commands too
            update_session_context(session_id, command_full, output)
            return jsonify({'output': output, 'new_path': new_path})
        
        elif command_key == 'cd':
            if len(parts) < 2:
                new_path = os.path.expanduser('~')
                return jsonify({'output': f'Changed directory to {new_path}', 'new_path': new_path})

            path_arg = parts[1]
            # Resolve potential new path
            potential_path = os.path.join(current_path, path_arg)
            
            if os.path.isdir(potential_path):
                # Return the resolved, absolute path
                new_path = os.path.abspath(potential_path)
                return jsonify({'output': f'Changed directory to {new_path}', 'new_path': new_path})
            else:
                return jsonify({'error': f'cd: no such file or directory: {path_arg}', 'new_path': current_path})
        
        elif command_key == 'pwd':
            output = current_path
            update_session_context(session_id, command_full, output)
            return jsonify({'output': output, 'new_path': new_path})

        elif command_key == 'mkdir':
            if len(parts) < 2: return jsonify({'error': 'mkdir: missing operand', 'new_path': new_path})
            target_path = os.path.join(current_path, parts[1])
            os.makedirs(target_path, exist_ok=True)
            return jsonify({'output': f'Created directory: {parts[1]}', 'new_path': new_path})
        
        elif command_key == 'rm':
            # Simplified logic, can be expanded
            if len(parts) < 2: return jsonify({'error': 'rm: missing operand'})
            path_arg = parts[-1]
            target_path = os.path.join(current_path, path_arg)
            if '-r' in parts or '-R' in parts:
                shutil.rmtree(target_path)
                return jsonify({'output': f'Removed directory: {path_arg}', 'new_path': new_path})
            else:
                os.remove(target_path)
                return jsonify({'output': f'Removed file: {path_arg}', 'new_path': new_path})

        elif command_key == 'cpu':
            output = f'CPU Usage: {psutil.cpu_percent(interval=0.5)}%'
            update_session_context(session_id, command_full, output)
            return jsonify({'output': output, 'new_path': new_path})
        elif command_key == 'mem':
            mem = psutil.virtual_memory()
            output = f'Memory: {mem.used / (1024**3):.2f}GB used out of {mem.total / (1024**3):.2f}GB ({mem.percent}%)'
            update_session_context(session_id, command_full, output)
            return jsonify({'output': output, 'new_path': new_path})
        elif command_key == 'ps':
            procs = [f"PID: {p.info['pid']:<6} | Name: {p.info['name']}" for p in psutil.process_iter(['pid', 'name'])]
            output = '\n'.join(procs)
            update_session_context(session_id, command_full, output)
            return jsonify({'output': output, 'new_path': new_path})
        
        elif command_key == 'help':
            help_text = """
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
"""
            update_session_context(session_id, command_full, help_text)
            return jsonify({'output': help_text, 'new_path': new_path})
        
        elif command_key == 'clear':
            return jsonify({'output': '', 'new_path': new_path})
        
        # --- Fallback to AI and then Subprocess ---
        else:
            ai_command, error = get_ai_command(command_full, session_id)
            if error: return jsonify({'error': error, 'new_path': new_path})
            
            ai_feedback = f"🤖 AI translated to: `{ai_command}`\n"
            
            # SECURITY FIX: Use shlex.split and shell=False
            print(f"🤖 AI generated command: {ai_command}")  # Debug output
            command_parts = shlex.split(ai_command)
            print(f"🔧 Command parts: {command_parts}")  # Debug output
            result = subprocess.run(
                command_parts, 
                capture_output=True, 
                text=True, 
                cwd=current_path # STATELESS: Execute in the correct directory
            )
            output = result.stdout if result.stdout else result.stderr
            final_output = ai_feedback + output.strip()
            
            # Update session context with the executed command and output
            update_session_context(session_id, ai_command, output.strip())
            
            return jsonify({'output': final_output, 'new_path': new_path})

    except FileNotFoundError as e:
        return jsonify({'error': f'No such file or directory: {e.filename}', 'new_path': new_path})
    except Exception as e:
        return jsonify({'error': str(e), 'new_path': new_path})

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
        if len(parts) <= 1 and not text.endswith(' '):
            suggestions = [cmd for cmd in BUILTIN_COMMANDS if cmd.startswith(text)]
        
        else:
            partial_path = parts[-1]
            if '..' in partial_path or partial_path.startswith('/'):
                return jsonify({'suggestions': [], 'error': 'Invalid path'}), 400
            
            search_path = os.path.join(current_path, partial_path + '*')
            matches = glob.glob(search_path)
            
            for match in matches:
                suggestion = os.path.basename(match)
                if os.path.isdir(match):
                    suggestions.append(suggestion + '/')
                else:
                    suggestions.append(suggestion)

        return jsonify({'suggestions': suggestions})
    except Exception as e:
        return jsonify({'suggestions': [], 'error': str(e)})

@app.route('/context/<session_id>', methods=['GET'])
def get_session_context_endpoint(session_id):
    """Get session context for testing purposes."""
    context = get_session_context(session_id)
    return jsonify({
        'session_id': session_id,
        'context': context,
        'message': 'This shows the conversational AI context for this session'
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)

