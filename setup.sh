#!/bin/bash

# AI-Terminal Setup Script
# This script sets up both backend and frontend components

echo "🚀 Setting up AI-Terminal..."
echo "============================"

# Check for Python
if command -v python3 &>/dev/null; then
    PYTHON_CMD=python3
elif command -v python &>/dev/null; then
    PYTHON_CMD=python
else
    echo "❌ Python not found. Please install Python 3.9 or higher."
    exit 1
fi

# Check Python version
PY_VERSION=$($PYTHON_CMD -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
if (( $(echo "$PY_VERSION < 3.9" | bc -l) )); then
    echo "❌ Python version $PY_VERSION detected. Please upgrade to Python 3.9 or higher."
    exit 1
fi

echo "✅ Python $PY_VERSION detected"

# Check for Node.js
if ! command -v node &>/dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if (( $NODE_VERSION < 18 )); then
    echo "❌ Node.js version v$NODE_VERSION detected. Please upgrade to Node.js 18 or higher."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Setup virtual environment
echo -e "\n📦 Setting up Python virtual environment..."
$PYTHON_CMD -m venv venv
source venv/bin/activate

# Install Python dependencies
echo -e "\n📦 Installing Python dependencies..."
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "\n🔑 Creating .env file..."
    cp env.example .env
    echo "⚠️  Please edit .env file and add your Google API key"
else
    echo "✅ .env file already exists"
fi

# Set up frontend
echo -e "\n🖥️  Setting up frontend..."
cd ai-terminal

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Check if .env.development exists, if not create it
if [ ! -f .env.development ]; then
    echo -e "\n🔑 Creating .env.development file..."
    echo "VITE_API_URL=http://localhost:5000" > .env.development
else
    echo "✅ .env.development file already exists"
fi

# Return to root directory
cd ..

echo -e "\n✅ Setup completed!"
echo -e "\nTo run the backend:"
echo "  source venv/bin/activate  # On Windows: venv\\Scripts\\activate"
echo "  python app.py"
echo -e "\nTo run the frontend:"
echo "  cd ai-terminal"
echo "  npm run dev"
echo -e "\nAccess the terminal at: http://localhost:5173"
