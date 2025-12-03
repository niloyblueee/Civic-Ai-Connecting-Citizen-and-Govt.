# VisionX (NATIONAL INNOVATION CHALLENGE 2025)
## Finalist project of the National Innovation Challenge 2025


A comprehensive civic engagement platform built with React (Vite) and Node.js, enabling citizens to report issues, government authorities to manage and resolve problems, and departments to track and address community concerns efficiently.

## Features

- 🔐 **Multi-Role Authentication System**
  - User registration and login
  - Google OAuth integration
  - JWT-based authentication
  - Role-based access control (Citizen, Government Authority, Admin, Department-specific roles)

- 🏛️ **Government Authority Dashboard**
  - Issue verification and management
  - Event organization
  - Reward distribution system
  - Problem tracking and resolution

- 👥 **Citizen Portal**
  - Issue submission with media uploads
  - Progress tracking
  - Contribution history
  - Leaderboard and rewards system

- 🚨 **Department-Specific Modules**
  - Police Department
  - Health Department
  - Fire Department
  - Water Department
  - Electricity Department

- 🤖 **AI-Powered Features**
  - AI-assisted issue suggestions
  - Automated issue categorization
  - Smart recommendations

- 🗺️ **Interactive Maps**
  - Heatmap visualization for issues
  - Location-based issue tracking
  - Geographic data analysis

- 🎨 **Modern UI/UX**
  - Beautiful gradient backgrounds
  - Smooth animations with Framer Motion
  - Responsive design
  - Toast notifications
  - Interactive data visualizations

- 🛡️ **Security**
  - Password hashing with bcrypt
  - JWT token authentication
  - Input validation
  - CORS protection
  - Rate limiting
  - Helmet security headers

## Tech Stack

### Frontend
- **React 19** with Vite
- **React Router** for navigation
- **Framer Motion** for animations
- **React Hot Toast** for notifications
- **React Icons** for icons
- **Google OAuth** integration
- **Leaflet & React Leaflet** for maps
- **Leaflet.heat** for heatmap visualization
- **Bootstrap** for UI components
- **Axios** for API requests

