# AI Terminal

A modern, AI-powered terminal interface built with React and Python Flask. This terminal allows you to execute commands using natural language through Google's Gemini AI.

## Features

- 🤖 **AI-Powered Commands**: Convert natural language to shell commands
- 🧠 **Contextual Understanding**: AI remembers context from previous commands
- 🖥️ **Multi-Tab Support**: Multiple terminal sessions with persistent state
- ⌨️ **Auto-Complete**: Tab completion for commands and file paths
- 🎨 **Modern UI**: Beautiful terminal interface with custom themes
- 🔍 **Smart File Operations**: Find, count, and manipulate files using natural language
- 📊 **System Monitoring**: Easy CPU, memory, and process monitoring
- 🌐 **Cross-Platform**: Works on Windows, macOS, and Linux
- 🔒 **Security**: Command validation and whitelist protection
- 📱 **Responsive**: Works on desktop and mobile devices
- 🔄 **Session Tracking**: Maintains context across commands
- 🔴 **Status Indicator**: Real-time backend connection status with AI availability
- 🔄 **Real-time Output**: Streaming command output via WebSockets
- 🛑 **Command Cancellation**: Cancel long-running commands with Ctrl+C

## Prerequisites

- Node.js (v18 or higher)
- Python 3.9 or higher
- Google AI API key (for Gemini 1.5 Flash)

## Quick Start

### Automated Setup (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/krishnasharma4415/AI-Terminal.git
cd AI-Terminal
```

2. Run the setup script:
```bash
# On macOS/Linux:
./setup.sh

# On Windows:
# Right-click setup.sh and open with Git Bash
```

3. Start the backend server:
```bash
# Activate the virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Start the server
python app.py  # Runs on http://localhost:5000
```

4. Start the frontend development server:
```bash
cd ai-terminal
npm run dev  # Runs on http://localhost:5173
```

### Manual Setup

1. Clone the repository:
```bash
git clone https://github.com/krishnasharma4415/AI-Terminal.git
cd AI-Terminal
```

2. Set up the backend:
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your Google AI API key
cp env.example .env
# Edit .env with your editor and add your API key
```

3. Start the backend server:
```bash
python app.py  # Runs on http://localhost:5000
```

4. Set up the frontend:
```bash
cd ai-terminal

# Install dependencies
npm install

# Create development environment file
echo "VITE_API_URL=http://localhost:5000" > .env.development

# Start development server
npm run dev  # Runs on http://localhost:5173
```

## Using the Terminal

### Basic Usage

1. Open the terminal interface in your web browser (http://localhost:5173)
2. Create a new tab or use the default tab
3. Enter commands using natural language or traditional shell syntax
4. Press Enter to execute commands

### Example Commands

| Natural Language | Equivalent Shell Command |
|------------------|--------------------------|
| "Show all files" | `ls -la` |
| "What's my CPU usage" | `cpu` or system-specific command |
| "Find all Python files" | `find . -name "*.py"` |
| "How much disk space is left" | `df -h` |
| "Show running processes" | `ps aux` |
| "Count files in this folder" | `ls -1 | wc -l` |

### Contextual Features

The AI remembers context, allowing for follow-up commands:

1. `find . -name "*.py"` (lists Python files)
2. `count them` (counts the files from previous command)

### Keyboard Shortcuts

- **Up/Down Arrow**: Navigate command history
- **Tab**: Autocomplete commands and file paths
- **Ctrl+C**: Cancel current command
- **Ctrl+L**: Clear terminal
- **Ctrl+R**: Search command history
- **Ctrl+Shift+P**: Open command palette

## Building for Production

To build the frontend for production:

```bash
cd ai-terminal
npm run build
```

This creates a `dist` directory with optimized files ready for deployment.

For backend production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Installation

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd AI-Terminal
```

### 2. Set up the Python backend
```bash
# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp env.example .env
# Edit .env and add your Google AI API key
```

### 3. Set up the React frontend
```bash
cd ai-terminal
npm install
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Required: Google AI API Key
GOOGLE_API_KEY=your_google_api_key_here

# Optional: Flask configuration
FLASK_ENV=development
FLASK_DEBUG=True
```

### Getting a Google AI API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file

## Running the Application

### 1. Start the Python backend
```bash
python app.py
```
The backend will run on `http://127.0.0.1:5000`

### 2. Start the React frontend
```bash
cd ai-terminal
npm run dev
```
The frontend will run on `http://localhost:5173`

## Usage

### Basic Commands
- `ls` - List directory contents
- `cd <path>` - Change directory
- `pwd` - Print working directory
- `mkdir <name>` - Create directory
- `rm <file>` - Remove file
- `help` - Show help information

### AI Commands
Type natural language commands like:
- "Show me all Python files"
- "Find files larger than 100MB"
- "List running processes"
- "Check disk usage"

### Keyboard Shortcuts
- `Ctrl+Shift+P` - Open command palette
- `↑/↓` - Navigate command history
- `Tab` - Auto-complete commands/paths
- `Enter` - Execute command

## Security Features

- **Command Whitelist**: Only allows safe, predefined commands
- **Input Validation**: Prevents malicious input
- **Path Traversal Protection**: Blocks dangerous path operations
- **Command Length Limits**: Prevents buffer overflow attacks

## Development

### Project Structure
```
AI-Terminal/
├── app.py                 # Python Flask backend
├── requirements.txt       # Python dependencies
├── env.example           # Environment variables template
├── README.md             # This file
└── ai-terminal/          # React frontend
    ├── src/
    │   ├── PyTerminal.jsx # Main terminal component
    │   ├── main.jsx      # React entry point
    │   └── index.css     # Styles
    ├── package.json      # Node dependencies
    └── vite.config.js    # Vite configuration
```

### Available Scripts

#### Frontend (ai-terminal/)
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Troubleshooting

### Common Issues

1. **"AI features are not configured"**
   - Make sure you've set the `GOOGLE_API_KEY` in your `.env` file
   - Verify the API key is valid

2. **"Connection Error: Is the Python server running?"**
   - Ensure the Python backend is running on port 5000
   - Check that no firewall is blocking the connection

3. **Command not found**
   - The command might not be in the allowed whitelist
   - Try using a different phrasing for AI commands

## Deployment

This project is configured for easy deployment:

- **Backend**: Ready for deployment on [Render](https://render.com)
- **Frontend**: Ready for deployment on [Vercel](https://vercel.app)

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Google Gemini AI for natural language processing
- React and Vite for the frontend framework
- Flask for the Python backend
- Tailwind CSS for styling
