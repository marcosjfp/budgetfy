<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 💰 Budgetfy

A modern budget and expense management application designed for seamless group sharing and financial tracking.

## 🚀 Features

- **🔐 Secure Authentication**: User registration and login powered by JWT and bcrypt.
- **👥 Group Management**: Create shared groups to manage expenses with friends or family.
- **💸 Expense Tracking**: Easily add and categorize expenses within specific groups.
- **📊 Data Visualization**: Dynamic, interactive charts to visualize spending patterns using Recharts.
- **✨ Modern UI/UX**: A responsive and polished interface built with Tailwind CSS 4 and smooth animations from Motion.

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations**: [Motion](https://motion.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)

### **Backend**
- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express](https://expressjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)

### **Security & Utilities**
- **Authentication**: JSON Web Tokens (JWT) & bcryptjs
- **Environment**: Dotenv for configuration
- **Development**: tsx for seamless TypeScript execution and Concurrently for running parallel processes

## 🏃 Getting Started

### **Prerequisites**
- **Node.js** (v18 or higher recommended)
- **PostgreSQL** instance (local or hosted)

### **Installation**

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd budgetfy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env.local` file in the root directory (referencing `.env.example`) and configure your credentials:
   ```env
   DATABASE_URL=postgresql://your_user:your_password@localhost:5432/budgetfy
   JWT_SECRET=your_secure_random_string
   ```

4. **Initialize Database:**
   Push the Drizzle schema to your PostgreSQL database:
   ```bash
   npm run db:push
   ```

### **Running the Application**

To start both the frontend (Vite) and backend (Express) servers simultaneously, run:
```bash
npm run dev
```
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 📜 Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts frontend and backend concurrently in watch mode. |
| `npm run build` | Compiles the frontend application for production. |
| `npm run db:push` | Synchronizes the Drizzle schema with the database. |
| `npm run lint` | Runs TypeScript type checking. |
| `npm run clean` | Deletes the production `dist` directory. |
| `npm run preview` | Locally previews the production build. |

---

Built with ❤️ for better financial management.
