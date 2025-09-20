import os
import shutil
import psutil
import subprocess
import glob
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- Configuration ---
# Ensure your GOOGLE_API_KEY is set as an environment variable
try:
    genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    AI_ENABLED = True
except KeyError:
    print("WARNING: GOOGLE_API_KEY environment variable not found. AI features will be disabled.")
    AI_ENABLED = False
except Exception as e:
    print(f"Error initializing Google AI: {e}. AI features disabled.")
    AI_ENABLED = False

app = Flask(__name__)
CORS(app)

# --- Built-in commands for auto-completion and fast handling ---
BUILTIN_COMMANDS = ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cpu', 'mem', 'ps', 'help', 'clear']

def get_ai_command(natural_language_query):
    """Translates natural language into a shell command using the Gemini API."""
    if not AI_ENABLED:
        return None, "AI features are not configured. Please set the GOOGLE_API_KEY."
    
    # The prompt is key to getting clean, safe command output from the AI
    prompt = f"""
    You are an expert system administrator inside a Python-based command terminal.
    Your task is to convert a natural language request into a single, executable bash command.
    - Only return the bash command.
    - Do not include any explanation, preamble, or markdown formatting.
    - The command must be directly runnable.
    - If the request is ambiguous or seems dangerous (like 'delete everything'), return "Error: Ambiguous or unsafe request."

    User Request: "{natural_language_query}"
    
    Command:
    """
    try:
        response = model.generate_content(prompt)
        command = response.text.strip()
        if command.startswith("Error:"):
            return None, command
        return command, None
    except Exception as e:
        return None, f"Error contacting AI model: {str(e)}"

@app.route('/command', methods=['POST'])
def handle_command():
    data = request.json
    command_full = data.get('command', '').strip()
    parts = command_full.split()
    command_key = parts[0] if parts else ''
    
    try:
        # --- Handle Built-in Commands ---
        if command_key == 'ls':
            path = parts[1] if len(parts) > 1 else '.'
            files = os.listdir(path)
            return jsonify({'output': '\n'.join(files)})
        elif command_key == 'cd':
            path = parts[1] if len(parts) > 1 else os.path.expanduser('~')
            os.chdir(path)
            return jsonify({'output': f'Changed directory to {os.getcwd()}'})
        elif command_key == 'pwd':
            return jsonify({'output': os.getcwd()})
        elif command_key == 'mkdir':
            if len(parts) < 2: return jsonify({'error': 'mkdir: missing operand'})
            os.makedirs(parts[1], exist_ok=True)
            return jsonify({'output': f'Created directory: {parts[1]}'})
        elif command_key == 'rm':
            if len(parts) < 2: return jsonify({'error': 'rm: missing operand'})
            is_recursive = '-r' in parts or '-R' in parts
            path = next((arg for arg in parts[1:] if arg not in ['-r', '-R']), None)
            if not path: return jsonify({'error': 'rm: missing file operand'})
            
            if is_recursive:
                if os.path.isdir(path):
                    shutil.rmtree(path)
                    return jsonify({'output': f'Removed directory: {path}'})
                else: return jsonify({'error': f'rm: cannot remove \'{path}\': Not a directory'})
            else:
                if os.path.isfile(path):
                    os.remove(path)
                    return jsonify({'output': f'Removed file: {path}'})
                elif os.path.isdir(path): return jsonify({'error': f'rm: cannot remove \'{path}\': Is a directory. Use -r flag.'})
                else: return jsonify({'error': f'rm: cannot remove \'{path}\': No such file or directory'})
        elif command_key == 'cpu':
            return jsonify({'output': f'CPU Usage: {psutil.cpu_percent(interval=1)}%'})
        elif command_key == 'mem':
            mem = psutil.virtual_memory()
            return jsonify({'output': f'Memory: {mem.used / (1024**3):.2f}GB used out of {mem.total / (1024**3):.2f}GB ({mem.percent}%)'})
        elif command_key == 'ps':
            procs = [f"PID: {p.info['pid']:<6} | Name: {p.info['name']}" for p in psutil.process_iter(['pid', 'name'])]
            return jsonify({'output': '\n'.join(procs)})
        
        # --- Fallback to AI and then Subprocess ---
        else:
            ai_command, error = get_ai_command(command_full)
            if error: return jsonify({'error': error})
            
            final_command_to_run = ai_command
            ai_feedback = f"🤖 AI translated to: `{final_command_to_run}`\n"
            result = subprocess.run(final_command_to_run, shell=True, capture_output=True, text=True, cwd=os.getcwd())
            output = result.stdout if result.stdout else result.stderr
            return jsonify({'output': ai_feedback + output.strip()})

    except FileNotFoundError as e:
        return jsonify({'error': f'No such file or directory: {e.filename}'})
    except Exception as e:
        return jsonify({'error': str(e)})

# --- NEW: Auto-Completion Endpoint ---
@app.route('/autocomplete', methods=['POST'])
def autocomplete():
    data = request.json
    text = data.get('text', '')
    parts = text.split()

    suggestions = []
    
    try:
        # Case 1: Completing the command itself (the first word)
        if len(parts) <= 1 and not ' ' in text:
            suggestions = [cmd for cmd in BUILTIN_COMMANDS if cmd.startswith(text)]
        
        # Case 2: Completing a file or directory path
        else:
            partial_path = parts[-1]
            matches = glob.glob(partial_path + '*')
            for match in matches:
                # Add a '/' to directories for user convenience
                if os.path.isdir(match):
                    suggestions.append(match.replace('\\', '/') + '/') # Normalize slashes for Windows
                else:
                    suggestions.append(match.replace('\\', '/'))

        return jsonify({'suggestions': suggestions})
    except Exception as e:
        return jsonify({'suggestions': [], 'error': str(e)})


if __name__ == '__main__':
    app.run(debug=True, port=5000)

