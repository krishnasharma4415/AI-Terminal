# AI Terminal

A modern, AI-powered terminal interface built with React and Python Flask. This terminal allows you to execute commands using natural language through Google's Gemini AI.

## Features

- 🤖 **AI-Powered Commands**: Convert natural language to shell commands
- 🖥️ **Multi-Tab Support**: Multiple terminal sessions with persistent state
- ⌨️ **Auto-Complete**: Tab completion for commands and file paths
- 🎨 **Modern UI**: Beautiful terminal interface with custom animations
- 🔒 **Security**: Command validation and whitelist protection
- 📱 **Responsive**: Works on desktop and mobile devices

## Prerequisites

- Node.js (v16 or higher)
- Python 3.8 or higher
- Google AI API key (for AI features)

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
