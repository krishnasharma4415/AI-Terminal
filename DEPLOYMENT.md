# AI-Terminal Deployment Guide

This guide provides detailed instructions for deploying the AI-Terminal application to production environments.

## Deployment Stack Options

- **Option 1**: Render (Backend) + Vercel (Frontend)
- **Option 2**: Docker Containers
- **Option 3**: Traditional VPS/Cloud Server

## Prerequisites

- A GitHub account
- A Google AI API key (Gemini 1.5)
- Accounts on deployment platforms (if using Option 1)

## Option 1: Render + Vercel Deployment (Recommended)

### Backend Deployment on Render

1. **Prepare your repository**:
   - Ensure your code is in a GitHub repository
   - Make sure `requirements.txt` is up to date
   - Verify that `Procfile` is present with: `web: gunicorn app:app`

2. **Deploy on Render**:
   - Create a new Web Service on Render
   - Connect your GitHub repository
   - Configure the service:
     - **Name**: `ai-terminal-backend`
     - **Runtime**: Python 3.9
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `gunicorn app:app`
   - Add environment variables:
     - `GOOGLE_API_KEY`: Your Google AI API key
     - `FLASK_ENV`: production
     - `CORS_ORIGINS`: Your frontend URL (after Vercel deployment)
     
3. **Test the backend deployment**:
   - Access your backend URL (e.g., `https://ai-terminal-backend.onrender.com/health`)
   - Verify that the health check endpoint returns a successful response

### Frontend Deployment on Vercel

1. **Prepare your frontend**:
   - Create a production environment file:
     ```bash
     cd ai-terminal
     cp .env.example .env.production
     ```
   - Edit `.env.production` to point to your backend URL:
     ```
     VITE_API_URL=https://ai-terminal-backend.onrender.com
     ```

2. **Deploy on Vercel**:
   - Import your GitHub repository into Vercel
   - Configure the project:
     - **Framework Preset**: Vite
     - **Root Directory**: ai-terminal
     - **Build Command**: npm run build
     - **Output Directory**: dist
   - Deploy the project
   
3. **Configure custom domain** (optional):
   - In Vercel project settings, add your custom domain
   - Update the `CORS_ORIGINS` in your backend settings if you use a custom domain

## Option 2: Docker Deployment

Docker provides an easy way to containerize both the frontend and backend services.

### Backend Dockerfile

1. **Create a Dockerfile in the project root**:

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_ENV=production
ENV FLASK_DEBUG=False

EXPOSE 5000

# For WebSocket support with Gunicorn
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "-b", "0.0.0.0:5000", "app:app"]
```

### Frontend Dockerfile

1. **Create a Dockerfile in the ai-terminal directory**:

```dockerfile
# Build stage
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

2. **Create an nginx.conf file**:

```
server {
    listen 80;
    
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

### Docker Compose Setup

1. **Create a docker-compose.yml file**:

```yaml
version: '3'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - CORS_ORIGINS=http://localhost:80
    ports:
      - "5000:5000"
    restart: always
  
  frontend:
    build:
      context: ./ai-terminal
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: always
```

2. **Run with Docker Compose**:

```bash
# Set your Google API key in .env first
echo "GOOGLE_API_KEY=your-api-key-here" > .env

# Start containers
docker-compose up -d
```

## Option 3: Traditional VPS Deployment

For deployment on a standard VPS or cloud instance (AWS EC2, DigitalOcean Droplet, etc.)

### Server Setup

1. **Provision a server** with Ubuntu 20.04 or later
2. **Install dependencies**:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and related tools
sudo apt install -y python3 python3-venv python3-pip nginx

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install process manager for backend
sudo npm install -g pm2
```

### Backend Deployment

1. **Clone your repository**:

```bash
git clone https://github.com/your-username/AI-Terminal.git
cd AI-Terminal
```

