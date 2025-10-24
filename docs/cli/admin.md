# Admin Dashboard
 
The admin dashboard provides a real-time web interface to monitor the status of all services in your polyglot monorepo.
 
## Usage
 
Launch the admin dashboard from within a polyglot workspace:
 
```bash
create-polyglot admin
```
 
This will:
- Start a web server on port 8080 (by default)
- Check the status of all services every 5 seconds
- Automatically open your browser to the dashboard
- Display service status with visual indicators
 
## Options
 
### Port Configuration
```bash
create-polyglot admin --port 9000
```
Change the port the dashboard runs on (default: 8080)
 
### Refresh Interval
```bash
create-polyglot admin --refresh 10000
```
Set how often to check service status in milliseconds (default: 5000ms, minimum: 1000ms)
 
### Disable Auto-Open Browser
```bash
create-polyglot admin --no-open
```
Start the dashboard without automatically opening your browser
 
## Dashboard Features
 
### Service Status Indicators
- 🟢 **UP** - Service is responding (HTTP status < 400)
- 🔴 **DOWN** - Service is not reachable (connection failed)
- 🟡 **ERROR** - Service responded with an error (HTTP status >= 400)
 
### Service Information
Each service card displays:
- Service name and type
- Current status with visual indicator
- Port number
- File system path
- Last status check timestamp
- Clickable URL to access the service directly
 
### Real-time Updates
- Automatic page refresh based on configured interval
- Live status updates in the terminal
- Animated service cards with staggered loading
 
### API Endpoint
The dashboard also provides a JSON API endpoint at `/api/status` for programmatic access to service status data.
 
## Examples
 
### Basic Usage
```bash
# Start dashboard with defaults
create-polyglot admin
 
# Dashboard will be available at http://localhost:8080
# Services checked every 5 seconds
# Browser opens automatically
```
 
### Custom Configuration
```bash
# Custom port and refresh rate, no auto-open
create-polyglot admin --port 3333 --refresh 2000 --no-open
```
 
### Development Workflow
1. Run `create-polyglot dev` to start your services
2. In another terminal, run `create-polyglot admin` to monitor them
3. Access the dashboard to see real-time status of all services
 
## Requirements
 
- Must be run from within a polyglot workspace (contains `polyglot.json`)
- Services are checked via HTTP requests to their configured ports
- Services should implement basic HTTP endpoints to respond to status checks
 
## Technical Details
 
The admin dashboard:
- Uses Node.js built-in `http` module for the web server
- Performs HTTP GET requests to check service health
- Generates a responsive HTML dashboard with CSS Grid
- Includes automatic refresh and smooth animations
- Provides both human-readable and JSON API interfaces
 
## Troubleshooting
 
### "polyglot.json not found" Error
This command must be run from within a directory created by `create-polyglot init`.
 
### Services Always Show as "DOWN"
- Ensure your services are running (`create-polyglot dev`)
- Check that services respond to HTTP requests on their configured ports
- Verify firewall settings aren't blocking local connections
 
### Browser Doesn't Open Automatically
Use the `--no-open` flag if you prefer to open the browser manually, or check your system's default browser configuration.