### Backend
- **Node.js** with Express
- **MySQL** database (with mysql2 for Promise support)
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Multer** for file uploads (profile images, issue media)
- **Express Validator** for input validation
- **Helmet** for security headers
- **Compression** for response compression
- **Express Rate Limit** for API rate limiting
- **Google Auth Library** for OAuth
- **OpenAI Integration** (optional, for AI features)

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MySQL database
- Google OAuth credentials (optional, for Google login)
- OpenAI API key (optional, for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Technovation_TheLumiNos
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

4. **Set up environment variables**
   
   **Frontend** (create `.env` file in frontend folder, copy from `env.example`):
   ```env
   VITE_GOOGLE_CLIENT_ID=your-google-client-id
   VITE_API_URL=http://localhost:5000
   ```

   **Backend** (create `.env` file in backend folder, copy from `env.example`):
   ```env
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   FRONTEND_URLS=http://localhost:5173,http://127.0.0.1:5173
   
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=technovation_luminos
   
   # OR use Railway/MySQL URI
   DB_URL=mysql://user:password@host:port/database
   
   # Authentication
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   GOOGLE_CLIENT_ID=your-google-client-id
   
   # Optional: AI Features
   OPENAI_API_KEY=your-openai-api-key
   ```

5. **Set up the database**
   
   **Option 1: Using XAMPP**
   - Start Apache and MySQL in XAMPP
   - Create a database called `technovation_luminos` using phpMyAdmin or MySQL Shell
   
   **Option 2: Using setup script**
   ```bash
   cd backend
   node setup-db.js
   ```

6. **Start the development servers**
   
   **Backend** (in backend folder):
   ```bash
   npm start
   # or for development with auto-reload
   npm run dev
   ```
   
   **Frontend** (in frontend folder):
   ```bash
   npm run dev
   ```

7. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

## Project Structure

```
Technovation_TheLumiNos/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/          # Authentication components
│   │   │   ├── admin/         # Admin dashboard components
│   │   │   ├── features/      # Feature-specific components
│   │   │   ├── Dashboard.jsx
│   │   │   └── CitizenDashboard.jsx
│   │   ├── citizen/           # Citizen portal components
│   │   │   ├── CitizenLandingPage.jsx
│   │   │   ├── IssueSubmission.jsx
│   │   │   ├── TrackProgress.jsx
│   │   │   └── Contribution.jsx
│   │   ├── authority/         # Government authority components
│   │   │   ├── GovtDashboard.jsx
│   │   │   ├── IssueVerification.jsx
│   │   │   ├── ArrangeEvents.jsx
│   │   │   ├── GovtProblemPage.jsx
│   │   │   └── GovtRewardPage.jsx
│   │   ├── departments/       # Department-specific modules
│   │   │   ├── PoliceDepartment.jsx
│   │   │   ├── HealthDepartment.jsx
│   │   │   ├── FireDepartment.jsx
│   │   │   ├── WaterDepartment.jsx
│   │   │   ├── ElectricityDepartment.jsx
│   │   │   └── *IssueDetails.jsx (for each department)
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── routes/
│   │   ├── auth.js           # Authentication endpoints
│   │   ├── issues.js         # Issue management
│   │   ├── submit-issues.js  # Issue submission
│   │   ├── events.js         # Event management
│   │   ├── notifications.js  # Notification system
│   │   ├── leaderboard.js    # Leaderboard & rewards
│   │   └── ai-suggest.js     # AI-powered suggestions
│   ├── services/
│   │   ├── issue-ai.js       # AI service for issues
│   │   └── issue-collection.js
│   ├── scripts/
│   │   ├── backfill-issue-ai.js
│   │   └── rebuild-collections.js
│   ├── migrations/           # Database migrations
│   │   └── indexes_001.sql
│   ├── DB_BACKUP/           # Database backup utilities
│   │   ├── backup_express.js
│   │   ├── mybackup.sql
│   │   └── restore.js
│   ├── uploads/             # User-uploaded files
│   │   └── profile/
│   ├── server.js
│   ├── schema.sql           # Database schema
│   ├── setup-db.js          # Database setup script
│   ├── reset-db.js          # Database reset script
│   ├── db-change-log.js
│   ├── Dockerfile
│   └── package.json
├── PLAN/                    # Project planning documents
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout
- `POST /api/auth/change-password` - Change password

### Issues Management
- `GET /api/issues` - Get all issues (with filters)
- `POST /api/submit-issues` - Submit a new issue
- `GET /api/issues/:id` - Get issue details
- `PUT /api/issues/:id` - Update issue status/details
- `DELETE /api/issues/:id` - Delete an issue

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create a new event
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Leaderboard & Rewards
- `GET /api/leaderboard` - Get leaderboard rankings
- `POST /api/leaderboard/reward` - Award points to users

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id/read` - Mark as read

### AI Features
- `POST /api/ai-suggest` - Get AI-powered issue suggestions
- AI-assisted categorization and recommendations

### Health Check
- `GET /api/health` - API health status

## User Roles

- **Citizen**: Regular users who can submit issues, track progress, view contributions, and earn rewards
- **Government Authority**: Officials who verify issues, manage events, distribute rewards, and oversee problem resolution
- **Admin**: System administrators with full access to manage users, roles, and system settings
- **Department Roles**: Specialized roles for different departments (Police, Health, Fire, Water, Electricity) with department-specific permissions

## Database Management

### Backup Database
```bash
cd backend
npm run backup
```
This creates a backup in `backend/DB_BACKUP/mybackup.sql`

### Restore Database
```bash
cd backend
npm run restore
```
This restores from `backend/DB_BACKUP/mybackup.sql`

### Reset Database
```bash
cd backend
npm run reset-db
```
This drops and recreates all tables (⚠️ Warning: This will delete all data!)

## Deployment

The project includes Dockerfiles for both frontend and backend:

### Docker Build
```bash
# Backend
cd backend
docker build -t visionx-backend .

# Frontend
cd frontend
docker build -t visionx-frontend .
```

### Environment Setup for Production
- Ensure all environment variables are properly configured
- Update `FRONTEND_URLS` in backend .env to include production URLs
- Set `NODE_ENV=production`
- Use strong, unique values for `JWT_SECRET`
- Configure proper CORS origins

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Scripts

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run setup` - Run setup script

### Backend
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run setup-db` - Setup database
- `npm run reset-db` - Reset database (⚠️ deletes all data)
- `npm run backup` - Backup database
- `npm run restore` - Restore database from backup

## Key Features Breakdown

### For Citizens
- 📝 Submit issues with photos and location
- 📊 Track issue progress in real-time
- 🏆 Earn reward points for contributions
- 📱 View contribution history
- 🗺️ See issues on interactive maps

### For Government Authorities
- ✅ Verify and approve citizen-submitted issues
- 📅 Organize community events
- 🎁 Distribute rewards to active citizens
- 📈 Monitor problem resolution progress
- 📊 Access analytics and reports

### For Departments
- 🔍 View department-specific issues
- ⚡ Quick issue resolution workflow
- 📝 Update issue status and details
- 📊 Track department performance metrics
- 🚨 Priority-based issue handling

## Technologies Used

- **Frontend Framework**: React 19 with Vite for fast development
- **Routing**: React Router v7 for client-side routing
- **State Management**: Context API for global state
- **Styling**: CSS Modules + Bootstrap for responsive design
- **Animations**: Framer Motion for smooth transitions
- **Maps**: Leaflet for interactive maps and heatmaps
- **HTTP Client**: Axios for API communication
- **Backend Framework**: Express.js for RESTful API
- **Database**: MySQL with mysql2 for Promise-based queries
- **Authentication**: JWT + Google OAuth
- **File Uploads**: Multer for handling media files
- **Security**: Helmet, CORS, Rate Limiting

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Team

VisionX - TheLumiNos Team

## Support

For support or questions, please create an issue in the repository or contact the development team.