2. **Set up Python environment**:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
```

3. **Create .env file**:

```bash
cp env.example .env
# Edit .env with your favorite editor
nano .env  # Add GOOGLE_API_KEY and set CORS_ORIGINS
```

4. **Set up PM2 for process management**:

```bash
pm2 start "gunicorn -w 4 -b 127.0.0.1:5000 app:app" --name ai-terminal-backend
pm2 save
pm2 startup
```

### Frontend Deployment

1. **Build the frontend**:

```bash
cd ai-terminal
npm install
cp .env.example .env.production
# Edit .env.production to point to http://your-server-ip:5000
nano .env.production
npm run build
```

2. **Configure Nginx**:

```bash
sudo nano /etc/nginx/sites-available/ai-terminal
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Or your server IP

    # Frontend
    location / {
        root /home/ubuntu/AI-Terminal/ai-terminal/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. **Enable the site and restart Nginx**:

```bash
sudo ln -s /etc/nginx/sites-available/ai-terminal /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

4. **Set up SSL with Certbot** (recommended):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Security Considerations

1. **API Key Protection**:
   - Never commit API keys to version control
   - Use environment variables or secret management services

2. **Rate Limiting**:
   - Consider implementing rate limiting to prevent abuse

3. **HTTPS**:
   - Always use HTTPS in production
   - Set up proper SSL/TLS certificates (Let's Encrypt is free)

4. **CORS Configuration**:
   - Restrict CORS to only your frontend domain in production

## Troubleshooting

1. **Common Issues**:
   - **CORS errors**: Ensure `CORS_ORIGINS` is set correctly in backend
   - **404 Not Found**: Check Nginx configuration and path to static files
   - **API Key errors**: Verify your Google API key is valid and has access to Gemini 1.5
   - **Connection failures**: Check firewall settings and network configuration

2. **Checking Logs**:
   - Backend logs: `pm2 logs ai-terminal-backend`
   - Nginx logs: `sudo tail -f /var/log/nginx/error.log`
   - Frontend: Check browser console for errors

1. **Environment Variables**:
   - Make sure your API keys and sensitive data are loaded from environment variables
   - Use python-dotenv for local development

2. **Production Settings**:
   - Set `debug=False` for production
   - Set proper CORS settings

3. **Requirements File**:
   - Make sure your `requirements.txt` is up to date:
     ```bash
     pip freeze > requirements.txt
     ```

4. **Procfile for Render**:
   - Create a file named `Procfile` with the content:
     ```
     web: gunicorn app:app
     ```

### Frontend Preparation (React/Vite)

1. **Environment Variables**:
   - Create separate env files for development and production:
     - `.env.development` for local development
     - `.env.production` for production settings

2. **API URL Configuration**:
   - Use environment variables for the backend URL
   - Make sure your code uses `import.meta.env.VITE_BACKEND_URL` for API calls

## Phase 2: Deploying the Backend on Render

1. **Create a New Web Service**:
   - Sign in to Render and click "New +"
   - Select "Web Service"
   - Connect your GitHub repository

2. **Configure the Service**:
   - Name: `ai-terminal-backend`
   - Environment: Python
   - Region: Choose closest to your users
   - Branch: `main`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
   - Instance Type: Free

3. **Environment Variables**:
   - Click "Advanced" > "Environment Variables"
   - Add `GOOGLE_API_KEY` with your API key value
   - Add `PYTHON_VERSION` with your Python version (e.g. `3.9.1`)
   - Add `PORT` with value `10000` (Render will override this)

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for the build and deployment process to complete
   - Note your service URL (e.g., `https://ai-terminal-backend.onrender.com`)

## Phase 3: Deploying the Frontend on Vercel

1. **Import Your GitHub Repository**:
   - Sign in to Vercel and click "Add New" > "Project"
   - Select your repository
   - Vercel should automatically detect it's a Vite project

2. **Configure Project**:
   - Framework preset: Vite
   - Root directory: `ai-terminal` (if using the subdir)
   - Build command: `npm run build`
   - Output directory: `dist`

3. **Environment Variables**:
   - Add `VITE_BACKEND_URL` with your Render backend URL
   - Make sure to include the full URL with https

4. **Deploy**:
   - Click "Deploy"
   - Wait for the build process to complete
   - Vercel will give you a URL for your deployed frontend

## Phase 4: Testing and Troubleshooting

1. **Test Your Deployment**:
   - Visit your Vercel URL
   - Try basic commands: `ls`, `pwd`, etc.
   - Try AI commands: "show me all files", "system information"

2. **Check Logs for Errors**:
   - Render Dashboard > Your Service > Logs
   - Vercel Dashboard > Your Project > Deployments > Logs

3. **Common Issues**:
   - CORS errors: Make sure your backend has proper CORS settings
   - API key issues: Verify environment variables are set correctly
   - 500 errors: Check backend logs for Python exceptions

## Continuous Deployment

Both Render and Vercel support automatic deployment from your GitHub repository. Any push to your main branch will trigger a new deployment.

## Custom Domains (Optional)

1. **Purchase a Domain**:
   - Use Namecheap, Google Domains, etc.

2. **Configure DNS**:
   - Add records for your Vercel frontend
   - Add records for your Render backend (if needed)

3. **Update Environment Variables**:
   - Update `VITE_BACKEND_URL` to use your custom domain

## Security Considerations

1. **Rate Limiting**:
   - Add rate limiting to protect your API
   - Implement request throttling for `/command` endpoint

2. **Authentication**:
   - Consider adding user authentication for production use
   - Use OAuth or similar for user login

3. **Monitoring**:
   - Set up monitoring for your backend service
   - Configure alerts for errors or downtime

## WebSocket Deployment Considerations

The AI-Terminal application now includes WebSocket support for real-time command output streaming. Keep these considerations in mind when deploying:

### Render Deployment

For Render deployment, update your `Start Command` to:

```
gunicorn --worker-class eventlet -w 1 app:app
```

Note that we're using only one worker with the `eventlet` worker class for proper WebSocket support.

### Load Balancers & Proxies

If you're using load balancers or proxies (like Nginx), ensure they're configured to support WebSockets:

For **Nginx**, add:

```nginx
location / {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

### Timeout Configuration

Long-running commands require extended timeouts:

- For **Gunicorn**, set timeout parameters: `--timeout 120`
- For **Nginx**, configure: `proxy_read_timeout 120s;`
- For **Load Balancers**, increase timeout settings to at least 2 minutes

### Performance Considerations

- **Scale horizontally**: Deploy multiple instances of the backend API as needed
- **Consider database caching**: Add Redis caching if implementing persistent storage
- **CDN for static assets**: Use a CDN for frontend assets to improve load times
- **Optimize AI calls**: Implement request throttling for the AI service
- **Log rotation**: Set up log rotation to prevent disk space issues
- **WebSocket connections**: Monitor active WebSocket connections to avoid resource depletion
