# BookNook Server – REST API Backend

Backend API service for **BookNook – A Small Online Library**, built with Express.js, MongoDB, and JSON Web Token (JWT) authentication.

## 🚀 Live Site & API URLs
- **Live Client Web App**: [https://booknook-abc.vercel.app](https://booknook-abc.vercel.app)
- **Live Server API**: [https://booknook-servers.vercel.app](https://booknook-servers.vercel.app)

---

## 🌟 Key Features
- **Secure JWT Authentication**: Role-aware bearer token authentication with bcrypt password hashing and Google social login compatibility.
- **Robust Book Catalog (CRUD)**: Complete endpoints to browse, search, filter by genre, add, edit, and delete books.
- **Smart Borrowing System**: Tracks active borrows, enforces user-specific limits, and calculates due dates.
- **Inventory Concurrency ($inc)**: Uses atomic MongoDB `$inc` operations to decrement available copies on borrow and increment upon return.
- **No Double Borrow Guard**: Enforces business rules preventing users from borrowing the exact same title simultaneously.
- **Hybrid Database Architecture**: Natively connects to MongoDB Atlas / local MongoDB with an automatic resilient zero-config local storage fallback.

---

## 📋 API Endpoints

### Public Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status and route directory |
| `GET` | `/books` | List books (supports `sort=newest`, `limit=6`, `category`, `search`) |
| `GET` | `/books/:id` | Retrieve single book details |
| `POST` | `/auth/register` | Register new user with strict password validation |
| `POST` | `/auth/login` | Login user and issue JWT bearer token |
| `POST` | `/auth/google` | Social login via Google account profile |

### Protected Endpoints (Requires `Authorization: Bearer <token>`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/auth/me` | Fetch authenticated user profile |
| `POST` | `/books` | Add a new book to the library collection |
| `PATCH` | `/books/:id` | Update an existing book (owner restricted) |
| `DELETE` | `/books/:id` | Remove a book from the library (owner restricted) |
| `POST` | `/borrows` | Borrow a book (atomic copy decrement & duplicate check) |
| `GET` | `/borrows` | Retrieve all active borrows for the logged-in user |
| `DELETE` | `/borrows/:id` | Return a borrowed book (atomic copy increment) |

---

## 🛠️ Environment Variables
Create a `.env` file in the `server` root:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/booknook?retryWrites=true&w=majority
JWT_SECRET=jwt_secret_key_here
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

---

## 💻 Running Locally
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start
```
